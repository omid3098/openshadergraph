@tool
class_name BaseNode extends GraphNode

# node path in the list of all available nodes
# "" means the node is in the root
var node_path: String = ""

signal node_selection_changed(node: BaseNode)

func _ready():
    pass

func _gui_input(event: InputEvent):
    if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.is_pressed():
        emit_signal("node_selection_changed", self)

# Virtual method for nodes to provide custom properties for the properties panel
func get_property_list_for_panel() -> Array:
    return []

# Virtual method for nodes to handle property changes
func set_property(property_name: String, value):
    # Simple property setting
    if property_name in self:
        set(property_name, value)
