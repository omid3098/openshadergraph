class_name ConnectionData

var from_node: BaseNodeData
var from_pin: PinData
var to_node: BaseNodeData
var to_pin: PinData

func _init(from_node: BaseNodeData, from_pin: PinData, to_node: BaseNodeData, to_pin: PinData) -> void:
    self.from_node = from_node
    self.from_pin = from_pin
    self.to_node = to_node
    self.to_pin = to_pin
    var from_node_name = from_node.name if from_node else "null"
    var from_pin_name = from_pin.name if from_pin else "null"
    var to_node_name = to_node.name if to_node else "null"
    var to_pin_name = to_pin.name if to_pin else "null"
    Logger.log("[ConnectionData]: " + from_node_name + ": " + from_pin_name + " -> " + to_node_name + ": " + to_pin_name)