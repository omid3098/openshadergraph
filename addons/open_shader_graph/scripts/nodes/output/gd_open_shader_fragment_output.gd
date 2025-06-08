@tool
class_name OpenShaderFragmentOutput
extends BaseNode

var albedo_input: Vector3 = Vector3.ONE
var alpha_input: float = 1.0

func _ready():
	node_path = "Output/Fragment Output"
	title = "Fragment Output"
	
	# Set up slots: inputs only, no outputs for output nodes
	# Albedo Input (slot 0)
	set_slot(0, true, 0, Color.YELLOW, false, 0, Color.WHITE, null, null, true)
	# Alpha Input (slot 1) 
	set_slot(1, true, 0, Color.CYAN, false, 0, Color.WHITE, null, null, true)
	
	# Create labels for the inputs
	var label_albedo = Label.new()
	label_albedo.text = "Albedo"
	add_child(label_albedo)
	
	var label_alpha = Label.new()
	label_alpha.text = "Alpha"
	add_child(label_alpha)

func set_albedo_input(value: Vector3):
	albedo_input = value

func set_alpha_input(value: float):
	alpha_input = value

# Output nodes don't have output values, they consume inputs
func get_fragment_output() -> Dictionary:
	return {
		"albedo": albedo_input,
		"alpha": alpha_input
	}