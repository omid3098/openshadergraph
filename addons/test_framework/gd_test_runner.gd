@tool
extends RefCounted
class_name TestRunner

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
	register_all_tests(framework, test_directories)
	return framework