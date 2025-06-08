@tool
class_name OpenShaderAdd extends BaseMathNode

func _ready():
	node_path = "Math/Add"
	title = "Add"
	super._ready()

func get_operation_result() -> float:
	return input_a + input_b