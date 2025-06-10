@tool
extends Control

class_name OpenShaderEditor

const NodeCreationPopup = preload("res://addons/open_shader_graph/scripts/gd_node_creation_popup.gd")
const EditorUI = preload("res://addons/open_shader_graph/scripts/core/gd_editor_ui.gd")
const NodeFactory = preload("res://addons/open_shader_graph/scripts/core/gd_node_factory.gd")

# UI management
var editor_ui: EditorUI
var current_graph_edit: GraphEdit
var node_creation_popup: NodeCreationPopup

# Mouse position tracking for node creation
var last_right_click_position: Vector2

func _ready() -> void:
	if OS.is_debug_build():
		print("[DEBUG] OpenShaderEditor Loaded")
	
	# Initialize UI manager
	editor_ui = EditorUI.new(self)
	
	# Create the main layout using EditorUI
	current_graph_edit = editor_ui.setup_layout()
	
	# Connect UI signals
	editor_ui.file_menu_item_selected.connect(_on_file_menu_item_selected)
	editor_ui.graph_edit_right_clicked.connect(_on_graph_edit_right_clicked)
	editor_ui.node_selected.connect(_on_node_selected)
	editor_ui.resource_changed.connect(_on_resource_changed)
	
	# Initialize the node creation popup
	node_creation_popup = NodeCreationPopup.new(self)
	node_creation_popup.node_type_selected.connect(_on_node_type_selected)
	
	# Initialize with a default new shader
	_initialize_default_shader()

func _initialize_default_shader() -> void:
	# Create a default new shader when the editor starts
	if current_graph_edit:
		current_graph_edit.create_new_resource("main_shader")
		if OS.is_debug_build():
			print("[DEBUG] Default shader initialized")

func _on_file_menu_item_selected(id: int) -> void:
	match id:
		0: # New Shader
			_create_new_shader()
		1: # New SubGraph
			_create_new_subgraph()
		2: # Open
			_open_file()
		3: # Save
			_save_file()
		4: # Save As
			_save_file_as()

func _create_new_shader() -> void:
	if OS.is_debug_build():
		print("[DEBUG] Creating new shader...")
	
	# Check for unsaved changes
	if current_graph_edit and current_graph_edit.has_unsaved_changes():
		if not _confirm_unsaved_changes():
			return
	
	# Create new main shader resource
	if current_graph_edit.create_new_resource("main_shader"):
		# Prompt for save location immediately
		_save_file_as()
		if OS.is_debug_build():
			print("[DEBUG] New shader created and ready for editing")
	else:
		push_error("Failed to create new shader resource")

func _create_new_subgraph() -> void:
	if OS.is_debug_build():
		print("[DEBUG] Creating new subgraph...")
	
	# Check for unsaved changes
	if current_graph_edit and current_graph_edit.has_unsaved_changes():
		if not _confirm_unsaved_changes():
			return
	
	# Create new subgraph resource
	if current_graph_edit.create_new_resource("subgraph"):
		# Prompt for save location immediately
		_save_file_as()
		if OS.is_debug_build():
			print("[DEBUG] New subgraph created and ready for editing")
	else:
		push_error("Failed to create new subgraph resource")

func _open_file() -> void:
	if OS.is_debug_build():
		print("[DEBUG] Opening file...")
	
	# Check for unsaved changes
	if current_graph_edit and current_graph_edit.has_unsaved_changes():
		if not _confirm_unsaved_changes():
			return
	
	# Use EditorUI to show file dialog
	if editor_ui:
		editor_ui.show_open_file_dialog()
		var file_dialog: FileDialog = editor_ui.get_current_file_dialog()
		if file_dialog:
			file_dialog.file_selected.connect(_on_file_selected_for_open)

func _on_file_selected_for_open(file_path: String) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Opening file: ", file_path)
	
	if current_graph_edit.load_resource_from_disk(file_path):
		if OS.is_debug_build():
			print("[DEBUG] File opened successfully: ", file_path)
	else:
		push_error("Failed to open file: " + file_path)
	
	# Clean up file dialog using EditorUI
	if editor_ui:
		editor_ui.cleanup_file_dialog()

func _save_file() -> void:
	if OS.is_debug_build():
		print("[DEBUG] Saving file...")
	
	var resource_info = current_graph_edit.get_resource_info()
	
	if resource_info.is_saved and not resource_info.file_path.is_empty():
		# Save to existing file
		if current_graph_edit.save_resource_to_disk():
			if OS.is_debug_build():
				print("[DEBUG] File saved successfully: ", resource_info.file_path)
		else:
			push_error("Failed to save file")
	else:
		# No existing file, prompt for save location
		_save_file_as()

