@tool
extends BaseTest
class_name TestPinData

var input_pin: PinData
var output_pin: PinData

func before_each():
	input_pin = PinData.new("test_input", "float", PinData.PinType.INPUT, 0.0)
	output_pin = PinData.new("test_output", "vector3", PinData.PinType.OUTPUT, Vector3.ZERO)

func after_each():
	input_pin = null
	output_pin = null

# Test pin creation
func test_pin_creation():
	assert_not_null(input_pin, "Input pin should be created")
	assert_not_null(output_pin, "Output pin should be created")

# Test pin properties
func test_pin_properties():
	assert_equal("test_input", input_pin.get_name(), "Input pin name should be set correctly")
	assert_equal("float", input_pin.get_data_type(), "Input pin data type should be set correctly")
	assert_equal(PinData.PinType.INPUT, input_pin.get_direction(), "Input pin direction should be set correctly")
	
	assert_equal("test_output", output_pin.get_name(), "Output pin name should be set correctly")
	assert_equal("vector3", output_pin.get_data_type(), "Output pin data type should be set correctly")
	assert_equal(PinData.PinType.OUTPUT, output_pin.get_direction(), "Output pin direction should be set correctly")

# Test pin types enum
func test_pin_types_enum():
	assert_equal(0, PinData.PinType.INPUT, "INPUT should be 0")
	assert_equal(1, PinData.PinType.OUTPUT, "OUTPUT should be 1")

# Test input pin creation
func test_input_pin_creation():
	var custom_input = PinData.new("custom_input", "vector2", PinData.PinType.INPUT, Vector2.ZERO)
	
	assert_equal("custom_input", custom_input.get_name(), "Custom input pin name should be set")
	assert_equal("vector2", custom_input.get_data_type(), "Custom input pin type should be set")
	assert_equal(PinData.PinType.INPUT, custom_input.get_direction(), "Custom input pin should be input type")

# Test output pin creation
func test_output_pin_creation():
	var custom_output = PinData.new("custom_output", "int", PinData.PinType.OUTPUT, 0)
	
	assert_equal("custom_output", custom_output.get_name(), "Custom output pin name should be set")
	assert_equal("int", custom_output.get_data_type(), "Custom output pin type should be set")
	assert_equal(PinData.PinType.OUTPUT, custom_output.get_direction(), "Custom output pin should be output type")

# Test different data types
func test_float_pin():
	var float_pin = PinData.new("float_pin", "float", PinData.PinType.INPUT, 0.0)
	assert_equal("float", float_pin.get_data_type(), "Float pin should have float type")

func test_vector2_pin():
	var vector2_pin = PinData.new("vector2_pin", "vector2", PinData.PinType.INPUT, Vector2.ZERO)
	assert_equal("vector2", vector2_pin.get_data_type(), "Vector2 pin should have vector2 type")

func test_vector3_pin():
	var vector3_pin = PinData.new("vector3_pin", "vector3", PinData.PinType.INPUT, Vector3.ZERO)
	assert_equal("vector3", vector3_pin.get_data_type(), "Vector3 pin should have vector3 type")

func test_vector4_pin():
	var vector4_pin = PinData.new("vector4_pin", "vector4", PinData.PinType.INPUT, Vector4.ZERO)
	assert_equal("vector4", vector4_pin.get_data_type(), "Vector4 pin should have vector4 type")

func test_int_pin():
	var int_pin = PinData.new("int_pin", "int", PinData.PinType.INPUT, 0)
	assert_equal("int", int_pin.get_data_type(), "Int pin should have int type")

func test_bool_pin():
	var bool_pin = PinData.new("bool_pin", "bool", PinData.PinType.INPUT, false)
	assert_equal("bool", bool_pin.get_data_type(), "Bool pin should have bool type")

# Test pin property modification
func test_pin_name_modification():
	input_pin.set_name("modified_name")
	assert_equal("modified_name", input_pin.get_name(), "Pin name should be modifiable")

func test_pin_data_type_modification():
	input_pin.set_data_type("vector2")
	assert_equal("vector2", input_pin.get_data_type(), "Pin data type should be modifiable")

func test_pin_direction_modification():
	input_pin.set_direction(PinData.PinType.OUTPUT)
	assert_equal(PinData.PinType.OUTPUT, input_pin.get_direction(), "Pin direction should be modifiable")

# Test edge cases
func test_empty_pin_name():
	var empty_name_pin = PinData.new("", "float", PinData.PinType.INPUT, 0.0)
	assert_equal("", empty_name_pin.get_name(), "Pin should accept empty name")

