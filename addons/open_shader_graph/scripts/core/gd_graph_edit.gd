@tool
extends GraphEdit

# Preload required classes
const OpenShaderResourceManager = preload("res://addons/open_shader_graph/scripts/resources/gd_open_shader_resource_manager.gd")
const NodeFactory = preload("res://addons/open_shader_graph/scripts/core/gd_node_factory.gd")

signal right_clicked(global_mouse_position)
signal shader_node_selected(node)
signal nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int)
signal nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int)

# Connection tracking
var node_connections: Array[Dictionary] = []

# Node index management for shader code generation
var next_node_index: int = 0

# Resource management
var current_resource: OpenShaderGraphAsset = null
var resource_file_path: String = ""

# Signal emitted when resource is loaded or changed
signal resource_changed(resource: OpenShaderGraphAsset)

# We use the _gui_input function to detect mouse clicks on this specific node.
func _gui_input(event: InputEvent) -> void:
	# Check for a right mouse button click.
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.is_pressed():
		# Emit the signal, providing the current global mouse position.
		# The main plugin will listen for this.
		emit_signal("right_clicked", get_global_mouse_position())
		accept_event()

# When a child node is added, connect to its selection signal and assign index
func _on_child_entered_tree(node):
	if node is BaseNode:
		node.node_selection_changed.connect(_on_node_selection_changed)
		# Assign a unique index to the node
		node.set_node_index(next_node_index)
		next_node_index += 1
		print("[DEBUG] Assigned index ", node.get_node_index(), " to node: ", node.name)

# When a child node is removed, we may need to recompact indices (optional)
func _on_child_exiting_tree(node):
	if node is BaseNode:
		print("[DEBUG] Node with index ", node.get_node_index(), " is being removed: ", node.name)
		# Note: We could recompact indices here, but for shader generation
		# it might be better to keep stable indices until a full reindex is needed

func _on_node_selection_changed(selected_node: BaseNode):
	emit_signal("shader_node_selected", selected_node)

func _ready():
	# Connect to child management signals
	child_entered_tree.connect(_on_child_entered_tree)
	child_exiting_tree.connect(_on_child_exiting_tree)
	
	# Connect to GraphEdit's connection signals
	connection_request.connect(_on_connection_request)
	disconnection_request.connect(_on_disconnection_request)
	
	# Enable right-click on background to delete connections
	delete_nodes_request.connect(_on_delete_nodes_request)
	
	print("[DEBUG] GraphEdit: Connection signals connected and node index management initialized")

