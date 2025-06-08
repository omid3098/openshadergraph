@tool
extends BaseNode

var float_value: float = 0.0

func _ready():
	node_path = "Float"
	title = "Float"
	# Set up the node with one output slot for float
	# set_slot(slot_index, enable_input, input_type, input_color, enable_output, output_type, output_color, input_icon, output_icon, draw_stylebox)
	set_slot(0, false, 0, Color.WHITE, true, 0, Color.CYAN, null, null, true)
	
	# Create a simple label to show the current value
	var label = Label.new()
	label.text = "Value: " + str(float_value)
	add_child(label)

func set_value(value: float):
	float_value = value
	# Update the label if it exists
	if get_child_count() > 0:
		var label = get_child(0) as Label
		if label:
			label.text = "Value: " + str(float_value)

func get_output_value() -> float:
	return float_value