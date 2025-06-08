@tool
extends GraphEdit


signal right_clicked(global_mouse_position)

# We use the _gui_input function to detect mouse clicks on this specific node.
func _gui_input(event: InputEvent) -> void:
	# Check for a right mouse button click.
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.is_pressed():
		# Emit the signal, providing the current global mouse position.
		# The main plugin will listen for this.
		emit_signal("right_clicked", get_global_mouse_position())
		accept_event()