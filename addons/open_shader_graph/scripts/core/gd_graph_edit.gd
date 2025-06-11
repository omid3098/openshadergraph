@tool
extends GraphEdit

## Enhanced GraphEdit for OpenShaderGraph with Phase 1 Grouping Support
## Features: Modular managers, context menu system, selection management

# Preload required classes
const ConnectionManager = preload("res://addons/open_shader_graph/scripts/core/gd_connection_manager.gd")
const NodeIndexManager = preload("res://addons/open_shader_graph/scripts/core/gd_node_index_manager.gd")
const ResourceManager = preload("res://addons/open_shader_graph/scripts/core/gd_resource_manager.gd")
const NodeFactory = preload("res://addons/open_shader_graph/scripts/core/gd_node_factory.gd")
const ContextMenuManager = preload("res://addons/open_shader_graph/scripts/core/gd_context_menu.gd")

# Phase 1 Grouping signals
signal right_clicked(global_mouse_position: Vector2)
signal context_menu_requested(target_type: String, context_data: Dictionary)
signal shader_node_selected(node: BaseNode)
signal nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int)
signal nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int)
signal resource_changed(resource: OpenShaderGraphAsset)
signal selection_changed(selected_nodes: Array[BaseNode])

# Modular managers
var connection_manager: ConnectionManager
var node_index_manager: NodeIndexManager
var resource_manager: ResourceManager
var context_menu_manager: ContextMenuManager

# Phase 1: Selection Management
var selected_nodes: Array[BaseNode] = []
var is_selecting: bool = false
var selection_start_pos: Vector2
var selection_rect: Rect2

# Phase 1: Context Menu System
enum ContextTarget {
	BACKGROUND,
	SINGLE_NODE,
	MULTIPLE_NODES,
	CONNECTION
}

## Initialization
func _ready() -> void:
	# Initialize managers
	connection_manager = ConnectionManager.new(self)
	node_index_manager = NodeIndexManager.new(self)
	resource_manager = ResourceManager.new(self)
	context_menu_manager = ContextMenuManager.new(self)
	
	# Connect manager signals
	connection_manager.nodes_connected.connect(_on_nodes_connected)
	connection_manager.nodes_disconnected.connect(_on_nodes_disconnected)
	resource_manager.resource_changed.connect(_on_resource_changed)
	context_menu_manager.context_action_requested.connect(_on_context_action_requested)
	
	# Connect our context menu signal to the manager
	context_menu_requested.connect(context_menu_manager.show_context_menu)
	
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

## Phase 1: Enhanced Mouse Input Handling
func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_RIGHT and event.is_pressed():
			_handle_right_click(event.global_position)
			accept_event()
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.is_pressed():
				_handle_left_click_start(event.position)
			else:
				_handle_left_click_end(event.position)
	elif event is InputEventMouseMotion and is_selecting:
		_handle_selection_drag(event.position)

## Phase 1: Right-Click Context Menu System
func _handle_right_click(global_pos: Vector2) -> void:
	var local_pos = global_pos - global_position
	var clicked_node = _get_node_at_position(local_pos)
	
	var context_type: ContextTarget
	var context_data: Dictionary = {
		"global_position": global_pos,
		"local_position": local_pos
	}
	
	if clicked_node:
		if clicked_node in selected_nodes:
			# Right-clicked on selected node(s)
			if selected_nodes.size() > 1:
				context_type = ContextTarget.MULTIPLE_NODES
				context_data["nodes"] = selected_nodes
			else:
				context_type = ContextTarget.SINGLE_NODE
				context_data["node"] = clicked_node
		else:
			# Right-clicked on unselected node - select it first
			_select_single_node(clicked_node)
			context_type = ContextTarget.SINGLE_NODE
			context_data["node"] = clicked_node
	else:
		# Right-clicked on background
		context_type = ContextTarget.BACKGROUND
		_clear_selection()
	
	# Emit context menu signal
	context_menu_requested.emit(_context_target_to_string(context_type), context_data)
	
	# Only emit the legacy signal for background clicks (backward compatibility)
	if context_type == ContextTarget.BACKGROUND:
		right_clicked.emit(global_pos)

