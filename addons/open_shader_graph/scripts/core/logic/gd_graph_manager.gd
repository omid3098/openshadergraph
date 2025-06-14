class_name GraphManager extends Node

var all_graphs_data: Array[BaseGraphData] = []
var current_graph_data: BaseGraphData

func _init() -> void:
	Logger.log("[GraphManager] init")
	# Listen for graph selection events to keep current_graph_data in sync
	EventBus.get_instance().graph_selected.connect(_on_graph_selected)

func create_new_graph() -> void:
	current_graph_data = BaseGraphData.new("New Graph", BaseGraphData.GraphType.SHADER_GRAPH, [], [])
	all_graphs_data.append(current_graph_data)
	Logger.log("[GraphManager] Created new graph: " + current_graph_data.name)

	EventBus.get_instance().graph_created.emit(current_graph_data)

func get_current_graph() -> BaseGraphData:
	return current_graph_data

func get_all_graphs() -> Array[BaseGraphData]:
	return all_graphs_data

# Select a graph for editing
func select_graph(graph: BaseGraphData) -> void:
	current_graph_data = graph
	Logger.log("[GraphManager] Selected graph: " + graph.name)
	EventBus.get_instance().graph_selected.emit(graph)

# Delete a graph and emit a signal; auto-select first graph if any remain
func delete_graph(graph: BaseGraphData) -> void:
	if all_graphs_data.has(graph):
		all_graphs_data.erase(graph)
		Logger.log("[GraphManager] Deleted graph: " + graph.name)
		EventBus.get_instance().graph_deleted.emit(graph)
		if all_graphs_data.size() > 0:
			select_graph(all_graphs_data[0])

# Handle external graph_selected events
func _on_graph_selected(graph: BaseGraphData) -> void:
	current_graph_data = graph
	Logger.log("[GraphManager] Current graph set to " + graph.name)