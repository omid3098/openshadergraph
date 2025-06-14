class_name CustomMenuBar extends PanelContainer

# Reference to the enum defined in MenuEnums for cleaner access.
const FileMenuItem = MenuEnums.FileMenuItem

var _menus: Dictionary = {}
# Internal HBoxContainer that actually hosts the menu buttons. Using a PanelContainer
# as the root node lets us style the background via a StyleBox without manually drawing.
var _hbox: HBoxContainer

func _init() -> void:
	Logger.log("[CustomMenuBar] init")

	# Create the internal HBoxContainer that will hold the menu buttons.
	_hbox = HBoxContainer.new()
	_hbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_hbox.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	add_child(_hbox)

	_setup_styling()
	_setup_default_menus()

func _setup_default_menus() -> void:
	# Only File menu is required for now
	add_file_menu()

func _setup_styling() -> void:
	# Create a StyleBoxFlat to serve as the dark background for the menu bar.
	var stylebox := StyleBoxFlat.new()
	stylebox.bg_color = Color(0.13, 0.13, 0.13, 1) # Darker background colour
	# Optional: Uncomment to give rounded corners in the future
	stylebox.set_corner_radius_all(6)

	add_theme_stylebox_override("panel", stylebox)

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
	
	# Add to internal HBoxContainer so layout remains horizontal
	_hbox.add_child(menu_button)
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

func _on_popup_item_selected(item_id: int, _menu_name: String) -> void:
	# Forward the enum value directly; only File menu exists so menu_name is irrelevant.
	EventBus.get_instance().file_menu_item_selected.emit(item_id)

# Convenience methods for common menu operations
func add_file_menu() -> void:
	"""Add a standard File menu leveraging enum ids for readability"""
	var file_items = [
		{"text": "New Graph", "id": FileMenuItem.NEW_GRAPH},
		{"text": "Open Graph", "id": FileMenuItem.OPEN_GRAPH},
		{"separator": true},
		{"text": "Save", "id": FileMenuItem.SAVE},
		{"text": "Save As", "id": FileMenuItem.SAVE_AS},
		{"separator": true},
		{"text": "Export", "id": FileMenuItem.EXPORT}
	]
	add_menu("File", file_items)

# The Edit, View, and Help menus are intentionally omitted for now based on
# current requirements.