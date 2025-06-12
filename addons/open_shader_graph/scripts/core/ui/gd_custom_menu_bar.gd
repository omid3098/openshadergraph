class_name CustomMenuBar extends HBoxContainer

signal menu_item_selected(menu_name: String, item_id: int, item_text: String)

var _menus: Dictionary = {}

func _init() -> void:
	print("[CustomMenuBar] init")
	_setup_styling()

func _setup_styling() -> void:
	# Add some padding and styling to make it look like a proper menu bar
	add_theme_constant_override("separation", 0)

func add_menu(menu_name: String, items: Array) -> void:
	"""
	Add a menu to the menu bar
	menu_name: The display name for the menu button
	items: Array of dictionaries with keys: 'text', 'id', 'disabled' (optional), 'separator' (optional)
	Example: [{"text": "New", "id": 0}, {"separator": true}, {"text": "Open", "id": 1}]
	"""
	if _menus.has(menu_name):
		push_warning("[CustomMenuBar] Menu '%s' already exists, replacing it" % menu_name)
		_remove_menu(menu_name)
	
	# Create the menu button
	var menu_button = Button.new()
	menu_button.text = menu_name
	menu_button.flat = true
	menu_button.custom_minimum_size.x = 60
	menu_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	
	# Create the popup menu
	var popup_menu = PopupMenu.new()
	popup_menu.name = menu_name + "_popup"
	
	# Add items to the popup menu
	for item in items:
		if item.has("separator") and item.separator:
			popup_menu.add_separator()
		else:
			var item_id = item.get("id", popup_menu.get_item_count())
			popup_menu.add_item(item.text, item_id)
			if item.has("disabled") and item.disabled:
				popup_menu.set_item_disabled(popup_menu.get_item_count() - 1, true)
	
	# Connect signals
	menu_button.pressed.connect(_on_menu_button_pressed.bind(menu_name))
	popup_menu.id_pressed.connect(_on_popup_item_selected.bind(menu_name))
	
	# Add to scene
	add_child(menu_button)
	menu_button.add_child(popup_menu)
	
	# Store reference
	_menus[menu_name] = {
		"button": menu_button,
		"popup": popup_menu
	}

func remove_menu(menu_name: String) -> void:
	"""Remove a menu from the menu bar"""
	_remove_menu(menu_name)

func _remove_menu(menu_name: String) -> void:
	if _menus.has(menu_name):
		var menu_data = _menus[menu_name]
		menu_data.button.queue_free()
		_menus.erase(menu_name)

func get_menu(menu_name: String) -> PopupMenu:
	"""Get the PopupMenu for a specific menu by name"""
	if _menus.has(menu_name):
		return _menus[menu_name].popup
	return null

func update_menu_item(menu_name: String, item_id: int, new_text: String = "", disabled: bool = false) -> void:
	"""Update a specific menu item's text or disabled state"""
	var popup = get_menu(menu_name)
	if popup:
		var item_index = popup.get_item_index(item_id)
		if item_index != -1:
			if new_text != "":
				popup.set_item_text(item_index, new_text)
			popup.set_item_disabled(item_index, disabled)

func _on_menu_button_pressed(menu_name: String) -> void:
	var menu_data = _menus.get(menu_name)
	if menu_data:
		var button = menu_data.button
		var popup = menu_data.popup
		
		# Position the popup below the button
		var button_global_pos = button.global_position
		var button_size = button.size
		popup.position = Vector2i(button_global_pos.x, button_global_pos.y + button_size.y)
		popup.popup()

func _on_popup_item_selected(item_id: int, menu_name: String) -> void:
	# Wrapper function to handle the correct parameter order from bind
	_on_menu_item_selected(menu_name, item_id)

func _on_menu_item_selected(menu_name: String, item_id: int) -> void:
	var popup = get_menu(menu_name)
	if popup:
		var item_index = popup.get_item_index(item_id)
		var item_text = popup.get_item_text(item_index)
		menu_item_selected.emit(menu_name, item_id, item_text)

# Convenience methods for common menu operations
func add_file_menu() -> void:
	"""Add a standard File menu"""
	var file_items = [
		{"text": "New Graph", "id": 0},
		{"text": "Open Graph", "id": 1},
		{"separator": true},
		{"text": "Save", "id": 2},
		{"text": "Save As", "id": 3},
		{"separator": true},
		{"text": "Export", "id": 4}
	]
	add_menu("File", file_items)

func add_edit_menu() -> void:
	"""Add a standard Edit menu"""
	var edit_items = [
		{"text": "Undo", "id": 10},
		{"text": "Redo", "id": 11},
		{"separator": true},
		{"text": "Cut", "id": 12},
		{"text": "Copy", "id": 13},
		{"text": "Paste", "id": 14},
		{"separator": true},
		{"text": "Select All", "id": 15},
		{"text": "Deselect All", "id": 16}
	]
	add_menu("Edit", edit_items)

func add_view_menu() -> void:
	"""Add a standard View menu"""
	var view_items = [
		{"text": "Zoom In", "id": 20},
		{"text": "Zoom Out", "id": 21},
		{"text": "Zoom to Fit", "id": 22},
		{"text": "Reset Zoom", "id": 23},
		{"separator": true},
		{"text": "Show Grid", "id": 24},
		{"text": "Show Minimap", "id": 25}
	]
	add_menu("View", view_items)

func add_help_menu() -> void:
	"""Add a standard Help menu"""
	var help_items = [
		{"text": "Documentation", "id": 30},
		{"text": "About", "id": 31}
	]
	add_menu("Help", help_items)