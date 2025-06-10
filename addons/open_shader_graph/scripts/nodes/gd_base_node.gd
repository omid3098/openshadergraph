@tool
class_name BaseNode extends GraphNode

# Centralized pin color management - available to all node types
const PinTypeColors = preload("res://addons/open_shader_graph/scripts/core/gd_pin_type_colors.gd")

# node path in the list of all available nodes
# "" means the node is in the root
var node_path: String = ""

# Index in the graph for shader code generation
# This helps determine the order of nodes when generating final shader code
var node_index: int = -1

signal node_selection_changed(node: BaseNode)

func _ready() -> void:
    pass

func _gui_input(event: InputEvent) -> void:
    if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.is_pressed():
        node_selection_changed.emit(self)

# Virtual method for nodes to provide custom properties for the properties panel
func get_property_list_for_panel() -> Array:
    return []

# Virtual method for nodes to handle property changes
func set_property(property_name: String, value: Variant) -> void:
    # Simple property setting
    if property_name in self:
        set(property_name, value)

# Get the node's index in the graph
func get_node_index() -> int:
    return node_index

# Set the node's index in the graph
func set_node_index(index: int) -> void:
    node_index = index