func _on_connection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int):
	print("[DEBUG] Connection request: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	
	# Validate the connection
	if _is_valid_connection(from_node, from_port, to_node, to_port):
		# Create the connection visually
		connect_node(from_node, from_port, to_node, to_port)
		
		# Track the connection
		var connection_data = {
			"from_node": str(from_node),
			"from_port": from_port,
			"to_node": str(to_node),
			"to_port": to_port
		}
		node_connections.append(connection_data)
		
		# Update the receiving node's input
		_update_node_input(to_node, to_port, from_node, from_port)
		
		# Emit signal for external listeners
		emit_signal("nodes_connected", str(from_node), from_port, str(to_node), to_port)
		
		print("[DEBUG] Connection created successfully")
	else:
		print("[DEBUG] Connection rejected - validation failed")

func _on_disconnection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int):
	print("[DEBUG] Disconnection request: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	
	# Remove the connection visually
	disconnect_node(from_node, from_port, to_node, to_port)
	
	# Remove from tracking
	var connection_found = false
	for i in range(node_connections.size() - 1, -1, -1):
		var conn = node_connections[i]
		if conn.from_node == str(from_node) and conn.from_port == from_port and conn.to_node == str(to_node) and conn.to_port == to_port:
			node_connections.remove_at(i)
			connection_found = true
			break
	
	# Reset the receiving node's input to default
	_reset_node_input(to_node, to_port)
	
	# Emit signal for external listeners
	emit_signal("nodes_disconnected", str(from_node), from_port, str(to_node), to_port)
	
	print("[DEBUG] Connection removed successfully")

func _on_delete_nodes_request(nodes: Array):
	print("[DEBUG] Delete nodes request: ", nodes)
	# Handle node deletion - disconnect all connections to/from deleted nodes
	for node_name in nodes:
		_disconnect_all_node_connections(node_name)

func _is_valid_connection(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> bool:
	# Don't allow self-connections
	if from_node == to_node:
		print("[DEBUG] Connection validation failed: self-connection not allowed")
		return false
	
	# Get the actual node objects
	var from_node_obj = get_node_or_null(NodePath(from_node))
	var to_node_obj = get_node_or_null(NodePath(to_node))
	
	if not from_node_obj or not to_node_obj:
		print("[DEBUG] Connection validation failed: node not found")
		return false
	
	# Check if both nodes inherit from BaseNode
	if not (from_node_obj is BaseNode and to_node_obj is BaseNode):
		print("[DEBUG] Connection validation failed: not BaseNode instances")
		return false
	
	# Check if target port already has a connection (only one input per port)
	for conn in node_connections:
		if conn.to_node == str(to_node) and conn.to_port == to_port:
			print("[DEBUG] Connection validation failed: target port already connected")
			return false
	
	# Type validation would go here - for now, allow all connections
	# TODO: Add pin type compatibility checking
	
	return true

func _update_node_input(to_node: StringName, to_port: int, from_node: StringName, from_port: int):
	var to_node_obj = get_node_or_null(NodePath(to_node))
	var from_node_obj = get_node_or_null(NodePath(from_node))
	
	if not to_node_obj or not from_node_obj:
		return
	
	# Update input based on node type and port
	if to_node_obj is BaseMathNode:
		var output_value = _get_node_output_value(from_node_obj, from_port)
		if to_port == 0: # Input A
			to_node_obj.set_input_a(output_value)
		elif to_port == 1: # Input B
			to_node_obj.set_input_b(output_value)
	
	print("[DEBUG] Updated node input: ", to_node, " port ", to_port, " with value from ", from_node)

func _reset_node_input(to_node: StringName, to_port: int):
	var to_node_obj = get_node_or_null(NodePath(to_node))
	
	if not to_node_obj:
		return
	
	# Reset input to default value based on node type and port
	if to_node_obj is BaseMathNode:
		if to_port == 0: # Input A
			to_node_obj.set_input_a(to_node_obj.get_default_input_a())
		elif to_port == 1: # Input B
			to_node_obj.set_input_b(to_node_obj.get_default_input_b())
	
	print("[DEBUG] Reset node input: ", to_node, " port ", to_port, " to default")

func _get_node_output_value(node: BaseNode, port: int) -> float:
	# Get output value from a node based on its type
	if node is BaseMathNode:
		return node.get_output_value()
	elif node is BaseConstantNode:
		var value = node.get_output_value()
		if value is float:
			return value
		elif value is int:
			return float(value)
		else:
			return 0.0
	
	return 0.0

func _disconnect_all_node_connections(node_name: String):
	var connections_to_remove = []
	
	# Find all connections involving this node
	for i in range(node_connections.size()):
		var conn = node_connections[i]
		if conn.from_node == node_name or conn.to_node == node_name:
			connections_to_remove.append(i)
			
			# Remove visual connection
			disconnect_node(conn.from_node, conn.from_port, conn.to_node, conn.to_port)
			
			# Reset input if this was an input connection
			if conn.to_node != node_name:
				_reset_node_input(conn.to_node, conn.to_port)
	
	# Remove connections from tracking (reverse order to maintain indices)
	connections_to_remove.reverse()
	for i in connections_to_remove:
		node_connections.remove_at(i)
	
	print("[DEBUG] Disconnected all connections for node: ", node_name)

# Public API for external access
func get_connections() -> Array[Dictionary]:
	return node_connections.duplicate()

# Get all nodes sorted by their index (useful for shader code generation)
func get_nodes_by_index() -> Array[BaseNode]:
	var nodes: Array[BaseNode] = []
	
	# Collect all BaseNode children
	for child in get_children():
		if child is BaseNode:
			nodes.append(child)
	
	# Sort by index
	nodes.sort_custom(func(a, b): return a.get_node_index() < b.get_node_index())
	
	return nodes

# Recompact node indices (removes gaps in numbering)
func recompact_node_indices():
	var nodes = get_nodes_by_index()
	next_node_index = 0
	
	for node in nodes:
		node.set_node_index(next_node_index)
		next_node_index += 1
		print("[DEBUG] Recompacted node index: ", node.get_node_index(), " for node: ", node.name)
	
	print("[DEBUG] Node indices recompacted. Next index will be: ", next_node_index)

# Get the current next index (useful for external components)
func get_next_node_index() -> int:
	return next_node_index

# Resource Management API

## Sets the current resource for this graph
func set_current_resource(resource: OpenShaderGraphAsset, file_path: String = ""):
	current_resource = resource
	resource_file_path = file_path
	
	if current_resource:
		# Load the graph from the resource
		_load_graph_from_resource()
		emit_signal("resource_changed", current_resource)
		print("[DEBUG] GraphEdit: Resource set and loaded - ", file_path if file_path else "unsaved")
	else:
		print("[DEBUG] GraphEdit: Resource cleared")

## Gets the current resource
func get_current_resource() -> OpenShaderGraphAsset:
	return current_resource

## Gets the current resource file path
func get_resource_file_path() -> String:
	return resource_file_path

## Saves the current graph state to the resource
func save_graph_to_resource() -> bool:
	if not current_resource:
		push_error("GraphEdit: No resource to save to")
		return false
	
	# Clear existing data
	current_resource.clear()
	
	# Save nodes
	for child in get_children():
		if child is BaseNode:
			var node_data = _serialize_node(child)
			current_resource.add_node(node_data.id, node_data.type, node_data.properties, node_data.position)
	
	# Save connections
	for connection in node_connections:
		current_resource.add_connection(connection.from_node, connection.from_port, connection.to_node, connection.to_port)
	
	print("[DEBUG] GraphEdit: Graph saved to resource (", current_resource.nodes.size(), " nodes, ", current_resource.connections.size(), " connections)")
	return true

## Saves the current resource to disk
func save_resource_to_disk(file_path: String = "") -> bool:
	if not current_resource:
		push_error("GraphEdit: No resource to save")
		return false
	
	# Use provided path or current path
	var save_path = file_path if file_path else resource_file_path
	if save_path.is_empty():
		push_error("GraphEdit: No file path provided for saving")
		return false
	
	# Save graph state to resource first
	if not save_graph_to_resource():
		return false
	
	# Save resource to disk
	if OpenShaderResourceManager.save_graph_resource(current_resource, save_path):
		resource_file_path = save_path
		print("[DEBUG] GraphEdit: Resource saved to disk - ", save_path)
		return true
	else:
		push_error("GraphEdit: Failed to save resource - " + OpenShaderResourceManager.get_last_error())
		return false

## Loads a resource from disk
func load_resource_from_disk(file_path: String) -> bool:
	var loaded_resource = OpenShaderResourceManager.load_graph_resource(file_path)
	if loaded_resource:
		set_current_resource(loaded_resource, file_path)
		return true
	else:
		push_error("GraphEdit: Failed to load resource - " + OpenShaderResourceManager.get_last_error())
		return false

## Creates a new resource and sets it as current
func create_new_resource(resource_type: String = "main_shader") -> bool:
	var new_resource: OpenShaderGraphAsset
	
	match resource_type:
		"main_shader":
			new_resource = OpenShaderResourceManager.create_main_shader_resource()
		"subgraph":
			new_resource = OpenShaderResourceManager.create_subgraph_resource()
		_:
			push_error("GraphEdit: Unknown resource type - " + resource_type)
			return false
	
	set_current_resource(new_resource, "")
	return true

## Internal method to serialize a node to data format
func _serialize_node(node: BaseNode) -> Dictionary:
	# Get the node type from NodeFactory using the script path (more reliable)
	var node_type = NodeFactory.get_node_type_from_instance(node)
	if node_type.is_empty():
		node_type = node.title if node.title else "Unknown"
	
	var node_data = {
		"id": node.name,
		"type": node_type,
		"properties": {},
		"position": {"x": node.position_offset.x, "y": node.position_offset.y}
	}
	
	# Get node properties - this will depend on the specific node implementation
	# For now, we'll get basic properties that can be serialized
	var property_list = node.get_property_list()
	for property in property_list:
		var prop_name = property.name
		# Skip built-in properties that shouldn't be serialized
		if prop_name.begins_with("_") or prop_name in ["script", "name", "owner", "scene_file_path"]:
			continue
		
		var value = node.get(prop_name)
		# Only serialize serializable types
		if _is_serializable_type(value):
			node_data.properties[prop_name] = value
	
	return node_data

## Helper method to check if a value can be serialized
func _is_serializable_type(value) -> bool:
	return value == null or value is bool or value is int or value is float or \
	       value is String or value is Vector2 or value is Vector3 or value is Vector4 or \
	       value is Color or value is Array or value is Dictionary

## Internal method to load graph from current resource
func _load_graph_from_resource():
	if not current_resource:
		return
	
	# Clear current graph
	_clear_graph()
	
	# Load nodes
	for node_data in current_resource.nodes:
		var node = _deserialize_node(node_data)
		if node:
			add_child(node)
			# Position will be set during deserialization
	
	# Wait a frame for nodes to be fully added, then load connections
	await get_tree().process_frame
	
	# Load connections
	for connection_data in current_resource.connections:
		var from_parts = connection_data.from.split(":")
		var to_parts = connection_data.to.split(":")
		
		if from_parts.size() == 2 and to_parts.size() == 2:
			var from_node = from_parts[0]
			var from_port = from_parts[1].to_int()
			var to_node = to_parts[0]
			var to_port = to_parts[1].to_int()
			
			# Create visual connection
			if has_node(NodePath(from_node)) and has_node(NodePath(to_node)):
				connect_node(from_node, from_port, to_node, to_port)
				
				# Update tracking
				var connection_tracking = {
					"from_node": from_node,
					"from_port": from_port,
					"to_node": to_node,
					"to_port": to_port
				}
				node_connections.append(connection_tracking)
				
				# Update receiving node input
				_update_node_input(to_node, to_port, from_node, from_port)
	
	print("[DEBUG] GraphEdit: Graph loaded from resource (", current_resource.nodes.size(), " nodes, ", current_resource.connections.size(), " connections)")

## Internal method to deserialize a node from data format
func _deserialize_node(node_data: Dictionary) -> BaseNode:
	var node_type = node_data.get("type", "")
	var node_id = node_data.get("id", "")
	var properties = node_data.get("properties", {})
	var position = node_data.get("position", {"x": 0, "y": 0})
	
	# Create node using NodeFactory
	var node = NodeFactory.create_node(node_type)
	if not node:
		push_error("GraphEdit: Failed to create node of type: " + node_type)
		return null
	
	# Set node name (ensure uniqueness)
	node.name = node_id
	# If name already exists, make it unique
	var existing_node = get_node_or_null(NodePath(node_id))
	if existing_node and existing_node != node:
		var counter = 1
		while get_node_or_null(NodePath(node_id +"_"+ str(counter))):
			counter += 1
		node.name = node_id + "_" + str(counter)
	
	# Set position
	node.position_offset = Vector2(position.x, position.y)
	
	# Set properties
	for prop_name in properties:
		var value = properties[prop_name]
		if prop_name in node:
			node.set(prop_name, value)
	
	return node

## Internal method to clear the current graph
func _clear_graph():
	# Clear connections tracking
	node_connections.clear()
	
	# Remove all BaseNode children
	for child in get_children():
		if child is BaseNode:
			child.queue_free()
	
	# Reset node index
	next_node_index = 0
	
	print("[DEBUG] GraphEdit: Graph cleared")

## Checks if the graph has unsaved changes
func has_unsaved_changes() -> bool:
	if not current_resource:
		# If we have nodes but no resource, we have unsaved changes
		for child in get_children():
			if child is BaseNode:
				return true
		return false
	
	# Create a temporary resource and compare
	var temp_resource = current_resource.duplicate_graph()
	if not temp_resource:
		return true # If we can't duplicate, assume changes exist
	temp_resource.clear()
	
	# Save current state to temp resource
	for child in get_children():
		if child is BaseNode:
			var node_data = _serialize_node(child)
			temp_resource.add_node(node_data.id, node_data.type, node_data.properties, node_data.position)
	
	for connection in node_connections:
		temp_resource.add_connection(connection.from_node, connection.from_port, connection.to_node, connection.to_port)
	
	# Compare node count and connection count as a simple check
	return temp_resource.nodes.size() != current_resource.nodes.size() or \
	       temp_resource.connections.size() != current_resource.connections.size()

## Gets information about the current resource
func get_resource_info() -> Dictionary:
	var info = {
		"has_resource": current_resource != null,
		"file_path": resource_file_path,
		"resource_type": "",
		"is_saved": false,
		"has_unsaved_changes": has_unsaved_changes()
	}
	
	if current_resource:
		if current_resource is OpenShaderMainAsset:
			info.resource_type = "main_shader"
		elif current_resource is OpenShaderSubgraphAsset:
			info.resource_type = "subgraph"
		else:
			info.resource_type = "base_graph"
		
		info.is_saved = not resource_file_path.is_empty()
	
	return info