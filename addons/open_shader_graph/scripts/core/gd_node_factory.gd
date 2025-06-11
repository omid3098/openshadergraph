@tool
class_name NodeFactory
extends RefCounted

## Improved NodeFactory with recursive scanning, caching, and extensibility
## Phase 1.4 implementation from dev_plan.md

# Node registry organized by categories
static var _node_registry: Dictionary = {}
static var _initialized: bool = false
static var _cache_valid: bool = false
static var _last_scan_time: float = 0.0
static var _manual_registrations: Dictionary = {} # For optional manual registrations

# Configuration
static var _nodes_base_path: String = "res://addons/open_shader_graph/scripts/nodes"
static var _excluded_files: Array[String] = ["gd_base_node.gd", "gd_base_constant_node.gd", "gd_base_math_node.gd"]
static var _cache_timeout: float = 10.0 # Cache timeout in seconds for development
static var _suppress_warnings: bool = false # For testing purposes

## Initialize the node registry with improved scanning logic
static func _initialize() -> void:
	if _initialized and _cache_valid and (Time.get_ticks_msec() / 1000.0 - _last_scan_time) < _cache_timeout:
		return
	
	if OS.is_debug_build():
		print("[DEBUG] NodeFactory: Initializing with improved recursive scanning...")
	
	_node_registry.clear()
	_last_scan_time = Time.get_ticks_msec() / 1000.0
	
	# Apply manual registrations first (highest priority)
	_apply_manual_registrations()
	
	# Perform recursive directory scanning
	_recursive_scan_directory(_nodes_base_path, "")
	
	_initialized = true
	_cache_valid = true
	
	if OS.is_debug_build():
		print("[DEBUG] NodeFactory: Scan complete. Found ", _count_total_nodes(), " nodes in ", _node_registry.size(), " categories")

## Apply manual registrations to registry (optional extensibility)
static func _apply_manual_registrations() -> void:
	for category: String in _manual_registrations:
		if not _node_registry.has(category):
			_node_registry[category] = {}
		
		for node_name: String in _manual_registrations[category]:
			var script_path: String = _manual_registrations[category][node_name]
			_node_registry[category][node_name] = script_path
			
			if OS.is_debug_build():
				print("[DEBUG] NodeFactory: Applied manual registration '", node_name, "' in category '", category, "'")

## Recursively scan directory structure using Godot's Directory API
static func _recursive_scan_directory(base_path: String, relative_path: String) -> void:
	var full_path: String = base_path if relative_path.is_empty() else base_path + "/" + relative_path
	var dir := DirAccess.open(full_path)
	
	if not dir:
		if not _suppress_warnings:
			push_warning("NodeFactory: Cannot access directory: " + full_path)
		return
	
	var error := dir.list_dir_begin()
	if error != OK:
		push_error("NodeFactory: Failed to begin directory listing for: " + full_path)
		return
	
	var item_name := dir.get_next()
	
	while item_name != "":
		# Skip hidden files and directories
		if item_name.begins_with("."):
			item_name = dir.get_next()
			continue
		
		var item_path := full_path + "/" + item_name
		
		if dir.current_is_dir():
			# Recursively scan subdirectories
			var sub_relative_path := relative_path + "/" + item_name if not relative_path.is_empty() else item_name
			_recursive_scan_directory(base_path, sub_relative_path)
		else:
			# Process node files
			if _is_valid_node_file(item_name):
				var category := _extract_category_from_path(relative_path)
				_register_node_from_file_safe(category, item_path)
		
		item_name = dir.get_next()
	
	dir.list_dir_end()

## Validate if a file should be processed as a node
static func _is_valid_node_file(filename: String) -> bool:
	# Only process .gd files that are not excluded and not .uid files
	if not filename.ends_with(".gd") or filename.ends_with(".uid"):
		return false
	
	# Check against excluded files
	for excluded_file in _excluded_files:
		if filename == excluded_file:
			return false
	
	return true

## Extract category name from relative path
static func _extract_category_from_path(relative_path: String) -> String:
	if relative_path.is_empty():
		return "General" # Default category for root level nodes
	
	# Use the first directory in the path as category
	var path_parts := relative_path.split("/")
	return path_parts[0].capitalize()

## Safely register a node with comprehensive error handling
static func _register_node_from_file_safe(category: String, script_path: String) -> void:
	# Validate file exists
	if not FileAccess.file_exists(script_path):
		if not _suppress_warnings:
			push_warning("NodeFactory: Script file does not exist: " + script_path)
		return
	
	# Load the script with error handling
	var script: GDScript = load(script_path)
	if not script:
		if not _suppress_warnings:
			push_warning("NodeFactory: Failed to load node script: " + script_path)
		return
	
	# Validate script is a BaseNode
	if not _is_base_node_script(script):
		if OS.is_debug_build():
			print("[DEBUG] NodeFactory: Skipping non-BaseNode script: ", script_path)
		return
	
	var display_name := _extract_display_name_safe(script, script_path)
	if display_name.is_empty():
		if not _suppress_warnings:
			push_warning("NodeFactory: Could not determine display name for: " + script_path)
		return
	
	# Check for duplicate registration
	if _node_registry.has(category) and _node_registry[category].has(display_name):
		# Allow manual registrations to override automatic ones
		if not _is_manual_registration(category, display_name):
			if not _suppress_warnings:
				push_warning("NodeFactory: Duplicate node name '" + display_name + "' in category '" + category + "'. Using first occurrence.")
			return
	
	# Register the node
	if not _node_registry.has(category):
		_node_registry[category] = {}
	
	_node_registry[category][display_name] = script_path
	
	if OS.is_debug_build():
		print("[DEBUG] NodeFactory: Registered node '", display_name, "' in category '", category, "' from ", script_path)

