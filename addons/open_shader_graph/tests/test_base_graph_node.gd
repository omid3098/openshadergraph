@tool
extends BaseTest
class_name TestBaseGraphNode

var test_node_data: BaseNodeData
var test_graph_node: BaseGraphNode
var input_pin: PinData
var output_pin: PinData

# Signal tracking variables
var selected_signal_received: bool = false
var deselected_signal_received: bool = false
var moved_signal_received: bool = false
var value_changed_signal_received: bool = false
var last_signal_data: BaseNodeData = null
var last_position: Vector2
var last_pin_index: int = -1
var last_value: Variant

func before_each():
	# Reset signal tracking
	selected_signal_received = false
	deselected_signal_received = false
	moved_signal_received = false
	value_changed_signal_received = false
	last_signal_data = null
	last_position = Vector2.ZERO
	last_pin_index = -1
	last_value = null
	
	# Create test data
	input_pin = PinData.new("input", "float", PinData.PinType.INPUT, 1.0)
	output_pin = PinData.new("output", "float", PinData.PinType.OUTPUT, 0.0)
	test_node_data = BaseNodeData.new("TestNode", "ConstantNode", Vector2(100, 200), [input_pin], [output_pin])
	
	# Create graph node
	test_graph_node = BaseGraphNode.new(test_node_data)
	
	# Connect signals for testing
	test_graph_node.node_selected.connect(_on_node_selected)
	test_graph_node.node_deselected.connect(_on_node_deselected)
	test_graph_node.node_moved.connect(_on_node_moved)
	# test_graph_node.value_changed.connect(_on_value_changed)

func after_each():
	if test_graph_node:
		test_graph_node.queue_free()
	test_graph_node = null
	test_node_data = null
	input_pin = null
	output_pin = null

# Signal handlers for testing
func _on_node_selected():
	selected_signal_received = true
	last_signal_data = test_graph_node.data

func _on_node_deselected():
	deselected_signal_received = true
	last_signal_data = test_graph_node.data

func _on_node_moved(node_data: BaseNodeData, new_position: Vector2):
	moved_signal_received = true
	last_signal_data = node_data
	last_position = new_position

# Test node creation
func test_graph_node_creation():
	assert_not_null(test_graph_node, "BaseGraphNode should be created")
	assert_true(test_graph_node is GraphNode, "BaseGraphNode should inherit from GraphNode")
	assert_true(test_graph_node is BaseGraphNode, "Should be instance of BaseGraphNode")
	assert_equal(test_node_data, test_graph_node.data, "Node data should be assigned")
	assert_equal("TestNode", test_graph_node.get_title(), "Node title should be set from data name")
	assert_equal(Vector2(100, 200), test_graph_node.get_position(), "Node position should be set from data")

# Test focus mode setting
func test_focus_mode():
	assert_equal(Control.FOCUS_ALL, test_graph_node.focus_mode, "Focus mode should be set to FOCUS_ALL")

# Test signal connections
func test_signal_connections():
	# Check that signals are connected (we can't directly test this, but we can test the signal emission)
	assert_true(test_graph_node.focus_entered.is_connected(test_graph_node._on_focus_entered), "focus_entered should be connected")
	assert_true(test_graph_node.focus_exited.is_connected(test_graph_node._on_focus_exited), "focus_exited should be connected")
	assert_true(test_graph_node.dragged.is_connected(test_graph_node._on_dragged), "dragged should be connected")

# Test selection signal emission
func test_selection_signal():
	# Simulate focus entered by emitting the signal
	test_graph_node.emit_signal("node_selected")
	
	assert_true(selected_signal_received, "Selection signal should be emitted")
	assert_equal(test_node_data, last_signal_data, "Signal should carry correct node data")

# Test deselection signal emission
func test_deselection_signal():
	# Simulate focus exited by emitting the signal
	test_graph_node.emit_signal("node_deselected")
	
	assert_true(deselected_signal_received, "Deselection signal should be emitted")
	assert_equal(test_node_data, last_signal_data, "Signal should carry correct node data")

# Test movement signal emission
func test_movement_signal():
	var new_pos = Vector2(50, 30)
	
	# Simulate drag
	test_graph_node._on_dragged(test_graph_node.get_position(), new_pos)
	
	assert_true(moved_signal_received, "Movement signal should be emitted")
	assert_equal(test_node_data, last_signal_data, "Signal should carry correct node data")
	assert_equal(new_pos, last_position, "Signal should carry correct new position")
	assert_equal(new_pos, test_node_data.get_position(), "Node data position should be updated")

