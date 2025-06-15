@tool
extends BaseTest
class_name TestBaseGraphData

var test_graph: BaseGraphData
var test_node1: BaseNodeData
var test_node2: BaseNodeData
var input_pin: PinData
var output_pin: PinData

func before_each():
	# Create test pins
	input_pin = PinData.new("input", "float", PinData.PinType.INPUT)
	output_pin = PinData.new("output", "float", PinData.PinType.OUTPUT)
	
	# Create test nodes
	test_node1 = BaseNodeData.new("Node1", "ConstantNode", Vector2(0, 0), [], [output_pin])
	test_node2 = BaseNodeData.new("Node2", "AddNode", Vector2(100, 0), [input_pin], [])
	
	# Create test graph
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	test_graph = BaseGraphData.new("Test Graph", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)

func after_each():
	test_graph = null
	test_node1 = null
	test_node2 = null
	input_pin = null
	output_pin = null

# Test graph creation
func test_graph_creation():
	assert_not_null(test_graph, "Graph should be created")
	assert_equal("Test Graph", test_graph.name, "Graph name should be set correctly")
	assert_equal(BaseGraphData.GraphType.SHADER_GRAPH, test_graph.graph_type, "Graph type should be set correctly")
	assert_equal(0, test_graph.nodes.size(), "Graph should start with no nodes")
	assert_equal(0, test_graph.connections.size(), "Graph should start with no connections")
	assert_equal("1.0", test_graph.version, "Graph should have default version")
	assert_equal("", test_graph.file_path, "Graph should start with empty file path")

func test_graph_creation_with_initial_data():
	var nodes: Array[BaseNodeData] = [test_node1, test_node2]
	var connections: Array[ConnectionData] = []
	var graph = BaseGraphData.new("Custom Graph", BaseGraphData.GraphType.GROUP_GRAPH, nodes, connections)
	
	assert_equal("Custom Graph", graph.name, "Custom graph name should be set")
	assert_equal(BaseGraphData.GraphType.GROUP_GRAPH, graph.graph_type, "Custom graph type should be set")
	assert_equal(2, graph.nodes.size(), "Graph should be initialized with nodes")
	assert_equal(0, graph.connections.size(), "Graph should be initialized with connections")

# Test node management
func test_add_node():
	test_graph.add_node(test_node1)
	
	assert_equal(1, test_graph.nodes.size(), "Graph should have one node after adding")
	assert_contains(test_graph.nodes, test_node1, "Graph should contain the added node")

func test_add_multiple_nodes():
	test_graph.add_node(test_node1)
	test_graph.add_node(test_node2)
	
	assert_equal(2, test_graph.nodes.size(), "Graph should have two nodes")
	assert_contains(test_graph.nodes, test_node1, "Graph should contain first node")
	assert_contains(test_graph.nodes, test_node2, "Graph should contain second node")

func test_add_same_node_twice():
	test_graph.add_node(test_node1)
	test_graph.add_node(test_node1)
	
	assert_equal(2, test_graph.nodes.size(), "Same node can be added twice (array behavior)")

# Test connection management
func test_add_valid_connection():
	# Add nodes to graph first
	test_graph.add_node(test_node1)
	test_graph.add_node(test_node2)
	
	var connection = ConnectionData.new(test_node1, output_pin, test_node2, input_pin)
	test_graph.add_connection(connection)
	
	assert_equal(1, test_graph.connections.size(), "Graph should have one connection")
	assert_contains(test_graph.connections, connection, "Graph should contain the added connection")

func test_reject_invalid_connection_same_node():
	test_graph.add_node(test_node1)
	
	var connection = ConnectionData.new(test_node1, output_pin, test_node1, input_pin)
	test_graph.add_connection(connection)
	
	assert_equal(0, test_graph.connections.size(), "Connection to same node should be rejected")

func test_reject_invalid_connection_same_pin_direction():
	test_graph.add_node(test_node1)
	test_graph.add_node(test_node2)
	
	var output_pin2 = PinData.new("output2", "float", PinData.PinType.OUTPUT)
	var connection = ConnectionData.new(test_node1, output_pin, test_node2, output_pin2)
	test_graph.add_connection(connection)
	
	assert_equal(0, test_graph.connections.size(), "Connection between same pin directions should be rejected")

