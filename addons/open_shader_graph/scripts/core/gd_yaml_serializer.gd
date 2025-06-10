@tool
class_name YAMLSerializer extends RefCounted

## Centralizes YAML serialization/deserialization for OpenShaderGraph
## Provides minimal data format for efficient storage and recreation

const NodeFactory = preload("res://addons/open_shader_graph/scripts/core/gd_node_factory.gd")

## Serializes a node to a minimal data format
static func serialize_node(node: BaseNode) -> Dictionary:
	if not node:
		return {}
	
	# Get the node type from NodeFactory using the script path (more reliable)
	var node_type: String = NodeFactory.get_node_type_from_instance(node)
	if node_type.is_empty():
		node_type = node.title if node.title else "Unknown"
	
	var node_data := {
		"id": node.name,
		"type": node_type,
		"properties": {},
		"position": {"x": node.position_offset.x, "y": node.position_offset.y},
		"index": node.get_node_index()
	}
	
	# Get node properties - this will depend on the specific node implementation
	var property_list: Array = node.get_property_list()
	for property in property_list:
		var prop_name: String = property.name
		# Skip built-in properties that shouldn't be serialized
		if _should_skip_property(prop_name):
			continue
		
		var value: Variant = node.get(prop_name)
		# Only serialize serializable types
		if _is_serializable_type(value):
			node_data.properties[prop_name] = _serialize_value(value)
	
	return node_data

## Deserializes a node from data format
static func deserialize_node(node_data: Dictionary) -> BaseNode:
	if node_data.is_empty():
		return null
	
	var node_type: String = node_data.get("type", "")
	var node_id: String = node_data.get("id", "")
	var properties: Dictionary = node_data.get("properties", {})
	var position: Dictionary = node_data.get("position", {"x": 0, "y": 0})
	var index: int = node_data.get("index", -1)
	
	# Create node using NodeFactory
	var node: BaseNode = NodeFactory.create_node(node_type)
	if not node:
		push_error("YAMLSerializer: Failed to create node of type: " + node_type)
		return null
	
	# Set node name
	node.name = node_id
	
	# Set position
	node.position_offset = Vector2(position.x, position.y)
	
	# Set index if provided
	if index >= 0:
		node.set_node_index(index)
	
	# Set properties
	for prop_name: String in properties:
		var value: Variant = _deserialize_value(properties[prop_name])
		if node.has_method("set") and prop_name in node:
			node.set(prop_name, value)
	
	return node

## Serializes a connection to minimal format
static func serialize_connection(from_node: String, from_port: int, to_node: String, to_port: int) -> Dictionary:
	return {
		"from": from_node + ":" + str(from_port),
		"to": to_node + ":" + str(to_port)
	}

## Deserializes a connection from data format
static func deserialize_connection(connection_data: Dictionary) -> Dictionary:
	var from_str: String = connection_data.get("from", "")
	var to_str: String = connection_data.get("to", "")
	
	var from_parts: PackedStringArray = from_str.split(":")
	var to_parts: PackedStringArray = to_str.split(":")
	
	if from_parts.size() != 2 or to_parts.size() != 2:
		push_error("YAMLSerializer: Invalid connection format")
		return {}
	
	return {
		"from_node": from_parts[0],
		"from_port": from_parts[1].to_int(),
		"to_node": to_parts[0],
		"to_port": to_parts[1].to_int()
	}

## Serializes graph metadata
static func serialize_graph_metadata(graph_edit: GraphEdit) -> Dictionary:
	var metadata := {
		"version": "1.0",
		"created_at": Time.get_unix_time_from_system(),
		"total_nodes": 0,
		"total_connections": 0
	}
	
	if graph_edit:
		# Count nodes
		for child in graph_edit.get_children():
			if child is BaseNode:
				metadata.total_nodes += 1
		
		# Get connections from connection manager if available
		if graph_edit.has_method("get_connections"):
			var connections: Array = graph_edit.get_connections()
			metadata.total_connections = connections.size()
	
	return metadata

## Serializes entire graph to YAML-compatible format
static func serialize_graph(graph_edit: GraphEdit) -> Dictionary:
	var graph_data := {
		"metadata": serialize_graph_metadata(graph_edit),
		"nodes": [],
		"connections": []
	}
	
	if not graph_edit:
		return graph_data
	
	# Serialize nodes
	for child in graph_edit.get_children():
		if child is BaseNode:
			var node_data: Dictionary = serialize_node(child)
			if not node_data.is_empty():
				graph_data.nodes.append(node_data)
	
	# Serialize connections
	if graph_edit.has_method("get_connections"):
		var connections: Array = graph_edit.get_connections()
		for conn in connections:
			if conn is Dictionary:
				var connection_data: Dictionary = serialize_connection(
					conn.get("from_node", ""),
					conn.get("from_port", 0),
					conn.get("to_node", ""),
					conn.get("to_port", 0)
				)
				graph_data.connections.append(connection_data)
	
	return graph_data

