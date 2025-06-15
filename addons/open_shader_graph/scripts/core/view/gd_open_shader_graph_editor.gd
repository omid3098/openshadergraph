class_name OpenShaderGraphEditor
extends Control

var graph_manager: GraphManager
var ui_manager: UIManager
var preferences_manager: PreferencesManager
var file_dialog: FileDialog # for save dialog
var root_control: Control # root UI scene returned by get_main_scene

func _init() -> void:
	Logger.log("[OpenShaderGraphEditor] init")
	graph_manager = GraphManager.new()
	ui_manager = UIManager.new()
	preferences_manager = PreferencesManager.new()
	
	# Connect GraphManager signals
	graph_manager.graph_created.connect(_on_graph_created)
	graph_manager.graph_selected.connect(_on_graph_selected)
	graph_manager.graph_deleted.connect(_on_graph_deleted)
	
	# Connect UIManager signals
	ui_manager.file_menu_item_selected.connect(_on_file_menu_item_selected)
	ui_manager.graph_tab_selected.connect(_on_graph_tab_selected)

func get_main_scene() -> Control:
	Logger.log("[OpenShaderGraphEditor] get_main_scene")
	root_control = ui_manager.get_main_scene()
	_init_file_dialog()
	return root_control

# Graph management signal handlers
func _on_graph_created(graph: BaseGraphData) -> void:
	ui_manager.on_graph_created(graph)

func _on_graph_selected(graph: BaseGraphData) -> void:
	ui_manager.on_graph_selected(graph)

func _on_graph_deleted(graph: BaseGraphData) -> void:
	ui_manager.on_graph_deleted(graph)

# UI signal handlers
func _on_graph_tab_selected(graph: BaseGraphData) -> void:
	graph_manager.select_graph(graph)

func _on_file_menu_item_selected(item_id: int) -> void:
	# Handle actions based on the selected File menu item enum.
	match item_id:
		MenuEnums.FileMenuItem.NEW_GRAPH:
			Logger.log("[OpenShaderGraphEditor] File > New Graph")
			graph_manager.create_new_graph()
		MenuEnums.FileMenuItem.OPEN_GRAPH:
			Logger.log("[OpenShaderGraphEditor] File > Open Graph")
		MenuEnums.FileMenuItem.SAVE:
			Logger.log("[OpenShaderGraphEditor] File > Save")
			_on_save_menu()
		MenuEnums.FileMenuItem.SAVE_AS:
			Logger.log("[OpenShaderGraphEditor] File > Save As")
			_on_save_as_menu()
		MenuEnums.FileMenuItem.EXPORT:
			Logger.log("[OpenShaderGraphEditor] File > Export")
		_:
			Logger.log("[OpenShaderGraphEditor] Unknown file menu action: " + str(item_id))

func _init_file_dialog() -> void:
	file_dialog = FileDialog.new()
	file_dialog.access = FileDialog.ACCESS_RESOURCES
	file_dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE
	file_dialog.add_filter("*.json ; JSON Graph")
	file_dialog.add_filter("*.yml ; YAML Graph")
	file_dialog.current_file = "new_graph.json"
	file_dialog.connect("file_selected", Callable(self, "_on_file_dialog_file_selected"))
	root_control.add_child(file_dialog)

func _on_file_dialog_file_selected(path: String) -> void:
	_save_graph_to_path(path)

func _on_save_menu() -> void:
	var graph = graph_manager.get_current_graph()
	if graph == null:
		Logger.log("[OpenShaderGraphEditor] No graph to save.")
		return
	if graph.file_path != "":
		_save_graph_to_path(graph.file_path)
	else:
		_on_save_as_menu()

func _on_save_as_menu() -> void:
	file_dialog.popup_centered()

func _save_graph_to_path(path: String) -> void:
	var graph = graph_manager.get_current_graph()
	if graph == null:
		Logger.log("[OpenShaderGraphEditor] No graph to save.")
		return
	# Update graph object with chosen file path
	graph.file_path = path
	# Prepare data structure for serialization
	var data: Dictionary = {}
	data["metadata"] = {
		"name": graph.name,
		"version": graph.version,
		"type": _graph_type_to_string(graph.graph_type),
		"properties": graph.properties
	}
	# Serialize nodes
	var nodes_array: Array = []
	for node in graph.nodes:
		var node_entry: Dictionary = {
			"name": node.name,
			"type": node.type,
			"position": [node.position.x, node.position.y],
			"inputs": [],
			"outputs": []
		}
		for pin in node.inputs:
			node_entry["inputs"].append({"name": pin.name, "type": pin.data_type})
		for pin in node.outputs:
			node_entry["outputs"].append({"name": pin.name, "type": pin.data_type})
		nodes_array.append(node_entry)
	data["nodes"] = nodes_array
	# Serialize connections
	var connections_array: Array = []
	for connection in graph.connections:
		connections_array.append({
			"from_node": connection.from_node.name,
			"from_pin": connection.from_pin.name,
			"to_node": connection.to_node.name,
			"to_pin": connection.to_pin.name
		})
	data["connections"] = connections_array
	# Convert to JSON
	var json = JSON.new()
	var text = json.stringify(data)
	# Write to file
	var file = FileAccess.open(path, FileAccess.WRITE)
	if file:
		file.store_string(text)
		file.close()
		Logger.log("[OpenShaderGraphEditor] Graph saved to %s" % path)
	else:
		Logger.log("[OpenShaderGraphEditor] Failed to save graph to %s" % path)

func _graph_type_to_string(graph_type_int: int) -> String:
	match graph_type_int:
		BaseGraphData.GraphType.SHADER_GRAPH:
			return "SHADER_GRAPH"
		BaseGraphData.GraphType.GROUP_GRAPH:
			return "GROUP_GRAPH"
		BaseGraphData.GraphType.LOCAL_SUBGRAPH:
			return "LOCAL_SUBGRAPH"
		BaseGraphData.GraphType.GLOBAL_SUBGRAPH:
			return "GLOBAL_SUBGRAPH"
		_:
			return "UNKNOWN"