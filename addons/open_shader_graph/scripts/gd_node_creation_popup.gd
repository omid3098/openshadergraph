@tool
extends RefCounted

class_name NodeCreationPopup

# Signal emitted when a node type is selected
signal node_type_selected(node_type: String)

# Available node types organized by categories
var node_categories = {}

# Reference to the parent node to add the popup as child
var parent_node: Node
var popup_window: PopupPanel
var search_input: LineEdit
var main_container: VBoxContainer

# UI Components
var tree_view: Tree
var search_results_list: ItemList

# Search functionality
var all_nodes_flat: Array = []
var filtered_nodes: Array = []
var is_searching: bool = false

# Performance optimization
var node_cache: Dictionary = {}
var tree_categories: Dictionary = {}

func _init(parent: Node):
	parent_node = parent
	_load_node_categories()
	_build_node_cache()

func _load_node_categories():
	# Get categories from the NodeFactory
	var categories = NodeFactory.get_categories()
	node_categories = {}
	
	for category in categories:
		var nodes_in_category = NodeFactory.get_nodes_in_category(category)
		node_categories[category] = nodes_in_category

func _build_node_cache():
	"""Build a flattened cache of all nodes for search functionality"""
	all_nodes_flat.clear()
	node_cache.clear()
	
	for category in node_categories:
		for node_name in node_categories[category]:
			var node_data = {
				"name": node_name,
				"category": category,
				"display_name": category + " > " + node_name,
				"search_text": (category + " " + node_name).to_lower()
			}
			all_nodes_flat.append(node_data)
			node_cache[node_name] = node_data

func show_popup(global_position: Vector2):
	# Create the popup window
	popup_window = PopupPanel.new()
	popup_window.size = Vector2(350, 450)
	popup_window.position = global_position
	
	# Create main container
	main_container = VBoxContainer.new()
	main_container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	main_container.add_theme_constant_override("separation", 3)
	
	# Add padding
	var margin_container = MarginContainer.new()
	margin_container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin_container.add_theme_constant_override("margin_left", 4)
	margin_container.add_theme_constant_override("margin_right", 4)
	margin_container.add_theme_constant_override("margin_top", 4)
	margin_container.add_theme_constant_override("margin_bottom", 4)
	
	# Create search input
	search_input = LineEdit.new()
	search_input.placeholder_text = "Search nodes... (Esc to clear)"
	search_input.custom_minimum_size.y = 32
	search_input.text_changed.connect(_on_search_text_changed)
	search_input.gui_input.connect(_on_search_input_gui_event)
	
	# Create hierarchical tree view (initially visible)
	_create_tree_view()
	
	# Create search results list (initially hidden)
	_create_search_results_list()
	
	# Add controls to layout
	main_container.add_child(search_input)
	main_container.add_child(tree_view)
	main_container.add_child(search_results_list)
	
	# Initial state: show tree, hide search results
	tree_view.visible = true
	search_results_list.visible = false
	is_searching = false
	
	# Add layout to popup
	margin_container.add_child(main_container)
	popup_window.add_child(margin_container)
	
	# Connect popup signals
	popup_window.popup_hide.connect(_on_popup_closed)
	
	# Add popup to parent and show it
	parent_node.add_child(popup_window)
	popup_window.popup()
	popup_window.position = global_position
	
	# Focus on search input
	search_input.grab_focus()

func _create_tree_view():
	"""Create the hierarchical Tree with category folders"""
	tree_view = Tree.new()
	tree_view.custom_minimum_size = Vector2(320, 380)
	tree_view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tree_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree_view.hide_root = true
	tree_view.allow_reselect = true
	tree_view.item_activated.connect(_on_tree_item_activated)
	tree_view.item_selected.connect(_on_tree_item_selected)
	
	# Create root
	var root = tree_view.create_item()
	tree_categories.clear()
	
	# Sort categories for consistent ordering
	var sorted_categories = node_categories.keys()
	sorted_categories.sort()
	
	# Add categories as expandable items
	for category in sorted_categories:
		var category_item = tree_view.create_item(root)
		category_item.set_text(0, category)
		category_item.set_icon(0, null) # You can add category icons here if desired
		category_item.set_metadata(0, {"type": "category", "name": category})
		tree_categories[category] = category_item
		
		# Sort nodes within category
		var sorted_nodes = node_categories[category].duplicate()
		sorted_nodes.sort()
		
		# Initially expand categories for better UX (but limit to avoid performance issues)
		# Only expand if category has 10 or fewer nodes
		category_item.collapsed = sorted_nodes.size() > 10
		
		# Add nodes as children
		for node_name in sorted_nodes:
			var node_item = tree_view.create_item(category_item)
			node_item.set_text(0, node_name)
			node_item.set_metadata(0, {"type": "node", "name": node_name, "category": category})
			# You can add node-specific icons here if desired

