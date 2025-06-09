class_name OpenShaderResourceManager extends RefCounted

## Resource manager for OpenShaderGraph assets
## Handles loading, saving, validation, and error recovery for graph resources
## Supports both main shader graphs and subgraphs

## Static instance for global access
static var instance: OpenShaderResourceManager

## Cache for loaded resources to prevent duplicate loading
var resource_cache: Dictionary = {}

## Error handling and reporting
var last_error: String = ""

func _init():
	if instance == null:
		instance = self

## Gets the singleton instance
static func get_instance() -> OpenShaderResourceManager:
	if instance == null:
		instance = OpenShaderResourceManager.new()
	return instance

## Loads a graph resource from file with error handling
static func load_graph_resource(file_path: String) -> OpenShaderGraphAsset:
	return get_instance()._load_graph_resource(file_path)

## Saves a graph resource to file with validation
static func save_graph_resource(resource: OpenShaderGraphAsset, file_path: String) -> bool:
	return get_instance()._save_graph_resource(resource, file_path)

## Validates a graph resource
static func validate_graph_resource(resource: OpenShaderGraphAsset) -> bool:
	return get_instance()._validate_graph_resource(resource)

## Creates a new main shader resource
static func create_main_shader_resource() -> OpenShaderMainAsset:
	return get_instance()._create_main_shader_resource()

## Creates a new subgraph resource
static func create_subgraph_resource() -> OpenShaderSubgraphAsset:
	return get_instance()._create_subgraph_resource()

## Gets the last error message
static func get_last_error() -> String:
	return get_instance().last_error

## Clears the resource cache
static func clear_cache() -> void:
	get_instance().resource_cache.clear()

## Internal implementation methods

func _load_graph_resource(file_path: String) -> OpenShaderGraphAsset:
	last_error = ""
	
	# Check if already cached
	if file_path in resource_cache:
		return resource_cache[file_path]
	
	# Validate file path
	if not FileAccess.file_exists(file_path):
		last_error = "File does not exist: " + file_path
		push_error("OpenShaderResourceManager: " + last_error)
		return null
	
	# Load the resource
	var resource = load(file_path)
	if resource == null:
		last_error = "Failed to load resource from: " + file_path
		push_error("OpenShaderResourceManager: " + last_error)
		return null
	
	# Validate resource type
	if not resource is OpenShaderGraphAsset:
		last_error = "Invalid resource type. Expected OpenShaderGraphAsset, got: " + resource.get_class()
		push_error("OpenShaderResourceManager: " + last_error)
		return null
	
	# Validate resource integrity
	if not resource.validate():
		last_error = "Resource validation failed for: " + file_path
		push_error("OpenShaderResourceManager: " + last_error)
		return null
	
	# Cache and return
	resource_cache[file_path] = resource
	return resource

func _save_graph_resource(resource: OpenShaderGraphAsset, file_path: String) -> bool:
	last_error = ""
	
	if resource == null:
		last_error = "Cannot save null resource"
		push_error("OpenShaderResourceManager: " + last_error)
		return false
	
	# Validate resource before saving
	if not resource.validate():
		last_error = "Resource validation failed before saving"
		push_error("OpenShaderResourceManager: " + last_error)
		return false
	
	# Ensure directory exists
	var dir_path = file_path.get_base_dir()
	if not DirAccess.dir_exists_absolute(dir_path):
		var dir = DirAccess.open("res://")
		if dir == null:
			last_error = "Failed to access filesystem"
			push_error("OpenShaderResourceManager: " + last_error)
			return false
		
		var result = dir.make_dir_recursive(dir_path)
		if result != OK:
			last_error = "Failed to create directory: " + dir_path
			push_error("OpenShaderResourceManager: " + last_error)
			return false
	
	# Save the resource
	var result = ResourceSaver.save(resource, file_path)
	if result != OK:
		last_error = "Failed to save resource to: " + file_path + " (Error: " + str(result) + ")"
		push_error("OpenShaderResourceManager: " + last_error)
		return false
	
	# Update cache
	resource_cache[file_path] = resource
	
	return true

func _validate_graph_resource(resource: OpenShaderGraphAsset) -> bool:
	last_error = ""
	
	if resource == null:
		last_error = "Cannot validate null resource"
		return false
	
	var is_valid = resource.validate()
	if not is_valid:
		last_error = "Resource validation failed"
	
	return is_valid

func _create_main_shader_resource() -> OpenShaderMainAsset:
	var resource = OpenShaderMainAsset.new()
	
	# Set some default properties
	resource.set_shader_type("spatial")
	resource.set_graph_property("created_at", Time.get_unix_time_from_system())
	resource.set_graph_property("created_by", "OpenShaderGraph")
	
	return resource

