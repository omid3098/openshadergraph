extends GutTest

# Simple verification test to ensure GUT is working correctly
class_name TestVerification

func before_all():
	gut.p("Starting verification tests")

func test_gut_is_working():
	# Basic test to verify GUT framework is functioning
	assert_true(true, "GUT framework should be working")
	assert_eq(1 + 1, 2, "Basic math should work")

func test_strings():
	# Test string assertions
	assert_eq("hello", "hello", "Strings should be equal")
	assert_ne("hello", "world", "Different strings should not be equal")

func test_arrays():
	# Test array assertions
	var array1: Array = [1, 2, 3]
	var array2: Array = [1, 2, 3]
	var array3: Array = [4, 5, 6]
	
	assert_eq(array1, array2, "Equal arrays should be equal")
	assert_ne(array1, array3, "Different arrays should not be equal")

func test_node_creation():
	# Test node creation and cleanup
	var test_node: Node = autofree(Node.new())
	test_node.name = "TestNode"
	
	assert_not_null(test_node, "Node should be created")
	assert_eq(test_node.name, "TestNode", "Node name should be set correctly")

func test_with_inner_class():
	# This test should be visible under an inner class
	var inner_test = TestInnerClass.new()
	assert_not_null(inner_test, "Inner class should be created")

class TestInnerClass:
	extends GutTest
	
	func test_inner_functionality():
		assert_true(true, "Inner class test should work")
		assert_eq("inner", "inner", "Inner class string test")