func _create_search_results_list():
	"""Create the search results ItemList"""
	search_results_list = ItemList.new()
	search_results_list.custom_minimum_size = Vector2(320, 380)
	search_results_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	search_results_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	search_results_list.item_selected.connect(_on_search_result_selected)
	search_results_list.item_activated.connect(_on_search_result_activated)

func _on_search_text_changed(new_text: String):
	"""Handle search input changes"""
	var search_text = new_text.strip_edges()
	
	if search_text.is_empty():
		# Switch back to tree view
		_switch_to_tree_mode()
	else:
		# Switch to search mode
		_switch_to_search_mode(search_text)

func _switch_to_tree_mode():
	"""Switch to hierarchical tree display"""
	tree_view.visible = true
	search_results_list.visible = false
	is_searching = false

func _switch_to_search_mode(search_text: String):
	"""Switch to search results display"""
	tree_view.visible = false
	search_results_list.visible = true
	is_searching = true
	
	# Update search results
	_update_search_results(search_text)

func _update_search_results(search_text: String):
	"""Update search results based on search text"""
	search_results_list.clear()
	filtered_nodes.clear()
	
	var search_lower = search_text.to_lower()
	var exact_matches = []
	var partial_matches = []
	
	# Categorize matches for better sorting
	for node_data in all_nodes_flat:
		var node_name_lower = node_data.name.to_lower()
		var category_lower = node_data.category.to_lower()
		
		# Check for exact name match first
		if node_name_lower == search_lower:
			exact_matches.append(node_data)
		# Check for name starts with search
		elif node_name_lower.begins_with(search_lower):
			exact_matches.append(node_data)
		# Check for name contains search
		elif node_name_lower.contains(search_lower):
			partial_matches.append(node_data)
		# Check for category contains search
		elif category_lower.contains(search_lower):
			partial_matches.append(node_data)
	
	# Sort within each category
	exact_matches.sort_custom(_sort_nodes_by_name)
	partial_matches.sort_custom(_sort_nodes_by_name)
	
	# Add exact matches first, then partial matches
	var all_matches = exact_matches + partial_matches
	
	# Limit results for performance (show first 50 matches)
	var max_results = min(50, all_matches.size())
	
	for i in range(max_results):
		var node_data = all_matches[i]
		search_results_list.add_item(node_data.display_name)
		filtered_nodes.append(node_data)
	
	# Select first item if available
	if search_results_list.get_item_count() > 0:
		search_results_list.select(0)
		search_results_list.ensure_current_is_visible()

func _sort_nodes_by_name(a: Dictionary, b: Dictionary) -> bool:
	"""Custom sorting function for nodes"""
	return a.name < b.name

func _on_search_input_gui_event(event: InputEvent):
	"""Handle keyboard navigation in search input"""
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_DOWN:
				if is_searching:
					_navigate_search_list(1)
				else:
					_navigate_tree(1)
				search_input.accept_event()
			KEY_UP:
				if is_searching:
					_navigate_search_list(-1)
				else:
					_navigate_tree(-1)
				search_input.accept_event()
			KEY_ENTER:
				if is_searching:
					_select_current_search_item()
				else:
					_select_current_tree_item()
				search_input.accept_event()
			KEY_RIGHT:
				if not is_searching:
					_expand_or_enter_tree_item()
				search_input.accept_event()
			KEY_LEFT:
				if not is_searching:
					_collapse_or_exit_tree_item()
				search_input.accept_event()
			KEY_ESCAPE:
				if search_input.text.length() > 0:
					# Clear search first
					search_input.text = ""
					_switch_to_tree_mode()
				else:
					# Close popup
					_close_popup()
				search_input.accept_event()

func _navigate_search_list(direction: int):
	"""Navigate search results list"""
	if not is_searching or search_results_list.get_item_count() == 0:
		return
		
	var current_selected = search_results_list.get_selected_items()
	var new_index = 0
	
	if current_selected.size() > 0:
		new_index = current_selected[0] + direction
	
	# Clamp to valid range
	new_index = clamp(new_index, 0, search_results_list.get_item_count() - 1)
	
	search_results_list.select(new_index)
	search_results_list.ensure_current_is_visible()

func _navigate_tree(direction: int):
	"""Navigate tree view"""
	var selected = tree_view.get_selected()
	if not selected:
		# Select first item (preferably first node, not category)
		var root = tree_view.get_root()
		if root and root.get_child_count() > 0:
			var first_category = root.get_child(0)
			if first_category.get_child_count() > 0:
				# Select first node in first category
				var first_node = first_category.get_child(0)
				first_node.select(0)
			else:
				# Select first category if no nodes
				first_category.select(0)
		return
	
	var next_item = null
	if direction > 0:
		# Navigate down
		if selected.get_child_count() > 0 and not selected.collapsed:
			# Go to first child if expanded
			next_item = selected.get_child(0)
		else:
			# Find next sibling or next uncle
			next_item = _get_next_tree_item(selected)
	else:
		# Navigate up
		next_item = _get_previous_tree_item(selected)
	
	if next_item:
		next_item.select(0)

