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

func get_data() -> BaseNodeData:
    return data

func get_position() -> Vector2:
    return position

func set_position(value: Vector2, _keep_offset: bool = true) -> void:
    position = value
    if data:
        data.set_position(value)

func get_title() -> String:
    return title

func set_title(value: String) -> void:
    title = value
    if data:
        data.set_name(value)