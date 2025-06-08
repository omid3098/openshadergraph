@tool
class_name OpenShaderSubtract extends BaseMathNode

func _ready():
	node_path = "Math/Subtract"
	title = "Subtract"
	super._ready()

func get_operation_result() -> float:
	return input_a - input_b