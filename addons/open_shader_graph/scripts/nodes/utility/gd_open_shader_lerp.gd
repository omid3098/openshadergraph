@tool
class_name OpenShaderLerp
extends BaseNode

var from_value: float = 0.0
var to_value: float = 1.0
var weight: float = 0.5

func _ready():
	node_path = "Utility/Lerp"
	title = "Lerp"
	
	# Set up slots: three inputs and one output
	# From Value (slot 0)
	set_slot(0, true, 0, PinTypeColors.get_color_for_type("float"), false, 0, PinTypeColors.get_default_color(), null, null, true)
	# To Value (slot 1) 
	set_slot(1, true, 0, PinTypeColors.get_color_for_type("float"), false, 0, PinTypeColors.get_default_color(), null, null, true)
	# Weight (slot 2)
	set_slot(2, true, 0, PinTypeColors.get_color_for_type("float"), false, 0, PinTypeColors.get_default_color(), null, null, true)
	# Output (slot 3)
	set_slot(3, false, 0, PinTypeColors.get_default_color(), true, 0, PinTypeColors.get_color_for_type("float"), null, null, true)
	
	# Create labels for the inputs and output
	var label_from = Label.new()
	label_from.text = "From"
	add_child(label_from)
	
	var label_to = Label.new()
	label_to.text = "To"
	add_child(label_to)
	
	var label_weight = Label.new()
	label_weight.text = "Weight"
	add_child(label_weight)
	
	var label_result = Label.new()
	label_result.text = "Result"
	add_child(label_result)

func set_from_value(value: float):
	from_value = value

func set_to_value(value: float):
	to_value = value

func set_weight(value: float):
	weight = value

func get_output_value() -> float:
	return lerp(from_value, to_value, weight)