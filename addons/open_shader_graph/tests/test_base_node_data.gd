@tool
extends BaseTest
class_name TestBaseNodeData

var test_node: BaseNodeData
var input_pin: PinData
var output_pin: PinData

func before_each():
	input_pin = PinData.new("input", "float", PinData.PinType.INPUT)
	output_pin = PinData.new("output", "float", PinData.PinType.OUTPUT)
	test_node = BaseNodeData.new("TestNode", "ConstantNode", Vector2(50, 100), [input_pin], [output_pin])

func after_each():
	test_node = null
	input_pin = null
	output_pin = null

# Test node creation
func test_node_creation():
	assert_not_null(test_node, "Node should be created")
	assert_equal("TestNode", test_node.name, "Node name should be set correctly")
	assert_equal("ConstantNode", test_node.type, "Node type should be set correctly")
	assert_equal(Vector2(50, 100), test_node.position, "Node position should be set correctly")

func test_node_creation_minimal():
	var minimal_node = BaseNodeData.new("Minimal", "SimpleNode", Vector2.ZERO)
	
	assert_equal("Minimal", minimal_node.name, "Minimal node name should be set")
	assert_equal("SimpleNode", minimal_node.type, "Minimal node type should be set")
	assert_equal(Vector2.ZERO, minimal_node.position, "Minimal node position should be set")
	assert_equal(0, minimal_node.inputs.size(), "Minimal node should have no inputs by default")
	assert_equal(0, minimal_node.outputs.size(), "Minimal node should have no outputs by default")

func test_node_creation_with_pins():
	assert_equal(1, test_node.inputs.size(), "Node should have one input pin")
	assert_equal(1, test_node.outputs.size(), "Node should have one output pin")
	assert_contains(test_node.inputs, input_pin, "Node should contain the input pin")
	assert_contains(test_node.outputs, output_pin, "Node should contain the output pin")

# Test node with multiple pins
func test_node_with_multiple_pins():
	var input1 = PinData.new("input1", "float", PinData.PinType.INPUT)
	var input2 = PinData.new("input2", "vector3", PinData.PinType.INPUT)
	var output1 = PinData.new("output1", "float", PinData.PinType.OUTPUT)
	var output2 = PinData.new("output2", "vector3", PinData.PinType.OUTPUT)
	
	var multi_pin_node = BaseNodeData.new(
		"MultiPin",
		"MathNode",
		Vector2(200, 300),
		[input1, input2],
		[output1, output2]
	)
	
	assert_equal(2, multi_pin_node.inputs.size(), "Node should have two input pins")
	assert_equal(2, multi_pin_node.outputs.size(), "Node should have two output pins")
	assert_contains(multi_pin_node.inputs, input1, "Node should contain first input pin")
	assert_contains(multi_pin_node.inputs, input2, "Node should contain second input pin")
	assert_contains(multi_pin_node.outputs, output1, "Node should contain first output pin")
	assert_contains(multi_pin_node.outputs, output2, "Node should contain second output pin")

# Test node properties modification
func test_node_name_modification():
	test_node.name = "ModifiedName"
	assert_equal("ModifiedName", test_node.name, "Node name should be modifiable")

func test_node_type_modification():
	test_node.type = "ModifiedType"
	assert_equal("ModifiedType", test_node.type, "Node type should be modifiable")

func test_node_position_modification():
	test_node.position = Vector2(999, 888)
	assert_equal(Vector2(999, 888), test_node.position, "Node position should be modifiable")

# Test pin arrays modification
func test_add_input_pin():
	var new_input = PinData.new("new_input", "vector2", PinData.PinType.INPUT)
	test_node.inputs.append(new_input)
	
	assert_equal(2, test_node.inputs.size(), "Node should have two input pins after adding")
	assert_contains(test_node.inputs, new_input, "Node should contain the new input pin")

func test_add_output_pin():
	var new_output = PinData.new("new_output", "vector2", PinData.PinType.OUTPUT)
	test_node.outputs.append(new_output)
	
	assert_equal(2, test_node.outputs.size(), "Node should have two output pins after adding")
	assert_contains(test_node.outputs, new_output, "Node should contain the new output pin")

func test_remove_input_pin():
	test_node.inputs.erase(input_pin)
	
	assert_equal(0, test_node.inputs.size(), "Node should have no input pins after removal")
	assert_not_contains(test_node.inputs, input_pin, "Node should not contain the removed input pin")

func test_remove_output_pin():
	test_node.outputs.erase(output_pin)
	
	assert_equal(0, test_node.outputs.size(), "Node should have no output pins after removal")
	assert_not_contains(test_node.outputs, output_pin, "Node should not contain the removed output pin")

# Test node with no pins
func test_node_no_pins():
	var no_pin_node = BaseNodeData.new("NoPins", "UtilityNode", Vector2(0, 0), [], [])
	
	assert_equal(0, no_pin_node.inputs.size(), "Node with no pins should have empty inputs")
	assert_equal(0, no_pin_node.outputs.size(), "Node with no pins should have empty outputs")

# Test node with only inputs
func test_node_only_inputs():
	var input_only_node = BaseNodeData.new("InputOnly", "OutputNode", Vector2(0, 0), [input_pin], [])
	
	assert_equal(1, input_only_node.inputs.size(), "Input-only node should have one input")
	assert_equal(0, input_only_node.outputs.size(), "Input-only node should have no outputs")

# Test node with only outputs
func test_node_only_outputs():
	var output_only_node = BaseNodeData.new("OutputOnly", "InputNode", Vector2(0, 0), [], [output_pin])
	
	assert_equal(0, output_only_node.inputs.size(), "Output-only node should have no inputs")
	assert_equal(1, output_only_node.outputs.size(), "Output-only node should have one output")

# Test edge cases
func test_node_empty_name():
	var empty_name_node = BaseNodeData.new("", "SomeType", Vector2.ZERO)
	assert_equal("", empty_name_node.name, "Node should accept empty name")

func test_node_empty_type():
	var empty_type_node = BaseNodeData.new("SomeName", "", Vector2.ZERO)
	assert_equal("", empty_type_node.type, "Node should accept empty type")

func test_node_negative_position():
	var negative_pos_node = BaseNodeData.new("Negative", "TestType", Vector2(-100, -200))
	assert_equal(Vector2(-100, -200), negative_pos_node.position, "Node should accept negative position")

# Test pin data integrity
func test_pin_data_integrity():
	assert_equal("input", test_node.inputs[0].name, "Input pin name should be preserved")
	assert_equal("float", test_node.inputs[0].data_type, "Input pin type should be preserved")
	assert_equal(PinData.PinType.INPUT, test_node.inputs[0].direction, "Input pin direction should be preserved")
	
	assert_equal("output", test_node.outputs[0].name, "Output pin name should be preserved")
	assert_equal("float", test_node.outputs[0].data_type, "Output pin type should be preserved")
	assert_equal(PinData.PinType.OUTPUT, test_node.outputs[0].direction, "Output pin direction should be preserved")

# Helper function for assert_not_contains (not in base test)
func assert_not_contains(container, item, message: String = ""):
	var contains = false
	if container is Array:
		contains = item in container
	elif container is String:
		contains = container.find(str(item)) != -1
	elif container is Dictionary:
		contains = container.has(item)
	
	if contains:
		var error_msg = "Expected container to NOT contain '%s'" % str(item)
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)