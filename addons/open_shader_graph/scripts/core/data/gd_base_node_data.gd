class_name BaseNodeData

var name: String
var type: String
var position: Vector2
var inputs: Array[PinData]
var outputs: Array[PinData]

func _init(_name: String, _type: String, _position: Vector2, _inputs: Array[PinData] = [], _outputs: Array[PinData] = []) -> void:
    name = _name
    type = _type
    position = _position
    inputs = _inputs
    outputs = _outputs