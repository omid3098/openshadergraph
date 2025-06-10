@tool
extends GraphEdit

# Preload required classes
const ConnectionManager = preload("res://addons/open_shader_graph/scripts/core/gd_connection_manager.gd")
const NodeIndexManager = preload("res://addons/open_shader_graph/scripts/core/gd_node_index_manager.gd")
const ResourceManager = preload("res://addons/open_shader_graph/scripts/core/gd_resource_manager.gd")
const NodeFactory = preload("res://addons/open_shader_graph/scripts/core/gd_node_factory.gd")

signal right_clicked(global_mouse_position: Vector2)
signal shader_node_selected(node: BaseNode)
signal nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int)
signal nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int)
signal resource_changed(resource: OpenShaderGraphAsset)

# Modular managers
var connection_manager: ConnectionManager
var node_index_manager: NodeIndexManager
var resource_manager: ResourceManager

# We use the _gui_input function to detect mouse clicks on this specific node.
func _gui_input(event: InputEvent) -> void:
	# Check for a right mouse button click.
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.is_pressed():
		# Emit the signal, providing the current global mouse position.
		# The main plugin will listen for this.
		right_clicked.emit(get_global_mouse_position())
		accept_event()

# When a child node is added, connect to its selection signal and assign index
func _on_child_entered_tree(node: Node) -> void:
	if node is BaseNode:
		node.node_selection_changed.connect(_on_node_selection_changed)
		# Use node index manager to assign index
		if node_index_manager:
			node_index_manager.handle_node_added(node)

# When a child node is removed, we may need to recompact indices (optional)
func _on_child_exiting_tree(node: Node) -> void:
	if node is BaseNode:
		# Use node index manager to handle removal
		if node_index_manager:
			node_index_manager.handle_node_removed(node)

func _on_node_selection_changed(selected_node: BaseNode) -> void:
	shader_node_selected.emit(selected_node)

func _ready() -> void:
	# Initialize managers
	connection_manager = ConnectionManager.new(self)
	node_index_manager = NodeIndexManager.new(self)
	resource_manager = ResourceManager.new(self)
	
	# Connect manager signals
	connection_manager.nodes_connected.connect(_on_nodes_connected)
	connection_manager.nodes_disconnected.connect(_on_nodes_disconnected)
	resource_manager.resource_changed.connect(_on_resource_changed)
	
	# Connect to child management signals
	child_entered_tree.connect(_on_child_entered_tree)
	child_exiting_tree.connect(_on_child_exiting_tree)
	
	# Connect to GraphEdit's connection signals
	connection_request.connect(_on_connection_request)
	disconnection_request.connect(_on_disconnection_request)
	
	# Enable right-click on background to delete connections
	delete_nodes_request.connect(_on_delete_nodes_request)
	
	if OS.is_debug_build():
		print("[DEBUG] GraphEdit: Managers initialized and signals connected")

func _on_connection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> void:
	# Delegate to connection manager
	if connection_manager:
		connection_manager.handle_connection_request(from_node, from_port, to_node, to_port)

func _on_disconnection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> void:
	# Delegate to connection manager
	if connection_manager:
		connection_manager.handle_disconnection_request(from_node, from_port, to_node, to_port)

func _on_delete_nodes_request(nodes: Array) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Delete nodes request: ", nodes)
	# Handle node deletion - disconnect all connections to/from deleted nodes
	if connection_manager:
		for node_name in nodes:
			connection_manager.disconnect_all_node_connections(node_name)

# Signal handlers for manager events
func _on_nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int) -> void:
	nodes_connected.emit(from_node, from_port, to_node, to_port)

func _on_nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int) -> void:
	nodes_disconnected.emit(from_node, from_port, to_node, to_port)

func _on_resource_changed(resource: OpenShaderGraphAsset) -> void:
	resource_changed.emit(resource)

