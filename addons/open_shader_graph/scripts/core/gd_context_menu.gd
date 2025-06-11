@tool
extends RefCounted
class_name ContextMenuManager

## Context Menu Manager for OpenShaderGraph Phase 1 Grouping System
## Handles multi-layered context menus based on right-click target

signal context_action_requested(action: String, context_data: Dictionary)

# Reference to the GraphEdit
var graph_edit: GraphEdit
var popup_menu: PopupMenu

enum ContextAction {
	# Background actions
	CREATE_NODE,
	PASTE_NODES,
	
	# Single node actions
	DELETE_NODE,
	DUPLICATE_NODE,
	COPY_NODE,
	EDIT_PROPERTIES,
	
	# Multiple node actions
	DELETE_NODES,
	DUPLICATE_NODES,
	COPY_NODES,
	CREATE_GROUP,
	CREATE_LOCAL_SUBGRAPH,
	CREATE_NORMAL_SUBGRAPH,
	
	# Connection actions
	DELETE_CONNECTION
}

func _init(target_graph_edit: GraphEdit) -> void:
	graph_edit = target_graph_edit
	
	# Create popup menu
	popup_menu = PopupMenu.new()
	popup_menu.name = "ContextMenu"
	
	# Connect signals
	popup_menu.id_pressed.connect(_on_menu_item_selected)
	
	# Add popup to graph edit
	graph_edit.add_child(popup_menu)
	
	if OS.is_debug_build():
		print("[DEBUG] ContextMenuManager: Initialized")

func show_context_menu(target_type: String, context_data: Dictionary) -> void:
	if not popup_menu:
		return
	
	# Clear existing menu
	popup_menu.clear()
	
	# Populate menu based on target type
	match target_type:
		"background":
			_populate_background_menu(context_data)
		"single_node":
			_populate_single_node_menu(context_data)
		"multiple_nodes":
			_populate_multiple_nodes_menu(context_data)
		"connection":
			_populate_connection_menu(context_data)
		_:
			if OS.is_debug_build():
				print("[DEBUG] ContextMenuManager: Unknown target type: ", target_type)
			return
	
	# Show menu at cursor position
	var global_pos = context_data.get("global_position", Vector2.ZERO)
	popup_menu.position = Vector2i(global_pos)
	popup_menu.popup()

func _populate_background_menu(context_data: Dictionary) -> void:
	popup_menu.add_item("Create Node", ContextAction.CREATE_NODE)
	popup_menu.add_separator()
	popup_menu.add_item("Paste", ContextAction.PASTE_NODES)
	popup_menu.set_item_disabled(popup_menu.get_item_index(ContextAction.PASTE_NODES), true) # TODO: Enable when clipboard is implemented

func _populate_single_node_menu(context_data: Dictionary) -> void:
	var node: BaseNode = context_data.get("node")
	if not node:
		return
	
	popup_menu.add_item("Delete", ContextAction.DELETE_NODE)
	popup_menu.add_item("Duplicate", ContextAction.DUPLICATE_NODE)
	popup_menu.add_item("Copy", ContextAction.COPY_NODE)
	popup_menu.add_separator()
	popup_menu.add_item("Properties", ContextAction.EDIT_PROPERTIES)
	
	# Add grouping options (Phase 1 preparation for Phase 2)
	popup_menu.add_separator()
	var grouping_submenu = PopupMenu.new()
	grouping_submenu.name = "GroupingSubmenu"
	grouping_submenu.add_item("Create Group", ContextAction.CREATE_GROUP)
	grouping_submenu.add_item("Create Local Subgraph", ContextAction.CREATE_LOCAL_SUBGRAPH)
	grouping_submenu.add_item("Create Normal Subgraph", ContextAction.CREATE_NORMAL_SUBGRAPH)
	grouping_submenu.id_pressed.connect(_on_menu_item_selected)
	
	popup_menu.add_child(grouping_submenu)
	popup_menu.add_submenu_item("Grouping", "GroupingSubmenu")
	
	# Disable grouping options for now (will be enabled in Phase 2)
	for i in range(grouping_submenu.get_item_count()):
		grouping_submenu.set_item_disabled(i, true)

func _populate_multiple_nodes_menu(context_data: Dictionary) -> void:
	var nodes: Array = context_data.get("nodes", [])
	if nodes.is_empty():
		return
	
	popup_menu.add_item("Delete Selection", ContextAction.DELETE_NODES)
	popup_menu.add_item("Duplicate Selection", ContextAction.DUPLICATE_NODES)
	popup_menu.add_item("Copy Selection", ContextAction.COPY_NODES)
	
	# Multiple node grouping options
	popup_menu.add_separator()
	var grouping_submenu = PopupMenu.new()
	grouping_submenu.name = "GroupingSubmenu"
	grouping_submenu.add_item("Create Group", ContextAction.CREATE_GROUP)
	grouping_submenu.add_item("Create Local Subgraph", ContextAction.CREATE_LOCAL_SUBGRAPH)
	grouping_submenu.add_item("Create Normal Subgraph", ContextAction.CREATE_NORMAL_SUBGRAPH)
	grouping_submenu.id_pressed.connect(_on_menu_item_selected)
	
	popup_menu.add_child(grouping_submenu)
	popup_menu.add_submenu_item("Grouping", "GroupingSubmenu")
	
	# Disable grouping options for now (will be enabled in Phase 2)
	for i in range(grouping_submenu.get_item_count()):
		grouping_submenu.set_item_disabled(i, true)

func _populate_connection_menu(context_data: Dictionary) -> void:
	popup_menu.add_item("Delete Connection", ContextAction.DELETE_CONNECTION)

func _on_menu_item_selected(id: int) -> void:
	var action = _context_action_to_string(id)
	var context_data = {
		"action_id": id,
		"graph_edit": graph_edit
	}
	
	# Add selection context if relevant
	if graph_edit.has_method("get_selected_nodes"):
		context_data["selected_nodes"] = graph_edit.get_selected_nodes()
	
	context_action_requested.emit(action, context_data)
	
	if OS.is_debug_build():
		print("[DEBUG] ContextMenuManager: Action requested: ", action)

func _context_action_to_string(action_id: int) -> String:
	match action_id:
		ContextAction.CREATE_NODE:
			return "create_node"
		ContextAction.PASTE_NODES:
			return "paste_nodes"
		ContextAction.DELETE_NODE:
			return "delete_node"
		ContextAction.DUPLICATE_NODE:
			return "duplicate_node"
		ContextAction.COPY_NODE:
			return "copy_node"
		ContextAction.EDIT_PROPERTIES:
			return "edit_properties"
		ContextAction.DELETE_NODES:
			return "delete_nodes"
		ContextAction.DUPLICATE_NODES:
			return "duplicate_nodes"
		ContextAction.COPY_NODES:
			return "copy_nodes"
		ContextAction.CREATE_GROUP:
			return "create_group"
		ContextAction.CREATE_LOCAL_SUBGRAPH:
			return "create_local_subgraph"
		ContextAction.CREATE_NORMAL_SUBGRAPH:
			return "create_normal_subgraph"
		ContextAction.DELETE_CONNECTION:
			return "delete_connection"
		_:
			return "unknown"

func hide_menu() -> void:
	if popup_menu and popup_menu.visible:
		popup_menu.hide()

func cleanup() -> void:
	if popup_menu:
		popup_menu.queue_free()
		popup_menu = null