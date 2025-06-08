@tool
class_name OpenShaderBoolConstant extends BaseConstantNode

func _ready():
	node_path = "Constants/Bool Constant"
	title = "Bool Constant"
	value = false
	super._ready()

func get_value_type() -> String:
	return "bool"

func get_output_color() -> Color:
	return PinTypeColors.get_color_for_type("bool")
