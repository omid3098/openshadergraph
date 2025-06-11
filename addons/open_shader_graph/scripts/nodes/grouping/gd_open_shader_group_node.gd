@tool
class_name OpenShaderGroupNode extends BaseNode

# Group properties
@export var group_name: String = "New Group"
@export var description: String = ""

# Reference to the subgraph asset that contains the grouped nodes
var subgraph_asset: Resource = null

# Group interface - dynamically managed input/output pins
var input_pins: Array[Dictionary] = []
var output_pins: Array[Dictionary] = []

func _ready():
	node_path = "Grouping/Group"
	title = "Group"
	super._ready()
	
	# Initialize group with default name
	if group_name.is_empty():
		group_name = "New Group"
	
	_update_title()
	_setup_default_pins()

func _update_title():
	title = group_name if not group_name.is_empty() else "Group"

# Set up default input/output pins (placeholder implementation)
func _setup_default_pins():
	# This will be implemented in Phase 2 when we have the subgraph system
	# For now, just add placeholder pins
	# TODO: Phase 2 - Automatically create Group Input and Group Output nodes internally
	super.apply_node_title_color(node_title_color)

# Group management methods (to be implemented in Phase 2)
func set_group_name(new_name: String):
	group_name = new_name
	_update_title()

func set_group_color(new_color):
	# Debug log to inspect the type and value of the passed-in new_color
	print("[DEBUG] set_group_color called with new_color type:", typeof(new_color), "value:", new_color)
	node_title_color = new_color
	
	super.apply_node_title_color(node_title_color)

func set_description(new_desc: String):
	description = new_desc

# Interface management (placeholder for Phase 2)
func add_input_pin(pin_name: String, pin_type: String):
	# To be implemented when we have the pin management system
	pass

func add_output_pin(pin_name: String, pin_type: String):
	# To be implemented when we have the pin management system
	pass

func remove_input_pin(pin_index: int):
	# To be implemented when we have the pin management system
	pass

func remove_output_pin(pin_index: int):
	# To be implemented when we have the pin management system
	pass

# Properties panel integration
func get_property_list_for_panel() -> Array:
	return [
		{"name": "group_name", "type": "string"},
		{"name": "description", "type": "string"},
		{"name": "node_title_color", "type": "color"}
	]

func set_property(property_name: String, value: Variant) -> void:
	match property_name:
		"group_name":
			set_group_name(value)
		"description":
			set_description(value)
		"node_title_color":
			apply_node_title_color(value)
		_:
			super.set_property(property_name, value)