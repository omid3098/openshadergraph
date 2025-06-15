@tool
extends BaseTest
class_name TestIntegration

var graph_manager: GraphManager
var test_graph: BaseGraphData
var received_signals: Array = []

func before_each():
	graph_manager = GraphManager.new()
	received_signals.clear()
	
	# Connect to GraphManager's direct signals
	graph_manager.graph_created.connect(_on_graph_created)
	graph_manager.graph_selected.connect(_on_graph_selected)
	graph_manager.graph_deleted.connect(_on_graph_deleted)

func after_each():
	# Clean up
	if graph_manager.graph_created.is_connected(_on_graph_created):
		graph_manager.graph_created.disconnect(_on_graph_created)
	if graph_manager.graph_selected.is_connected(_on_graph_selected):
		graph_manager.graph_selected.disconnect(_on_graph_selected)
	if graph_manager.graph_deleted.is_connected(_on_graph_deleted):
		graph_manager.graph_deleted.disconnect(_on_graph_deleted)
	
	if graph_manager:
		graph_manager.cleanup()
	graph_manager = null
	test_graph = null
	received_signals.clear()

# Signal handlers
func _on_graph_created(graph: BaseGraphData):
	received_signals.append({"type": "created", "graph": graph})

func _on_graph_selected(graph: BaseGraphData):
	received_signals.append({"type": "selected", "graph": graph})

func _on_graph_deleted(graph: BaseGraphData):
	received_signals.append({"type": "deleted", "graph": graph})

# Test creating a complete shader graph workflow
func test_complete_shader_graph_workflow():
	# Create a new graph
	graph_manager.create_new_graph()
	var graph = graph_manager.get_current_graph()
	
	assert_not_null(graph, "Graph should be created")
	assert_equal("New Graph", graph.name, "Graph should have default name")
	
	# Create nodes for a simple shader (Constant -> Add -> Output)
	var color_pin = PinData.new("color", "vector3", PinData.PinType.OUTPUT)
	var value_pin = PinData.new("value", "float", PinData.PinType.OUTPUT)
	var input1_pin = PinData.new("input1", "vector3", PinData.PinType.INPUT)
	var input2_pin = PinData.new("input2", "vector3", PinData.PinType.INPUT) # Changed to vector3 to create type mismatch with float
	var result_pin = PinData.new("result", "vector3", PinData.PinType.OUTPUT)
	var albedo_pin = PinData.new("albedo", "vector3", PinData.PinType.INPUT)
	
	var color_node = BaseNodeData.new("ColorConstant", "ConstantNode", Vector2(0, 0), [], [color_pin])
	var value_node = BaseNodeData.new("FloatConstant", "ConstantNode", Vector2(0, 100), [], [value_pin])
	var add_node = BaseNodeData.new("Add", "MathNode", Vector2(200, 50), [input1_pin, input2_pin], [result_pin])
	var output_node = BaseNodeData.new("Output", "OutputNode", Vector2(400, 50), [albedo_pin], [])
	
	# Add nodes to graph
	graph.add_node(color_node)
	graph.add_node(value_node)
	graph.add_node(add_node)
	graph.add_node(output_node)
	
	assert_equal(4, graph.nodes.size(), "Graph should have 4 nodes")
	
	# Create connections
	var connection1 = ConnectionData.new(color_node, color_pin, add_node, input1_pin)
	var connection2 = ConnectionData.new(value_node, value_pin, add_node, input2_pin)
	var connection3 = ConnectionData.new(add_node, result_pin, output_node, albedo_pin)
	
	# Add connections (only valid ones should be added due to type mismatch)
	graph.add_connection(connection1) # vector3 -> vector3 (valid)
	graph.add_connection(connection2) # float -> vector3 (invalid - type mismatch)
	graph.add_connection(connection3) # vector3 -> vector3 (valid)
	
	# Only connections 1 and 3 should be valid
	assert_equal(2, graph.connections.size(), "Graph should have 2 valid connections")
	
	# Verify the workflow was properly tracked by signals
	assert_equal(1, received_signals.size(), "Should have one creation signal")
	assert_equal("created", received_signals[0]["type"], "Should be creation signal")