func test_reject_connection_no_output_pins():
	var node_no_outputs = BaseNodeData.new("NoOutputs", "InputNode", Vector2(0, 0), [input_pin], [])
	test_graph.add_node(node_no_outputs)
	test_graph.add_node(test_node2)
	
	var connection = ConnectionData.new(node_no_outputs, output_pin, test_node2, input_pin)
	test_graph.add_connection(connection)
	
	assert_equal(0, test_graph.connections.size(), "Connection from node with no outputs should be rejected")

func test_reject_connection_no_input_pins():
	var node_no_inputs = BaseNodeData.new("NoInputs", "OutputNode", Vector2(0, 0), [], [output_pin])
	test_graph.add_node(test_node1)
	test_graph.add_node(node_no_inputs)
	
	var connection = ConnectionData.new(test_node1, output_pin, node_no_inputs, input_pin)
	test_graph.add_connection(connection)
	
	assert_equal(0, test_graph.connections.size(), "Connection to node with no inputs should be rejected")

func test_reject_connection_node_not_in_graph():
	test_graph.add_node(test_node1)
	# test_node2 is not added to graph
	
	var connection = ConnectionData.new(test_node1, output_pin, test_node2, input_pin)
	test_graph.add_connection(connection)
	
	assert_equal(0, test_graph.connections.size(), "Connection to node not in graph should be rejected")

func test_reject_connection_type_mismatch():
	test_graph.add_node(test_node1)
	test_graph.add_node(test_node2)
	
	var vector_input = PinData.new("vector_input", "vector3", PinData.PinType.INPUT)
	var node_with_vector = BaseNodeData.new("VectorNode", "VectorNode", Vector2(200, 0), [vector_input], [])
	test_graph.add_node(node_with_vector)
	
	var connection = ConnectionData.new(test_node1, output_pin, node_with_vector, vector_input)
	test_graph.add_connection(connection)
	
	assert_equal(0, test_graph.connections.size(), "Connection with type mismatch should be rejected")

# Test connection validation method directly
func test_validate_connection_valid():
	test_graph.add_node(test_node1)
	test_graph.add_node(test_node2)
	
	var connection = ConnectionData.new(test_node1, output_pin, test_node2, input_pin)
	var is_valid = test_graph.validate_connection(connection)
	
	assert_true(is_valid, "Valid connection should pass validation")

func test_validate_connection_invalid():
	test_graph.add_node(test_node1)
	
	var connection = ConnectionData.new(test_node1, output_pin, test_node1, input_pin)
	var is_valid = test_graph.validate_connection(connection)
	
	assert_false(is_valid, "Invalid connection should fail validation")

# Test graph properties
func test_graph_properties():
	test_graph.properties["custom_prop"] = "test_value"
	test_graph.properties["shader_type"] = "spatial"
	
	assert_equal("test_value", test_graph.properties["custom_prop"], "Custom property should be stored")
	assert_equal("spatial", test_graph.properties["shader_type"], "Shader type property should be stored")
	assert_equal(2, test_graph.properties.size(), "Properties dictionary should have correct size")

# Test graph file path
func test_graph_file_path():
	test_graph.file_path = "res://test_graph.json"
	assert_equal("res://test_graph.json", test_graph.file_path, "File path should be set correctly")

# Test graph version
func test_graph_version():
	test_graph.version = "2.0"
	assert_equal("2.0", test_graph.version, "Version should be updated correctly")

# Test all graph types
func test_all_graph_types():
	# Create separate arrays for each graph to avoid sharing
	var shader_graph = BaseGraphData.new("Shader", BaseGraphData.GraphType.SHADER_GRAPH, [], [])
	var group_graph = BaseGraphData.new("Group", BaseGraphData.GraphType.GROUP_GRAPH, [], [])
	var local_subgraph = BaseGraphData.new("Local", BaseGraphData.GraphType.LOCAL_SUBGRAPH, [], [])
	var global_subgraph = BaseGraphData.new("Global", BaseGraphData.GraphType.GLOBAL_SUBGRAPH, [], [])
	
	assert_equal(BaseGraphData.GraphType.SHADER_GRAPH, shader_graph.graph_type, "Shader graph type should be set")
	assert_equal(BaseGraphData.GraphType.GROUP_GRAPH, group_graph.graph_type, "Group graph type should be set")
	assert_equal(BaseGraphData.GraphType.LOCAL_SUBGRAPH, local_subgraph.graph_type, "Local subgraph type should be set")
	assert_equal(BaseGraphData.GraphType.GLOBAL_SUBGRAPH, global_subgraph.graph_type, "Global subgraph type should be set")