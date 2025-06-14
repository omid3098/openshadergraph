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
    Logger.log("[ConnectionData]: " + from_node.name + ": " + from_pin.name + " -> " + to_node.name + ": " + to_pin.name)