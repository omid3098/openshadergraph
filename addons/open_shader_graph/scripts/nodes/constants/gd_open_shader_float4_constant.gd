@tool
class_name OpenShaderFloat4Constant extends BaseConstantNode

func _ready():
	node_path = "Constants/Float4 Constant"
	title = "Float4 Constant"
	if value == null:
		value = Vector4.ZERO
	super._ready()

func get_value_type() -> String:
	return "float4"

func get_output_color() -> Color:
	return PinTypeColors.get_color_for_type("float4")

func get_display_text() -> String:
	var vec4 = value as Vector4
	# Use consistent float formatting from BaseConstantNode
	var x_formatted = BaseConstantNode.format_float(vec4.x)
	var y_formatted = BaseConstantNode.format_float(vec4.y)
	var z_formatted = BaseConstantNode.format_float(vec4.z)
	var w_formatted = BaseConstantNode.format_float(vec4.w)
	return "(" + x_formatted + ", " + y_formatted + ", " + z_formatted + ", " + w_formatted + ")"