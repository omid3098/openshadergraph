@tool
extends BaseTest
class_name TestViewIntegration

var graph_data: BaseGraphData
var node_data1: BaseNodeData
var node_data2: BaseNodeData
var graph_node1: BaseGraphNode
var graph_node2: BaseGraphNode

# Test pins with different value types
var float_input: PinData
var float_output: PinData
var vector2_input: PinData
var vector3_output: PinData

func before_each():
	# Create pins with values
	float_input = PinData.new("float_in", "float", PinData.PinType.INPUT, 2.5)
	float_output = PinData.new("float_out", "float", PinData.PinType.OUTPUT, 0.0)
	vector2_input = PinData.new("vec2_in", "vector2", PinData.PinType.INPUT, Vector2(1.0, 2.0))
	vector3_output = PinData.new("vec3_out", "vector3", PinData.PinType.OUTPUT, Vector3.ZERO)
	
	# Create node data with pins
	node_data1 = BaseNodeData.new("ConstantNode", "constant", Vector2(50, 100), [float_input], [float_output])
	node_data2 = BaseNodeData.new("MathNode", "add", Vector2(200, 150), [vector2_input], [vector3_output])
	
	# Create graph data
	var empty_connections: Array[ConnectionData] = []
	graph_data = BaseGraphData.new("TestGraph", BaseGraphData.GraphType.SHADER_GRAPH, [node_data1, node_data2], empty_connections)
	
	# Create view nodes and add to scene tree for proper processing
	graph_node1 = BaseGraphNode.new(node_data1)
	graph_node2 = BaseGraphNode.new(node_data2)
	Engine.get_main_loop().root.add_child(graph_node1)
	Engine.get_main_loop().root.add_child(graph_node2)

func after_each():
	if graph_node1:
		graph_node1.queue_free()
	if graph_node2:
		graph_node2.queue_free()
	
	graph_node1 = null
	graph_node2 = null
	node_data1 = null
	node_data2 = null
	graph_data = null
	float_input = null
	vector2_input = null
	float_output = null
	vector3_output = null

# Test data-view binding
func test_data_view_binding():
	# Test that view nodes are properly bound to data
	assert_equal(node_data1, graph_node1.data, "Graph node 1 should be bound to node data 1")
	assert_equal(node_data2, graph_node2.data, "Graph node 2 should be bound to node data 2")
	
	# Test that view properties reflect data properties
	assert_equal("ConstantNode", graph_node1.get_title(), "Graph node 1 title should match data name")
	assert_equal("MathNode", graph_node2.get_title(), "Graph node 2 title should match data name")
	assert_equal(Vector2(50, 100), graph_node1.get_position(), "Graph node 1 position should match data")
	assert_equal(Vector2(200, 150), graph_node2.get_position(), "Graph node 2 position should match data")

# Test pin value access through view
func test_pin_value_access():
	# Access pin values through the view's data reference
	assert_equal(2.5, graph_node1.get_data().get_inputs()[0].get_value(), "Should access input pin value through view")
	assert_equal(0.0, graph_node1.get_data().get_outputs()[0].get_value(), "Should access output pin value through view")
	
	# Modify pin values through view
	graph_node1.get_data().get_inputs()[0].set_value(5.0)
	assert_equal(5.0, node_data1.get_inputs()[0].get_value(), "Pin value modification through view should affect original data")

# Test view synchronization with data changes
func test_view_data_synchronization():
	# Test that changing view properties updates the data
	graph_node1.set_title("ViewModified")
	graph_node1.set_position(Vector2(90, 140))

	assert_equal("ViewModified", graph_node1.get_title(), "View title should be updated")
	assert_equal(Vector2(90, 140), graph_node1.get_position(), "View position should be updated")
	assert_equal("ViewModified", node_data1.get_name(), "Data name should update when view title changes")
	assert_equal(Vector2(90, 140), node_data1.get_position(), "Data position should update when view position changes")

# Test movement synchronization
func test_movement_synchronization():
	var original_position = node_data1.get_position()
	var movement_offset = Vector2(30, 40)
	var new_position = original_position + movement_offset
	
	# Simulate movement through view
	graph_node1._on_dragged(original_position, new_position)
	
	# Both view and original data should be updated
	assert_equal(new_position, graph_node1.data.get_position(), "View data position should be updated")
	assert_equal(new_position, node_data1.get_position(), "Original data position should be updated")
	assert_equal(new_position, graph_node1.get_position(), "View position should be updated")

# Test multiple view nodes with same data type
func test_multiple_view_nodes():
	# Both nodes should be independently functional
	assert_not_equal(graph_node1.data, graph_node2.data, "View nodes should have different data")
	assert_equal("ConstantNode", graph_node1.get_title(), "First node should have correct title")
	assert_equal("MathNode", graph_node2.get_title(), "Second node should have correct title")
	
	# Move one node, other should be unaffected
	var original_pos2 = node_data2.get_position()
	graph_node1._on_dragged(graph_node1.get_position(), graph_node1.get_position() + Vector2(10, 10))
	
	assert_equal(original_pos2, node_data2.get_position(), "Second node position should be unaffected")

# Test pin value modification scenarios
func test_pin_value_modification_scenarios():
	var input_pin = graph_node1.get_data().get_inputs()[0]
	var output_pin = graph_node1.get_data().get_outputs()[0]
	
	# Test different value types
	input_pin.set_value(10.5)
	assert_equal(10.5, input_pin.get_value(), "Float value should be modifiable")
	
	output_pin.set_value(7.2)
	assert_equal(7.2, output_pin.get_value(), "Output pin value should be modifiable")
	
	# Test complex value types
	var complex_pin = PinData.new("complex", "color", PinData.PinType.INPUT, Color.RED)
	graph_node1.get_data().get_inputs().append(complex_pin)
	
	complex_pin.set_value(Color.BLUE)
	assert_equal(Color.BLUE, complex_pin.get_value(), "Complex value types should be modifiable")

