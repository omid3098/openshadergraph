@tool
class_name OpenShaderFloatConstant
extends BaseNode

var float_value: float = 0.0

func _ready():
	node_path = "Constants/Float Constant"
	title = "Float Constant"
	
	# Set up the node with one output slot for float
	set_slot(0, false, 0, Color.WHITE, true, 0, Color.CYAN, null, null, true)
	
	# Create a simple label to show the current value
	_update_display()

func _update_display():
	# Clear existing children
	for child in get_children():
		child.queue_free()
	
	var label = Label.new()
	label.text = str(float_value)
	add_child(label)

func set_value(value: float):
	float_value = value
	_update_display()

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