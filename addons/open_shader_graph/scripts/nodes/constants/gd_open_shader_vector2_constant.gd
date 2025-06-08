@tool
class_name OpenShaderVector2Constant extends BaseConstantNode

func _ready():
	node_path = "Constants/Vector2 Constant"
	title = "Vector2 Constant"
	value = Vector2.ZERO
	super._ready()

func get_value_type() -> String:
	return "vector2"

func get_output_color() -> Color:
	return Color.GREEN

func get_display_text() -> String:
	var vec2 = value as Vector2
	return "(" + str(vec2.x) + ", " + str(vec2.y) + ")"
