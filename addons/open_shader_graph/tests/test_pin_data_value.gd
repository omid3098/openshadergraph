@tool
extends BaseTest
class_name TestPinDataValue

var float_pin: PinData
var vector2_pin: PinData
var vector3_pin: PinData
var vector4_pin: PinData
var int_pin: PinData
var bool_pin: PinData
var string_pin: PinData

func before_each():
	float_pin = PinData.new("float_input", "float", PinData.PinType.INPUT, 3.14)
	vector2_pin = PinData.new("vec2_input", "vector2", PinData.PinType.INPUT, Vector2(1.0, 2.0))
	vector3_pin = PinData.new("vec3_input", "vector3", PinData.PinType.INPUT, Vector3(1.0, 2.0, 3.0))
	vector4_pin = PinData.new("vec4_input", "vector4", PinData.PinType.INPUT, Vector4(1.0, 2.0, 3.0, 4.0))
	int_pin = PinData.new("int_input", "int", PinData.PinType.INPUT, 42)
	bool_pin = PinData.new("bool_input", "bool", PinData.PinType.INPUT, true)
	string_pin = PinData.new("string_input", "string", PinData.PinType.INPUT, "test_value")

func after_each():
	float_pin = null
	vector2_pin = null
	vector3_pin = null
	vector4_pin = null
	int_pin = null
	bool_pin = null
	string_pin = null

# Test value field initialization
func test_value_initialization():
	assert_equal(3.14, float_pin.get_value(), "Float pin value should be initialized correctly")
	assert_equal(Vector2(1.0, 2.0), vector2_pin.get_value(), "Vector2 pin value should be initialized correctly")
	assert_equal(Vector3(1.0, 2.0, 3.0), vector3_pin.get_value(), "Vector3 pin value should be initialized correctly")
	assert_equal(Vector4(1.0, 2.0, 3.0, 4.0), vector4_pin.get_value(), "Vector4 pin value should be initialized correctly")
	assert_equal(42, int_pin.get_value(), "Int pin value should be initialized correctly")
	assert_equal(true, bool_pin.get_value(), "Bool pin value should be initialized correctly")
	assert_equal("test_value", string_pin.get_value(), "String pin value should be initialized correctly")

# Test value modification
func test_value_modification():
	float_pin.set_value(2.71)
	assert_equal(2.71, float_pin.get_value(), "Float pin value should be modifiable")
	
	vector2_pin.set_value(Vector2(5.0, 6.0))
	assert_equal(Vector2(5.0, 6.0), vector2_pin.get_value(), "Vector2 pin value should be modifiable")
	
	int_pin.set_value(100)
	assert_equal(100, int_pin.get_value(), "Int pin value should be modifiable")
	
	bool_pin.set_value(false)
	assert_equal(false, bool_pin.get_value(), "Bool pin value should be modifiable")

# Test null values
func test_null_values():
	var null_pin = PinData.new("null_pin", "custom", PinData.PinType.INPUT, null)
	assert_null(null_pin.get_value(), "Pin should accept null value")

# Test zero values
func test_zero_values():
	var zero_float = PinData.new("zero_float", "float", PinData.PinType.INPUT, 0.0)
	var zero_int = PinData.new("zero_int", "int", PinData.PinType.INPUT, 0)
	var zero_vec2 = PinData.new("zero_vec2", "vector2", PinData.PinType.INPUT, Vector2.ZERO)
	var zero_vec3 = PinData.new("zero_vec3", "vector3", PinData.PinType.INPUT, Vector3.ZERO)
	var zero_vec4 = PinData.new("zero_vec4", "vector4", PinData.PinType.INPUT, Vector4.ZERO)
	
	assert_equal(0.0, zero_float.get_value(), "Zero float value should be preserved")
	assert_equal(0, zero_int.get_value(), "Zero int value should be preserved")
	assert_equal(Vector2.ZERO, zero_vec2.get_value(), "Zero Vector2 value should be preserved")
	assert_equal(Vector3.ZERO, zero_vec3.get_value(), "Zero Vector3 value should be preserved")
	assert_equal(Vector4.ZERO, zero_vec4.get_value(), "Zero Vector4 value should be preserved")

# Test negative values
func test_negative_values():
	var neg_float = PinData.new("neg_float", "float", PinData.PinType.INPUT, -5.5)
	var neg_int = PinData.new("neg_int", "int", PinData.PinType.INPUT, -10)
	var neg_vec2 = PinData.new("neg_vec2", "vector2", PinData.PinType.INPUT, Vector2(-1.0, -2.0))
	
	assert_equal(-5.5, neg_float.get_value(), "Negative float value should be preserved")
	assert_equal(-10, neg_int.get_value(), "Negative int value should be preserved")
	assert_equal(Vector2(-1.0, -2.0), neg_vec2.get_value(), "Negative Vector2 value should be preserved")

