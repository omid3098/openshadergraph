@tool
extends Control

class_name OpenShaderEditor

const NodeCreationPopup = preload("res://addons/open_shader_graph/scripts/gd_node_creation_popup.gd")
const PropertiesPanel = preload("res://addons/open_shader_graph/scripts/gd_properties_panel.gd")
const NodeFactory = preload("res://addons/open_shader_graph/scripts/core/gd_node_factory.gd")

var graph_edit_path: String = "res://addons/open_shader_graph/scenes/scn_graph_edit.tscn"
var current_graph_edit: GraphEdit
var node_creation_popup: NodeCreationPopup
var properties_panel: PropertiesPanel

# File menu references
var menu_bar: MenuBar
var file_menu: PopupMenu

# Mouse position tracking for node creation
var last_right_click_position: Vector2

# Constants for layout
const PROPERTIES_PANEL_RATIO = 0.25 # 1/4 of the total width

func _ready():
	print("[DEBUG] OpenShaderEditor Loaded")
	
	# Create the main layout
	_setup_layout()
	
	# Initialize the node creation popup
	node_creation_popup = NodeCreationPopup.new(self)
	node_creation_popup.node_type_selected.connect(_on_node_type_selected)
	
	# Initialize with a default new shader
	_initialize_default_shader()

func _initialize_default_shader():
	# Create a default new shader when the editor starts
	if current_graph_edit:
		current_graph_edit.create_new_resource("main_shader")
		print("[DEBUG] Default shader initialized")

func _setup_layout():
	# Create the main VBoxContainer to hold menu and content
	var main_vbox = VBoxContainer.new()
	add_child(main_vbox)
	main_vbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	
	# Create and setup the menu bar
	_setup_menu_bar(main_vbox)
	
	# Create a HSplitContainer for the main layout below the menu
	var hsplit = HSplitContainer.new()
	main_vbox.add_child(hsplit)
	hsplit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	
	# Create properties panel on the left
	properties_panel = PropertiesPanel.new()
	properties_panel.custom_minimum_size.x = 200 # Minimum width to ensure usability
	properties_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	properties_panel.size_flags_stretch_ratio = PROPERTIES_PANEL_RATIO
	hsplit.add_child(properties_panel)
	
	# Create a container for the graph edit (to add top margin)
	var graph_container = Control.new()
	graph_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	graph_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	graph_container.size_flags_stretch_ratio = 1.0 - PROPERTIES_PANEL_RATIO
	hsplit.add_child(graph_container)
	
	# Create a new graph_edit
	current_graph_edit = load(graph_edit_path).instantiate()
	current_graph_edit.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	
	# Listen for signals
	current_graph_edit.right_clicked.connect(_on_graph_edit_right_clicked)
	current_graph_edit.shader_node_selected.connect(_on_node_selected)
	current_graph_edit.nodes_connected.connect(_on_nodes_connected)
	current_graph_edit.nodes_disconnected.connect(_on_nodes_disconnected)
	current_graph_edit.resource_changed.connect(_on_resource_changed)
	
	# Add graph edit to its container
	graph_container.add_child(current_graph_edit)

func _setup_menu_bar(parent: Control):
	# Create menu bar
	menu_bar = MenuBar.new()
	parent.add_child(menu_bar)
	
	# Create File menu
	file_menu = PopupMenu.new()
	file_menu.name = "File"
	
	# Add File menu items
	file_menu.add_item("New Shader", 0)
	file_menu.add_item("New SubGraph", 1)
	file_menu.add_separator()
	file_menu.add_item("Open...", 2)
	file_menu.add_item("Save", 3)
	file_menu.add_item("Save As...", 4)
	
	# Connect File menu signals
	file_menu.id_pressed.connect(_on_file_menu_item_selected)
	
	# Add the File menu to the menu bar
	menu_bar.add_child(file_menu)
	menu_bar.set_menu_title(0, "File")

func _on_file_menu_item_selected(id: int):
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

func _create_new_shader():
	print("[DEBUG] Creating new shader...")
	
	# Check for unsaved changes
	if current_graph_edit and current_graph_edit.has_unsaved_changes():
		if not _confirm_unsaved_changes():
			return
	
	# Create new main shader resource
	if current_graph_edit.create_new_resource("main_shader"):
		# Prompt for save location immediately
		_save_file_as()
		print("[DEBUG] New shader created and ready for editing")
	else:
		push_error("Failed to create new shader resource")

func _create_new_subgraph():
	print("[DEBUG] Creating new subgraph...")
	
	# Check for unsaved changes
	if current_graph_edit and current_graph_edit.has_unsaved_changes():
		if not _confirm_unsaved_changes():
			return
	
	# Create new subgraph resource
	if current_graph_edit.create_new_resource("subgraph"):
		# Prompt for save location immediately
		_save_file_as()
		print("[DEBUG] New subgraph created and ready for editing")
	else:
		push_error("Failed to create new subgraph resource")

func _open_file():
	print("[DEBUG] Opening file...")
	
	# Check for unsaved changes
	if current_graph_edit and current_graph_edit.has_unsaved_changes():
		if not _confirm_unsaved_changes():
			return
	
	# Create file dialog
	var file_dialog = FileDialog.new()
	file_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	file_dialog.access = FileDialog.ACCESS_RESOURCES
	file_dialog.add_filter("*.tres", "Godot Resource Files")
	file_dialog.current_dir = "res://"
	
	# Connect signal
	file_dialog.file_selected.connect(_on_file_selected_for_open)
	
	# Add to scene and show
	add_child(file_dialog)
	file_dialog.popup_centered(Vector2i(800, 600))