func _save_file_as() -> void:
	if OS.is_debug_build():
		print("[DEBUG] Save As...")
	
	var resource_info: Dictionary = current_graph_edit.get_resource_info()
	var resource_type: String = resource_info.get("resource_type", "main_shader")
	
	# Use EditorUI to show save dialog
	if editor_ui:
		editor_ui.show_save_file_dialog(resource_type)
		var file_dialog: FileDialog = editor_ui.get_current_file_dialog()
		if file_dialog:
			file_dialog.file_selected.connect(_on_file_selected_for_save)

func _on_file_selected_for_save(file_path: String) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Saving file as: ", file_path)
	
	if current_graph_edit.save_resource_to_disk(file_path):
		if OS.is_debug_build():
			print("[DEBUG] File saved successfully: ", file_path)
	else:
		push_error("Failed to save file: " + file_path)
	
	# Clean up file dialog using EditorUI
	if editor_ui:
		editor_ui.cleanup_file_dialog()

func _confirm_unsaved_changes() -> bool:
	# Use EditorUI for confirmation dialog
	if editor_ui:
		return editor_ui.show_unsaved_changes_dialog()
	
	# Fallback: just return true (discard changes)
	if OS.is_debug_build():
		print("[DEBUG] Warning: Discarding unsaved changes")
	return true

func _on_resource_changed(resource: OpenShaderGraphAsset) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Resource changed: ", resource.get_graph_property("asset_type", "unknown") if resource else "null")

func _on_graph_edit_right_clicked(global_mouse_position: Vector2) -> void:
	# Convert global position to GraphEdit's local coordinate space
	# Account for GraphEdit's scroll offset and zoom
	var graph_rect := current_graph_edit.get_rect()
	var local_pos := global_mouse_position - current_graph_edit.global_position
	local_pos = (local_pos + current_graph_edit.scroll_offset) / current_graph_edit.zoom
	last_right_click_position = local_pos
	
	if OS.is_debug_build():
		print("[DEBUG] Right-click at global: ", global_mouse_position, " local: ", last_right_click_position)
	
	# Show the node creation popup at the mouse position
	node_creation_popup.show_at_position(global_mouse_position)

func _on_node_type_selected(node_type: String) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Node type selected: ", node_type)
	
	# Create the node using the NodeFactory
	var new_node := NodeFactory.create_node(node_type)
	if new_node:
		# Generate a unique name for the node
		var base_name := node_type.replace(" ", "_").to_lower()
		var unique_name := base_name
		var counter := 1
		
		# Ensure the name is unique within the current graph
		while current_graph_edit.get_node_or_null(NodePath(unique_name)) != null:
			unique_name = base_name + "_" + str(counter)
			counter += 1
		
		# Set the node name and position
		new_node.name = unique_name
		new_node.position_offset = last_right_click_position
		
		# Add the node to the graph
		current_graph_edit.add_child(new_node)
		
		if OS.is_debug_build():
			print("[DEBUG] Node created and added at position: ", last_right_click_position, " with name: ", unique_name)
	else:
		push_error("Failed to create node: " + node_type)

func _on_node_selected(node: BaseNode) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Node selected: ", node.title if node else "None")
	
	# Update the properties panel with the selected node
	if editor_ui:
		editor_ui.update_properties_panel(node)

func _on_nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Nodes connected: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	
	# Update any listeners or perform additional logic if needed

func _on_nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int) -> void:
	if OS.is_debug_build():
		print("[DEBUG] Nodes disconnected: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	
	# Update any listeners or perform additional logic if needed

# Debug and utility functions
func refresh_node_registry() -> void:
	if OS.is_debug_build():
		print("[DEBUG] Refreshing node registry...")
	NodeFactory.refresh_registry()

func debug_connections() -> void:
	if OS.is_debug_build():
		var connections = current_graph_edit.get_connections()
		print("[DEBUG] Current connections: ", connections)

func debug_node_indices() -> void:
	if OS.is_debug_build():
		var nodes = current_graph_edit.get_nodes_by_index()
		print("[DEBUG] Nodes by index:")
		for node in nodes:
			print("  Index ", node.get_node_index(), ": ", node.name, " (", node.get_script().get_global_name() if node.get_script() else "no script", ")")
		print("[DEBUG] Next node index will be: ", current_graph_edit.get_next_node_index())

func recompact_node_indices() -> void:
	current_graph_edit.recompact_node_indices()
	if OS.is_debug_build():
		print("[DEBUG] Node indices recompacted")

# Get nodes sorted by their index (useful for shader code generation)
func get_nodes_by_index() -> Array[BaseNode]:
	if current_graph_edit:
		return current_graph_edit.get_nodes_by_index()
	return []
