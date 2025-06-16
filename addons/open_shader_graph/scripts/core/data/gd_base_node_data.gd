class_name BaseNodeData

var _name: String
var _type: String
var _position: Vector2
var _inputs: Array[PinData]
var _outputs: Array[PinData]

func _init(_name: String, _type: String, _position: Vector2, _inputs: Array[PinData] = [], _outputs: Array[PinData] = []) -> void:
    self._name = _name
    self._type = _type
    self._position = _position
    self._inputs = _inputs
    self._outputs = _outputs

func get_name() -> String:
    return _name

func get_type() -> String:
    return _type

func get_position() -> Vector2:
    return _position

func get_inputs() -> Array[PinData]:
    return _inputs

func get_outputs() -> Array[PinData]:
    return _outputs

func set_position(value: Vector2) -> void:
    _position = value

func set_name(value: String) -> void:
    _name = value

func set_type(value: String) -> void:
    _type = value

func set_inputs(value: Array[PinData]) -> void:
    _inputs = value

func set_outputs(value: Array[PinData]) -> void:
    _outputs = value