func _context_target_to_string(target: ContextTarget) -> String:
	match target:
		ContextTarget.BACKGROUND:
			return "background"
		ContextTarget.SINGLE_NODE:
			return "single_node"
		ContextTarget.MULTIPLE_NODES:
			return "multiple_nodes"
		ContextTarget.CONNECTION:
			return "connection"
		_:
			return "unknown"

## Phase 1: Selection Management System
func _handle_left_click_start(local_pos: Vector2) -> void:
	var clicked_node = _get_node_at_position(local_pos)
	
	if clicked_node:
		if Input.is_key_pressed(KEY_CTRL):
			# Multi-select with Ctrl
			_toggle_node_selection(clicked_node)
		else:
			# Single select
			_select_single_node(clicked_node)
	else:
		# Start selection rectangle
		if not Input.is_key_pressed(KEY_CTRL):
			_clear_selection()
		is_selecting = true
		selection_start_pos = local_pos

func _handle_left_click_end(local_pos: Vector2) -> void:
	if is_selecting:
		is_selecting = false
		_finalize_selection_rectangle()

func _handle_selection_drag(local_pos: Vector2) -> void:
	if is_selecting:
		selection_rect = Rect2(selection_start_pos, local_pos - selection_start_pos)
		if selection_rect.size.x < 0:
			selection_rect.position.x += selection_rect.size.x
			selection_rect.size.x = abs(selection_rect.size.x)
		if selection_rect.size.y < 0:
			selection_rect.position.y += selection_rect.size.y
			selection_rect.size.y = abs(selection_rect.size.y)
		
		# Visual feedback could be added here
		queue_redraw()

func _finalize_selection_rectangle() -> void:
	var nodes_in_rect: Array[BaseNode] = []
	
	for child in get_children():
		if child is BaseNode:
			var node_rect = Rect2(child.position, child.size)
			if selection_rect.intersects(node_rect):
				nodes_in_rect.append(child)
	
	if Input.is_key_pressed(KEY_CTRL):
		# Add to existing selection
		for node in nodes_in_rect:
			if node not in selected_nodes:
				selected_nodes.append(node)
				_update_node_selection_visual(node, true)
	else:
		# Replace selection
		_clear_selection()
		selected_nodes = nodes_in_rect
		for node in selected_nodes:
			_update_node_selection_visual(node, true)
	
	_emit_selection_changed()

func _get_node_at_position(local_pos: Vector2) -> BaseNode:
	for child in get_children():
		if child is BaseNode:
			var node_rect = Rect2(child.position, child.size)
			if node_rect.has_point(local_pos):
				return child
	return null

func _select_single_node(node: BaseNode) -> void:
	_clear_selection()
	selected_nodes.append(node)
	_update_node_selection_visual(node, true)
	_emit_selection_changed()

func _toggle_node_selection(node: BaseNode) -> void:
	if node in selected_nodes:
		selected_nodes.erase(node)
		_update_node_selection_visual(node, false)
	else:
		selected_nodes.append(node)
		_update_node_selection_visual(node, true)
	_emit_selection_changed()

func _clear_selection() -> void:
	for node in selected_nodes:
		_update_node_selection_visual(node, false)
	selected_nodes.clear()
	_emit_selection_changed()

func _update_node_selection_visual(node: BaseNode, selected: bool) -> void:
	# Add visual feedback for selection
	if selected:
		node.modulate = Color(1.2, 1.2, 1.2, 1.0) # Slightly brighter
	else:
		node.modulate = Color.WHITE

func _emit_selection_changed() -> void:
	selection_changed.emit(selected_nodes)
	
	# Also emit single node selection for backward compatibility
	if selected_nodes.size() == 1:
		shader_node_selected.emit(selected_nodes[0])

