class_name PinData

enum PinType {
    INPUT = 0,
    OUTPUT = 1
}

var _name: String
var _data_type: String
var _direction: PinType
var _value: Variant

func _init(_name: String, _data_type: String, _direction: PinType, _value: Variant) -> void:
    self._name = _name
    self._data_type = _data_type
    self._direction = _direction
    self._value = _value

func get_name() -> String:
    return _name

func get_data_type() -> String:
    return _data_type

func get_direction() -> PinType:
    return _direction

func get_value() -> Variant:
    return _value

func set_value(value: Variant) -> void:
    _value = value

func set_name(name: String) -> void:
    _name = name

func set_data_type(data_type: String) -> void:
    _data_type = data_type

func set_direction(direction: PinType) -> void:
    _direction = direction
