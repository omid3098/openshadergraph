@tool
class_name OpenShaderMultiply extends BaseMathNode

func _ready():
	node_path = "Math/Multiply"
	title = "Multiply"
	super._ready()

func get_default_input_a() -> float:
	return 1.0

func get_default_input_b() -> float:
	return 1.0

func get_operation_result() -> float:
	return input_a * input_b