## Node lifecycle management
func _on_child_entered_tree(node: Node) -> void:
	if node is BaseNode:
		# Use node index manager to assign index
		if node_index_manager:
			node_index_manager.handle_node_added(node)

func _on_child_exiting_tree(node: Node) -> void:
	if node is BaseNode:
		# Remove from selection if present
		if node in selected_nodes:
			selected_nodes.erase(node)
			_emit_selection_changed()
		# Use node index manager to handle removal
		if node_index_manager:
			node_index_manager.handle_node_removed(node)

## Connection handling with validation
func _on_connection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> void:
	if _is_valid_connection(from_node, from_port, to_node, to_port):
		if connection_manager:
			connection_manager.handle_connection_request(from_node, from_port, to_node, to_port)
			_update_node_input(to_node, to_port, from_node, from_port)

func _on_disconnection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> void:
	if connection_manager:
		connection_manager.handle_disconnection_request(from_node, from_port, to_node, to_port)
		_reset_node_input(to_node, to_port)

func _on_delete_nodes_request(nodes: Array) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Delete nodes request: ", nodes)
	# Handle node deletion - disconnect all connections to/from deleted nodes
	if connection_manager:
		for node_name in nodes:
			connection_manager.disconnect_all_node_connections(node_name)

## Connection validation (merged from original)
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

## Node input management (merged from original)
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

## Signal handlers for manager events
func _on_nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int) -> void:
	nodes_connected.emit(from_node, from_port, to_node, to_port)

func _on_nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int) -> void:
	nodes_disconnected.emit(from_node, from_port, to_node, to_port)

func _on_resource_changed(resource: OpenShaderGraphAsset) -> void:
	resource_changed.emit(resource)

func _on_context_action_requested(action: String, context_data: Dictionary) -> void:
	# Handle context menu actions
	match action:
		"create_node":
			# For background "create_node" actions, emit the right-click signal
			# The main plugin will handle node creation
			right_clicked.emit(context_data.get("global_position", Vector2.ZERO))
		"delete_node":
			var selected = get_selected_nodes()
			if not selected.is_empty():
				for node in selected:
					node.queue_free()
		"delete_nodes":
			var selected = get_selected_nodes()
			if not selected.is_empty():
				for node in selected:
					node.queue_free()
		"duplicate_node", "duplicate_nodes":
			_duplicate_selected_nodes()
		"copy_node", "copy_nodes":
			_copy_selected_nodes()
		"edit_properties":
			# Properties editing is handled by the properties panel
			pass
		"create_group", "create_local_subgraph", "create_normal_subgraph":
			# These will be implemented in Phase 2
			if OS.is_debug_build():
				print("[DEBUG] Grouping action requested: ", action, " (Phase 2)")
		_:
			if OS.is_debug_build():
				print("[DEBUG] Unknown context action: ", action)

func _duplicate_selected_nodes() -> void:
	# TODO: Implement node duplication
	if OS.is_debug_build():
		print("[DEBUG] Node duplication requested (not yet implemented)")

func _copy_selected_nodes() -> void:
	# TODO: Implement node copying to clipboard
	if OS.is_debug_build():
		print("[DEBUG] Node copying requested (not yet implemented)")

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

## Public API - Selection Management (Phase 1)
func get_selected_nodes() -> Array[BaseNode]:
	return selected_nodes.duplicate()

func select_nodes(nodes: Array[BaseNode]) -> void:
	_clear_selection()
	for node in nodes:
		if node and node.get_parent() == self:
			selected_nodes.append(node)
			_update_node_selection_visual(node, true)
	_emit_selection_changed()

func clear_selection() -> void:
	_clear_selection()

func is_node_selected(node: BaseNode) -> bool:
	return node in selected_nodes

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
	# Clear selection first
	_clear_selection()
	
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
		"selected_nodes": selected_nodes.size(),
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
		print("  Selected: ", info.selected_nodes)
		print("  Resource: ", info.resource_info)
		print("  Node Indices: ", info.node_indices)