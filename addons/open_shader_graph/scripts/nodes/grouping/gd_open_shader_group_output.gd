@tool
class_name OpenShaderGroupOutput extends BaseNode

## Internal node for group interface management
## This node represents the output interface of a group/subgraph
## It should NOT appear in the node creation menu - only created automatically
## by grouping nodes when setting up their internal structure

# Group output specific properties
var output_pins: Array[Dictionary] = []
var is_subgraph_context: bool = false

func _ready():
	node_path = "" # Excluded from creation menu - internal node only
	title = "Group Output"
	
	# Set visual appearance
	add_theme_color_override("title_color", Color.MAGENTA)
	
	super._ready()
	
	# Detect if we're in a subgraph context
	_detect_subgraph_context()
	
	# Setup default pins
	_setup_default_pins()

func _detect_subgraph_context():
	"""Detect if this node is being used within a subgraph"""
	# This will be implemented when we have the subgraph system
	# For now, assume we're not in a subgraph context
	is_subgraph_context = false

func _setup_default_pins():
	"""Setup default output pins configuration"""
	# Start with one default output that will become an input of the group
	if output_pins.is_empty():
		add_output_pin("Output", "float")

# Pin management
func add_output_pin(pin_name: String, pin_type: String):
	"""Add a new output pin (which becomes an input of this node)"""
	var pin_data = {
		"name": pin_name,
		"type": pin_type,
		"color": PinTypeColors.get_color_for_type(pin_type)
	}
	
	output_pins.append(pin_data)
	_rebuild_pins()

func remove_output_pin(pin_index: int):
	"""Remove an output pin"""
	if pin_index >= 0 and pin_index < output_pins.size():
		output_pins.remove_at(pin_index)
		_rebuild_pins()

func update_output_pin(pin_index: int, pin_name: String, pin_type: String):
	"""Update an existing output pin"""
	if pin_index >= 0 and pin_index < output_pins.size():
		output_pins[pin_index].name = pin_name
		output_pins[pin_index].type = pin_type
		output_pins[pin_index].color = PinTypeColors.get_color_for_type(pin_type)
		_rebuild_pins()

func _rebuild_pins():
	"""Rebuild the visual pins based on the output_pins array"""
	# Clear existing pins
	clear_all_slots()
	
	# Add input slots for each output pin (they become inputs of this node)
	for i in range(output_pins.size()):
		var pin = output_pins[i]
		set_slot(i, true, 0, pin.color, false, 0, Color.WHITE)
		
		# Add label for the pin
		var label = Label.new()
		label.text = pin.name + " (" + pin.type + ")"
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		add_child(label)

# Interface for external configuration
func set_output_pins_from_array(pins: Array[Dictionary]):
	"""Set all output pins from an external array"""
	output_pins = pins.duplicate(true)
	_rebuild_pins()

func get_output_pins() -> Array[Dictionary]:
	"""Get the current output pins configuration"""
	return output_pins.duplicate(true)

# Validation
func validate_configuration() -> bool:
	"""Validate that the output configuration is valid"""
	if not is_subgraph_context:
		# Group Output nodes should only exist in subgraphs
		return false
	
	if output_pins.is_empty():
		# Should have at least one output pin
		return false
	
	# Check for duplicate names
	var names = []
	for pin in output_pins:
		if pin.name in names:
			return false
		names.append(pin.name)
	
	return true

# Properties panel integration
func get_property_list_for_panel() -> Array:
	var properties = []
	
	# Add controls for managing pins
	properties.append({"name": "pin_count", "type": "int"})
	
	# Add individual pin properties
	for i in range(output_pins.size()):
		var pin = output_pins[i]
		properties.append({
			"name": "pin_" + str(i) + "_name",
			"type": "string"
		})
		properties.append({
			"name": "pin_" + str(i) + "_type",
			"type": "string"
		})
	
	return properties

func set_property(property_name: String, value: Variant) -> void:
	if property_name == "pin_count":
		_resize_pins(value)
	elif property_name.begins_with("pin_"):
		_handle_pin_property(property_name, value)
	else:
		super.set_property(property_name, value)

func _resize_pins(new_count: int):
	"""Resize the pins array to match the desired count"""
	new_count = max(1, new_count) # At least one pin
	
	while output_pins.size() < new_count:
		add_output_pin("Output " + str(output_pins.size() + 1), "float")
	
	while output_pins.size() > new_count:
		remove_output_pin(output_pins.size() - 1)

func _handle_pin_property(property_name: String, value: Variant):
	"""Handle individual pin property changes"""
	var parts = property_name.split("_")
	if parts.size() >= 3:
		var pin_index = parts[1].to_int()
		var property = parts[2]
		
		if pin_index >= 0 and pin_index < output_pins.size():
			match property:
				"name":
					output_pins[pin_index].name = value
				"type":
					output_pins[pin_index].type = value
					output_pins[pin_index].color = PinTypeColors.get_color_for_type(value)
			
			_rebuild_pins()

# Debug info
func get_debug_info() -> Dictionary:
	return {
		"is_subgraph_context": is_subgraph_context,
		"output_pins_count": output_pins.size(),
		"output_pins": output_pins,
		"is_valid": validate_configuration()
	}