# Test view-data consistency during operations
func test_view_data_consistency():
	# Perform multiple operations
	graph_node1._on_dragged(graph_node1.get_position(), graph_node1.get_position() + Vector2(5, 5))
	graph_node1.get_data().get_inputs()[0].set_value(3.14)
	graph_node1.get_data().set_name("UpdatedNode")
	
	# Check consistency
	assert_equal(node_data1.get_position(), graph_node1.get_data().get_position(), "Position should be consistent")
	assert_equal(node_data1.get_inputs()[0].get_value(), graph_node1.get_data().get_inputs()[0].get_value(), "Pin values should be consistent")
	assert_equal(node_data1.get_name(), graph_node1.get_data().get_name(), "Name should be consistent")

# Test graph-level operations with views
func test_graph_level_operations():
	# Test that graph data contains the correct nodes
	assert_contains(graph_data.get_nodes(), node_data1, "Graph should contain node data 1")
	assert_contains(graph_data.get_nodes(), node_data2, "Graph should contain node data 2")
	
	# Modify nodes through views
	graph_node1.get_data().get_inputs()[0].set_value(100.0)
	graph_node2.get_data().get_inputs()[0].set_value(Vector2(10.0, 20.0))
	
	# Changes should be reflected in graph data
	assert_equal(100.0, graph_data.get_nodes()[0].get_inputs()[0].get_value(), "Graph data should reflect view changes")
	assert_equal(Vector2(10.0, 20.0), graph_data.get_nodes()[1].get_inputs()[0].get_value(), "Graph data should reflect view changes")

# Test pin type and value consistency
func test_pin_type_value_consistency():
	var float_pin = graph_node1.get_data().get_inputs()[0]
	assert_equal("float", float_pin.get_data_type(), "Pin should have correct data type")
	assert_equal(2.5, float_pin.get_value(), "Pin should have correct initial value")
	
	# Change value to different float
	float_pin.set_value(-15.7)
	assert_equal(-15.7, float_pin.get_value(), "Pin should accept new float value")
	assert_equal("float", float_pin.get_data_type(), "Pin type should remain unchanged")

# Test view cleanup and memory management
func test_view_cleanup():
	# Store reference to data
	var data_ref = graph_node1.get_data()
	assert_equal(node_data1, data_ref, "Data reference should be correct")
	
	# Clear view reference
	graph_node1.data = null
	
	# Original data should still exist
	assert_not_null(node_data1, "Original data should still exist")
	assert_equal("ConstantNode", node_data1.get_name(), "Original data should be unchanged")

# Test signal integration with data changes
func test_signal_data_integration():
	var signal_received = false
	var received_data: BaseNodeData = null
	
	# Connect to the built-in signal from GraphNode
	graph_node1.node_selected.connect(func():
		signal_received = true
		received_data = graph_node1.get_data()
	)
	
	# Set selected to true to trigger the signal
	graph_node1.selected = true

	# Wait a frame for signals to process
	await Engine.get_main_loop().process_frame
	
	assert_true(signal_received, "Signal should be received")
	assert_equal(node_data1, received_data, "Signal should carry correct data reference")

# Test edge cases with empty or null values
func test_edge_cases():
	# Test with null pin values
	var null_pin = PinData.new("null_test", "custom", PinData.PinType.INPUT, null)
	var node_with_null = BaseNodeData.new("NullNode", "test", Vector2.ZERO, [null_pin], [])
	var graph_node_null = BaseGraphNode.new(node_with_null)
	
	assert_null(graph_node_null.get_data().get_inputs()[0].get_value(), "Should handle null pin values")
	
	# Test with empty arrays
	var empty_node = BaseNodeData.new("EmptyNode", "test", Vector2.ZERO, [], [])
	var graph_node_empty = BaseGraphNode.new(empty_node)
	
	assert_equal(0, graph_node_empty.get_data().get_inputs().size(), "Should handle empty input arrays")
	assert_equal(0, graph_node_empty.get_data().get_outputs().size(), "Should handle empty output arrays")
	
	graph_node_null.queue_free()
	graph_node_empty.queue_free()

# Test performance with multiple pin values
func test_performance_multiple_pins():
	# Create node with many pins
	var many_inputs: Array[PinData] = []
	var many_outputs: Array[PinData] = []
	
	for i in range(10):
		many_inputs.append(PinData.new("input_%d" % i, "float", PinData.PinType.INPUT, float(i)))
		many_outputs.append(PinData.new("output_%d" % i, "float", PinData.PinType.OUTPUT, float(i * 2)))
	
	var complex_node = BaseNodeData.new("ComplexNode", "complex", Vector2.ZERO, many_inputs, many_outputs)
	var graph_node_complex = BaseGraphNode.new(complex_node)
	
	# Test that all pins are accessible
	assert_equal(10, graph_node_complex.get_data().get_inputs().size(), "Should handle multiple input pins")
	assert_equal(10, graph_node_complex.get_data().get_outputs().size(), "Should handle multiple output pins")
	
	# Test value access
	for i in range(10):
		assert_equal(float(i), graph_node_complex.get_data().get_inputs()[i].get_value(), "Input pin %d should have correct value" % i)
		assert_equal(float(i * 2), graph_node_complex.get_data().get_outputs()[i].get_value(), "Output pin %d should have correct value" % i)

	graph_node_complex.queue_free()