func test_empty_data_type():
	var empty_type_pin = PinData.new("test", "", PinData.PinType.INPUT, 0.0)
	assert_equal("", empty_type_pin.get_data_type(), "Pin should accept empty data type")

func test_special_characters_in_name():
	var special_pin = PinData.new("pin_with-special.chars@123", "float", PinData.PinType.INPUT, 0.0)
	assert_equal("pin_with-special.chars@123", special_pin.get_name(), "Pin should accept special characters in name")

func test_special_characters_in_type():
	var special_type_pin = PinData.new("test", "custom_type_with_underscores", PinData.PinType.INPUT, 0.0)
	assert_equal("custom_type_with_underscores", special_type_pin.get_data_type(), "Pin should accept special characters in type")

# Test pin equality (reference-based)
func test_pin_equality():
	var same_params_pin = PinData.new("test_input", "float", PinData.PinType.INPUT, 0.0)
	
	# Pins are objects, so they won't be equal even with same parameters
	assert_not_equal(input_pin, same_params_pin, "Different pin instances should not be equal")

# Test pin comparison by properties
func test_pin_property_comparison():
	var identical_pin = PinData.new("test_input", "float", PinData.PinType.INPUT, 0.0)
	
	assert_equal(input_pin.get_name(), identical_pin.get_name(), "Identical pins should have same name")
	assert_equal(input_pin.get_data_type(), identical_pin.get_data_type(), "Identical pins should have same data type")
	assert_equal(input_pin.get_direction(), identical_pin.get_direction(), "Identical pins should have same direction")

# Test multiple pins with same properties
func test_multiple_identical_pins():
	var pin1 = PinData.new("same_name", "float", PinData.PinType.INPUT, 0.0)
	var pin2 = PinData.new("same_name", "float", PinData.PinType.INPUT, 0.0)
	var pin3 = PinData.new("same_name", "float", PinData.PinType.INPUT, 0.0)
	
	assert_equal(pin1.get_name(), pin2.get_name(), "Pin1 and Pin2 should have same name")
	assert_equal(pin2.get_name(), pin3.get_name(), "Pin2 and Pin3 should have same name")
	assert_equal(pin1.get_data_type(), pin3.get_data_type(), "Pin1 and Pin3 should have same data type")

# Test pin in array operations
func test_pin_in_array():
	var pin_array = [input_pin, output_pin]
	
	assert_contains(pin_array, input_pin, "Array should contain input pin")
	assert_contains(pin_array, output_pin, "Array should contain output pin")
	assert_equal(2, pin_array.size(), "Array should have 2 pins")

# Test pin array operations
func test_pin_array_operations():
	var pins = []
	pins.append(input_pin)
	pins.append(output_pin)
	
	assert_equal(input_pin, pins[0], "First pin should be input pin")
	assert_equal(output_pin, pins[1], "Second pin should be output pin")
	
	pins.erase(input_pin)
	assert_equal(1, pins.size(), "Array should have 1 pin after removal")
	assert_contains(pins, output_pin, "Array should still contain output pin")

# Test custom data types (shader-specific)
func test_shader_specific_types():
	var texture_pin = PinData.new("texture", "sampler2D", PinData.PinType.INPUT, null)
	var color_pin = PinData.new("color", "vec4", PinData.PinType.INPUT, null)
	var matrix_pin = PinData.new("matrix", "mat4", PinData.PinType.INPUT, null)
	
	assert_equal("sampler2D", texture_pin.get_data_type(), "Texture pin should have sampler2D type")
	assert_equal("vec4", color_pin.get_data_type(), "Color pin should have vec4 type")
	assert_equal("mat4", matrix_pin.get_data_type(), "Matrix pin should have mat4 type")

# Test long names and types
func test_long_names_and_types():
	var long_name = "very_long_pin_name_with_many_characters_and_descriptive_text"
	var long_type = "very_long_custom_data_type_name_with_specific_purpose"
	var long_pin = PinData.new(long_name, long_type, PinData.PinType.OUTPUT, null)
	
	assert_equal(long_name, long_pin.get_name(), "Long pin name should be preserved")
	assert_equal(long_type, long_pin.get_data_type(), "Long data type should be preserved")

# Test numeric strings as names/types
func test_numeric_strings():
	var numeric_name_pin = PinData.new("123", "456", PinData.PinType.INPUT, null)
	
	assert_equal("123", numeric_name_pin.get_name(), "Numeric string name should be preserved")
	assert_equal("456", numeric_name_pin.get_data_type(), "Numeric string type should be preserved")