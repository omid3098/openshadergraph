@tool
extends BaseTest
class_name MyFirstTest

var test_data: Dictionary = {}

# Called once before all tests in this class
func before_all():
	print("MyFirstTest: Setting up test suite...")
	test_data = {
		"numbers": [1, 2, 3, 4, 5],
		"name": "Test Suite",
		"version": 1.0
	}

# Called before each individual test
func before_each():
	print("MyFirstTest: Preparing for test...")

# Called after each individual test
func after_each():
	print("MyFirstTest: Cleaning up after test...")

# Called once after all tests in this class
func after_all():
	print("MyFirstTest: Tearing down test suite...")
	test_data.clear()

# Test basic arithmetic operations
func test_arithmetic_operations():
	var result = 10 + 5
	assert_equal(15, result, "Addition should work correctly")
	
	result = 10 - 5
	assert_equal(5, result, "Subtraction should work correctly")
	
	result = 10 * 5
	assert_equal(50, result, "Multiplication should work correctly")

# Test string operations
func test_string_operations():
	var greeting = "Hello"
	var target = "World"
	var full_greeting = greeting + ", " + target + "!"
	
	assert_equal("Hello, World!", full_greeting, "String concatenation should work")
	assert_contains(full_greeting, "World", "Result should contain 'World'")
	assert_type(full_greeting, TYPE_STRING, "Result should be a string")

# Test array operations with test data
func test_array_operations():
	var numbers = test_data["numbers"]
	
	assert_not_null(numbers, "Numbers array should not be null")
	assert_type(numbers, TYPE_ARRAY, "Numbers should be an array")
	assert_equal(5, numbers.size(), "Array should have 5 elements")
	assert_contains(numbers, 3, "Array should contain the number 3")
	
	# Test array manipulation
	var doubled = []
	for num in numbers:
		doubled.append(num * 2)
	
	assert_equal([2, 4, 6, 8, 10], doubled, "Doubled array should be correct")

func test_failing_test():
	assert_true(false, "This test should fail")