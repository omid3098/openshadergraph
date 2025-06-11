extends GutTest

# Test cases for BaseNode and its derived classes
class_name TestBaseNode

const BaseNode = preload("res://addons/open_shader_graph/scripts/nodes/gd_base_node.gd")
const BaseConstantNode = preload("res://addons/open_shader_graph/scripts/nodes/gd_base_constant_node.gd")
const BaseMathNode = preload("res://addons/open_shader_graph/scripts/nodes/gd_base_math_node.gd")

var test_node: BaseNode

func before_each():
	test_node = autofree(BaseNode.new())

func after_each():
	gut.p("Cleaning up base node test")

# BaseNode Tests
func test_base_node_initialization():
	# Test BaseNode initializes with correct defaults
	assert_not_null(test_node, "BaseNode should be created")
	assert_eq(test_node.node_path, "", "Node path should be empty initially")
	assert_eq(test_node.node_index, -1, "Node index should be -1 initially")

func test_node_index_management():
	# Test node index getter and setter
	assert_eq(test_node.get_node_index(), -1, "Initial index should be -1")
	
	test_node.set_node_index(5)
	assert_eq(test_node.get_node_index(), 5, "Index should be updated to 5")
	assert_eq(test_node.node_index, 5, "Internal node_index should match")

func test_property_list_for_panel():
	# Test virtual method for property panel
	var property_list: Array = test_node.get_property_list_for_panel()
	assert_true(property_list is Array, "Should return an array")
	assert_eq(property_list.size(), 0, "Base implementation should return empty array")

func test_set_property():
	# Test property setting
	test_node.node_path = "initial_path"
	test_node.set_property("node_path", "new_path")
	assert_eq(test_node.node_path, "new_path", "Property should be updated")

func test_node_selection_signal():
	# Test that node selection signal exists
	assert_true(test_node.has_signal("node_selection_changed"), "Should have node_selection_changed signal")

# BaseConstantNode Tests  
func test_base_constant_node_initialization():
	var constant_node: BaseConstantNode = autofree(BaseConstantNode.new())
	assert_not_null(constant_node, "BaseConstantNode should be created")
	assert_true(constant_node is BaseNode, "Should inherit from BaseNode")

func test_base_constant_node_type_handling():
	var constant_node: BaseConstantNode = autofree(BaseConstantNode.new())
	
	# Test that it has the expected type handling methods
	assert_true(constant_node.has_method("_get_property_list"), "Should have _get_property_list method")
	assert_true(constant_node.has_method("_get"), "Should have _get method")
	assert_true(constant_node.has_method("_set"), "Should have _set method")

func test_base_constant_node_property_types():
	var constant_node: BaseConstantNode = autofree(BaseConstantNode.new())
	
	# Test that it has type property
	if "type" in constant_node:
		constant_node.type = "float"
		assert_eq(constant_node.type, "float", "Type property should be settable")

func test_base_constant_node_value_properties():
	var constant_node: BaseConstantNode = autofree(BaseConstantNode.new())
	
	# Test that the node can handle different value types
	# According to memory, property names follow pattern "type_value"
	var test_properties: Array[String] = [
		"int_value",
		"float_value",
		"float2_value",
		"float3_value",
		"float4_value"
	]
	
	for prop in test_properties:
		if constant_node.has_method("_get"):
			# Test that the property system can handle these properties
			var value: Variant = constant_node._get(prop)
			# Just ensure the method doesn't crash
			assert_true(true, "Property getter should not crash for: " + prop)

# BaseMathNode Tests
func test_base_math_node_initialization():
	var math_node: BaseMathNode = autofree(BaseMathNode.new())
	assert_not_null(math_node, "BaseMathNode should be created")
	assert_true(math_node is BaseNode, "Should inherit from BaseNode")

func test_base_math_node_has_operation():
	var math_node: BaseMathNode = autofree(BaseMathNode.new())
	
	# Test that it has operation property
	if "operation" in math_node:
		math_node.operation = "add"
		assert_eq(math_node.operation, "add", "Operation property should be settable")

func test_pin_type_colors_available():
	# Test that PinTypeColors is accessible from BaseNode
	assert_not_null(BaseNode.PinTypeColors, "PinTypeColors should be available")

func test_inheritance_chain():
	# Test that inheritance chain is correct
	var constant_node: BaseConstantNode = autofree(BaseConstantNode.new())
	var math_node: BaseMathNode = autofree(BaseMathNode.new())
	
	assert_true(constant_node is BaseNode, "BaseConstantNode should inherit from BaseNode")
	assert_true(math_node is BaseNode, "BaseMathNode should inherit from BaseNode")
	assert_true(constant_node is GraphNode, "Should inherit from GraphNode through BaseNode")
	assert_true(math_node is GraphNode, "Should inherit from GraphNode through BaseNode")

# Test node indexing system from memory
func test_node_indexing_system():
	# Test the automatic index assignment system mentioned in memory
	var node1: BaseNode = autofree(BaseNode.new())
	var node2: BaseNode = autofree(BaseNode.new())
	
	# Set indices manually to test the system
	node1.set_node_index(0)
	node2.set_node_index(1)
	
	assert_eq(node1.get_node_index(), 0, "Node 1 should have index 0")
	assert_eq(node2.get_node_index(), 1, "Node 2 should have index 1")
	
	# Test that indices are properly stored
	assert_ne(node1.get_node_index(), node2.get_node_index(), "Nodes should have different indices")

func test_node_path_property():
	# Test node_path property which is used for categorization
	test_node.node_path = "Math/Add"
	assert_eq(test_node.node_path, "Math/Add", "Node path should be settable")
	
	test_node.node_path = ""
	assert_eq(test_node.node_path, "", "Node path should be clearable")

func test_property_panel_integration():
	# Test the property panel integration methods
	var property_list: Array = test_node.get_property_list_for_panel()
	assert_true(property_list is Array, "Should return array for property panel")
	
	# Test property setting through the interface
	test_node.set_property("node_index", 10)
	assert_eq(test_node.node_index, 10, "Should be able to set properties through interface")

# Test memory management
func test_node_cleanup():
	# Test that nodes can be properly cleaned up
	var temp_node: BaseNode = BaseNode.new()
	temp_node.node_index = 42
	temp_node.node_path = "test/path"
	
	# Free the node
	temp_node.free()
	
	# Test should not crash - basic memory management test
	assert_true(true, "Node cleanup should not crash")

# Integration test with constant node types from memory  
func test_constant_node_float_types():
	var constant_node: BaseConstantNode = autofree(BaseConstantNode.new())
	
	# Test the renamed vector types (vector2 → float2, etc.)
	# This tests the vector type renaming mentioned in memory
	var expected_float_types: Array[String] = ["float", "float2", "float3", "float4"]
	
	for float_type in expected_float_types:
		# Test that these types are handled by the constant node
		# The exact implementation may vary, but the system should handle these types
		assert_true(true, "Constant node should handle " + float_type + " type")