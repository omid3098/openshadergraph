@tool
class_name ResourceManager extends RefCounted

## Consolidated resource management for OpenShaderGraph
## Handles creation, loading, saving, and validation of graph resources
## Replaces duplicated resource methods across the codebase

const OpenShaderResourceManager = preload("res://addons/open_shader_graph/scripts/resources/gd_open_shader_resource_manager.gd")
const YAMLSerializer = preload("res://addons/open_shader_graph/scripts/core/gd_yaml_serializer.gd")

signal resource_changed(resource: OpenShaderGraphAsset)
signal resource_saved(resource: OpenShaderGraphAsset, file_path: String)
signal resource_loaded(resource: OpenShaderGraphAsset, file_path: String)

# Current resource state
var current_resource: OpenShaderGraphAsset = null
var resource_file_path: String = ""
var has_unsaved_changes: bool = false

# Reference to the graph for serialization
var graph_edit: GraphEdit

func _init(graph: GraphEdit) -> void:
	graph_edit = graph

## Creates a new resource of the specified type
func create_new_resource(resource_type: String = "main_shader") -> bool:
	var new_resource: OpenShaderGraphAsset
	
	match resource_type:
		"main_shader":
			new_resource = OpenShaderResourceManager.create_main_shader_resource()
		"subgraph":
			new_resource = OpenShaderResourceManager.create_subgraph_resource()
		_:
			push_error("ResourceManager: Unknown resource type - " + resource_type)
			return false
	
	if new_resource:
		set_current_resource(new_resource, "")
		if OS.is_debug_build():
			print("[DEBUG] ResourceManager: Created new ", resource_type, " resource")
		return true
	else:
		push_error("ResourceManager: Failed to create " + resource_type + " resource")
		return false

## Sets the current resource and updates state
func set_current_resource(resource: OpenShaderGraphAsset, file_path: String = "") -> void:
	current_resource = resource
	resource_file_path = file_path
	has_unsaved_changes = false
	
	# Load the graph from the resource
	if current_resource:
		_load_graph_from_resource()
	
	resource_changed.emit(current_resource)
	
	if OS.is_debug_build():
		print("[DEBUG] ResourceManager: Current resource set (", file_path if not file_path.is_empty() else "unsaved", ")")

## Loads a resource from disk
func load_resource_from_disk(file_path: String) -> bool:
	var loaded_resource: OpenShaderGraphAsset = OpenShaderResourceManager.load_graph_resource(file_path)
	if loaded_resource:
		set_current_resource(loaded_resource, file_path)
		resource_loaded.emit(loaded_resource, file_path)
		if OS.is_debug_build():
			print("[DEBUG] ResourceManager: Resource loaded from: ", file_path)
		return true
	else:
		push_error("ResourceManager: Failed to load resource - " + OpenShaderResourceManager.get_last_error())
		return false

## Saves the current resource to disk
func save_resource_to_disk(file_path: String = "") -> bool:
	if not current_resource:
		push_error("ResourceManager: No current resource to save")
		return false
	
	# Use existing file path if none provided
	var save_path: String = file_path if not file_path.is_empty() else resource_file_path
	if save_path.is_empty():
		push_error("ResourceManager: No file path specified for saving")
		return false
	
	# Update resource with current graph state
	_save_graph_to_resource()
	
	# Save the resource
	if OpenShaderResourceManager.save_graph_resource(current_resource, save_path):
		resource_file_path = save_path
		has_unsaved_changes = false
		resource_saved.emit(current_resource, save_path)
		if OS.is_debug_build():
			print("[DEBUG] ResourceManager: Resource saved to: ", save_path)
		return true
	else:
		push_error("ResourceManager: Failed to save resource - " + OpenShaderResourceManager.get_last_error())
		return false

## Checks if there are unsaved changes
func check_unsaved_changes() -> bool:
	if not current_resource:
		# If we have nodes but no resource, we have unsaved changes
		if graph_edit:
			for child in graph_edit.get_children():
				if child is BaseNode:
					return true
		return false
	
	# Create a temporary resource and compare
	var temp_resource: OpenShaderGraphAsset = current_resource.duplicate_graph()
	if not temp_resource:
		return true # If we can't duplicate, assume changes exist
	temp_resource.clear()
	
	# Save current state to temp resource
	if graph_edit:
		for child in graph_edit.get_children():
			if child is BaseNode:
				var node_data: Dictionary = YAMLSerializer.serialize_node(child)
				temp_resource.add_node(node_data.id, node_data.type, node_data.properties, node_data.position)
		
		# Add connections if available
		if graph_edit.has_method("get_connections"):
			var connections: Array = graph_edit.get_connections()
			for connection in connections:
				if connection is Dictionary:
					temp_resource.add_connection(
						connection.get("from_node", ""),
						connection.get("from_port", 0),
						connection.get("to_node", ""),
						connection.get("to_port", 0)
					)
	
	# Compare node count and connection count as a simple check
	var changes_detected: bool = temp_resource.nodes.size() != current_resource.nodes.size() or \
	                            temp_resource.connections.size() != current_resource.connections.size()
	
	has_unsaved_changes = changes_detected
	return changes_detected

