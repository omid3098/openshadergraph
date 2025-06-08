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
	# Use consistent float formatting from BaseConstantNode
	var x_formatted = BaseConstantNode.format_float(vec2.x)
	var y_formatted = BaseConstantNode.format_float(vec2.y)
	return "(" + x_formatted + ", " + y_formatted + ")"
