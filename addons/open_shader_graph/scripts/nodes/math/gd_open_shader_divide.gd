@tool
class_name OpenShaderDivide extends BaseMathNode

func _ready():
	node_path = "Math/Divide"
	title = "Divide"
	super._ready()

func get_default_input_b() -> float:
	return 1.0

func get_operation_result() -> float:
	return input_a / input_b if input_b != 0.0 else 0.0