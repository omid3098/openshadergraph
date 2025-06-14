class_name OpenShaderGraphEditor
extends Control

var graph_manager: GraphManager
var ui_manager: UIManager
var preferences_manager: PreferencesManager

func _init() -> void:
	Logger.log("[OpenShaderGraphEditor] init")
	graph_manager = GraphManager.new()
	ui_manager = UIManager.new(graph_manager)
	preferences_manager = PreferencesManager.new()
	EventBus.get_instance().file_menu_item_selected.connect(_on_file_menu_item_selected)

func get_main_scene() -> Control:
	Logger.log("[OpenShaderGraphEditor] get_main_scene")
	return ui_manager.get_main_scene()

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
		MenuEnums.FileMenuItem.SAVE_AS:
			Logger.log("[OpenShaderGraphEditor] File > Save As")
		MenuEnums.FileMenuItem.EXPORT:
			Logger.log("[OpenShaderGraphEditor] File > Export")
		_:
			Logger.log("[OpenShaderGraphEditor] Unknown file menu action: " + str(item_id))