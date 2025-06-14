@tool
extends RefCounted
class_name BaseTest

var _assertion_failures: Array = []
var _test_framework: TestFramework

func _init():
	# Test instances are automatically discovered and registered by TestRunner
	pass

func get_test_name() -> String:
	return get_script().get_path().get_file().get_basename()

func get_test_methods() -> Array:
	var methods = []
	var script = get_script()
	if script:
		for method in script.get_script_method_list():
			var method_name = method.name
			if method_name.begins_with("test_"):
				methods.append(method_name)
	return methods

func reset_assertions():
	_assertion_failures.clear()

func has_assertion_failures() -> bool:
	return _assertion_failures.size() > 0

func get_assertion_error() -> String:
	if _assertion_failures.size() > 0:
		return _assertion_failures[0]
	return ""

# Lifecycle methods (optional overrides)
func before_all():
	pass

func before_each():
	pass

func after_each():
	pass

func after_all():
	pass

# Assertion methods
func assert_true(condition: bool, message: String = ""):
	if not condition:
		var error_msg = "Expected true but got false"
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)

func assert_false(condition: bool, message: String = ""):
	if condition:
		var error_msg = "Expected false but got true"
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)

func assert_equal(expected, actual, message: String = ""):
	if expected != actual:
		var error_msg = "Expected '%s' but got '%s'" % [str(expected), str(actual)]
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)

func assert_not_equal(expected, actual, message: String = ""):
	if expected == actual:
		var error_msg = "Expected values to be different but both were '%s'" % str(expected)
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)

func assert_null(value, message: String = ""):
	if value != null:
		var error_msg = "Expected null but got '%s'" % str(value)
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)

func assert_not_null(value, message: String = ""):
	if value == null:
		var error_msg = "Expected non-null value but got null"
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)

func assert_greater_than(actual, expected, message: String = ""):
	if actual <= expected:
		var error_msg = "Expected '%s' to be greater than '%s'" % [str(actual), str(expected)]
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)

func assert_less_than(actual, expected, message: String = ""):
	if actual >= expected:
		var error_msg = "Expected '%s' to be less than '%s'" % [str(actual), str(expected)]
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)

func assert_contains(container, item, message: String = ""):
	var contains = false
	if container is Array:
		contains = item in container
	elif container is String:
		contains = container.find(str(item)) != -1
	elif container is Dictionary:
		contains = container.has(item)
	
	if not contains:
		var error_msg = "Expected container to contain '%s'" % str(item)
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)

func assert_type(value, expected_type: int, message: String = ""):
	var actual_type = typeof(value)
	if actual_type != expected_type:
		var error_msg = "Expected type %d but got type %d" % [expected_type, actual_type]
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)