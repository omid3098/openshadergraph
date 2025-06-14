@tool
extends Resource
class_name TestFramework

signal test_started(test_name: String)
signal test_completed(test_name: String, passed: bool, message: String)
signal all_tests_completed(total_tests: int, passed_tests: int, failed_tests: int)

var registered_tests: Array = []
var test_results: Array = []

@export var run_tests: bool = false: set = _run_tests_pressed
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
		TestRunner.register_all_tests(self, test_directories)
	
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
			test_started.emit(method_name)
			
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
			
			test_completed.emit(method_name, test_passed, test_message)
			
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
	
	all_tests_completed.emit(total_tests, passed_tests, failed_tests)
	
	return test_results