# Test multi-graph management workflow
func test_multi_graph_workflow():
	# Create multiple graphs
	graph_manager.create_new_graph()
	var graph1 = graph_manager.get_current_graph()
	graph1.name = "Shader Graph 1"
	
	graph_manager.create_new_graph()
	var graph2 = graph_manager.get_current_graph()
	graph2.name = "Shader Graph 2"
	
	graph_manager.create_new_graph()
	var graph3 = graph_manager.get_current_graph()
	graph3.name = "Shader Graph 3"
	
	assert_equal(3, graph_manager.get_all_graphs().size(), "Should have 3 graphs")
	assert_equal(graph3, graph_manager.get_current_graph(), "Current should be last created")
	
	# Switch between graphs
	graph_manager.select_graph(graph1)
	assert_equal(graph1, graph_manager.get_current_graph(), "Should switch to graph1")
	
	graph_manager.select_graph(graph2)
	assert_equal(graph2, graph_manager.get_current_graph(), "Should switch to graph2")
	
	# Delete middle graph
	graph_manager.delete_graph(graph2)
	assert_equal(2, graph_manager.get_all_graphs().size(), "Should have 2 graphs after deletion")
	assert_equal(graph1, graph_manager.get_current_graph(), "Should auto-select remaining graph")
	
	# Verify all operations were signaled
	var signal_types = []
	for signal_data in received_signals:
		signal_types.append(signal_data["type"])
	
	assert_contains(signal_types, "created", "Should have creation signals")
	assert_contains(signal_types, "selected", "Should have selection signals")
	assert_contains(signal_types, "deleted", "Should have deletion signal")

# Test complex connection validation scenarios
func test_complex_connection_validation():
	graph_manager.create_new_graph()
	var graph = graph_manager.get_current_graph()
	
	# Create a chain of nodes: Input -> Math -> Math -> Output
	var input_out = PinData.new("value", "float", PinData.PinType.OUTPUT)
	var math1_in = PinData.new("a", "float", PinData.PinType.INPUT)
	var math1_out = PinData.new("result", "float", PinData.PinType.OUTPUT)
	var math2_in = PinData.new("b", "float", PinData.PinType.INPUT)
	var math2_out = PinData.new("result", "float", PinData.PinType.OUTPUT)
	var output_in = PinData.new("final", "float", PinData.PinType.INPUT)
	
	var input_node = BaseNodeData.new("Input", "InputNode", Vector2(0, 0), [], [input_out])
	var math1_node = BaseNodeData.new("Math1", "MathNode", Vector2(100, 0), [math1_in], [math1_out])
	var math2_node = BaseNodeData.new("Math2", "MathNode", Vector2(200, 0), [math2_in], [math2_out])
	var output_node = BaseNodeData.new("Output", "OutputNode", Vector2(300, 0), [output_in], [])
	
	# Add all nodes
	graph.add_node(input_node)
	graph.add_node(math1_node)
	graph.add_node(math2_node)
	graph.add_node(output_node)
	
	# Test valid connection chain
	var conn1 = ConnectionData.new(input_node, input_out, math1_node, math1_in)
	var conn2 = ConnectionData.new(math1_node, math1_out, math2_node, math2_in)
	var conn3 = ConnectionData.new(math2_node, math2_out, output_node, output_in)
	
	graph.add_connection(conn1)
	graph.add_connection(conn2)
	graph.add_connection(conn3)
	
	assert_equal(3, graph.connections.size(), "All connections should be valid")
	
	# Test invalid connections
	var invalid_conn1 = ConnectionData.new(input_node, input_out, input_node, input_out) # Same node
	var invalid_conn2 = ConnectionData.new(input_node, input_out, math1_node, math1_out) # Output to output
	
	graph.add_connection(invalid_conn1)
	graph.add_connection(invalid_conn2)
	
	assert_equal(3, graph.connections.size(), "Invalid connections should be rejected")

# Test graph data integrity during operations
func test_graph_data_integrity():
	graph_manager.create_new_graph()
	var graph = graph_manager.get_current_graph()
	
	# Create nodes with specific data
	var node1 = BaseNodeData.new("Node1", "Type1", Vector2(10, 20), [], [])
	var node2 = BaseNodeData.new("Node2", "Type2", Vector2(30, 40), [], [])
	
	graph.add_node(node1)
	graph.add_node(node2)
	
	# Verify data integrity
	assert_equal("Node1", graph.nodes[0].name, "First node name should be preserved")
	assert_equal("Type1", graph.nodes[0].type, "First node type should be preserved")
	assert_equal(Vector2(10, 20), graph.nodes[0].position, "First node position should be preserved")
	
	assert_equal("Node2", graph.nodes[1].name, "Second node name should be preserved")
	assert_equal("Type2", graph.nodes[1].type, "Second node type should be preserved")
	assert_equal(Vector2(30, 40), graph.nodes[1].position, "Second node position should be preserved")
	
	# Modify nodes and verify changes persist
	node1.name = "Modified Node1"
	node1.position = Vector2(100, 200)
	
	assert_equal("Modified Node1", graph.nodes[0].name, "Modified node name should persist")
	assert_equal(Vector2(100, 200), graph.nodes[0].position, "Modified node position should persist")