## Check if a script extends BaseNode (without instantiating)
static func _is_base_node_script(script: GDScript) -> bool:
	if not script:
		return false
	
	# Check script inheritance chain
	var base_script := script.get_base_script()
	while base_script:
		var script_class_name := _get_script_class_name(base_script)
		if script_class_name == "BaseNode":
			return true
		base_script = base_script.get_base_script()
	
	# Also check if the script itself is BaseNode
	return _get_script_class_name(script) == "BaseNode"

## Get class name from script safely
static func _get_script_class_name(script: GDScript) -> String:
	if not script:
		return ""
	
	# Try to get class name from script
	var source_code := script.source_code
	if source_code.is_empty():
		return ""
	
	# Look for class_name declaration
	var lines := source_code.split("\n")
	for line in lines:
		var trimmed := line.strip_edges()
		if trimmed.begins_with("class_name "):
			var parts := trimmed.split(" ")
			if parts.size() >= 2:
				return parts[1]
	
	return ""

## Extract display name safely without instantiating nodes
static func _extract_display_name_safe(script: GDScript, script_path: String) -> String:
	# Method 1: Check for node_path or title in script source
	var source_code := script.source_code
	if not source_code.is_empty():
		var display_name := _parse_display_name_from_source(source_code)
		if not display_name.is_empty():
			return display_name
	
	# Method 2: Derive from filename as fallback
	var filename := script_path.get_file().get_basename()
	if filename.begins_with("gd_open_shader_"):
		return filename.substr(15).capitalize().replace("_", " ")
	elif filename.begins_with("gd_"):
		return filename.substr(3).capitalize().replace("_", " ")
	else:
		return filename.capitalize().replace("_", " ")

## Parse display name from script source code
static func _parse_display_name_from_source(source_code: String) -> String:
	var lines := source_code.split("\n")
	
	for line in lines:
		var trimmed := line.strip_edges()
		
		# Look for title assignment
		if trimmed.begins_with("title = ") or trimmed.contains(" title = "):
			var title_value := _extract_string_value(trimmed)
			if not title_value.is_empty():
				return title_value
		
		# Look for node_path assignment
		if trimmed.begins_with("node_path = ") or trimmed.contains(" node_path = "):
			var path_value := _extract_string_value(trimmed)
			if not path_value.is_empty():
				# Extract the last part of the path (e.g., "Math/Add" -> "Add")
				if "/" in path_value:
					return path_value.split("/")[-1]
				else:
					return path_value
	
	return ""

## Extract string value from assignment line
static func _extract_string_value(line: String) -> String:
	# Find the string value after = sign
	var equals_index := line.find(" = ")
	if equals_index == -1:
		equals_index = line.find("=")
		if equals_index == -1:
			return ""
	
	var value_part := line.substr(equals_index + (3 if line.find(" = ") != -1 else 1)).strip_edges()
	
	# Remove quotes and comments
	if value_part.begins_with('"') and value_part.find('"', 1) != -1:
		var end_quote := value_part.find('"', 1)
		return value_part.substr(1, end_quote - 1)
	elif value_part.begins_with("'") and value_part.find("'", 1) != -1:
		var end_quote := value_part.find("'", 1)
		return value_part.substr(1, end_quote - 1)
	
	return ""

## Check if a node is manually registered
static func _is_manual_registration(category: String, node_name: String) -> bool:
	return _manual_registrations.has(category) and _manual_registrations[category].has(node_name)

## Count total nodes across all categories
static func _count_total_nodes() -> int:
	var total := 0
	for category in _node_registry:
		total += _node_registry[category].size()
	return total

## Get all available categories
static func get_categories() -> Array:
	_initialize()
	return _node_registry.keys()

## Get all nodes in a specific category
static func get_nodes_in_category(category: String) -> Array:
	_initialize()
	if _node_registry.has(category):
		return _node_registry[category].keys()
	return []

## Get all nodes flattened for search
static func get_all_nodes() -> Dictionary:
	_initialize()
	var all_nodes: Dictionary = {}
	for category in _node_registry:
		for node_name in _node_registry[category]:
			all_nodes[node_name] = {
				"category": category,
				"script_path": _node_registry[category][node_name]
			}
	return all_nodes

