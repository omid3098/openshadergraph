class_name Sidebar extends Control

var custom_menu_bar: CustomMenuBar
var graphs_list: GraphsList
var properties_panel: PropertiesPanel

func _init() -> void:
	print("[Sidebar] init")
	# Sidebar contents:
	# A custom menu bar to show in this editor, not in the default godot editor. Like the menu bar in the default godot shader editor.
	# Graphs List
	# Properties Panel

	# Create a VBoxContainer to properly organize the sidebar components vertically
	var vbox_container = VBoxContainer.new()
	vbox_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(vbox_container)

	custom_menu_bar = CustomMenuBar.new()
	graphs_list = GraphsList.new()
	properties_panel = PropertiesPanel.new()
	# Create a split container so the user can resize the list and properties panel
	var vsplit_container := VSplitContainer.new()
	vsplit_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vsplit_container.size_flags_vertical = Control.SIZE_EXPAND_FILL

	# Set size flags for proper layout
	custom_menu_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	custom_menu_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	
	graphs_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	graphs_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	
	properties_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	properties_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL

	# Add the panels to the split container so they can be resized by the user
	vsplit_container.add_child(graphs_list)
	vsplit_container.add_child(properties_panel)
	
	# Add the menu bar and the split container to the VBox container
	vbox_container.add_child(custom_menu_bar)
	vbox_container.add_child(vsplit_container)

	# Add default menus to make the menu bar visible
	_setup_default_menus()

func _setup_default_menus() -> void:
	# Add standard menus to the custom menu bar
	custom_menu_bar.add_file_menu()
	custom_menu_bar.add_edit_menu()
	custom_menu_bar.add_help_menu()
	
	# Connect to menu signals
	custom_menu_bar.menu_item_selected.connect(_on_menu_item_selected_wrapper)

func _on_menu_item_selected_wrapper(menu_name: String, item_id: int, item_text: String) -> void:
	# Wrapper function to handle the signal with 3 parameters and call our function with 2
	_on_menu_item_selected(menu_name, item_text)

func _on_menu_item_selected(menu_name: String, item_text: String) -> void:
	print("[Sidebar] Menu item selected: " + menu_name + " > " + item_text)
	# TODO: Implement actual menu actions
