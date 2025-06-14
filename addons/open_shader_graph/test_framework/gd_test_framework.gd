@tool
class_name TestFramework extends Resource

# TestDiscovery class - handles test discovery and registration
class TestDiscovery:
	static func register_all_tests(test_framework: TestFramework, test_directories: Array[String] = ["res://tests/"]):
		print("TestRunner: Discovering and registering tests...")
		
		var discovered_tests = discover_tests(test_directories)
		
		for test_class in discovered_tests:
			var test_instance = test_class.new()
			test_framework.register_test(test_instance)
		
		print("TestRunner: Test discovery completed - found %d test classes" % discovered_tests.size())

	static func discover_tests(test_directories: Array[String]) -> Array:
		var test_classes = []
		
		for directory_path in test_directories:
			print("TestRunner: Scanning directory: %s" % directory_path)
			var discovered_in_dir = _scan_directory_for_tests(directory_path)
			test_classes.append_array(discovered_in_dir)
				
		return test_classes

	static func _scan_directory_for_tests(directory_path: String) -> Array:
		var test_classes = []
		var dir = DirAccess.open(directory_path)
		
		if dir == null:
			print("TestRunner: Directory not found: %s" % directory_path)
			return test_classes
		
		dir.list_dir_begin()
		var file_name = dir.get_next()
		
		while file_name != "":
			var full_path = directory_path + "/" + file_name
			
			if dir.current_is_dir() and not file_name.begins_with("."):
				# Recursively scan subdirectories
				var subdir_tests = _scan_directory_for_tests(full_path)
				test_classes.append_array(subdir_tests)
			elif file_name.ends_with(".gd"):
				# Check if this is a test file
				var test_class = _load_and_validate_test_file(full_path)
				if test_class != null:
					test_classes.append(test_class)
			
			file_name = dir.get_next()
		
		return test_classes

	static func _load_and_validate_test_file(file_path: String):
		var script = load(file_path)
		
		if script == null:
			print("TestRunner: Failed to load script: %s" % file_path)
			return null
		
		# Check if the script extends BaseTest
		if not _script_extends_base_test(script):
			return null
		
		print("TestRunner: Found test class: %s" % file_path)
		return script

	static func _script_extends_base_test(script: Script) -> bool:
		var current_script = script
		
		while current_script != null:
			var base_script = current_script.get_base_script()
			
			if base_script != null:
				# Check if the base script is BaseTest
				var base_script_path = base_script.get_path()
				if base_script_path.ends_with("base_test.gd"):
					return true
				
				# Check class name if available
				if current_script.get_global_name() == "BaseTest":
					return true
			
			current_script = base_script
		
		return false

	static func create_test_framework_resource(test_directories: Array[String] = ["res://tests/"]) -> TestFramework:
		var framework = TestFramework.new()
		TestDiscovery.register_all_tests(framework, test_directories)
		return framework

# TestFramework class - main test execution framework

var registered_tests: Array = []
var test_results: Array = []

@export var run_tests: bool:
	set(value):
		run_tests = false
		execute_all_tests()

@export var show_detailed_output: bool = true
@export var stop_on_first_failure: bool = false
@export var test_directories: Array[String] = ["res://tests/"]

func _run_tests_pressed(value: bool):
	if value and Engine.is_editor_hint():
		execute_all_tests()

func register_test(test):
	if test not in registered_tests:
		registered_tests.append(test)
		print("Registered test: ", test.get_test_name())

func execute_all_tests():
	print("=== Starting Test Execution ===")
	test_results.clear()
	
	# Automatically discover and register tests if none are registered
	if registered_tests.is_empty():
		print("No tests registered, performing automatic discovery...")
		TestDiscovery.register_all_tests(self, test_directories)
	
	var total_tests = 0
	var passed_tests = 0
	var failed_tests = 0
	
	# Count total tests
	for test in registered_tests:
		total_tests += test.get_test_methods().size()
	
	if total_tests == 0:
		print("No tests found to execute!")
		print("Make sure you have test files in the following directories:")
		for dir in test_directories:
			print("  - %s" % dir)
		print("Test files should extend BaseTest and have methods starting with 'test_'")
		return
	
	print("Found %d tests to execute" % total_tests)
	
	# Execute before_all for each test class
	for test in registered_tests:
		if test.has_method("before_all"):
			test.before_all()
	
	# Execute tests
	for test in registered_tests:
		var test_methods = test.get_test_methods()
		
		for method_name in test_methods:
			var start_time = Time.get_unix_time_from_system()
			var test_passed = true
			var test_message = "PASSED"
			
			# Execute before_each
			if test.has_method("before_each"):
				test.before_each()
			
			# Execute the test and catch assertion failures
			test.reset_assertions()
			test.call(method_name)
			
			if test.has_assertion_failures():
				test_passed = false
				test_message = "FAILED: " + test.get_assertion_error()
			
			# Execute after_each
			if test.has_method("after_each"):
				test.after_each()
			
			var end_time = Time.get_unix_time_from_system()
			var execution_time = end_time - start_time
			
			# Store result
			var result = {
				"test_name": method_name,
				"passed": test_passed,
				"message": test_message,
				"execution_time": execution_time
			}
			test_results.append(result)
			
			if test_passed:
				passed_tests += 1
			else:
				failed_tests += 1
			
			if show_detailed_output:
				var status = "PASS" if test_passed else "FAIL"
				print("[%s] %s - %s (%.3fs)" % [status, method_name, test_message, execution_time])
			
			if not test_passed and stop_on_first_failure:
				break
		
		if failed_tests > 0 and stop_on_first_failure:
			break
	
	# Execute after_all for each test class
	for test in registered_tests:
		if test.has_method("after_all"):
			test.after_all()
	
	# Print summary
	print("\n=== Test Results Summary ===")
	print("Total Tests: %d" % total_tests)
	print("Passed: %d" % passed_tests)
	print("Failed: %d" % failed_tests)
	print("Success Rate: %.1f%%" % (float(passed_tests) / float(total_tests) * 100.0))
	
	return test_results