## Recreates a graph from YAML-compatible data
static func deserialize_graph(graph_data: Dictionary, graph_edit: GraphEdit) -> bool:
	if not graph_edit or graph_data.is_empty():
		return false
	
	var nodes_data: Array = graph_data.get("nodes", [])
	var connections_data: Array = graph_data.get("connections", [])
	var metadata: Dictionary = graph_data.get("metadata", {})
	
	# Clear existing graph
	_clear_graph(graph_edit)
	
	# Recreate nodes
	var created_nodes: Dictionary = {}
	for node_data in nodes_data:
		var node: BaseNode = deserialize_node(node_data)
		if node:
			# Ensure unique name
			var unique_name: String = _ensure_unique_node_name(graph_edit, node.name)
			node.name = unique_name
			created_nodes[node_data.get("id", "")] = node
			graph_edit.add_child(node)
	
	# Wait a frame for nodes to be fully added
	await graph_edit.get_tree().process_frame
	
	# Recreate connections
	if graph_edit.has_method("get_connection_manager"):
		var connection_manager = graph_edit.get_connection_manager()
		if connection_manager:
			for connection_data in connections_data:
				var conn: Dictionary = deserialize_connection(connection_data)
				if not conn.is_empty():
					connection_manager.handle_connection_request(
						conn.from_node,
						conn.from_port,
						conn.to_node,
						conn.to_port
					)
	
	if OS.is_debug_build():
		print("[DEBUG] YAMLSerializer: Graph deserialized (", nodes_data.size(), " nodes, ", connections_data.size(), " connections)")
	
	return true

## Converts graph data to YAML string (if YAML support is available)
static func to_yaml_string(graph_data: Dictionary) -> String:
	# For now, we'll use JSON format as a placeholder
	# TODO: Implement actual YAML formatting when needed
	return JSON.stringify(graph_data, "  ")

## Parses YAML string to graph data (if YAML support is available)
static func from_yaml_string(yaml_string: String) -> Dictionary:
	# For now, we'll use JSON parsing as a placeholder
	# TODO: Implement actual YAML parsing when needed
	var json := JSON.new()
	var parse_result := json.parse(yaml_string)
	
	if parse_result != OK:
		push_error("YAMLSerializer: Failed to parse JSON data")
		return {}
	
	var data: Variant = json.data
	if data is Dictionary:
		return data
	else:
		push_error("YAMLSerializer: Parsed data is not a Dictionary")
		return {}

## Helper methods

## Checks if a property should be skipped during serialization
static func _should_skip_property(prop_name: String) -> bool:
	var skip_properties: PackedStringArray = [
		"script", "name", "owner", "scene_file_path", "visible", "modulate",
		"self_modulate", "show_behind_parent", "top_level", "clip_contents",
		"light_mask", "visibility_layer", "z_index", "z_as_relative", "y_sort_enabled",
		"texture_filter", "texture_repeat", "material", "use_parent_material"
	]
	
	return prop_name.begins_with("_") or prop_name in skip_properties

## Checks if a value can be serialized
static func _is_serializable_type(value: Variant) -> bool:
	return value == null or value is bool or value is int or value is float or \
	       value is String or value is Vector2 or value is Vector3 or value is Vector4 or \
	       value is Color or value is Array or value is Dictionary

## Serializes a value to a simplified format
static func _serialize_value(value: Variant) -> Variant:
	if value is Vector2:
		return {"x": value.x, "y": value.y}
	elif value is Vector3:
		return {"x": value.x, "y": value.y, "z": value.z}
	elif value is Vector4:
		return {"x": value.x, "y": value.y, "z": value.z, "w": value.w}
	elif value is Color:
		return {"r": value.r, "g": value.g, "b": value.b, "a": value.a}
	else:
		return value

## Deserializes a value from simplified format
static func _deserialize_value(value: Variant) -> Variant:
	if value is Dictionary:
		if "x" in value and "y" in value:
			if "z" in value and "w" in value:
				return Vector4(value.x, value.y, value.z, value.w)
			elif "z" in value:
				return Vector3(value.x, value.y, value.z)
			else:
				return Vector2(value.x, value.y)
		elif "r" in value and "g" in value and "b" in value:
			return Color(value.r, value.g, value.b, value.get("a", 1.0))
	
	return value

## Clears all nodes from the graph
static func _clear_graph(graph_edit: GraphEdit) -> void:
	if not graph_edit:
		return
	
	# Clear connections if connection manager is available
	if graph_edit.has_method("get_connection_manager"):
		var connection_manager = graph_edit.get_connection_manager()
		if connection_manager and connection_manager.has_method("clear_connections"):
			connection_manager.clear_connections()
	
	# Remove all BaseNode children
	for child in graph_edit.get_children():
		if child is BaseNode:
			child.queue_free()
	
	if OS.is_debug_build():
		print("[DEBUG] YAMLSerializer: Graph cleared")

## Ensures a node name is unique within the graph
static func _ensure_unique_node_name(graph_edit: GraphEdit, base_name: String) -> String:
	var unique_name: String = base_name
	var counter: int = 1
	
	# Check if name already exists
	while graph_edit.get_node_or_null(NodePath(unique_name)) != null:
		unique_name = base_name + "_" + str(counter)
		counter += 1
	
	return unique_name