# Test complex values
func test_complex_values():
	var color_pin = PinData.new("color", "color", PinData.PinType.INPUT, Color.RED)
	var transform_pin = PinData.new("transform", "transform2d", PinData.PinType.INPUT, Transform2D.IDENTITY)
	
	assert_equal(Color.RED, color_pin.get_value(), "Color value should be preserved")
	assert_equal(Transform2D.IDENTITY, transform_pin.get_value(), "Transform2D value should be preserved")

# Test array values
func test_array_values():
	var array_value = [1, 2, 3, 4]
	var array_pin = PinData.new("array", "array", PinData.PinType.INPUT, array_value)
	
	assert_equal(array_value, array_pin.get_value(), "Array value should be preserved")
	assert_equal(4, array_pin.get_value().size(), "Array size should be preserved")

# Test dictionary values
func test_dictionary_values():
	var dict_value = {"key1": "value1", "key2": 42, "key3": true}
	var dict_pin = PinData.new("dict", "dictionary", PinData.PinType.INPUT, dict_value)
	
	assert_equal(dict_value, dict_pin.get_value(), "Dictionary value should be preserved")
	assert_equal("value1", dict_pin.get_value()["key1"], "Dictionary string value should be accessible")
	assert_equal(42, dict_pin.get_value()["key2"], "Dictionary int value should be accessible")
	assert_equal(true, dict_pin.get_value()["key3"], "Dictionary bool value should be accessible")

# Test value type consistency
func test_value_type_consistency():
	# Test that we can store any Variant type
	var resource_pin = PinData.new("resource", "resource", PinData.PinType.INPUT, preload("res://addons/open_shader_graph/scripts/core/data/gd_pin_data.gd"))
	assert_not_null(resource_pin.get_value(), "Resource value should be stored")

# Test output pins with values
func test_output_pin_values():
	var output_float = PinData.new("output", "float", PinData.PinType.OUTPUT, 1.5)
	var output_vec3 = PinData.new("output", "vector3", PinData.PinType.OUTPUT, Vector3(1, 2, 3))
	
	assert_equal(1.5, output_float.get_value(), "Output pin should store float value")
	assert_equal(Vector3(1, 2, 3), output_vec3.get_value(), "Output pin should store vector3 value")

# Test value persistence after pin property changes
func test_value_persistence():
	var test_pin = PinData.new("test", "float", PinData.PinType.INPUT, 5.0)
	
	# Change other properties
	test_pin.set_name("changed_name")
	test_pin.set_data_type("vector2")
	test_pin.set_direction(PinData.PinType.OUTPUT)
	
	# Value should remain unchanged
	assert_equal(5.0, test_pin.get_value(), "Value should persist after other property changes")

# Test large values
func test_large_values():
	var large_float = PinData.new("large", "float", PinData.PinType.INPUT, 999999.999999)
	var large_int = PinData.new("large", "int", PinData.PinType.INPUT, 2147483647)
	
	assert_equal(999999.999999, large_float.get_value(), "Large float value should be preserved")
	assert_equal(2147483647, large_int.get_value(), "Large int value should be preserved")

# Test string values with special characters
func test_special_string_values():
	var special_strings = [
		"", # empty string
		" ", # space
		"\n\t", # newline and tab
		"unicode: 🎮🎯🎨", # unicode characters
		"quotes: \"single\" 'double'", # quotes
		"symbols: !@#$%^&*()_+-=[]{}|;:,.<>?", # special symbols
	]
	
	for i in range(special_strings.size()):
		var pin = PinData.new("special_%d" % i, "string", PinData.PinType.INPUT, special_strings[i])
		assert_equal(special_strings[i], pin.get_value(), "Special string value should be preserved: " + str(special_strings[i]))

# Test value comparison for different pin instances
func test_value_comparison_different_instances():
	var pin1 = PinData.new("test1", "float", PinData.PinType.INPUT, 3.14)
	var pin2 = PinData.new("test2", "float", PinData.PinType.INPUT, 3.14)
	
	# Pins are different instances
	assert_not_equal(pin1, pin2, "Different pin instances should not be equal")
	# But their values should be equal
	assert_equal(pin1.get_value(), pin2.get_value(), "Pin values should be equal")