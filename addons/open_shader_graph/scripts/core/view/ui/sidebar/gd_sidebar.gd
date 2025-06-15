class_name Sidebar extends Control

# Forward signals from child components
signal file_menu_item_selected(item_id: int)

var custom_menu_bar: CustomMenuBar
var properties_panel: PropertiesPanel

func _init() -> void:
	Logger.log("[Sidebar] init")
	# Sidebar contents:
	# A custom menu bar to show in this editor, not in the default godot editor. Like the menu bar in the default godot shader editor.
	# Properties Panel (GraphsList removed - using tabs now)

	# Create a VBoxContainer to properly organize the sidebar components vertically
	var vbox_container = VBoxContainer.new()
	vbox_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(vbox_container)

	custom_menu_bar = CustomMenuBar.new()
	properties_panel = PropertiesPanel.new()

	# Connect menu bar signals to forward them
	custom_menu_bar.file_menu_item_selected.connect(_on_file_menu_item_selected)

	# Set size flags for proper layout
	custom_menu_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	custom_menu_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	
	properties_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	properties_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL

	# Add components directly to VBox (no split container needed with only 2 components)
	vbox_container.add_child(custom_menu_bar)
	vbox_container.add_child(properties_panel)

func _on_file_menu_item_selected(item_id: int) -> void:
	# Forward signal to parent
	file_menu_item_selected.emit(item_id)
