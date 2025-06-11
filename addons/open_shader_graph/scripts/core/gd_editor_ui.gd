@tool
class_name EditorUI extends RefCounted

## Manages UI setup and layout for OpenShaderGraph editor
## Handles menu creation, layout management, and dialog interactions

signal file_menu_item_selected(id: int)
signal graph_edit_right_clicked(global_mouse_position: Vector2)
signal node_selected(node: BaseNode)
signal resource_changed(resource: OpenShaderGraphAsset)

# UI References
var parent_control: Control
var menu_bar: MenuBar
var file_menu: PopupMenu
var properties_panel: PropertiesPanel
var current_graph_edit: GraphEdit

# Constants for layout
const PROPERTIES_PANEL_RATIO: float = 0.25 # 1/4 of the total width

# File dialog management
var current_file_dialog: FileDialog

func _init(parent: Control) -> void:
	parent_control = parent

## Sets up the complete UI layout
func setup_layout() -> GraphEdit:
	if not parent_control:
		push_error("EditorUI: Cannot setup layout without parent control")
		return null
	
	# Create the main VBoxContainer to hold menu and content
	var main_vbox := VBoxContainer.new()
	parent_control.add_child(main_vbox)
	main_vbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	
	# Create and setup the menu bar
	_setup_menu_bar(main_vbox)
	
	# Create a HSplitContainer for the main layout below the menu
	var hsplit := HSplitContainer.new()
	main_vbox.add_child(hsplit)
	hsplit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	
	# Create properties panel on the left
	_setup_properties_panel(hsplit)
	
	# Create graph edit area
	current_graph_edit = _setup_graph_edit(hsplit)
	
	return current_graph_edit

## Sets up the menu bar with File menu
func _setup_menu_bar(parent: Control) -> void:
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

## Sets up the properties panel
func _setup_properties_panel(parent: Control) -> void:
	const PropertiesPanel = preload("res://addons/open_shader_graph/scripts/gd_properties_panel.gd")
	
	properties_panel = PropertiesPanel.new()
	properties_panel.custom_minimum_size.x = 200 # Minimum width to ensure usability
	properties_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	properties_panel.size_flags_stretch_ratio = PROPERTIES_PANEL_RATIO
	parent.add_child(properties_panel)

## Sets up the graph edit area
func _setup_graph_edit(parent: Control) -> GraphEdit:
	# Create a container for the graph edit (to add top margin)
	var graph_container := Control.new()
	graph_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	graph_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	graph_container.size_flags_stretch_ratio = 1.0 - PROPERTIES_PANEL_RATIO
	parent.add_child(graph_container)
	
	# Create a new graph_edit using the enhanced version
	var graph_edit_script = preload("res://addons/open_shader_graph/scripts/core/gd_graph_edit.gd")
	var graph_edit: GraphEdit = GraphEdit.new()
	graph_edit.set_script(graph_edit_script)
	graph_edit.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	
	# Connect signals (will be handled by the main editor)
	graph_edit.right_clicked.connect(_on_graph_edit_right_clicked)
	graph_edit.shader_node_selected.connect(_on_node_selected)
	graph_edit.resource_changed.connect(_on_resource_changed)
	
	# Add graph edit to its container
	graph_container.add_child(graph_edit)
	
	return graph_edit

## Shows a file dialog for opening files
func show_open_file_dialog() -> void:
	if current_file_dialog:
		current_file_dialog.queue_free()
	
	current_file_dialog = FileDialog.new()
	current_file_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	current_file_dialog.access = FileDialog.ACCESS_RESOURCES
	current_file_dialog.add_filter("*.tres", "Godot Resource Files")
	current_file_dialog.current_dir = "res://"
	
	# Add to scene and show
	parent_control.add_child(current_file_dialog)
	current_file_dialog.popup_centered(Vector2i(800, 600))

## Shows a file dialog for saving files
func show_save_file_dialog(resource_type: String = "main_shader") -> void:
	if current_file_dialog:
		current_file_dialog.queue_free()
	
	current_file_dialog = FileDialog.new()
	current_file_dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE
	current_file_dialog.access = FileDialog.ACCESS_RESOURCES
	current_file_dialog.add_filter("*.tres", "Godot Resource Files")
	current_file_dialog.current_dir = "res://"
	
	# Set default filename based on resource type
	match resource_type:
		"main_shader":
			current_file_dialog.current_file = "shader.tres"
		"subgraph":
			current_file_dialog.current_file = "subgraph.tres"
		_:
			current_file_dialog.current_file = "graph.tres"
	
	# Add to scene and show
	parent_control.add_child(current_file_dialog)
	current_file_dialog.popup_centered(Vector2i(800, 600))

## Shows a confirmation dialog for unsaved changes
func show_unsaved_changes_dialog() -> bool:
	# TODO: Implement a proper confirmation dialog
	# For now, just return true (discard changes)
	if OS.is_debug_build():
		print("[DEBUG] EditorUI: Warning: Discarding unsaved changes")
	return true

## Gets the current file dialog (for connecting signals)
func get_current_file_dialog() -> FileDialog:
	return current_file_dialog

## Cleans up the current file dialog
func cleanup_file_dialog() -> void:
	if current_file_dialog:
		current_file_dialog.queue_free()
		current_file_dialog = null

## Updates the properties panel with a selected node
func update_properties_panel(node: BaseNode) -> void:
	if properties_panel:
		properties_panel.set_selected_node(node)

## Gets the properties panel reference
func get_properties_panel() -> PropertiesPanel:
	return properties_panel

## Gets the menu bar reference
func get_menu_bar() -> MenuBar:
	return menu_bar

## Gets the file menu reference
func get_file_menu() -> PopupMenu:
	return file_menu

## Internal signal handlers

func _on_file_menu_item_selected(id: int) -> void:
	file_menu_item_selected.emit(id)

func _on_graph_edit_right_clicked(global_mouse_position: Vector2) -> void:
	graph_edit_right_clicked.emit(global_mouse_position)

func _on_node_selected(node: BaseNode) -> void:
	node_selected.emit(node)

func _on_resource_changed(resource: OpenShaderGraphAsset) -> void:
	resource_changed.emit(resource)

## Utility methods for UI state management

## Shows/hides the properties panel
func set_properties_panel_visible(visible: bool) -> void:
	if properties_panel:
		properties_panel.visible = visible

## Gets the properties panel visibility
func is_properties_panel_visible() -> bool:
	return properties_panel.visible if properties_panel else false

## Sets the properties panel width ratio
func set_properties_panel_ratio(ratio: float) -> void:
	if properties_panel and ratio > 0.0 and ratio < 1.0:
		properties_panel.size_flags_stretch_ratio = ratio
		
		# Update the graph container ratio
		if current_graph_edit and current_graph_edit.get_parent():
			current_graph_edit.get_parent().size_flags_stretch_ratio = 1.0 - ratio