func _on_file_selected_for_open(file_path: String):
	print("[DEBUG] Opening file: ", file_path)
	
	if current_graph_edit.load_resource_from_disk(file_path):
		print("[DEBUG] File opened successfully: ", file_path)
	else:
		push_error("Failed to open file: " + file_path)
	
	# Clean up file dialog
	var file_dialog = get_children().filter(func(child): return child is FileDialog)[0]
	if file_dialog:
		file_dialog.queue_free()

func _save_file():
	print("[DEBUG] Saving file...")
	
	var resource_info = current_graph_edit.get_resource_info()
	
	if resource_info.is_saved and not resource_info.file_path.is_empty():
		# Save to existing file
		if current_graph_edit.save_resource_to_disk():
			print("[DEBUG] File saved successfully: ", resource_info.file_path)
		else:
			push_error("Failed to save file")
	else:
		# No existing file, show Save As dialog
		_save_file_as()

func _save_file_as():
	print("[DEBUG] Save As...")
	
	var resource_info = current_graph_edit.get_resource_info()
	
	# Create file dialog
	var file_dialog = FileDialog.new()
	file_dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE
	file_dialog.access = FileDialog.ACCESS_RESOURCES
	file_dialog.add_filter("*.tres", "Godot Resource Files")
	file_dialog.current_dir = "res://"
	
	# Set default filename based on resource type
	match resource_info.resource_type:
		"main_shader":
			file_dialog.current_file = "new_shader.tres"
		"subgraph":
			file_dialog.current_file = "new_subgraph.tres"
		_:
			file_dialog.current_file = "new_graph.tres"
	
	# Connect signal
	file_dialog.file_selected.connect(_on_file_selected_for_save)
	
	# Add to scene and show
	add_child(file_dialog)
	file_dialog.popup_centered(Vector2i(800, 600))

func _on_file_selected_for_save(file_path: String):
	print("[DEBUG] Saving file as: ", file_path)
	
	if current_graph_edit.save_resource_to_disk(file_path):
		print("[DEBUG] File saved successfully: ", file_path)
	else:
		push_error("Failed to save file: " + file_path)
	
	# Clean up file dialog
	var file_dialog = get_children().filter(func(child): return child is FileDialog)[0]
	if file_dialog:
		file_dialog.queue_free()

func _confirm_unsaved_changes() -> bool:
	# For now, just return true (always discard changes)
	# TODO: Implement proper confirmation dialog
	print("[DEBUG] Warning: Discarding unsaved changes")
	return true

func _on_resource_changed(resource: OpenShaderGraphAsset):
	print("[DEBUG] Resource changed: ", resource.get_graph_property("asset_type", "unknown") if resource else "null")
	# TODO: Update UI to reflect current resource state
	# For example, update window title, properties panel, etc.

func _on_graph_edit_right_clicked(global_mouse_position: Vector2):
	# Convert global position to GraphEdit's local coordinate space
	# Account for GraphEdit's scroll offset and zoom
	var graph_rect = current_graph_edit.get_rect()
	var local_pos = global_mouse_position - current_graph_edit.global_position
	local_pos = (local_pos + current_graph_edit.scroll_offset) / current_graph_edit.zoom
	last_right_click_position = local_pos
	print("[DEBUG] Right-click at global: ", global_mouse_position, " local: ", last_right_click_position)
	# Show the node creation popup
	node_creation_popup.show_popup(global_mouse_position)

func _on_node_type_selected(node_type: String):
	print("[DEBUG] Node type selected: ", node_type)
	var new_node = NodeFactory.create_node(node_type)
	if new_node:
		# Generate a unique name for the node
		var base_name = node_type.replace(" ", "_").to_lower()
		var unique_name = base_name
		var counter = 1
		while current_graph_edit.has_node(NodePath(unique_name)):
			unique_name = base_name + "_" + str(counter)
			counter += 1
		new_node.name = unique_name
		
		current_graph_edit.add_child(new_node)
		# Position the node at the stored right-click location
		new_node.position_offset = last_right_click_position
		print("[DEBUG] Node created and added at position: ", last_right_click_position, " with name: ", unique_name)
	else:
		print("[ERROR] Failed to create node: ", node_type)

func _on_node_selected(node: BaseNode):
	print("[DEBUG] Node selected: ", node.title if node else "None")
	if properties_panel:
		properties_panel.set_selected_node(node)

func _on_nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int):
	print("[DEBUG] Nodes connected: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	# Here we could update UI or trigger other events when nodes are connected

func _on_nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int):
	print("[DEBUG] Nodes disconnected: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	# Here we could update UI or trigger other events when nodes are disconnected

# Development helper function to refresh node registry
func refresh_node_registry():
	print("[DEBUG] Refreshing node registry...")
	NodeFactory.refresh_registry()
	NodeFactory.debug_print_registry()

# Development helper function to debug connections
func debug_connections():
	if current_graph_edit:
		var connections = current_graph_edit.get_connections()
		print("[DEBUG] Current connections: ", connections)
		return connections
	return []

# Development helper function to debug node indices
func debug_node_indices():
	if current_graph_edit:
		var nodes = current_graph_edit.get_nodes_by_index()
		print("[DEBUG] Nodes by index:")
		for node in nodes:
			print("  Index ", node.get_node_index(), ": ", node.name, " (", node.get_script().get_global_name() if node.get_script() else "no script", ")")
		print("[DEBUG] Next node index will be: ", current_graph_edit.get_next_node_index())
		return nodes
	return []

# Recompact node indices (removes gaps in numbering)
func recompact_node_indices():
	if current_graph_edit:
		current_graph_edit.recompact_node_indices()
		print("[DEBUG] Node indices recompacted")

# Get nodes sorted by their index (useful for shader code generation)
func get_nodes_by_index() -> Array[BaseNode]:
	if current_graph_edit:
		return current_graph_edit.get_nodes_by_index()
	return []
