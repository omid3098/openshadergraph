@tool
extends GraphEdit

signal right_clicked(global_mouse_position)
signal shader_node_selected(node)

# We use the _gui_input function to detect mouse clicks on this specific node.
func _gui_input(event: InputEvent) -> void:
	# Check for a right mouse button click.
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.is_pressed():
		# Emit the signal, providing the current global mouse position.
		# The main plugin will listen for this.
		emit_signal("right_clicked", get_global_mouse_position())
		accept_event()

# When a child node is added, connect to its selection signal
func _on_child_entered_tree(node):
	if node is BaseNode:
		node.node_selection_changed.connect(_on_node_selection_changed)

func _on_node_selection_changed(selected_node: BaseNode):
	emit_signal("shader_node_selected", selected_node)

func _ready():
	# Connect to child entered tree signal
	child_entered_tree.connect(_on_child_entered_tree)