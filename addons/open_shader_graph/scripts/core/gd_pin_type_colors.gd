@tool
class_name PinTypeColors
extends RefCounted

# Static color definitions for different pin types
# Colors match Unity's Shader Graph for familiarity
static var PIN_COLORS = {
	"bool": Color.PURPLE, # Boolean - Purple
	"int": Color.CYAN, # Integer - Light Blue (same as Float)
	"float": Color.CYAN, # Float (Vector 1) - Light Blue
	"float2": Color.GREEN, # Vector 2 - Green
	"float3": Color.YELLOW, # Vector 3 - Yellow
	"float4": Color.MAGENTA, # Vector 4 - Pink
	"texture2d": Color.RED, # Texture 2D - Red
	"matrix": Color.BLUE, # Matrix types - Blue
	"sampler": Color.GRAY, # Sampler State - Grey
	"gradient": Color.GRAY, # Gradient - Grey
	"default": Color.WHITE
}

# Get color for a specific pin type
static func get_color_for_type(type: String) -> Color:
	return PIN_COLORS.get(type, PIN_COLORS["default"])

# Get all available pin types
static func get_all_types() -> Array:
	return PIN_COLORS.keys().filter(func(key): return key != "default")

# Check if a type is valid
static func is_valid_type(type: String) -> bool:
	return type in PIN_COLORS

# Get default color for unrecognized types
static func get_default_color() -> Color:
	return PIN_COLORS["default"]