## Create a node instance with improved error handling
static func create_node(node_name: String) -> BaseNode:
	_initialize()
	var all_nodes := get_all_nodes()
	if not all_nodes.has(node_name):
		push_error("NodeFactory: Unknown node type: " + node_name)
		return null
	
	var node_info: Dictionary = all_nodes[node_name]
	var script_path: String = node_info.script_path
	
	# Validate script file exists
	if not FileAccess.file_exists(script_path):
		push_error("NodeFactory: Script file does not exist: " + script_path)
		return null
	
	# Load the script
	var script: GDScript = load(script_path)
	if not script:
		push_error("NodeFactory: Failed to load script: " + script_path)
		return null
	
	# Create node instance
	var node := BaseNode.new()
	node.set_script(script)
	
	return node

## Register a new node type manually (extensibility hook)
## This allows plugins or external scripts to register additional nodes
static func register_node_manual(category: String, node_name: String, script_path: String) -> bool:
	if category.is_empty() or node_name.is_empty() or script_path.is_empty():
		if not _suppress_warnings:
			push_warning("NodeFactory: Invalid parameters for manual registration")
		return false
	
	# Validate script exists and is valid
	if not FileAccess.file_exists(script_path):
		if not _suppress_warnings:
			push_warning("NodeFactory: Cannot manually register non-existent script: " + script_path)
		return false
	
	var script: GDScript = load(script_path)
	if not script or not _is_base_node_script(script):
		if not _suppress_warnings:
			push_warning("NodeFactory: Cannot manually register non-BaseNode script: " + script_path)
		return false
	
	# Add to manual registrations
	if not _manual_registrations.has(category):
		_manual_registrations[category] = {}
	
	_manual_registrations[category][node_name] = script_path
	
	# Invalidate cache to force re-initialization
	_cache_valid = false
	
	if OS.is_debug_build():
		print("[DEBUG] NodeFactory: Manually registered '", node_name, "' in category '", category, "'")
	
	return true

## Unregister a manually registered node
static func unregister_node_manual(category: String, node_name: String) -> bool:
	if not _manual_registrations.has(category) or not _manual_registrations[category].has(node_name):
		return false
	
	_manual_registrations[category].erase(node_name)
	if _manual_registrations[category].is_empty():
		_manual_registrations.erase(category)
	
	# Invalidate cache to force re-initialization
	_cache_valid = false
	
	if OS.is_debug_build():
		print("[DEBUG] NodeFactory: Unregistered manual node '", node_name, "' from category '", category, "'")
	
	return true

## Get list of manually registered nodes
static func get_manual_registrations() -> Dictionary:
	return _manual_registrations.duplicate(true)

## Force re-initialization (useful for development and cache invalidation)
static func refresh_registry() -> void:
	_initialized = false
	_cache_valid = false
	_initialize()

## Invalidate cache without full refresh
static func invalidate_cache() -> void:
	_cache_valid = false

## Get node type name from script path (reverse lookup)
static func get_node_type_from_script_path(script_path: String) -> String:
	_initialize()
	for category in _node_registry:
		for node_name in _node_registry[category]:
			if _node_registry[category][node_name] == script_path:
				return node_name
	return ""

## Get node type name from a node instance
static func get_node_type_from_instance(node: BaseNode) -> String:
	if not node or not node.get_script():
		return ""
	
	var script_path: String = node.get_script().resource_path
	return get_node_type_from_script_path(script_path)

## Get detailed registry information for debugging
static func get_registry_info() -> Dictionary:
	_initialize()
	return {
		"total_categories": _node_registry.size(),
		"total_nodes": _count_total_nodes(),
		"manual_registrations": _manual_registrations.size(),
		"cache_valid": _cache_valid,
		"last_scan_time": _last_scan_time,
		"initialized": _initialized
	}

## Debug function to print the current registry
static func debug_print_registry() -> void:
	_initialize()
	if OS.is_debug_build():
		print("[DEBUG] NodeFactory Registry:")
		print("  Total Categories: ", _node_registry.size())
		print("  Total Nodes: ", _count_total_nodes())
		print("  Manual Registrations: ", _manual_registrations.size())
		print("  Cache Valid: ", _cache_valid)
		print("")
		
		for category in _node_registry:
			print("  Category: ", category)
			for node_name in _node_registry[category]:
				var marker := " (manual)" if _is_manual_registration(category, node_name) else ""
				print("    Node: ", node_name, marker, " -> ", _node_registry[category][node_name])
		print("[DEBUG] Registry end.")

## Configuration methods for extensibility

## Set the base path for node scanning
static func set_nodes_base_path(path: String) -> void:
	if _nodes_base_path != path:
		_nodes_base_path = path
		_cache_valid = false

## Add files to the exclusion list
static func add_excluded_files(files: Array[String]) -> void:
	for file in files:
		if not _excluded_files.has(file):
			_excluded_files.append(file)
			_cache_valid = false

## Set cache timeout for development
static func set_cache_timeout(timeout_seconds: float) -> void:
	_cache_timeout = max(0.0, timeout_seconds)

## Control warning suppression (useful for testing)
static func set_suppress_warnings(suppress: bool) -> void:
	_suppress_warnings = suppress