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
	return "(" + str(vec3.x) + ", " + str(vec3.y) + ", " + str(vec3.z) + ")"