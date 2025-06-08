@tool
extends RefCounted

class_name NodeCreationPopup

# Signal emitted when a node type is selected
signal node_type_selected(node_type: String)

# Available node types and their IDs
var node_types = {
	0: "Constant",
	1: "Float",
	2: "Int",
	3: "Bool",
	4: "Vector2"
}

# Reference to the parent node to add the popup as child
var parent_node: Node
var popup_window: PopupPanel
var search_input: LineEdit
var item_list: ItemList
var filtered_node_types: Dictionary = {}

func _init(parent: Node):
	parent_node = parent

func show_popup(global_position: Vector2):
	# Create the popup window
	popup_window = PopupPanel.new()
	popup_window.size = Vector2(300, 400)
	popup_window.position = global_position
	
	# Create a VBoxContainer for layout
	var vbox = VBoxContainer.new()
	vbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 8)
	
	# Add some padding to the container
	var margin_container = MarginContainer.new()
	margin_container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin_container.add_theme_constant_override("margin_left", 10)
	margin_container.add_theme_constant_override("margin_right", 10)
	margin_container.add_theme_constant_override("margin_top", 10)
	margin_container.add_theme_constant_override("margin_bottom", 10)
	
	# Create search input
	search_input = LineEdit.new()
	search_input.placeholder_text = "Search nodes..."
	search_input.custom_minimum_size.y = 30
	search_input.text_changed.connect(_on_search_text_changed)
	search_input.gui_input.connect(_on_search_input_gui_event)
	
	# Create item list
	item_list = ItemList.new()
	item_list.custom_minimum_size = Vector2(280, 300)
	item_list.item_selected.connect(_on_item_selected)
	item_list.item_activated.connect(_on_item_activated)
	
	# Add controls to layout
	vbox.add_child(search_input)
	vbox.add_child(item_list)
	
	# Add layout to margin container, then to popup
	margin_container.add_child(vbox)
	popup_window.add_child(margin_container)
	
	# Initialize with all items
	_update_filtered_items("")
	
	# Connect popup signals - PopupPanel auto-closes when clicking outside
	popup_window.popup_hide.connect(_on_popup_closed)
	
	# Add popup to parent and show it
	parent_node.add_child(popup_window)
	popup_window.popup()
	popup_window.position = global_position
	
	# Focus on search input
	search_input.grab_focus()

func _on_search_text_changed(new_text: String):
	_update_filtered_items(new_text)

func _update_filtered_items(search_text: String):
	item_list.clear()
	filtered_node_types.clear()
	
	var index = 0
	for id in node_types.keys():
		var node_name = node_types[id]
		
		# Filter based on search text (case insensitive)
		if search_text.is_empty() or node_name.to_lower().contains(search_text.to_lower()):
			item_list.add_item(node_name)
			filtered_node_types[index] = node_types[id]
			index += 1
	
	# Select first item if available
	if item_list.get_item_count() > 0:
		item_list.select(0)

func _on_search_input_gui_event(event: InputEvent):
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_DOWN:
				# Move selection down in list
				_navigate_list(1)
				search_input.accept_event()
			KEY_UP:
				# Move selection up in list
				_navigate_list(-1)
				search_input.accept_event()
			KEY_ENTER:
				# Select current item
				_select_current_item()
				search_input.accept_event()
			KEY_ESCAPE:
				# Close popup
				_close_popup()
				search_input.accept_event()

func _navigate_list(direction: int):
	var current_selected = item_list.get_selected_items()
	var new_index = 0
	
	if current_selected.size() > 0:
		new_index = current_selected[0] + direction
	
	# Clamp to valid range
	new_index = clamp(new_index, 0, item_list.get_item_count() - 1)
	
	if item_list.get_item_count() > 0:
		item_list.select(new_index)
		item_list.ensure_current_is_visible()

func _on_item_selected(index: int):
	# Item selected (single click or keyboard navigation) - select immediately
	_select_item_at_index(index)

func _on_item_activated(index: int):
	# Item double-clicked or enter pressed on list
	_select_item_at_index(index)

func _select_current_item():
	var selected_items = item_list.get_selected_items()
	if selected_items.size() > 0:
		_select_item_at_index(selected_items[0])

func _select_item_at_index(index: int):
	if index < 0 or index >= item_list.get_item_count():
		return
		
	var selected_node_type = filtered_node_types.get(index, "Unknown")
	print("[DEBUG] Popup item selected: ", selected_node_type)
	
	# Emit signal with the selected node type
	node_type_selected.emit(selected_node_type)
	
	# Defer popup closing to next frame to avoid cleanup during event processing
	_close_popup.call_deferred()

func _on_popup_closed():
	# Clean up when popup is closed
	if popup_window and is_instance_valid(popup_window):
		if popup_window.get_parent():
			popup_window.get_parent().remove_child(popup_window)
		popup_window.queue_free()
		popup_window = null

func _close_popup():
	if popup_window and is_instance_valid(popup_window):
		popup_window.hide()