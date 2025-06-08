@tool
class_name OpenShaderTestNode
extends BaseNode

func _ready():
	node_path = "Math/Test Node"
	title = "Test Node"
	
	# Set up a simple node with one input and one output
	set_slot(0, true, 0, Color.CYAN, false, 0, Color.WHITE, null, null, true)
	set_slot(1, false, 0, Color.WHITE, true, 0, Color.CYAN, null, null, true)
	
	# Create labels
	var label_input = Label.new()
	label_input.text = "Input"
	add_child(label_input)
	
	var label_output = Label.new()
	label_output.text = "Output"
	add_child(label_output)

func get_output_value():
	return "test_output"