class_name PinData

enum PinType {
    INPUT = 0,
    OUTPUT = 1
}

var name: String
var data_type: String
var direction: PinType

func _init(_name: String, _data_type: String, _direction: PinType) -> void:
    name = _name
    data_type = _data_type
    direction = _direction