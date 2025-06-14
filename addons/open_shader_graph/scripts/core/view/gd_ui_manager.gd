class_name UIManager extends Node

var graph_tabs: TabContainer
var context_menu_manager: ContextMenuManager
var bottom_panel: BottomPanel
var sidebar: Sidebar
var graph_manager: GraphManager # Reference to logic layer

const SIDEBAR_WIDTH: int = 250
const BOTTOM_PANEL_HEIGHT: int = 250

func _init(graph_manager_ref: GraphManager) -> void:
	print("[UIManager] init")
	graph_manager = graph_manager_ref
	
	# Set up UI components
	graph_tabs = TabContainer.new()
	context_menu_manager = ContextMenuManager.new()
	bottom_panel = BottomPanel.new()
	sidebar = Sidebar.new()
	
	# Connect to logic layer events
	EventBus.get_instance().graph_created.connect(_on_graph_created)
	EventBus.get_instance().graph_deleted.connect(_on_graph_deleted)
	EventBus.get_instance().graph_selected.connect(_on_graph_selected)
	
	# Connect to view layer events
	graph_tabs.connect("tab_changed", Callable(self, "_on_tab_changed"))

func get_main_scene() -> Control:
	# A main control node that will contain all the other nodes
	var main_scene = Control.new()
	
	# A VBoxContainer that will contain the menu bar and the main split container
	var vbox_container = VBoxContainer.new()
	vbox_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	
	# VSplitContainer to separate main content from bottom panel (resizable vertically)
	var main_vsplit = VSplitContainer.new()
	main_vsplit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	main_vsplit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	
	# HSplitContainer for sidebar and graph edit (resizable horizontally)
	var main_hsplit = HSplitContainer.new()
	main_hsplit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	main_hsplit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	
	# Set initial split ratios
	main_hsplit.split_offset = - SIDEBAR_WIDTH # Initial sidebar width
	main_vsplit.split_offset = BOTTOM_PANEL_HEIGHT # Initial bottom panel height

	# Set up sidebar
	sidebar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sidebar.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sidebar.custom_minimum_size = Vector2(SIDEBAR_WIDTH, 0) # Give it a minimum width
	main_hsplit.add_child(sidebar)

	
	# Set up graph edit
	graph_tabs.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	graph_tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	main_hsplit.add_child(graph_tabs)
	
	# Add the horizontal split to the vertical split
	main_vsplit.add_child(main_hsplit)
	
	# Set up bottom panel
	bottom_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bottom_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bottom_panel.custom_minimum_size = Vector2(0, BOTTOM_PANEL_HEIGHT) # Give it a minimum height
	main_vsplit.add_child(bottom_panel)
	
	vbox_container.add_child(main_vsplit)
	main_scene.add_child(vbox_container)
	return main_scene

# func _get_helper_label(_parent_control: Control, _text: String) -> void:
# 	# Add a label to show the component name and center it within its container
# 	var label = Label.new()
# 	label.text = _text
# 	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
# 	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
# 	# Use expand fill flags instead of full rect preset to work properly with containers
# 	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
# 	label.size_flags_vertical = Control.SIZE_EXPAND_FILL
# 	_parent_control.add_child(label)

# Tab management - orchestrates between logic and view
func _on_graph_created(graph: BaseGraphData) -> void:
	print("[UIManager] Adding graph tab: " + graph.name)
	_create_or_switch_to_tab(graph)

func _on_graph_selected(graph: BaseGraphData) -> void:
	print("[UIManager] Switching to graph: " + graph.name)
	_create_or_switch_to_tab(graph)

func _create_or_switch_to_tab(graph: BaseGraphData) -> void:
	# Check if tab already exists
	for i in range(graph_tabs.get_child_count()):
		var child = graph_tabs.get_child(i)
		if child is ShaderGraphEdit and child.graph_data == graph:
			graph_tabs.current_tab = i
			return
	
	# Create new tab
	var edit = ShaderGraphEdit.new()
	edit.set_graph(graph)
	graph_tabs.add_child(edit)
	graph_tabs.set_tab_title(graph_tabs.get_child_count() - 1, graph.name)
	graph_tabs.current_tab = graph_tabs.get_child_count() - 1

func _on_graph_deleted(graph: BaseGraphData) -> void:
	for i in range(graph_tabs.get_child_count()):
		var child = graph_tabs.get_child(i)
		if child is ShaderGraphEdit and child.graph_data == graph:
			graph_tabs.remove_child(child)
			child.queue_free()
			break

func _on_tab_changed(tab_index: int) -> void:
	var child = graph_tabs.get_child(tab_index)
	if child is ShaderGraphEdit and child.graph_data:
		# Tell logic layer about the selection (don't emit directly)
		graph_manager.select_graph(child.graph_data)