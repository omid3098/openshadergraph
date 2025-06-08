@tool
class_name OpenShaderVector2Constant
extends BaseNode

var vec2_value: Vector2 = Vector2.ZERO

func _ready():
	node_path = "Constants/Vector2 Constant"
	title = "Vector2 Constant"
	
	# Set up the node with one output slot for Vector2
	set_slot(0, false, 0, Color.WHITE, true, 0, Color.GREEN, null, null, true)
	
	# Create a simple label to show the current value
	_update_display()

func _update_display():
	# Clear existing children
	for child in get_children():
		child.queue_free()
	
	var label = Label.new()
	label.text = "(" + str(vec2_value.x) + ", " + str(vec2_value.y) + ")"
	add_child(label)

func set_value(value: Vector2):
	vec2_value = value
	_update_display()

func get_output_value() -> Vector2:
	return vec2_value

# Override from BaseNode to provide properties for the properties panel
func get_property_list_for_panel() -> Array:
	var properties = []
	
	properties.append({
		"name": "vec2_value",
		"display_name": "Value",
		"type": "vector2",
		"value": vec2_value
	})
	
	return properties

# Override from BaseNode to handle property changes
func set_property(property_name: String, value):
	match property_name:
		"vec2_value":
			set_value(value)
		_:
			super.set_property(property_name, value)