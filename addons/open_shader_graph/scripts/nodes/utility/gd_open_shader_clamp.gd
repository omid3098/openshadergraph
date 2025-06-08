@tool
class_name OpenShaderClamp
extends BaseNode

var input_value: float = 0.0
var min_value: float = 0.0
var max_value: float = 1.0

func _ready():
	node_path = "Utility/Clamp"
	title = "Clamp"
	
	# Set up slots: three inputs and one output
	# Input Value (slot 0)
	set_slot(0, true, 0, Color.CYAN, false, 0, Color.WHITE, null, null, true)
	# Min Value (slot 1) 
	set_slot(1, true, 0, Color.CYAN, false, 0, Color.WHITE, null, null, true)
	# Max Value (slot 2)
	set_slot(2, true, 0, Color.CYAN, false, 0, Color.WHITE, null, null, true)
	# Output (slot 3)
	set_slot(3, false, 0, Color.WHITE, true, 0, Color.CYAN, null, null, true)
	
	# Create labels for the inputs and output
	var label_value = Label.new()
	label_value.text = "Value"
	add_child(label_value)
	
	var label_min = Label.new()
	label_min.text = "Min"
	add_child(label_min)
	
	var label_max = Label.new()
	label_max.text = "Max"
	add_child(label_max)
	
	var label_result = Label.new()
	label_result.text = "Result"
	add_child(label_result)

func set_input_value(value: float):
	input_value = value

func set_min_value(value: float):
	min_value = value

func set_max_value(value: float):
	max_value = value

func get_output_value() -> float:
	return clamp(input_value, min_value, max_value)