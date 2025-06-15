class_name GraphManager extends Node

# Direct signals instead of using EventBus
signal graph_created(graph: BaseGraphData)
signal graph_selected(graph: BaseGraphData)
signal graph_deleted(graph: BaseGraphData)

var all_graphs_data: Array[BaseGraphData] = []
var current_graph_data: BaseGraphData

func _init() -> void:
	Logger.log("[GraphManager] init")

# Clean up signal connections when the GraphManager is freed
func cleanup() -> void:
	# No longer need to disconnect from EventBus
	pass

func create_new_graph() -> void:
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	current_graph_data = BaseGraphData.new("New Graph", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	all_graphs_data.append(current_graph_data)
	Logger.log("[GraphManager] Created new graph: " + current_graph_data.name)

	# Emit direct signal instead of using EventBus
	graph_created.emit(current_graph_data)

func get_current_graph() -> BaseGraphData:
	return current_graph_data

func get_all_graphs() -> Array[BaseGraphData]:
	return all_graphs_data

# Select a graph for editing
func select_graph(graph: BaseGraphData) -> void:
	current_graph_data = graph
	if graph != null:
		Logger.log("[GraphManager] Selected graph: " + current_graph_data.name)
	else:
		Logger.log("[GraphManager] Attempted to select null graph")
	# Emit direct signal instead of using EventBus
	graph_selected.emit(current_graph_data)

# Delete a graph and emit a signal; auto-select first graph if any remain
func delete_graph(graph: BaseGraphData) -> void:
	if all_graphs_data.has(graph):
		all_graphs_data.erase(graph)
		Logger.log("[GraphManager] Deleted graph: " + graph.name)
		# Emit direct signal instead of using EventBus
		graph_deleted.emit(graph)
		if all_graphs_data.size() > 0:
			select_graph(all_graphs_data[0])