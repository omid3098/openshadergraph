extends GutTest

# Test cases for YAML Serializer static methods
class_name TestYAMLSerializer

const YAMLSerializer = preload("res://addons/open_shader_graph/scripts/core/gd_yaml_serializer.gd")
const BaseNode = preload("res://addons/open_shader_graph/scripts/nodes/gd_base_node.gd")

var test_node: BaseNode
var mock_graph_edit: GraphEdit

func before_each():
	test_node = autofree(BaseNode.new())
	test_node.name = "test_node"
	mock_graph_edit = autofree(GraphEdit.new())

func after_each():
	gut.p("Cleaning up YAML serializer test")

func test_serialize_node():
	# Test serializing a basic node
	var node_data: Dictionary = YAMLSerializer.serialize_node(test_node)
	
	assert_not_null(node_data, "Should return node data")
	assert_true(node_data is Dictionary, "Node data should be a dictionary")
	assert_true(node_data.has("id"), "Should have id field")
	assert_true(node_data.has("type"), "Should have type field")
	assert_true(node_data.has("properties"), "Should have properties field")
	assert_true(node_data.has("position"), "Should have position field")

func test_serialize_node_null():
	# Test serializing null node
	var node_data: Dictionary = YAMLSerializer.serialize_node(null)
	
	assert_true(node_data.is_empty(), "Null node should return empty dictionary")

func test_serialize_connection():
	# Test serializing a connection
	var connection_data: Dictionary = YAMLSerializer.serialize_connection("node1", 0, "node2", 1)
	
	assert_not_null(connection_data, "Should return connection data")
	assert_true(connection_data is Dictionary, "Connection data should be a dictionary")
	assert_true(connection_data.has("from"), "Should have from field")
	assert_true(connection_data.has("to"), "Should have to field")
	assert_eq(connection_data.from, "node1:0", "From field should be formatted correctly")
	assert_eq(connection_data.to, "node2:1", "To field should be formatted correctly")

func test_deserialize_connection():
	# Test deserializing a connection
	var connection_data: Dictionary = {"from": "node1:0", "to": "node2:1"}
	var deserialized: Dictionary = YAMLSerializer.deserialize_connection(connection_data)
	
	assert_not_null(deserialized, "Should return deserialized connection")
	assert_true(deserialized is Dictionary, "Should be a dictionary")
	assert_eq(deserialized.from_node, "node1", "From node should be correct")
	assert_eq(deserialized.from_port, 0, "From port should be correct")
	assert_eq(deserialized.to_node, "node2", "To node should be correct")
	assert_eq(deserialized.to_port, 1, "To port should be correct")

func test_deserialize_connection_invalid():
	# Test deserializing invalid connection data
	var invalid_data: Dictionary = {"from": "invalid", "to": "also_invalid"}
	var deserialized: Dictionary = YAMLSerializer.deserialize_connection(invalid_data)
	
	assert_true(deserialized.is_empty(), "Invalid connection data should return empty dictionary")

func test_serialize_graph_metadata():
	# Test serializing graph metadata
	var metadata: Dictionary = YAMLSerializer.serialize_graph_metadata(mock_graph_edit)
	
	assert_not_null(metadata, "Should return metadata")
	assert_true(metadata is Dictionary, "Metadata should be a dictionary")
	assert_true(metadata.has("version"), "Should have version field")
	assert_true(metadata.has("created_at"), "Should have created_at field")
	assert_true(metadata.has("total_nodes"), "Should have total_nodes field")
	assert_true(metadata.has("total_connections"), "Should have total_connections field")

func test_serialize_graph_metadata_null():
	# Test serializing metadata with null graph
	var metadata: Dictionary = YAMLSerializer.serialize_graph_metadata(null)
	
	assert_not_null(metadata, "Should return metadata even with null graph")
	assert_true(metadata is Dictionary, "Should be a dictionary")
	assert_eq(metadata.total_nodes, 0, "Should have 0 nodes for null graph")

func test_serialize_graph_empty():
	# Test serializing an empty graph
	var graph_data: Dictionary = YAMLSerializer.serialize_graph(mock_graph_edit)
	
	assert_not_null(graph_data, "Should return graph data")
	assert_true(graph_data is Dictionary, "Graph data should be a dictionary")
	assert_true(graph_data.has("metadata"), "Should have metadata field")
	assert_true(graph_data.has("nodes"), "Should have nodes field")
	assert_true(graph_data.has("connections"), "Should have connections field")
	assert_eq(graph_data.nodes.size(), 0, "Empty graph should have no nodes")
	assert_eq(graph_data.connections.size(), 0, "Empty graph should have no connections")

func test_serialize_graph_null():
	# Test serializing null graph
	var graph_data: Dictionary = YAMLSerializer.serialize_graph(null)
	
	assert_not_null(graph_data, "Should return graph data even for null graph")
	assert_true(graph_data is Dictionary, "Should be a dictionary")
	assert_eq(graph_data.nodes.size(), 0, "Null graph should have no nodes")

func test_connection_format():
	# Test the connection string format
	var from_node: String = "test_node_1"
	var from_port: int = 3
	var to_node: String = "test_node_2"
	var to_port: int = 7
	
	var connection_data: Dictionary = YAMLSerializer.serialize_connection(from_node, from_port, to_node, to_port)
	var expected_from: String = from_node + ":" + str(from_port)
	var expected_to: String = to_node + ":" + str(to_port)
	
	assert_eq(connection_data.from, expected_from, "From format should be node:port")
	assert_eq(connection_data.to, expected_to, "To format should be node:port")

func test_node_serialization_preserves_name():
	# Test that node serialization preserves the node name as ID
	test_node.name = "special_node_name"
	var node_data: Dictionary = YAMLSerializer.serialize_node(test_node)
	
	assert_eq(node_data.id, "special_node_name", "Node ID should match node name")

func test_node_serialization_includes_position():
	# Test that node serialization includes position data
	test_node.position_offset = Vector2(100, 200)
	var node_data: Dictionary = YAMLSerializer.serialize_node(test_node)
	
	assert_true(node_data.position is Dictionary, "Position should be a dictionary")
	assert_eq(node_data.position.x, 100, "X position should be preserved")
	assert_eq(node_data.position.y, 200, "Y position should be preserved")

func test_round_trip_connection():
	# Test serializing and deserializing a connection preserves data
	var original_connection: Dictionary = YAMLSerializer.serialize_connection("node_a", 2, "node_b", 5)
	var deserialized: Dictionary = YAMLSerializer.deserialize_connection(original_connection)
	
	assert_eq(deserialized.from_node, "node_a", "From node should be preserved")
	assert_eq(deserialized.from_port, 2, "From port should be preserved")
	assert_eq(deserialized.to_node, "node_b", "To node should be preserved")
	assert_eq(deserialized.to_port, 5, "To port should be preserved")