@tool
class_name OpenShaderVector3Constant
extends BaseNode

var vec3_value: Vector3 = Vector3.ZERO

func _ready():
	node_path = "Constants/Vector3 Constant"
	title = "Vector3 Constant"
	
	# Set up the node with one output slot for Vector3
	set_slot(0, false, 0, Color.WHITE, true, 0, Color.YELLOW, null, null, true)
	
	# Create a simple label to show the current value
	_update_display()

func _update_display():
	# Clear existing children
	for child in get_children():
		child.queue_free()
	
	var label = Label.new()
	label.text = "(" + str(vec3_value.x) + ", " + str(vec3_value.y) + ", " + str(vec3_value.z) + ")"
	add_child(label)

func set_value(value: Vector3):
	vec3_value = value
	_update_display()

func get_output_value() -> Vector3:
	return vec3_value

# Override from BaseNode to provide properties for the properties panel
func get_property_list_for_panel() -> Array:
	var properties = []
	
	properties.append({
		"name": "vec3_value",
		"display_name": "Value",
		"type": "vector3",
		"value": vec3_value
	})
	
	return properties

# Override from BaseNode to handle property changes
func set_property(property_name: String, value):
	match property_name:
		"vec3_value":
			set_value(value)
		_:
			super.set_property(property_name, value)