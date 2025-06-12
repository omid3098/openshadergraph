class_name ShaderGraphEdit extends GraphEdit

func _init() -> void:
	print("[ShaderGraphEdit] init")
	# Disable user interaction until a graph is explicitly selected
	# and give a visual hint by dimming the widget.
	_deactive_graph_edit()
	# Future default settings for the graph editor can be configured here. 

func _deactive_graph_edit() -> void:
	show_menu = false
	modulate = Color(1, 1, 1, 0.5)
	minimap_enabled = false

func _active_graph_edit() -> void:
	show_menu = true
	modulate = Color(1, 1, 1, 1)
	minimap_enabled = true