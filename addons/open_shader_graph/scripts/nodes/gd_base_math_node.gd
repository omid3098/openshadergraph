@tool
class_name BaseMathNode
extends BaseNode

var input_a: float = 0.0
var input_b: float = 0.0

# Virtual method for child classes to provide their specific operation
func get_operation_result() -> float:
	# Must be overridden by child classes
	return 0.0

# Virtual method for child classes to provide default values
func get_default_input_a() -> float:
	return 0.0

func get_default_input_b() -> float:
	return 0.0

func _ready() -> void:
	# Initialize default values
	input_a = get_default_input_a()
	input_b = get_default_input_b()
	
	# Set up slots: two inputs and one output
	# Input A (slot 0)
	set_slot(0, true, 0, PinTypeColors.get_color_for_type("float"), false, 0, PinTypeColors.get_default_color(), null, null, true)
	# Input B (slot 1) 
	set_slot(1, true, 0, PinTypeColors.get_color_for_type("float"), false, 0, PinTypeColors.get_default_color(), null, null, true)
	# Output (slot 2)
	set_slot(2, false, 0, PinTypeColors.get_default_color(), true, 0, PinTypeColors.get_color_for_type("float"), null, null, true)
	
	# Create labels for the inputs and output
	var label_a := Label.new()
	label_a.text = "A"
	add_child(label_a)
	
	var label_b := Label.new()
	label_b.text = "B"
	add_child(label_b)
	
	var label_result := Label.new()
	label_result.text = "Result"
	add_child(label_result)

func set_input_a(value: float) -> void:
	input_a = value

func set_input_b(value: float) -> void:
	input_b = value

func get_output_value() -> float:
	return get_operation_result()