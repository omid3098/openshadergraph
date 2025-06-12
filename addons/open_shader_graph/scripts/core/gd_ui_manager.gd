class_name UIManager extends Node

var graph_edit: GraphEdit
var context_menu_manager: ContextMenuManager
var bottom_panel: BottomPanel
var sidebar: Sidebar

const SIDEBAR_WIDTH: int = 250
const BOTTOM_PANEL_HEIGHT: int = 250

# Preload the custom GraphEdit script to avoid unknown identifier errors during static analysis.
const ShaderGraphEdit := preload("res://addons/open_shader_graph/scripts/core/ui/gd_shader_graph_edit.gd")

func _init() -> void:
	print("[UIManager] init")
	# MenuBar
	# GraphEdit
	# ContextMenuManager
		# Creation Popup
		# Node Context Menu
		# Grouping Context Menu
	# BottomPanel
		# Console
		# Shader Code
	# Sidebar
		# Graphs List
		# Properties Panel
	graph_edit = ShaderGraphEdit.new()
	context_menu_manager = ContextMenuManager.new()
	bottom_panel = BottomPanel.new()
	sidebar = Sidebar.new()

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
	graph_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	graph_edit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	main_hsplit.add_child(graph_edit)
	
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