extends GutTest

# Test cases for OpenShaderGraphAsset resource serialization
class_name TestOpenShaderGraphAsset

const OpenShaderGraphAsset = preload("res://addons/open_shader_graph/scripts/resources/gd_open_shader_graph_asset.gd")

var asset: OpenShaderGraphAsset

func before_each():
	asset = OpenShaderGraphAsset.new()

func after_each():
	if asset:
		asset.clear()

func test_initialization():
	# Test that asset initializes with empty arrays and properties
	assert_not_null(asset.nodes, "Nodes array should be initialized")
	assert_not_null(asset.connections, "Connections array should be initialized")
	assert_not_null(asset.graph_properties, "Graph properties should be initialized")
	assert_eq(asset.nodes.size(), 0, "Nodes array should be empty initially")
	assert_eq(asset.connections.size(), 0, "Connections array should be empty initially")
	assert_eq(asset.graph_properties.size(), 0, "Graph properties should be empty initially")
	assert_eq(asset.version, "1.0.0", "Version should be 1.0.0")

func test_add_node():
	# Test adding a node
	var node_id: String = "test_node_1"
	var node_type: String = "TestType"
	var properties: Dictionary = {"value": 42}
	var position: Dictionary = {"x": 100, "y": 200}
	
	asset.add_node(node_id, node_type, properties, position)
	
	assert_eq(asset.nodes.size(), 1, "Should have one node")
	
	var node: Dictionary = asset.nodes[0]
	assert_eq(node.id, node_id, "Node ID should match")
	assert_eq(node.type, node_type, "Node type should match")
	assert_eq(node.properties.value, 42, "Node properties should match")
	assert_eq(node.position.x, 100, "Node position X should match")
	assert_eq(node.position.y, 200, "Node position Y should match")

func test_add_node_with_defaults():
	# Test adding a node with default parameters
	var node_id: String = "test_node_2"
	var node_type: String = "DefaultType"
	
	asset.add_node(node_id, node_type)
	
	assert_eq(asset.nodes.size(), 1, "Should have one node")
	
	var node: Dictionary = asset.nodes[0]
	assert_eq(node.id, node_id, "Node ID should match")
	assert_eq(node.type, node_type, "Node type should match")
	assert_true(node.properties is Dictionary, "Properties should be a dictionary")
	assert_eq(node.properties.size(), 0, "Properties should be empty")
	assert_eq(node.position.x, 0, "Default position X should be 0")
	assert_eq(node.position.y, 0, "Default position Y should be 0")

func test_remove_node():
	# Test removing a node
	asset.add_node("node1", "Type1")
	asset.add_node("node2", "Type2")
	
	assert_eq(asset.nodes.size(), 2, "Should have two nodes")
	
	asset.remove_node("node1")
	
	assert_eq(asset.nodes.size(), 1, "Should have one node after removal")
	assert_eq(asset.nodes[0].id, "node2", "Remaining node should be node2")

func test_remove_node_with_connections():
	# Test that removing a node also removes its connections
	asset.add_node("node1", "Type1")
	asset.add_node("node2", "Type2")
	asset.add_connection("node1", 0, "node2", 0)
	
	assert_eq(asset.connections.size(), 1, "Should have one connection")
	
	asset.remove_node("node1")
	
	assert_eq(asset.connections.size(), 0, "Connections should be removed with node")

func test_get_node():
	# Test getting a node by ID
	asset.add_node("test_node", "TestType", {"value": 123})
	
	var node: Dictionary = asset.get_node("test_node")
	assert_false(node.is_empty(), "Should return a valid node")
	assert_eq(node.id, "test_node", "Node ID should match")
	assert_eq(node.properties.value, 123, "Node properties should match")
	
	var missing_node: Dictionary = asset.get_node("nonexistent")
	assert_true(missing_node.is_empty(), "Should return empty dictionary for missing node")

func test_add_connection():
	# Test adding a connection
	asset.add_node("node1", "Type1")
	asset.add_node("node2", "Type2")
	
	asset.add_connection("node1", 0, "node2", 1)
	
	assert_eq(asset.connections.size(), 1, "Should have one connection")
	
	var connection: Dictionary = asset.connections[0]
	assert_eq(connection.from, "node1:0", "From reference should be correct")
	assert_eq(connection.to, "node2:1", "To reference should be correct")

func test_remove_connection():
	# Test removing a specific connection
	asset.add_node("node1", "Type1")
	asset.add_node("node2", "Type2")
	asset.add_connection("node1", 0, "node2", 1)
	asset.add_connection("node1", 1, "node2", 0)
	
	assert_eq(asset.connections.size(), 2, "Should have two connections")
	
	asset.remove_connection("node1", 0, "node2", 1)
	
	assert_eq(asset.connections.size(), 1, "Should have one connection after removal")
	assert_eq(asset.connections[0].from, "node1:1", "Remaining connection should be correct")

