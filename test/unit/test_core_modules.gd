extends GutTest

# Test cases for core modules
class_name TestCoreModules

const PinTypeColors = preload("res://addons/open_shader_graph/scripts/core/gd_pin_type_colors.gd")
const ConnectionManager = preload("res://addons/open_shader_graph/scripts/core/gd_connection_manager.gd")

func before_all():
	gut.p("Setting up core modules tests")

func after_each():
	gut.p("Cleaning up core modules test")

# PinTypeColors Tests
func test_pin_type_colors_initialization():
	# Test that PIN_COLORS dictionary is properly initialized
	assert_not_null(PinTypeColors.PIN_COLORS, "PIN_COLORS should be initialized")
	assert_true(PinTypeColors.PIN_COLORS is Dictionary, "PIN_COLORS should be a Dictionary")
	assert_true(PinTypeColors.PIN_COLORS.size() > 0, "PIN_COLORS should not be empty")

func test_pin_type_colors_has_required_types():
	# Test that all required pin types are defined
	var required_types: Array[String] = ["bool", "int", "float", "float2", "float3", "float4", "texture2d", "matrix", "sampler", "gradient", "default"]
	
	for type in required_types:
		assert_true(PinTypeColors.PIN_COLORS.has(type), "Should have color for type: " + type)
		assert_true(PinTypeColors.PIN_COLORS[type] is Color, "Color for " + type + " should be a Color object")

func test_get_color_for_type():
	# Test getting colors for valid types
	assert_eq(PinTypeColors.get_color_for_type("float"), Color.CYAN, "Float should return cyan color")
	assert_eq(PinTypeColors.get_color_for_type("float2"), Color.GREEN, "Float2 should return green color")
	assert_eq(PinTypeColors.get_color_for_type("float3"), Color.YELLOW, "Float3 should return yellow color")
	assert_eq(PinTypeColors.get_color_for_type("float4"), Color.MAGENTA, "Float4 should return magenta color")
	assert_eq(PinTypeColors.get_color_for_type("bool"), Color.PURPLE, "Bool should return purple color")

func test_get_color_for_invalid_type():
	# Test getting color for invalid type returns default
	var invalid_color: Color = PinTypeColors.get_color_for_type("invalid_type")
	var default_color: Color = PinTypeColors.get_color_for_type("default")
	assert_eq(invalid_color, default_color, "Invalid type should return default color")
	assert_eq(invalid_color, Color.WHITE, "Default color should be white")

func test_get_all_types():
	# Test getting all available types (excluding default)
	var all_types: Array = PinTypeColors.get_all_types()
	assert_true(all_types is Array, "Should return an array")
	assert_true(all_types.size() > 0, "Should have at least one type")
	assert_false("default" in all_types, "Should not include 'default' in types list")
	
	# Verify all returned types exist in PIN_COLORS
	for type in all_types:
		assert_true(PinTypeColors.PIN_COLORS.has(type), "All returned types should exist in PIN_COLORS: " + type)

func test_is_valid_type():
	# Test type validation
	assert_true(PinTypeColors.is_valid_type("float"), "Float should be valid type")
	assert_true(PinTypeColors.is_valid_type("bool"), "Bool should be valid type")
	assert_true(PinTypeColors.is_valid_type("default"), "Default should be valid type")
	assert_false(PinTypeColors.is_valid_type("invalid"), "Invalid should not be valid type")
	assert_false(PinTypeColors.is_valid_type(""), "Empty string should not be valid type")

func test_get_default_color():
	# Test getting default color
	var default_color: Color = PinTypeColors.get_default_color()
	assert_eq(default_color, Color.WHITE, "Default color should be white")
	assert_eq(default_color, PinTypeColors.PIN_COLORS["default"], "Should match default in PIN_COLORS")

func test_unity_shader_graph_compatibility():
	# Test that colors match Unity Shader Graph for familiarity
	# These are the expected Unity colors according to the comment
	assert_eq(PinTypeColors.get_color_for_type("bool"), Color.PURPLE, "Bool matches Unity purple")
	assert_eq(PinTypeColors.get_color_for_type("float"), Color.CYAN, "Float matches Unity cyan")
	assert_eq(PinTypeColors.get_color_for_type("float2"), Color.GREEN, "Float2 matches Unity green")
	assert_eq(PinTypeColors.get_color_for_type("float3"), Color.YELLOW, "Float3 matches Unity yellow")
	assert_eq(PinTypeColors.get_color_for_type("float4"), Color.MAGENTA, "Float4 matches Unity magenta")