func _is_valid_connection(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> bool:
	# Don't allow self-connections
	if from_node == to_node:
		if OS.is_debug_build():
			print("[DEBUG] Connection validation failed: self-connection not allowed")
		return false
	
	# Get the actual node objects
	var from_node_obj := get_node_or_null(NodePath(from_node))
	var to_node_obj := get_node_or_null(NodePath(to_node))
	
	if not from_node_obj or not to_node_obj:
		if OS.is_debug_build():
			print("[DEBUG] Connection validation failed: node not found")
		return false
	
	# Check if both nodes inherit from BaseNode
	if not (from_node_obj is BaseNode and to_node_obj is BaseNode):
		if OS.is_debug_build():
			print("[DEBUG] Connection validation failed: not BaseNode instances")
		return false
	
	# Check if target port already has a connection (only one input per port)
	if connection_manager:
		var connections: Array[Dictionary] = connection_manager.get_connections()
		for conn in connections:
			if conn.to_node == str(to_node) and conn.to_port == to_port:
				if OS.is_debug_build():
					print("[DEBUG] Connection validation failed: target port already connected")
				return false
	
	# Type validation would go here - for now, allow all connections
	# TODO: Add pin type compatibility checking
	
	return true

func _update_node_input(to_node: StringName, to_port: int, from_node: StringName, from_port: int) -> void:
	var to_node_obj := get_node_or_null(NodePath(to_node))
	var from_node_obj := get_node_or_null(NodePath(from_node))
	
	if not to_node_obj or not from_node_obj:
		return
	
	# Update input based on node type and port
	if to_node_obj is BaseMathNode:
		var output_value := _get_node_output_value(from_node_obj, from_port)
		if to_port == 0: # Input A
			to_node_obj.set_input_a(output_value)
		elif to_port == 1: # Input B
			to_node_obj.set_input_b(output_value)
	
	if OS.is_debug_build():
		print("[DEBUG] Updated node input: ", to_node, " port ", to_port, " with value from ", from_node)

func _reset_node_input(to_node: StringName, to_port: int) -> void:
	var to_node_obj := get_node_or_null(NodePath(to_node))
	
	if not to_node_obj:
		return
	
	# Reset input to default value based on node type and port
	if to_node_obj is BaseMathNode:
		if to_port == 0: # Input A
			to_node_obj.set_input_a(to_node_obj.get_default_input_a())
		elif to_port == 1: # Input B
			to_node_obj.set_input_b(to_node_obj.get_default_input_b())
	
	if OS.is_debug_build():
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
	# Delegate to connection manager
	if connection_manager:
		connection_manager.disconnect_all_node_connections(node_name)

# Public API for external access
func get_connections() -> Array[Dictionary]:
	if connection_manager:
		return connection_manager.get_connections()
	return []

# Get all nodes sorted by their index (useful for shader code generation)
func get_nodes_by_index() -> Array[BaseNode]:
	if node_index_manager:
		return node_index_manager.get_nodes_by_index()
	return []

# Recompact node indices (removes gaps in numbering)
func recompact_node_indices():
	if node_index_manager:
		node_index_manager.recompact_node_indices()

# Get the current next index (useful for external components)
func get_next_node_index() -> int:
	if node_index_manager:
		return node_index_manager.get_next_node_index()
	return 0

# Resource Management API - Delegated to ResourceManager

## Sets the current resource for this graph
func set_current_resource(resource: OpenShaderGraphAsset, file_path: String = "") -> void:
	if resource_manager:
		resource_manager.set_current_resource(resource, file_path)

## Gets the current resource
func get_current_resource() -> OpenShaderGraphAsset:
	if resource_manager:
		return resource_manager.get_current_resource()
	return null

## Gets the current resource file path
func get_resource_file_path() -> String:
	if resource_manager:
		return resource_manager.get_file_path()
	return ""

## Loads a resource from disk
func load_resource_from_disk(file_path: String) -> bool:
	if resource_manager:
		return resource_manager.load_resource_from_disk(file_path)
	return false

## Saves the current resource to disk
func save_resource_to_disk(file_path: String = "") -> bool:
	if resource_manager:
		return resource_manager.save_resource_to_disk(file_path)
	return false

## Creates a new resource and sets it as current
func create_new_resource(resource_type: String = "main_shader") -> bool:
	if resource_manager:
		return resource_manager.create_new_resource(resource_type)
	return false

## Checks if the graph has unsaved changes
func has_unsaved_changes() -> bool:
	if resource_manager:
		return resource_manager.check_unsaved_changes()
	return false

## Gets information about the current resource
func get_resource_info() -> Dictionary:
	if resource_manager:
		return resource_manager.get_resource_info()
	return {}

# Legacy methods removed - functionality now handled by dedicated managers
# All serialization/deserialization is handled by YAMLSerializer
# All resource management is handled by ResourceManager
# All connection tracking is handled by ConnectionManager
# All node indexing is handled by NodeIndexManager