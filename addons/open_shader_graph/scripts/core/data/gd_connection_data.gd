class_name ConnectionData

var _from: Dictionary
var _to: Dictionary


func _init(from_node: BaseNodeData, from_pin: PinData, to_node: BaseNodeData, to_pin: PinData) -> void:
    _from = {
        "node": from_node,
        "pin": from_pin
    }
    _to = {
        "node": to_node,
        "pin": to_pin
    }
    Logger.log("[ConnectionData]: _init")

func get_from() -> Dictionary:
    return _from

func get_to() -> Dictionary:
    return _to