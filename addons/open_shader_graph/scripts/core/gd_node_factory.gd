@tool
class_name NodeFactory
extends RefCounted

# Node registry organized by categories
static var _node_registry = {}
static var _initialized = false

# Initialize the node registry by scanning the nodes directory
static func _initialize():
	if _initialized:
		return
	
	print("[DEBUG] NodeFactory: Initializing automatic node discovery...")
	_node_registry = {}
	
	var nodes_base_path = "res://addons/open_shader_graph/scripts/nodes"
	var excluded_files = ["gd_base_node.gd", "gd_base_constant_node.gd", "gd_base_math_node.gd"] # Files to exclude from registration
	
	# Dynamically discover category folders
	var categories = _discover_categories(nodes_base_path)
	
	for category in categories:
		var category_path = nodes_base_path + "/" + category
		_scan_category_folder(category, category_path, excluded_files)
	
	_initialized = true
	print("[DEBUG] NodeFactory: Node discovery complete. Registry: ", _node_registry)

# Discover category folders dynamically
static func _discover_categories(nodes_base_path: String) -> Array:
	var categories = []
	var dir = DirAccess.open(nodes_base_path)
	if not dir:
		print("[WARNING] NodeFactory: Cannot access nodes base path: ", nodes_base_path)
		return categories
	
	dir.list_dir_begin()
	var item_name = dir.get_next()
	
	while item_name != "":
		# Only include directories (not files like gd_base_node.gd)
		if dir.current_is_dir() and not item_name.begins_with("."):
			categories.append(item_name)
		
		item_name = dir.get_next()
	
	dir.list_dir_end()
	print("[DEBUG] NodeFactory: Discovered categories: ", categories)
	return categories

# Scan a category folder and register all nodes found
static func _scan_category_folder(category: String, folder_path: String, excluded_files: Array):
	var dir = DirAccess.open(folder_path)
	if not dir:
		print("[WARNING] NodeFactory: Cannot access category folder: ", folder_path)
		return
	
	dir.list_dir_begin()
	var file_name = dir.get_next()
	
	while file_name != "":
		# Only process .gd files that are not excluded and not .uid files
		if file_name.ends_with(".gd") and not file_name.ends_with(".uid") and not file_name in excluded_files:
			var full_path = folder_path + "/" + file_name
			_register_node_from_file(category, full_path)
		
		file_name = dir.get_next()
	
	dir.list_dir_end()

# Register a node by examining its script file
static func _register_node_from_file(category: String, script_path: String):
	# Load the script to get the node information
	var script = load(script_path)
	if not script:
		print("[WARNING] NodeFactory: Failed to load node script: ", script_path)
		return
	
	# Create a temporary instance to get the node_path and title
	var temp_node = BaseNode.new()
	temp_node.set_script(script)
	
	# Call _ready to initialize the node's properties
	if temp_node.has_method("_ready"):
		temp_node._ready()
	
	# Get the node display name from node_path or title
	var display_name = ""
	if temp_node.has_method("get") and temp_node.get("title"):
		display_name = temp_node.get("title")
	elif temp_node.has_method("get") and temp_node.get("node_path"):
		var node_path = temp_node.get("node_path")
		# Extract the display name from the path (e.g., "Math/Add" -> "Add")
		if "/" in node_path:
			display_name = node_path.split("/")[-1]
		else:
			display_name = node_path
	
	# If we couldn't get a display name, derive it from the filename
	if display_name == "":
		var filename = script_path.get_file().get_basename()
		# Convert from "gd_open_shader_add" to "Add"
		if filename.begins_with("gd_open_shader_"):
			display_name = filename.substr(15).capitalize()
		else:
			display_name = filename.capitalize()
	
	# Clean up the temporary node
	temp_node.queue_free()
	
	# Register the node
	var category_display = category.capitalize()
	if not _node_registry.has(category_display):
		_node_registry[category_display] = {}
	
	_node_registry[category_display][display_name] = script_path
	print("[DEBUG] NodeFactory: Registered node '", display_name, "' in category '", category_display, "' from ", script_path)

# Get all available categories
static func get_categories() -> Array:
	_initialize()
	return _node_registry.keys()

# Get all nodes in a specific category
static func get_nodes_in_category(category: String) -> Array:
	_initialize()
	if _node_registry.has(category):
		return _node_registry[category].keys()
	return []

# Get all nodes flattened for search
static func get_all_nodes() -> Dictionary:
	_initialize()
	var all_nodes = {}
	for category in _node_registry:
		for node_name in _node_registry[category]:
			all_nodes[node_name] = {
				"category": category,
				"script_path": _node_registry[category][node_name]
			}
	return all_nodes

# Create a node instance
static func create_node(node_name: String) -> BaseNode:
	_initialize()
	var all_nodes = get_all_nodes()
	if not all_nodes.has(node_name):
		print("[ERROR] Unknown node type: ", node_name)
		return null
	
	var node_info = all_nodes[node_name]
	var script_path = node_info.script_path
	
	# Load the script
	var script = load(script_path)
	if not script:
		print("[ERROR] Failed to load script: ", script_path)
		return null
	
	# Create node instance
	var node = BaseNode.new()
	node.set_script(script)
	
	return node

# Register a new node type manually (for future extensibility)
static func register_node(category: String, node_name: String, script_path: String):
	_initialize()
	if not _node_registry.has(category):
		_node_registry[category] = {}
	_node_registry[category][node_name] = script_path

# Force re-initialization (useful for development)
static func refresh_registry():
	_initialized = false
	_initialize()

# Debug function to print the current registry
static func debug_print_registry():
	_initialize()
	print("[DEBUG] NodeFactory Registry:")
	for category in _node_registry:
		print("  Category: ", category)
		for node_name in _node_registry[category]:
			print("    Node: ", node_name, " -> ", _node_registry[category][node_name])
	print("[DEBUG] Registry end.")