func test_get_node_connections():
	# Test getting all connections for a specific node
	asset.add_node("node1", "Type1")
	asset.add_node("node2", "Type2")
	asset.add_node("node3", "Type3")
	
	asset.add_connection("node1", 0, "node2", 0)
	asset.add_connection("node2", 0, "node3", 0)
	asset.add_connection("node1", 1, "node3", 1)
	
	var node1_connections: Array = asset.get_node_connections("node1")
	assert_eq(node1_connections.size(), 2, "Node1 should have 2 connections")
	
	var node2_connections: Array = asset.get_node_connections("node2")
	assert_eq(node2_connections.size(), 2, "Node2 should have 2 connections (1 input, 1 output)")
	
	var node3_connections: Array = asset.get_node_connections("node3")
	assert_eq(node3_connections.size(), 2, "Node3 should have 2 connections")

func test_graph_properties():
	# Test setting and getting graph properties
	asset.set_graph_property("background_color", Color.BLACK)
	asset.set_graph_property("grid_size", 20)
	
	assert_eq(asset.get_graph_property("background_color"), Color.BLACK, "Background color should match")
	assert_eq(asset.get_graph_property("grid_size"), 20, "Grid size should match")
	assert_null(asset.get_graph_property("nonexistent"), "Nonexistent property should return null")
	assert_eq(asset.get_graph_property("nonexistent", "default"), "default", "Should return default value")

func test_validation_valid_graph():
	# Test validation of a valid graph
	asset.add_node("node1", "Type1")
	asset.add_node("node2", "Type2")
	asset.add_connection("node1", 0, "node2", 0)
	
	assert_true(asset.validate(), "Valid graph should pass validation")

func test_validation_invalid_node_structure():
	# Test validation with invalid node structure
	asset.nodes.append({"type": "Type1"}) # Missing ID
	
	assert_false(asset.validate(), "Graph with invalid node should fail validation")

func test_validation_invalid_connection_structure():
	# Test validation with invalid connection structure
	asset.add_node("node1", "Type1")
	asset.connections.append({"from": "node1:0"}) # Missing 'to'
	
	assert_false(asset.validate(), "Graph with invalid connection should fail validation")

func test_validation_invalid_connection_format():
	# Test validation with invalid connection reference format
	asset.add_node("node1", "Type1")
	asset.connections.append({"from": "node1", "to": "node2:0"}) # Invalid format
	
	assert_false(asset.validate(), "Graph with invalid connection format should fail validation")

func test_clear():
	# Test clearing all data
	asset.add_node("node1", "Type1")
	asset.add_connection("node1", 0, "node1", 1)
	asset.set_graph_property("test", "value")
	
	asset.clear()
	
	assert_eq(asset.nodes.size(), 0, "Nodes should be cleared")
	assert_eq(asset.connections.size(), 0, "Connections should be cleared")
	assert_eq(asset.graph_properties.size(), 0, "Graph properties should be cleared")

func test_duplicate_graph():
	# Test creating a deep copy of the graph
	asset.add_node("node1", "Type1", {"value": 42})
	asset.add_connection("node1", 0, "node1", 1)
	asset.set_graph_property("test", {"nested": true})
	
	var duplicate: OpenShaderGraphAsset = asset.duplicate_graph()
	
	assert_not_null(duplicate, "Duplicate should not be null")
	assert_ne(duplicate, asset, "Duplicate should be a different instance")
	assert_eq(duplicate.nodes.size(), asset.nodes.size(), "Duplicate should have same number of nodes")
	assert_eq(duplicate.connections.size(), asset.connections.size(), "Duplicate should have same number of connections")
	assert_eq(duplicate.graph_properties.size(), asset.graph_properties.size(), "Duplicate should have same graph properties")
	
	# Test that it's a deep copy
	duplicate.nodes[0].properties.value = 99
	assert_eq(asset.nodes[0].properties.value, 42, "Original should not be affected by duplicate changes")

func test_connection_reference_validation():
	# Test the internal connection reference validation
	assert_true(asset._is_valid_connection_reference("node1:0"), "Valid reference should pass")
	assert_true(asset._is_valid_connection_reference("node_name:123"), "Valid reference with underscore should pass")
	assert_false(asset._is_valid_connection_reference("node1"), "Reference without pin should fail")
	assert_false(asset._is_valid_connection_reference(":0"), "Reference without node should fail")
	assert_false(asset._is_valid_connection_reference("node1:"), "Reference without pin number should fail")
	assert_false(asset._is_valid_connection_reference("node1:abc"), "Reference with non-numeric pin should fail")