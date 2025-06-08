@tool
extends Control

@onready var graph_edit: GraphEdit = get_parent().get_node("GraphEdit")

func _ready():
	# Connect the popup request signal for right-click
	if graph_edit:
		if graph_edit.has_signal("popup_request"):
			graph_edit.popup_request.connect(_on_add_node_request)
	
	# Make sure we can receive input focus
	set_process_input(true)

func _input(event):
	# Handle Tab key press
	if event is InputEventKey and event.pressed:
		if event.keycode == KEY_TAB:
			_on_add_node_request(graph_edit.get_local_mouse_position() if graph_edit else Vector2.ZERO)
			get_viewport().set_input_as_handled()

func _on_add_node_request(position: Vector2 = Vector2.ZERO):
	print("Add node request detected! Position: ", position)
	# for test purpos add a base node.
	# in order to 
