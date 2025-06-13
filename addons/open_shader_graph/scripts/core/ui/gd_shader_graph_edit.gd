class_name ShaderGraphEdit extends GraphEdit

# var graph_edit: GraphEdit

func _init() -> void:
	print("[ShaderGraphEdit] init")
	# graph_edit = GraphEdit.new()
	# graph_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# graph_edit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	# add_child(graph_edit)

	EventBus.get_instance().graph_created.connect(_on_graph_created)

	_deactive_graph_edit()

func _deactive_graph_edit() -> void:
	show_menu = false
	modulate = Color(1, 1, 1, 0.5)
	minimap_enabled = false

func _active_graph_edit() -> void:
	show_menu = true
	modulate = Color(1, 1, 1, 1)
	minimap_enabled = true

func _on_graph_created(graph: BaseGraphData) -> void:
	print("[ShaderGraphEdit] Graph created: " + graph.name)
	_active_graph_edit()