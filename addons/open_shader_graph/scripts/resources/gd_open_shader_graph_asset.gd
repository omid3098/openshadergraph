class_name OpenShaderGraphAsset extends Resource

## Base class for all graph resources in OpenShaderGraph
## Contains the fundamental data structure for nodes, connections, and graph properties
## Designed for minimal serialization without visual representation data

## Array of node data dictionaries
## Each dictionary contains: id (String), type (String), properties (Dictionary), position (Dictionary)
@export var nodes: Array[Dictionary] = []

## Array of connection data dictionaries  
## Each dictionary contains: from (String), to (String)
## Format: "node_id:pin_index" -> "node_id:pin_index"
@export var connections: Array[Dictionary] = []

## Dictionary containing graph-level properties and metadata
## Used for storing configuration that applies to the entire graph
@export var graph_properties: Dictionary = {}

## Version number for compatibility and migration purposes
@export var version: String = "1.0.0"

func _init():
	nodes = []
	connections = []
	graph_properties = {}

## Validates the integrity of the graph resource
## Returns true if the resource is valid, false otherwise
func validate() -> bool:
	# Check that all required fields exist
	if nodes == null or connections == null or graph_properties == null:
		push_error("OpenShaderGraphAsset: Missing required fields")
		return false
	
	# Validate node structure
	for i in range(nodes.size()):
		var node = nodes[i]
		if not node.has("id") or not node.has("type"):
			push_error("OpenShaderGraphAsset: Invalid node structure at index " + str(i))
			return false
		
		if not node.has("properties"):
			node["properties"] = {}
		
		if not node.has("position"):
			node["position"] = {"x": 0, "y": 0}
	
	# Validate connection structure
	for i in range(connections.size()):
		var connection = connections[i]
		if not connection.has("from") or not connection.has("to"):
			push_error("OpenShaderGraphAsset: Invalid connection structure at index " + str(i))
			return false
		
		# Validate connection format (node_id:pin_index)
		if not _is_valid_connection_reference(connection["from"]) or not _is_valid_connection_reference(connection["to"]):
			push_error("OpenShaderGraphAsset: Invalid connection reference format at index " + str(i))
			return false
	
	return true

## Helper function to validate connection reference format
func _is_valid_connection_reference(ref: String) -> bool:
	var parts = ref.split(":")
	return parts.size() == 2 and parts[0].length() > 0 and parts[1].is_valid_int()

## Adds a node to the graph
func add_node(node_id: String, node_type: String, properties: Dictionary = {}, position: Dictionary = {"x": 0, "y": 0}) -> void:
	var node_data = {
		"id": node_id,
		"type": node_type,
		"properties": properties,
		"position": position
	}
	nodes.append(node_data)

## Removes a node from the graph by ID
func remove_node(node_id: String) -> void:
	# Remove the node
	for i in range(nodes.size() - 1, -1, -1):
		if nodes[i]["id"] == node_id:
			nodes.remove_at(i)
			break
	
	# Remove all connections involving this node
	for i in range(connections.size() - 1, -1, -1):
		var connection = connections[i]
		var from_parts = connection["from"].split(":")
		var to_parts = connection["to"].split(":")
		
		if from_parts[0] == node_id or to_parts[0] == node_id:
			connections.remove_at(i)

## Adds a connection between two nodes
func add_connection(from_node: String, from_pin: int, to_node: String, to_pin: int) -> void:
	var connection = {
		"from": from_node + ":" + str(from_pin),
		"to": to_node + ":" + str(to_pin)
	}
	connections.append(connection)

## Removes a connection between two nodes
func remove_connection(from_node: String, from_pin: int, to_node: String, to_pin: int) -> void:
	var connection_ref = {
		"from": from_node + ":" + str(from_pin),
		"to": to_node + ":" + str(to_pin)
	}
	
	for i in range(connections.size() - 1, -1, -1):
		var connection = connections[i]
		if connection["from"] == connection_ref["from"] and connection["to"] == connection_ref["to"]:
			connections.remove_at(i)
			break

## Gets a node by its ID
func get_node(node_id: String) -> Dictionary:
	for node in nodes:
		if node["id"] == node_id:
			return node
	return {}

## Gets all connections for a specific node
func get_node_connections(node_id: String) -> Array[Dictionary]:
	var node_connections: Array[Dictionary] = []
	
	for connection in connections:
		var from_parts = connection["from"].split(":")
		var to_parts = connection["to"].split(":")
		
		if from_parts[0] == node_id or to_parts[0] == node_id:
			node_connections.append(connection)
	
	return node_connections

## Sets a graph property
func set_graph_property(key: String, value) -> void:
	graph_properties[key] = value

## Gets a graph property
func get_graph_property(key: String, default_value = null):
	return graph_properties.get(key, default_value)

## Clears all data from the resource
func clear() -> void:
	nodes.clear()
	connections.clear()
	graph_properties.clear()

## Creates a deep copy of this resource
func duplicate_graph() -> OpenShaderGraphAsset:
	var duplicate = OpenShaderGraphAsset.new()
	
	# Deep copy nodes
	for node in nodes:
		duplicate.nodes.append(node.duplicate(true))
	
	# Deep copy connections
	for connection in connections:
		duplicate.connections.append(connection.duplicate(true))
	
	# Deep copy graph properties
	duplicate.graph_properties = graph_properties.duplicate(true)
	duplicate.version = version
	
	return duplicate