# Test event-driven architecture integration
func test_event_driven_architecture():
	var external_listener_calls = []
	
	# Set up external listener
	var external_handler = func(graph: BaseGraphData):
		external_listener_calls.append(graph.name)
	
	graph_manager.graph_created.connect(external_handler)
	
	# Perform operations that should trigger events
	# The external listener will receive "New Graph" since that's the name at creation time
	graph_manager.create_new_graph()
	var graph1 = graph_manager.get_current_graph()
	graph1.name = "External Test Graph 1"
	
	graph_manager.create_new_graph()
	var graph2 = graph_manager.get_current_graph()
	graph2.name = "External Test Graph 2"
	
	graph_manager.select_graph(graph1)
	graph_manager.delete_graph(graph1)
	
	# Verify external listener received events
	assert_equal(2, external_listener_calls.size(), "External listener should receive creation events")
	assert_equal("New Graph", external_listener_calls[0], "First creation should be tracked")
	assert_equal("New Graph", external_listener_calls[1], "Second creation should be tracked")
	
	# Clean up
	graph_manager.graph_created.disconnect(external_handler)

# Test error recovery and edge cases
func test_error_recovery():
	graph_manager.create_new_graph()
	var graph = graph_manager.get_current_graph()
	
	# Test operations on empty graph
	assert_equal(0, graph.nodes.size(), "Empty graph should have no nodes")
	assert_equal(0, graph.connections.size(), "Empty graph should have no connections")
	
	# Test adding connections without nodes
	var phantom_node1 = BaseNodeData.new("Phantom1", "Test", Vector2.ZERO, [], [])
	var phantom_node2 = BaseNodeData.new("Phantom2", "Test", Vector2.ZERO, [], [])
	var phantom_pin1 = PinData.new("out", "float", PinData.PinType.OUTPUT)
	var phantom_pin2 = PinData.new("in", "float", PinData.PinType.INPUT)
	
	var phantom_connection = ConnectionData.new(phantom_node1, phantom_pin1, phantom_node2, phantom_pin2)
	graph.add_connection(phantom_connection)
	
	assert_equal(0, graph.connections.size(), "Connection with non-existent nodes should be rejected")
	
	# Test null handling
	graph.add_node(null) # Should not crash
	graph.add_connection(null) # Should not crash
	
	# Graph should still be functional
	var real_node = BaseNodeData.new("Real", "Test", Vector2.ZERO, [], [])
	graph.add_node(real_node)
	assert_equal(1, graph.nodes.size(), "Graph should remain functional after null operations")

# Test performance with larger datasets
func test_larger_dataset_performance():
	graph_manager.create_new_graph()
	var graph = graph_manager.get_current_graph()
	
	var start_time = Time.get_unix_time_from_system()
	
	# Create many nodes
	for i in range(100):
		var output_pin = PinData.new("out_%d" % i, "float", PinData.PinType.OUTPUT)
		var node = BaseNodeData.new("Node_%d" % i, "TestNode", Vector2(i * 10, 0), [], [output_pin])
		graph.add_node(node)
	
	var node_creation_time = Time.get_unix_time_from_system() - start_time
	
	assert_equal(100, graph.nodes.size(), "Should have 100 nodes")
	assert_less_than(node_creation_time, 1.0, "Node creation should be reasonably fast")
	
	# Test graph operations still work
	var all_graphs = graph_manager.get_all_graphs()
	assert_equal(1, all_graphs.size(), "Should still have one graph")
	assert_equal(graph, graph_manager.get_current_graph(), "Current graph should be unchanged")

# Test different graph types
func test_different_graph_types():
	# Test all graph types - create separate arrays for each graph to avoid sharing
	var shader_graph = BaseGraphData.new("Shader", BaseGraphData.GraphType.SHADER_GRAPH, [], [])
	var group_graph = BaseGraphData.new("Group", BaseGraphData.GraphType.GROUP_GRAPH, [], [])
	var local_subgraph = BaseGraphData.new("Local", BaseGraphData.GraphType.LOCAL_SUBGRAPH, [], [])
	var global_subgraph = BaseGraphData.new("Global", BaseGraphData.GraphType.GLOBAL_SUBGRAPH, [], [])
	
	# All should behave similarly for basic operations
	var graphs = [shader_graph, group_graph, local_subgraph, global_subgraph]
	
	for graph in graphs:
		# Verify graph starts empty
		assert_equal(0, graph.nodes.size(), "Graph should start empty")
		
		# Create separate test nodes for each graph to avoid interference
		var test_node = BaseNodeData.new("TestNode", "Test", Vector2.ZERO, [], [])
		graph.add_node(test_node)
		assert_equal(1, graph.nodes.size(), "Each graph type should support adding nodes")
		
		# Test basic properties
		assert_not_null(graph.name, "Graph should have a name")
		assert_not_null(graph.graph_type, "Graph should have a type")
		assert_equal(0, graph.connections.size(), "New graph should have no connections")