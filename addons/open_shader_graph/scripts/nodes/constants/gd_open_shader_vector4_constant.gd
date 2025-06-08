@tool
class_name OpenShaderVector4Constant extends BaseConstantNode

func _ready():
	node_path = "Constants/Vector4 Constant"
	title = "Vector4 Constant"
	value = Vector4.ZERO
	super._ready()

func get_value_type() -> String:
	return "vector4"

func get_output_color() -> Color:
	return Color.MAGENTA

func get_display_text() -> String:
	var vec4 = value as Vector4
	return "(" + str(vec4.x) + ", " + str(vec4.y) + ", " + str(vec4.z) + ", " + str(vec4.w) + ")"