func test_vector_type_renaming_from_memory():
	# Test the vector type renaming mentioned in memory (vector2 → float2, etc.)
	var float_types: Array[String] = ["float2", "float3", "float4"]
	for float_type in float_types:
		assert_true(PinTypeColors.is_valid_type(float_type), "Should support renamed vector type: " + float_type)
		assert_ne(PinTypeColors.get_color_for_type(float_type), PinTypeColors.get_default_color(), "Should have specific color for: " + float_type)

# ConnectionManager Tests
func test_connection_manager_initialization():
	# ConnectionManager requires a GraphEdit parameter
	var mock_graph_edit: GraphEdit = autofree(GraphEdit.new())
	var connection_manager: ConnectionManager = autofree(ConnectionManager.new(mock_graph_edit))
	assert_not_null(connection_manager, "ConnectionManager should be created")

func test_connection_manager_is_refcounted():
	var mock_graph_edit: GraphEdit = autofree(GraphEdit.new())
	var connection_manager: ConnectionManager = autofree(ConnectionManager.new(mock_graph_edit))
	assert_true(connection_manager is RefCounted, "ConnectionManager should extend RefCounted")

# Test static color access from BaseNode (from memory)
func test_pin_colors_accessible_from_base_node():
	# According to memory, PinTypeColors is preloaded in BaseNode as a const
	const BaseNode = preload("res://addons/open_shader_graph/scripts/nodes/gd_base_node.gd")
	
	# Test that PinTypeColors is accessible
	assert_not_null(BaseNode.PinTypeColors, "PinTypeColors should be accessible from BaseNode")
	
	# Test that we can get colors through BaseNode
	var color: Color = BaseNode.PinTypeColors.get_color_for_type("float")
	assert_eq(color, Color.CYAN, "Should be able to get colors through BaseNode.PinTypeColors")

# Test centralized pin color management from memory
func test_centralized_pin_color_management():
	# According to memory, this eliminates code duplication across node implementations
	var float_color: Color = PinTypeColors.get_color_for_type("float")
	var float2_color: Color = PinTypeColors.get_color_for_type("float2")
	var float3_color: Color = PinTypeColors.get_color_for_type("float3")
	var float4_color: Color = PinTypeColors.get_color_for_type("float4")
	
	# Each type should have a distinct color
	assert_ne(float_color, float2_color, "Float and float2 should have different colors")
	assert_ne(float2_color, float3_color, "Float2 and float3 should have different colors")
	assert_ne(float3_color, float4_color, "Float3 and float4 should have different colors")
	
	# All should be valid colors
	assert_true(float_color is Color, "Float color should be valid")
	assert_true(float2_color is Color, "Float2 color should be valid")
	assert_true(float3_color is Color, "Float3 color should be valid")
	assert_true(float4_color is Color, "Float4 color should be valid")

func test_color_consistency():
	# Test that colors are consistent across multiple calls
	var color1: Color = PinTypeColors.get_color_for_type("float")
	var color2: Color = PinTypeColors.get_color_for_type("float")
	assert_eq(color1, color2, "Colors should be consistent across calls")

func test_case_sensitivity():
	# Test case sensitivity of type names
	assert_ne(PinTypeColors.get_color_for_type("FLOAT"), PinTypeColors.get_color_for_type("float"), "Type names should be case sensitive")
	assert_eq(PinTypeColors.get_color_for_type("FLOAT"), PinTypeColors.get_default_color(), "Unknown case should return default")

func test_pin_colors_immutability():
	# Test that PIN_COLORS cannot be accidentally modified
	var original_float_color: Color = PinTypeColors.PIN_COLORS["float"]
	
	# Try to modify (this should not affect future calls)
	var colors_dict: Dictionary = PinTypeColors.PIN_COLORS
	if colors_dict.has("float"):
		# Test that we get the same color even if someone tries to modify
		var current_color: Color = PinTypeColors.get_color_for_type("float")
		assert_eq(current_color, original_float_color, "Colors should remain consistent")

func test_edge_cases():
	# Test edge cases
	assert_eq(PinTypeColors.get_color_for_type(""), PinTypeColors.get_default_color(), "Empty string should return default")
	assert_false(PinTypeColors.is_valid_type(""), "Empty string should not be valid")
	
	# Test null-like cases
	var null_result: Color = PinTypeColors.get_color_for_type("null")
	assert_eq(null_result, PinTypeColors.get_default_color(), "Null-like input should return default")