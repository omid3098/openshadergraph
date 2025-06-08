@tool
class_name OpenShaderFloatInput
extends BaseNode

var float_value: float = 0.0

func _ready():
	node_path = "Input/Float Input"
	title = "Float Input"
	# Set up the node with one output slot for float
	# set_slot(slot_index, enable_input, input_type, input_color, enable_output, output_type, output_color, input_icon, output_icon, draw_stylebox)
	set_slot(0, false, 0, Color.WHITE, true, 0, Color.CYAN, null, null, true)
	
	# Create a simple label to show the current value
	var label = Label.new()
	label.text = "Value: " + BaseConstantNode.format_float(float_value)
	add_child(label)

func set_value(value: float):
	float_value = value
	# Update the label if it exists
	if get_child_count() > 0:
		var label = get_child(0) as Label
		if label:
			label.text = "Value: " + BaseConstantNode.format_float(float_value)

func get_output_value() -> float:
	return float_value

# Override from BaseNode to provide properties for the properties panel
func get_property_list_for_panel() -> Array:
	var properties = []
	
	properties.append({
		"name": "float_value",
		"display_name": "Value",
		"type": "float",
		"value": float_value
	})
	
	return properties

# Override from BaseNode to handle property changes
func set_property(property_name: String, value):
	match property_name:
		"float_value":
			set_value(value)
		_:
			super.set_property(property_name, value)