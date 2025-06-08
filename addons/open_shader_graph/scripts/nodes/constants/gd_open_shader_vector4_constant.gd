@tool
class_name OpenShaderVector4Constant
extends BaseNode

var vec4_value: Vector4 = Vector4.ZERO

func _ready():
	node_path = "Constants/Vector4 Constant"
	title = "Vector4 Constant"
	
	# Set up the node with one output slot for Vector4
	set_slot(0, false, 0, Color.WHITE, true, 0, Color.MAGENTA, null, null, true)
	
	# Create a simple label to show the current value
	_update_display()

func _update_display():
	# Clear existing children
	for child in get_children():
		child.queue_free()
	
	var label = Label.new()
	label.text = "(" + str(vec4_value.x) + ", " + str(vec4_value.y) + ", " + str(vec4_value.z) + ", " + str(vec4_value.w) + ")"
	add_child(label)

func set_value(value: Vector4):
	vec4_value = value
	_update_display()

func get_output_value() -> Vector4:
	return vec4_value

# Override from BaseNode to provide properties for the properties panel
func get_property_list_for_panel() -> Array:
	var properties = []
	
	properties.append({
		"name": "vec4_value",
		"display_name": "Value",
		"type": "vector4",
		"value": vec4_value
	})
	
	return properties

# Override from BaseNode to handle property changes
func set_property(property_name: String, value):
	match property_name:
		"vec4_value":
			set_value(value)
		_:
			super.set_property(property_name, value)