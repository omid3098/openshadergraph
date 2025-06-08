@tool
class_name OpenShaderIntConstant extends BaseConstantNode

func _ready():
	node_path = "Constants/Int Constant"
	title = "Int Constant"
	value = 0
	super._ready()

func get_value_type() -> String:
	return "int"

func get_output_color() -> Color:
	return PinTypeColors.get_color_for_type("int")
