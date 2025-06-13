class_name GraphManager extends Node

var all_graphs_data: Array[BaseGraphData] = []
var current_graph_data: BaseGraphData

func _init() -> void:
	print("[GraphManager] init")

func create_new_graph() -> void:
	current_graph_data = BaseGraphData.new("New Graph", BaseGraphData.GraphType.SHADER_GRAPH, [], [])
	all_graphs_data.append(current_graph_data)
	print("GraphManager: Created new graph: " + current_graph_data.name)

	EventBus.get_instance().graph_created.emit(current_graph_data)

func get_current_graph() -> BaseGraphData:
	return current_graph_data

func get_all_graphs() -> Array[BaseGraphData]:
	return all_graphs_data