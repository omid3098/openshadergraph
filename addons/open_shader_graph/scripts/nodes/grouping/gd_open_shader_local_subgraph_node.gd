@tool
class_name OpenShaderLocalSubgraphNode extends OpenShaderGroupNode

# Local subgraph specific properties
var instance_id: String = ""
var shared_subgraph_name: String = ""

# Registry of all instances (static for sharing)
static var local_subgraph_registry: Dictionary = {}
static var instance_counter: int = 0

func _ready():
	node_path = "Grouping/Local Subgraph"
	title = "Local Subgraph"
	
	# Generate unique instance ID if not set
	if instance_id.is_empty():
		instance_counter += 1
		instance_id = "local_subgraph_" + str(instance_counter)
	
	# Add visual indicator for local subgraph
	group_color = Color.ORANGE
	
	super._ready()
	
	# Register this instance
	_register_instance()

func _register_instance():
	"""Register this instance in the shared registry"""
	if not shared_subgraph_name.is_empty():
		if not local_subgraph_registry.has(shared_subgraph_name):
			local_subgraph_registry[shared_subgraph_name] = []
		
		# Add this instance if not already registered
		if not local_subgraph_registry[shared_subgraph_name].has(self):
			local_subgraph_registry[shared_subgraph_name].append(self)

func _unregister_instance():
	"""Unregister this instance from the shared registry"""
	if not shared_subgraph_name.is_empty() and local_subgraph_registry.has(shared_subgraph_name):
		local_subgraph_registry[shared_subgraph_name].erase(self)
		
		# Clean up empty registry entries
		if local_subgraph_registry[shared_subgraph_name].is_empty():
			local_subgraph_registry.erase(shared_subgraph_name)

func _exit_tree():
	_unregister_instance()

# Local subgraph management
func set_shared_subgraph_name(new_name: String):
	# Unregister from old name
	_unregister_instance()
	
	# Set new name
	shared_subgraph_name = new_name
	group_name = new_name
	
	# Register with new name
	_register_instance()
	
	_update_title()

func get_all_instances() -> Array:
	"""Get all instances of this local subgraph"""
	if shared_subgraph_name.is_empty():
		return []
	
	if local_subgraph_registry.has(shared_subgraph_name):
		return local_subgraph_registry[shared_subgraph_name].duplicate()
	
	return []

func synchronize_with_instances():
	"""Synchronize changes with all other instances of this subgraph"""
	# To be implemented in Phase 3 when we have the synchronization system
	var instances = get_all_instances()
	for instance in instances:
		if instance != self and is_instance_valid(instance):
			# Sync properties and structure
			instance.group_color = group_color
			instance.description = description
			# More synchronization logic will be added in Phase 3

# Override title update to show instance information
func _update_title():
	if not shared_subgraph_name.is_empty():
		title = shared_subgraph_name + " (LocalGraph)"
	else:
		title = "Local Subgraph"

# Properties panel integration
func get_property_list_for_panel() -> Array:
	var properties = super.get_property_list_for_panel()
	properties.append({"name": "shared_subgraph_name", "type": "string"})
	properties.append({"name": "instance_id", "type": "string"})
	return properties

func set_property(property_name: String, value: Variant) -> void:
	match property_name:
		"shared_subgraph_name":
			set_shared_subgraph_name(value)
		_:
			super.set_property(property_name, value)

# Debug helper
static func get_registry_info() -> Dictionary:
	return {
		"total_subgraphs": local_subgraph_registry.size(),
		"subgraphs": local_subgraph_registry.keys(),
		"instance_counter": instance_counter
	}