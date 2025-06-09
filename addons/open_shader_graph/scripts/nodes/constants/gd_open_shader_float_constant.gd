@tool
class_name OpenShaderFloatConstant extends BaseConstantNode

func _ready():
	node_path = "Constants/Float Constant"
	title = "Float Constant"
	if value == null:
		value = 0.0
	super._ready()

func get_value_type() -> String:
	return "float"

func get_output_color() -> Color:
	return PinTypeColors.get_color_for_type("float")