func _get_next_tree_item(item: TreeItem) -> TreeItem:
	"""Get next item in tree traversal order"""
	var next_sibling = item.get_next()
	if next_sibling:
		return next_sibling
	
	# No next sibling, go up to parent and find its next sibling
	var parent = item.get_parent()
	while parent and parent != tree_view.get_root():
		var parent_next = parent.get_next()
		if parent_next:
			return parent_next
		parent = parent.get_parent()
	
	return null

func _get_previous_tree_item(item: TreeItem) -> TreeItem:
	"""Get previous item in tree traversal order"""
	var prev_sibling = item.get_prev()
	if prev_sibling:
		# If prev sibling has children and is expanded, go to its last descendant
		return _get_last_visible_descendant(prev_sibling)
	
	# No previous sibling, go to parent (unless it's root)
	var parent = item.get_parent()
	if parent and parent != tree_view.get_root():
		return parent
	
	return null

func _get_last_visible_descendant(item: TreeItem) -> TreeItem:
	"""Get the last visible descendant of an item"""
	if item.get_child_count() == 0 or item.collapsed:
		return item
	
	var last_child = item.get_child(item.get_child_count() - 1)
	return _get_last_visible_descendant(last_child)

func _expand_or_enter_tree_item():
	"""Expand category or select node on right arrow"""
	var selected = tree_view.get_selected()
	if not selected:
		return
	
	var metadata = selected.get_metadata(0)
	if metadata and metadata.type == "category":
		if selected.collapsed:
			# Expand the category
			selected.collapsed = false
		elif selected.get_child_count() > 0:
			# Move to first child
			var first_child = selected.get_child(0)
			first_child.select(0)
	# If it's a node, activate it
	elif metadata and metadata.type == "node":
		_on_tree_item_activated()

func _collapse_or_exit_tree_item():
	"""Collapse category or move to parent on left arrow"""
	var selected = tree_view.get_selected()
	if not selected:
		return
	
	var metadata = selected.get_metadata(0)
	if metadata and metadata.type == "category":
		if not selected.collapsed:
			# Collapse the category
			selected.collapsed = true
		else:
			# Already collapsed, can't go further up (at root level)
			pass
	elif metadata and metadata.type == "node":
		# Move to parent category
		var parent = selected.get_parent()
		if parent and parent != tree_view.get_root():
			parent.select(0)

func _select_current_search_item():
	"""Select currently highlighted search result"""
	if not is_searching:
		return
		
	var selected_items = search_results_list.get_selected_items()
	if selected_items.size() > 0:
		_on_search_result_selected(selected_items[0])

func _select_current_tree_item():
	"""Select currently highlighted tree item"""
	if is_searching:
		return
	
	var selected = tree_view.get_selected()
	if selected:
		_on_tree_item_activated()

func _on_tree_item_selected():
	"""Handle tree item selection (single click)"""
	# We can add preview functionality here if needed

func _on_tree_item_activated():
	"""Handle tree item activation (double-click or Enter)"""
	var selected = tree_view.get_selected()
	if not selected:
		return
	
	var metadata = selected.get_metadata(0)
	if not metadata or metadata.type != "node":
		# If it's a category, toggle expansion
		if metadata and metadata.type == "category":
			selected.collapsed = !selected.collapsed
		return
	
	var node_name = metadata.name
	print("[DEBUG] Tree item activated: ", node_name)
	_emit_node_selected(node_name)

func _on_search_result_selected(index: int):
	"""Handle selection from search results"""
	if index < 0 or index >= filtered_nodes.size():
		return
		
	var node_data = filtered_nodes[index]
	print("[DEBUG] Search result selected: ", node_data.name)
	_emit_node_selected(node_data.name)

func _on_search_result_activated(index: int):
	"""Handle activation (double-click) from search results"""
	_on_search_result_selected(index)

func _emit_node_selected(node_name: String):
	"""Emit the node selection signal and close popup"""
	node_type_selected.emit(node_name)
	_close_popup.call_deferred()

func _on_popup_closed():
	"""Clean up when popup is closed"""
	if popup_window and is_instance_valid(popup_window):
		if popup_window.get_parent():
			popup_window.get_parent().remove_child(popup_window)
		popup_window.queue_free()
		popup_window = null

func _close_popup():
	"""Close the popup"""
	if popup_window and is_instance_valid(popup_window):
		popup_window.hide()