# Test multiple movements
func test_multiple_movements():
	var first_pos = Vector2(10, 20)
	test_graph_node._on_dragged(test_graph_node.get_position(), first_pos)
	assert_equal(first_pos, test_node_data.get_position(), "Position should update after first movement")
	
	# Second movement
	var second_pos = Vector2(5, -10)
	test_graph_node._on_dragged(test_graph_node.get_position(), second_pos)
	assert_equal(second_pos, test_node_data.get_position(), "Position should update after second movement")

# Test setup with multiple pins
func test_with_multiple_pins():
	var input1 = PinData.new("input1", "float", PinData.PinType.INPUT, 1.0)
	var input2 = PinData.new("input2", "vector2", PinData.PinType.INPUT, Vector2.ZERO)
	var output1 = PinData.new("output1", "float", PinData.PinType.OUTPUT, 0.0)
	var output2 = PinData.new("output2", "vector3", PinData.PinType.OUTPUT, Vector3.ZERO)
	
	var multi_pin_data = BaseNodeData.new("MultiPin", "MathNode", Vector2(200, 300), [input1, input2], [output1, output2])
	var multi_pin_graph_node = BaseGraphNode.new(multi_pin_data)

	assert_equal(multi_pin_data, multi_pin_graph_node.data, "Should handle node data with multiple pins")
	assert_equal(2, multi_pin_graph_node.data.get_inputs().size(), "Should preserve input pins")
	assert_equal(2, multi_pin_graph_node.data.get_outputs().size(), "Should preserve output pins")
	
	multi_pin_graph_node.queue_free()

# Test data reference integrity
func test_data_reference_integrity():
	# Modify data through the graph node reference
	test_graph_node.data.set_name("ModifiedName")
	
	# Original data should be modified too (same reference)
	assert_equal("ModifiedName", test_node_data.get_name(), "Data should be modified by reference")

# Test position synchronization
func test_position_synchronization():
	var drag_pos = Vector2(25, 35)
	
	# Simulate drag
	test_graph_node._on_dragged(test_graph_node.get_position(), drag_pos)
	
	# Both graph node and data should have updated position
	assert_equal(drag_pos, test_graph_node.data.get_position(), "Data position should be updated")
	assert_equal(test_graph_node.data.get_position(), test_node_data.get_position(), "Positions should be synchronized")

# Test signal emission order
func test_signal_emission_order():
	# Test selection then deselection
	test_graph_node.emit_signal("node_selected")
	assert_true(selected_signal_received, "Selection should be received first")
	
	selected_signal_received = false # Reset
	test_graph_node.emit_signal("node_deselected")
	assert_true(deselected_signal_received, "Deselection should be received after")
	assert_false(selected_signal_received, "Selection should not be triggered again")

# Test edge cases
func test_zero_offset_movement():
	var original_position = test_node_data.get_position()
	test_graph_node._on_dragged(original_position, original_position)
	
	assert_true(moved_signal_received, "Movement signal should be emitted even for zero offset")
	assert_equal(original_position, test_node_data.get_position(), "Position should remain unchanged for zero offset")

func test_negative_offset_movement():
	var new_pos = Vector2(-50, -30)
	
	test_graph_node._on_dragged(test_graph_node.get_position(), new_pos)
	
	assert_equal(new_pos, test_node_data.get_position(), "Should handle negative offsets correctly")

# Test setup called multiple times
func test_multiple_setup_calls():
	var first_data = BaseNodeData.new("First", "Type1", Vector2(10, 20))
	var second_data = BaseNodeData.new("Second", "Type2", Vector2(30, 40))
	
	var first_node = BaseGraphNode.new(first_data)
	assert_equal(first_data, first_node.data, "First setup should work")
	
	var second_node = BaseGraphNode.new(second_data)
	assert_equal(second_data, second_node.data, "Second setup should override first")
	assert_equal("Second", second_node.get_title(), "Title should update with second setup")
	assert_equal(Vector2(30, 40), second_node.get_position(), "Position should update with second setup")
	
	first_node.queue_free()
	second_node.queue_free()

## Test value changed signal (for future pin value editing)
#func test_value_changed_signal_emission():
#	# Manually emit value changed signal to test the mechanism
#	# test_graph_node.emit_signal("view_value_changed", test_node_data, 0, 5.0)
#
#	assert_true(value_changed_signal_received, "Value changed signal should be received")
#	assert_equal(test_node_data, last_signal_data, "Signal should carry correct node data")
#	assert_equal(0, last_pin_index, "Signal should carry correct pin index")
#	assert_equal(5.0, last_value, "Signal should carry correct new value")