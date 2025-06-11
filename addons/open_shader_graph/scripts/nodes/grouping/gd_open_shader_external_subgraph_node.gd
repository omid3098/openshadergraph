@tool
class_name OpenShaderExternalSubgraphNode extends OpenShaderGroupNode

# External subgraph specific properties
@export var subgraph_file_path: String = ""
@export var auto_reload: bool = true

# Error state tracking
var is_error_state: bool = false
var error_message: String = ""
var last_modified_time: int = 0
var subgraph_initial_color: Color = Color.GREEN

func _ready():
	node_path = "Grouping/External Subgraph"
	title = "External Subgraph"
	
	# Add visual indicator for external subgraph
	node_title_color = subgraph_initial_color
	
	super._ready()
	
	# Load the external subgraph if path is set
	if not subgraph_file_path.is_empty():
		_load_external_subgraph()

func _load_external_subgraph():
	"""Load the external subgraph from file"""
	if subgraph_file_path.is_empty():
		_set_error_state("No file path specified")
		return
	
	# Check if file exists
	if not FileAccess.file_exists(subgraph_file_path):
		_set_error_state("File not found: " + subgraph_file_path)
		return
	
	# Try to load the resource
	var resource = load(subgraph_file_path)
	if not resource:
		_set_error_state("Failed to load resource: " + subgraph_file_path)
		return
	
	# Validate resource type (to be implemented when we have subgraph assets)
	# For now, just clear error state
	_clear_error_state()
	
	# Store the subgraph asset
	subgraph_asset = resource
	
	# Update last modified time for auto-reload
	last_modified_time = FileAccess.get_modified_time(subgraph_file_path)
	
	# Extract name from file path
	var file_name = subgraph_file_path.get_file().get_basename()
	group_name = file_name
	_update_title()

func _set_error_state(message: String):
	"""Set the node to error state with visual feedback"""
	is_error_state = true
	error_message = message
	node_title_color = Color.RED
	add_theme_color_override("title_color", Color.RED)
	title = "External Subgraph (ERROR)"
	
	if OS.is_debug_build():
		print("[ERROR] OpenShaderExternalSubgraphNode: ", message)

func _clear_error_state():
	"""Clear error state and restore normal appearance"""
	is_error_state = false
	error_message = ""
	node_title_color = subgraph_initial_color
	add_theme_color_override("title_color", Color.GREEN)

func _update_title():
	if is_error_state:
		title = "External Subgraph (ERROR)"
	else:
		var file_name = subgraph_file_path.get_file().get_basename() if not subgraph_file_path.is_empty() else "External Subgraph"
		title = file_name + " (ExternalGraph)"

# File management
func set_subgraph_file_path(new_path: String):
	subgraph_file_path = new_path
	_load_external_subgraph()

func reload_subgraph():
	"""Manually reload the external subgraph"""
	_load_external_subgraph()

func check_for_updates():
	"""Check if the external file has been modified and reload if needed"""
	if not auto_reload or subgraph_file_path.is_empty() or is_error_state:
		return
	
	if not FileAccess.file_exists(subgraph_file_path):
		_set_error_state("File no longer exists: " + subgraph_file_path)
		return
	
	var current_modified_time = FileAccess.get_modified_time(subgraph_file_path)
	
	if current_modified_time > last_modified_time:
		if OS.is_debug_build():
			print("[DEBUG] External subgraph file changed, reloading: ", subgraph_file_path)
		_load_external_subgraph()

# Validation methods
func validate_file_path() -> bool:
	"""Validate the current file path"""
	if subgraph_file_path.is_empty():
		return false
	
	return FileAccess.file_exists(subgraph_file_path)

func get_file_info() -> Dictionary:
	"""Get information about the external file"""
	if not validate_file_path():
		return {}
	
	var file = FileAccess.open(subgraph_file_path, FileAccess.READ)
	if not file:
		return {}
	
	var info = {
		"path": subgraph_file_path,
		"size": file.get_length(),
		"modified_time": FileAccess.get_modified_time(subgraph_file_path)
	}
	
	file.close()
	return info

# Properties panel integration
func get_property_list_for_panel() -> Array:
	var properties = super.get_property_list_for_panel()
	properties.append({"name": "subgraph_file_path", "type": "string"})
	properties.append({"name": "auto_reload", "type": "bool"})
	
	if is_error_state:
		properties.append({"name": "error_message", "type": "string"})
	
	return properties

func set_property(property_name: String, value: Variant) -> void:
	match property_name:
		"subgraph_file_path":
			set_subgraph_file_path(value)
		"auto_reload":
			auto_reload = value
		_:
			super.set_property(property_name, value)

# Debug method
func get_debug_info() -> Dictionary:
	return {
		"file_path": subgraph_file_path,
		"is_error_state": is_error_state,
		"error_message": error_message,
		"auto_reload": auto_reload,
		"last_modified_time": last_modified_time,
		"file_exists": validate_file_path()
	}