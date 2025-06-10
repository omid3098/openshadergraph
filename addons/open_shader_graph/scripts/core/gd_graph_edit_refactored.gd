@tool
extends GraphEdit

## Refactored GraphEdit for OpenShaderGraph using modular managers
## This file replaces the monolithic gd_graph_edit.gd with proper separation of concerns

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

## Initialization
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

## Mouse input handling
func _gui_input(event: InputEvent) -> void:
	# Check for a right mouse button click.
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.is_pressed():
		# Emit the signal, providing the current global mouse position.
		right_clicked.emit(get_global_mouse_position())
		accept_event()

## Node lifecycle management
func _on_child_entered_tree(node: Node) -> void:
	if node is BaseNode:
		node.node_selection_changed.connect(_on_node_selection_changed)
		# Use node index manager to assign index
		if node_index_manager:
			node_index_manager.handle_node_added(node)

func _on_child_exiting_tree(node: Node) -> void:
	if node is BaseNode:
		# Use node index manager to handle removal
		if node_index_manager:
			node_index_manager.handle_node_removed(node)

func _on_node_selection_changed(selected_node: BaseNode) -> void:
	shader_node_selected.emit(selected_node)

## Connection handling - delegated to ConnectionManager
func _on_connection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> void:
	if connection_manager:
		connection_manager.handle_connection_request(from_node, from_port, to_node, to_port)

func _on_disconnection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> void:
	if connection_manager:
		connection_manager.handle_disconnection_request(from_node, from_port, to_node, to_port)

func _on_delete_nodes_request(nodes: Array) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Delete nodes request: ", nodes)
	# Handle node deletion - disconnect all connections to/from deleted nodes
	if connection_manager:
		for node_name in nodes:
			connection_manager.disconnect_all_node_connections(node_name)

## Signal handlers for manager events
func _on_nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int) -> void:
	nodes_connected.emit(from_node, from_port, to_node, to_port)

func _on_nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int) -> void:
	nodes_disconnected.emit(from_node, from_port, to_node, to_port)

func _on_resource_changed(resource: OpenShaderGraphAsset) -> void:
	resource_changed.emit(resource)

## Public API - Connection Management
func get_connections() -> Array[Dictionary]:
	if connection_manager:
		return connection_manager.get_connections()
	return []

func get_connection_manager() -> ConnectionManager:
	return connection_manager

## Public API - Node Index Management
func get_nodes_by_index() -> Array[BaseNode]:
	if node_index_manager:
		return node_index_manager.get_nodes_by_index()
	return []

func recompact_node_indices() -> void:
	if node_index_manager:
		node_index_manager.recompact_node_indices()

func get_next_node_index() -> int:
	if node_index_manager:
		return node_index_manager.get_next_node_index()
	return 0

func debug_node_indices() -> void:
	if node_index_manager:
		node_index_manager.debug_node_indices()

func get_node_index_manager() -> NodeIndexManager:
	return node_index_manager

## Public API - Resource Management
func create_new_resource(resource_type: String = "main_shader") -> bool:
	if resource_manager:
		return resource_manager.create_new_resource(resource_type)
	return false

func load_resource_from_disk(file_path: String) -> bool:
	if resource_manager:
		return resource_manager.load_resource_from_disk(file_path)
	return false

func save_resource_to_disk(file_path: String = "") -> bool:
	if resource_manager:
		return resource_manager.save_resource_to_disk(file_path)
	return false

func has_unsaved_changes() -> bool:
	if resource_manager:
		return resource_manager.check_unsaved_changes()
	return false

func get_resource_info() -> Dictionary:
	if resource_manager:
		return resource_manager.get_resource_info()
	return {}

func get_current_resource() -> OpenShaderGraphAsset:
	if resource_manager:
		return resource_manager.get_current_resource()
	return null

func set_current_resource(resource: OpenShaderGraphAsset, file_path: String = "") -> void:
	if resource_manager:
		resource_manager.set_current_resource(resource, file_path)

func get_resource_manager() -> ResourceManager:
	return resource_manager

## Utility methods
func clear_graph() -> void:
	# Clear all managers
	if connection_manager:
		connection_manager.clear_connections()
	
	if node_index_manager:
		node_index_manager.reset_index_counter()
	
	if resource_manager:
		resource_manager.clear_current_resource()
	
	# Remove all BaseNode children
	for child in get_children():
		if child is BaseNode:
			child.queue_free()
	
	if OS.is_debug_build():
		print("[DEBUG] GraphEdit: Complete graph cleared")

## Debug methods
func debug_connections() -> void:
	if OS.is_debug_build():
		var connections: Array[Dictionary] = get_connections()
		print("[DEBUG] Current connections: ", connections)

func get_debug_info() -> Dictionary:
	var debug_info := {
		"total_nodes": 0,
		"total_connections": 0,
		"resource_info": {},
		"node_indices": {}
	}
	
	# Count nodes
	for child in get_children():
		if child is BaseNode:
			debug_info.total_nodes += 1
	
	# Get connection info
	if connection_manager:
		debug_info.total_connections = connection_manager.get_connections().size()
	
	# Get resource info
	if resource_manager:
		debug_info.resource_info = resource_manager.get_resource_info()
	
	# Get node index info
	if node_index_manager:
		debug_info.node_indices = node_index_manager.get_debug_info()
	
	return debug_info

func print_debug_info() -> void:
	if OS.is_debug_build():
		var info: Dictionary = get_debug_info()
		print("[DEBUG] GraphEdit Debug Info:")
		print("  Nodes: ", info.total_nodes)
		print("  Connections: ", info.total_connections)
		print("  Resource: ", info.resource_info)
		print("  Node Indices: ", info.node_indices)