extends GraphNode
class_name BaseGraphNode

signal node_moved(node_data: BaseNodeData, new_position: Vector2)

var data: BaseNodeData

const DEFAULT_PIN_COLOR: Color = Color(1, 1, 1, 0.8)

func _init(node_data: BaseNodeData) -> void:
    data = node_data
    title = data.get_name()
    position = data.get_position()
    focus_mode = FOCUS_ALL

    Logger.log("[BaseGraphNode] _init")
    focus_entered.connect(_on_focus_entered)
    focus_exited.connect(_on_focus_exited)
    dragged.connect(_on_dragged)

    # TODO: add pin slots here

func _on_focus_entered() -> void:
    Logger.log("[BaseGraphNode] focus_entered")
    # Use built-in focus_entered signal externally to handle node selection
    pass

func _on_focus_exited() -> void:
    Logger.log("[BaseGraphNode] focus_exited")
    # Use built-in focus_exited signal externally to handle node deselection
    pass

func _on_dragged(_from: Vector2, _to: Vector2) -> void:
    Logger.log("[BaseGraphNode] dragged from %s to %s" % [_from, _to])
    position = _to
    if data:
        data.set_position(_to)
    node_moved.emit(data, position)
    # Use built-in dragged signal externally to handle node movement

func get_node_data() -> BaseNodeData:
    return data

func get_node_position() -> Vector2:
    return position

func set_node_position(value: Vector2, _keep_offset: bool = true) -> void:
    Logger.log("[BaseGraphNode] set_position called with value: %s, data_before: %s" % [value, data.get_position()])
    position = value
    if data:
        data.set_position(value)
        Logger.log("[BaseGraphNode] data position after set_position: %s" % data.get_position())

func get_node_title() -> String:
    return title

func set_node_title(value: String) -> void:
    Logger.log("[BaseGraphNode] set_node_title called")
    Logger.log("[BaseGraphNode] set_node_title called with value: %s, data_before: %s" % [value, data.get_name()])
    title = value
    if data:
        data.set_name(value)
        Logger.log("[BaseGraphNode] data name after set_node_title: %s" % data.get_name())