@tool
class_name BaseConstantNode
extends BaseNode

# The value this constant holds - should be overridden by child classes
var value: Variant

# Virtual method for child classes to provide their specific type and default value
func get_value_type() -> String:
	# Must be overridden by child classes
	return "variant"

# Virtual method for child classes to provide their specific output color
func get_output_color() -> Color:
	# Must be overridden by child classes
	return PinTypeColors.get_default_color()

# Virtual method for child classes to provide formatted display text
func get_display_text() -> String:
	# Default implementation - can be overridden by child classes
	# Use proper float formatting if the value is a float
	if value is float:
		return format_float(value)
	return str(value)

# Static utility method for consistent float formatting across all nodes
static func format_float(float_value: float) -> String:
	# Format float with proper precision to avoid long decimal representations
	var formatted := "%.3f" % float_value
	# Remove trailing zeros and decimal point if not needed
	formatted = formatted.rstrip("0").rstrip(".")
	return formatted

func _ready() -> void:
	# Set up the node with one output slot
	set_slot(0, false, 0, Color.WHITE, true, 0, get_output_color(), null, null, true)
	
	# Create initial display
	_update_display()

func _update_display() -> void:
	# Clear existing children
	for child in get_children():
		child.queue_free()
	
	var label := Label.new()
	label.text = get_display_text()
	add_child(label)

func set_value(new_value: Variant) -> void:
	value = new_value
	_update_display()

func get_output_value() -> Variant:
	return value

# Provide property list for Godot's property system
func _get_property_list() -> Array:
	var properties: Array = []
	var property_name: String = get_value_type() + "_value"
	
	var type_mapping := {
		"bool": TYPE_BOOL,
		"int": TYPE_INT,
		"float": TYPE_FLOAT,
		"float2": TYPE_VECTOR2,
		"float3": TYPE_VECTOR3,
		"float4": TYPE_VECTOR4
	}
	
	var property_type := type_mapping.get(get_value_type(), TYPE_NIL)
	
	properties.append({
		"name": property_name,
		"type": property_type,
		"usage": PROPERTY_USAGE_DEFAULT
	})
	
	return properties

# Handle dynamic property access for the properties panel
func _get(property: StringName) -> Variant:
	var expected_property_name := get_value_type() + "_value"
	if property == expected_property_name:
		return value
	return null

func _set(property: StringName, new_value: Variant) -> bool:
	var expected_property_name := get_value_type() + "_value"
	if property == expected_property_name:
		set_value(new_value)
		return true
	return false

# Override from BaseNode to provide properties for the properties panel
func get_property_list_for_panel() -> Array:
	var properties: Array = []
	
	var property_name := get_value_type() + "_value"
	properties.append({
		"name": property_name,
		"display_name": "Value",
		"type": get_value_type(),
		"value": value
	})
	
	return properties

# Override from BaseNode to handle property changes
func set_property(property_name: String, new_value: Variant) -> void:
	var expected_property_name := get_value_type() + "_value"
	if property_name == expected_property_name:
		set_value(new_value)
	else:
		super.set_property(property_name, new_value)