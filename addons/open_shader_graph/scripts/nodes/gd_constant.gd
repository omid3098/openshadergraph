@tool
extends BaseNode

# define the data type of the constant from https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html#data-types

var constant_type: ConstantType = ConstantType.FLOAT

# Values for different types (will be set based on constant_type)
var bool_value: bool = false
var int_value: int = 0
var float_value: float = 0.0
var vec2_value: Vector2 = Vector2.ZERO
var vec3_value: Vector3 = Vector3.ZERO
var vec4_value: Vector4 = Vector4.ZERO

enum ConstantType {
    BOOL = 0,
    INT = 1,
    FLOAT = 2,
    VEC2 = 3,
    VEC3 = 4,
    VEC4 = 5,
    MAT2 = 6,
    MAT3 = 7,
    MAT4 = 8,
    TEXTURE = 9,
    TEXTURE_2D = 10,
    TEXTURE_3D = 11,
    TEXTURE_CUBE = 12,
    TEXTURE_2D_ARRAY = 13,
    TEXTURE_3D_ARRAY = 14,
    TEXTURE_CUBE_ARRAY = 15,
}

func _ready():
    node_path = "Constant"
    title = "Constant"
    _set_slot_type(ConstantType.FLOAT)
    _update_display()

func _set_slot_type(slot_type: ConstantType):
    constant_type = slot_type
    # one output slot for the constant - https://docs.godotengine.org/en/stable/classes/class_graphnode.html#class-graphnode-method-set-slot
    var output_color = _get_type_color(slot_type)
    set_slot(0, false, 0, Color.WHITE, true, slot_type, output_color, null, null, true)

func _get_type_color(type: ConstantType) -> Color:
    match type:
        ConstantType.BOOL:
            return Color.RED
        ConstantType.INT:
            return Color.BLUE
        ConstantType.FLOAT:
            return Color.CYAN
        ConstantType.VEC2:
            return Color.GREEN
        ConstantType.VEC3:
            return Color.YELLOW
        ConstantType.VEC4:
            return Color.MAGENTA
        _:
            return Color.WHITE

func _update_display():
    # Clear existing children
    for child in get_children():
        child.queue_free()
    
    # Add a label showing the current value and type
    var label = Label.new()
    match constant_type:
        ConstantType.BOOL:
            label.text = "Bool: " + str(bool_value)
        ConstantType.INT:
            label.text = "Int: " + str(int_value)
        ConstantType.FLOAT:
            label.text = "Float: " + str(float_value)
        ConstantType.VEC2:
            label.text = "Vec2: " + str(vec2_value)
        ConstantType.VEC3:
            label.text = "Vec3: " + str(vec3_value)
        ConstantType.VEC4:
            label.text = "Vec4: " + str(vec4_value)
        _:
            label.text = "Constant"
    
    add_child(label)

func get_output_value():
    match constant_type:
        ConstantType.BOOL:
            return bool_value
        ConstantType.INT:
            return int_value
        ConstantType.FLOAT:
            return float_value
        ConstantType.VEC2:
            return vec2_value
        ConstantType.VEC3:
            return vec3_value
        ConstantType.VEC4:
            return vec4_value
        _:
            return null

# Functions to set values (will be used by properties panel later)
func set_bool_value(value: bool):
    bool_value = value
    if constant_type == ConstantType.BOOL:
        _update_display()

func set_int_value(value: int):
    int_value = value
    if constant_type == ConstantType.INT:
        _update_display()

func set_float_value(value: float):
    float_value = value
    if constant_type == ConstantType.FLOAT:
        _update_display()

func set_vec2_value(value: Vector2):
    vec2_value = value
    if constant_type == ConstantType.VEC2:
        _update_display()

func set_vec3_value(value: Vector3):
    vec3_value = value
    if constant_type == ConstantType.VEC3:
        _update_display()

func set_vec4_value(value: Vector4):
    vec4_value = value
    if constant_type == ConstantType.VEC4:
        _update_display()

# Function to change the constant type (will be used by properties panel)
func set_constant_type(new_type: ConstantType):
    if new_type != constant_type:
        _set_slot_type(new_type)
        _update_display()
