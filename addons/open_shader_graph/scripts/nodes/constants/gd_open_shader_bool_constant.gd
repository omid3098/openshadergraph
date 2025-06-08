@tool
class_name OpenShaderBoolConstant
extends BaseNode

var bool_value: bool = false

func _ready():
	node_path = "Constants/Bool Constant"
	title = "Bool Constant"
	
	# Set up the node with one output slot for bool
	set_slot(0, false, 0, Color.WHITE, true, 0, Color.RED, null, null, true)
	
	# Create a simple label to show the current value
	_update_display()

func _update_display():
	# Clear existing children
	for child in get_children():
		child.queue_free()
	
	var label = Label.new()
	label.text = str(bool_value)
	add_child(label)

func set_value(value: bool):
	bool_value = value
	_update_display()

func get_output_value() -> bool:
	return bool_value

# Override from BaseNode to provide properties for the properties panel
func get_property_list_for_panel() -> Array:
	var properties = []
	
	properties.append({
		"name": "bool_value",
		"display_name": "Value",
		"type": "bool",
		"value": bool_value
	})
	
	return properties

# Override from BaseNode to handle property changes
func set_property(property_name: String, value):
	match property_name:
		"bool_value":
			set_value(value)
		_:
			super.set_property(property_name, value)