func _create_subgraph_resource() -> OpenShaderSubgraphAsset:
	var resource = OpenShaderSubgraphAsset.new()
	
	# Set some default properties
	resource.set_subgraph_name("New Subgraph")
	resource.set_graph_property("created_at", Time.get_unix_time_from_system())
	resource.set_graph_property("created_by", "OpenShaderGraph")
	
	return resource

## Utility methods for resource management

## Checks if a file is a valid OpenShaderGraph resource
static func is_valid_graph_file(file_path: String) -> bool:
	var instance = get_instance()
	instance.last_error = ""
	
	if not FileAccess.file_exists(file_path):
		instance.last_error = "File does not exist"
		return false
	
	var resource = load(file_path)
	if resource == null:
		instance.last_error = "Failed to load resource"
		return false
	
	if not resource is OpenShaderGraphAsset:
		instance.last_error = "Not an OpenShaderGraph resource"
		return false
	
	return resource.validate()

## Gets resource type from file without full loading
static func get_resource_type(file_path: String) -> String:
	var instance = get_instance()
	instance.last_error = ""
	
	if not FileAccess.file_exists(file_path):
		instance.last_error = "File does not exist"
		return ""
	
	var resource = load(file_path)
	if resource == null:
		instance.last_error = "Failed to load resource"
		return ""
	
	if resource is OpenShaderMainAsset:
		return "main_shader"
	elif resource is OpenShaderSubgraphAsset:
		return "subgraph"
	elif resource is OpenShaderGraphAsset:
		return "base_graph"
	else:
		instance.last_error = "Unknown resource type"
		return ""

## Creates a backup of a resource file
static func backup_resource_file(file_path: String) -> bool:
	var instance = get_instance()
	instance.last_error = ""
	
	if not FileAccess.file_exists(file_path):
		instance.last_error = "Source file does not exist"
		return false
	
	var backup_path = file_path + ".backup"
	var source = FileAccess.open(file_path, FileAccess.READ)
	if source == null:
		instance.last_error = "Failed to open source file"
		return false
	
	var backup = FileAccess.open(backup_path, FileAccess.WRITE)
	if backup == null:
		source.close()
		instance.last_error = "Failed to create backup file"
		return false
	
	backup.store_buffer(source.get_buffer(source.get_length()))
	
	source.close()
	backup.close()
	
	return true

## Restores a resource from backup
static func restore_from_backup(file_path: String) -> bool:
	var instance = get_instance()
	instance.last_error = ""
	
	var backup_path = file_path + ".backup"
	if not FileAccess.file_exists(backup_path):
		instance.last_error = "Backup file does not exist"
		return false
	
	var backup = FileAccess.open(backup_path, FileAccess.READ)
	if backup == null:
		instance.last_error = "Failed to open backup file"
		return false
	
	var target = FileAccess.open(file_path, FileAccess.WRITE)
	if target == null:
		backup.close()
		instance.last_error = "Failed to open target file"
		return false
	
	target.store_buffer(backup.get_buffer(backup.get_length()))
	
	backup.close()
	target.close()
	
	# Remove from cache to force reload
	instance.resource_cache.erase(file_path)
	
	return true

## Handles missing subgraph references gracefully
static func handle_missing_subgraph_reference(file_path: String) -> OpenShaderSubgraphAsset:
	var instance = get_instance()
	instance.last_error = "Subgraph file missing: " + file_path
	
	# Create a placeholder subgraph with error state
	var placeholder = OpenShaderSubgraphAsset.new()
	placeholder.set_subgraph_name("MISSING: " + file_path.get_file())
	placeholder.set_subgraph_description("This subgraph file could not be found: " + file_path)
	placeholder.set_graph_property("is_missing", true)
	placeholder.set_graph_property("missing_path", file_path)
	
	return placeholder

## Validates and repairs a corrupted resource
static func repair_corrupted_resource(resource: OpenShaderGraphAsset) -> bool:
	var instance = get_instance()
	instance.last_error = ""
	
	if resource == null:
		instance.last_error = "Cannot repair null resource"
		return false
	
	# Repair missing arrays
	if resource.nodes == null:
		resource.nodes = []
	
	if resource.connections == null:
		resource.connections = []
	
	if resource.graph_properties == null:
		resource.graph_properties = {}
	
	# Clean up invalid connections
	var valid_node_ids = []
	for node in resource.nodes:
		if node.has("id"):
			valid_node_ids.append(node["id"])
	
	for i in range(resource.connections.size() - 1, -1, -1):
		var connection = resource.connections[i]
		if not connection.has("from") or not connection.has("to"):
			resource.connections.remove_at(i)
			continue
		
		var from_parts = connection["from"].split(":")
		var to_parts = connection["to"].split(":")
		
		if from_parts.size() != 2 or to_parts.size() != 2:
			resource.connections.remove_at(i)
			continue
		
		if not from_parts[0] in valid_node_ids or not to_parts[0] in valid_node_ids:
			resource.connections.remove_at(i)
			continue
	
	return resource.validate()