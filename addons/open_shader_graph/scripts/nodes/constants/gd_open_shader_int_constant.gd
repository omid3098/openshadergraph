@tool
class_name OpenShaderIntConstant
extends BaseNode

var int_value: int = 0

func _ready():
	node_path = "Constants/Int Constant"
	title = "Int Constant"
	
	# Set up the node with one output slot for int
	set_slot(0, false, 0, Color.WHITE, true, 0, Color.BLUE, null, null, true)
	
	# Create a simple label to show the current value
	_update_display()

func _update_display():
	# Clear existing children
	for child in get_children():
		child.queue_free()
	
	var label = Label.new()
	label.text = str(int_value)
	add_child(label)

func set_value(value: int):
	int_value = value
	_update_display()

func get_output_value() -> int:
	return int_value

# Override from BaseNode to provide properties for the properties panel
func get_property_list_for_panel() -> Array:
	var properties = []
	
	properties.append({
		"name": "int_value",
		"display_name": "Value",
		"type": "int",
		"value": int_value
	})
	
	return properties

# Override from BaseNode to handle property changes
func set_property(property_name: String, value):
	match property_name:
		"int_value":
			set_value(value)
		_:
			super.set_property(property_name, value)