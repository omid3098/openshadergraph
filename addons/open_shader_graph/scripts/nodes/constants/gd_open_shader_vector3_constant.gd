@tool
class_name OpenShaderVector3Constant extends BaseConstantNode

func _ready():
	node_path = "Constants/Vector3 Constant"
	title = "Vector3 Constant"
	value = Vector3.ZERO
	super._ready()

func get_value_type() -> String:
	return "vector3"

func get_output_color() -> Color:
	return Color.YELLOW

func get_display_text() -> String:
	var vec3 = value as Vector3
	# Use consistent float formatting from BaseConstantNode
	var x_formatted = BaseConstantNode.format_float(vec3.x)
	var y_formatted = BaseConstantNode.format_float(vec3.y)
	var z_formatted = BaseConstantNode.format_float(vec3.z)
	return "(" + x_formatted + ", " + y_formatted + ", " + z_formatted + ")"