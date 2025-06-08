extends BaseNode

# define the data type of the constant from https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html#data-types

var constant_type: ConstantType = ConstantType.FLOAT

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
    _set_slot_type(ConstantType.FLOAT)

func _set_slot_type(slot_type: ConstantType):
    # one output slot for the constant - https://docs.godotengine.org/en/stable/classes/class_graphnode.html#class-graphnode-method-set-slot
    set_slot(0, false, 0, Color.WHITE, true, slot_type, Color.WHITE, null, null, true)