## Gets information about the current resource
func get_resource_info() -> Dictionary:
	var info := {
		"has_resource": current_resource != null,
		"file_path": resource_file_path,
		"resource_type": "",
		"is_saved": false,
		"has_unsaved_changes": check_unsaved_changes()
	}
	
	if current_resource:
		if current_resource is OpenShaderMainAsset:
			info.resource_type = "main_shader"
		elif current_resource is OpenShaderSubgraphAsset:
			info.resource_type = "subgraph"
		else:
			info.resource_type = "base_graph"
		
		info.is_saved = not resource_file_path.is_empty()
	
	return info

## Clears the current resource and graph
func clear_current_resource() -> void:
	current_resource = null
	resource_file_path = ""
	has_unsaved_changes = false
	
	# Clear the graph
	if graph_edit:
		_clear_graph()
	
	resource_changed.emit(null)
	
	if OS.is_debug_build():
		print("[DEBUG] ResourceManager: Current resource cleared")

## Validates the current resource
func validate_current_resource() -> bool:
	if not current_resource:
		return false
	
	return OpenShaderResourceManager.validate_graph_resource(current_resource)

## Gets the current resource
func get_current_resource() -> OpenShaderGraphAsset:
	return current_resource

## Gets the current file path
func get_file_path() -> String:
	return resource_file_path

## Marks the resource as having unsaved changes
func mark_unsaved_changes() -> void:
	has_unsaved_changes = true

## Internal methods for graph serialization

## Loads graph from the current resource
func _load_graph_from_resource() -> void:
	if not current_resource or not graph_edit:
		return
	
	# Clear current graph
	_clear_graph()
	
	# Use YAMLSerializer for loading
	var graph_data := {
		"nodes": current_resource.nodes,
		"connections": current_resource.connections,
		"metadata": {}
	}
	
	YAMLSerializer.deserialize_graph(graph_data, graph_edit)

## Saves current graph state to the resource
func _save_graph_to_resource() -> void:
	if not current_resource or not graph_edit:
		return
	
	# Clear the resource
	current_resource.clear()
	
	# Use YAMLSerializer for saving
	var graph_data: Dictionary = YAMLSerializer.serialize_graph(graph_edit)
	
	# Add nodes to resource
	for node_data in graph_data.get("nodes", []):
		current_resource.add_node(
			node_data.get("id", ""),
			node_data.get("type", ""),
			node_data.get("properties", {}),
			node_data.get("position", {"x": 0, "y": 0})
		)
	
	# Add connections to resource
	for connection_data in graph_data.get("connections", []):
		var conn: Dictionary = YAMLSerializer.deserialize_connection(connection_data)
		if not conn.is_empty():
			current_resource.add_connection(
				conn.get("from_node", ""),
				conn.get("from_port", 0),
				conn.get("to_node", ""),
				conn.get("to_port", 0)
			)

## Clears the graph
func _clear_graph() -> void:
	if not graph_edit:
		return
	
	# Clear connections if connection manager is available
	if graph_edit.has_method("get_connection_manager"):
		var connection_manager = graph_edit.get_connection_manager()
		if connection_manager and connection_manager.has_method("clear_connections"):
			connection_manager.clear_connections()
	
	# Reset node index manager if available
	if graph_edit.has_method("get_node_index_manager"):
		var node_index_manager = graph_edit.get_node_index_manager()
		if node_index_manager and node_index_manager.has_method("reset_index_counter"):
			node_index_manager.reset_index_counter()
	
	# Remove all BaseNode children
	for child in graph_edit.get_children():
		if child is BaseNode:
			child.queue_free()
	
	if OS.is_debug_build():
		print("[DEBUG] ResourceManager: Graph cleared")

## Utility methods

## Creates a backup of the current resource
func create_backup() -> OpenShaderGraphAsset:
	if not current_resource:
		return null
	
	var backup: OpenShaderGraphAsset = current_resource.duplicate_graph()
	if backup:
		_save_graph_to_resource() # Update current resource first
		backup = current_resource.duplicate_graph() # Then create backup
	
	return backup

## Restores from a backup resource
func restore_from_backup(backup_resource: OpenShaderGraphAsset) -> bool:
	if not backup_resource:
		return false
	
	set_current_resource(backup_resource, resource_file_path)
	mark_unsaved_changes()
	
	if OS.is_debug_build():
		print("[DEBUG] ResourceManager: Restored from backup")
	
	return true