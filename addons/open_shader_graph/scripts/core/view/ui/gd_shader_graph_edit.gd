class_name ShaderGraphEdit extends GraphEdit

# var graph_edit: GraphEdit

func _init() -> void:
	Logger.log("[ShaderGraphEdit] init")
	# graph_edit = GraphEdit.new()
	# graph_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# graph_edit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	# add_child(graph_edit)

	_deactive_graph_edit()

func _deactive_graph_edit() -> void:
	show_menu = false
	modulate = Color(1, 1, 1, 0.5)
	minimap_enabled = false

func _active_graph_edit() -> void:
	show_menu = true
	modulate = Color(1, 1, 1, 1)
	minimap_enabled = true

# Add data and API to load/clear graphs
var graph_data: BaseGraphData

func set_graph(graph: BaseGraphData) -> void:
	graph_data = graph
	_clear_graph()
	# TODO: instantiate nodes & connections based on graph_data
	Logger.log("[ShaderGraphEdit] Loaded graph: " + graph.get_name())
	_active_graph_edit()

func _clear_graph() -> void:
	# Remove all GraphNode children
	for child in get_children():
		if child is GraphNode:
			remove_child(child)
			child.queue_free()
	# Remove all connections
	for conn in get_connection_list():
		disconnect_node(conn["from"], conn["from_port"], conn["to"], conn["to_port"])