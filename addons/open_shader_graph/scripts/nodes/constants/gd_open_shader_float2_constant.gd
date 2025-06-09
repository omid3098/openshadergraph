@tool
class_name OpenShaderFloat2Constant extends BaseConstantNode

func _ready():
	node_path = "Constants/Float2 Constant"
	title = "Float2 Constant"
	if value == null:
		value = Vector2.ZERO
	super._ready()

func get_value_type() -> String:
	return "float2"

func get_output_color() -> Color:
	return PinTypeColors.get_color_for_type("float2")

func get_display_text() -> String:
	var vec2 = value as Vector2
	# Use consistent float formatting from BaseConstantNode
	var x_formatted = BaseConstantNode.format_float(vec2.x)
	var y_formatted = BaseConstantNode.format_float(vec2.y)
	return "(" + x_formatted + ", " + y_formatted + ")"
