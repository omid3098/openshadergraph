class_name OpenShaderGraphEditor
extends Control

var graph_manager: GraphManager
var ui_manager: UIManager
var preferences_manager: PreferencesManager

func _init() -> void:
	print("[OpenShaderGraphEditor] init")
	graph_manager = GraphManager.new()
	ui_manager = UIManager.new()
	preferences_manager = PreferencesManager.new()
	EventBus.get_instance().file_menu_item_selected.connect(_on_file_menu_item_selected)

func get_main_scene() -> Control:
	print("[OpenShaderGraphEditor] get_main_scene")
	return ui_manager.get_main_scene()

func _on_file_menu_item_selected(item_id: int) -> void:
	# Handle actions based on the selected File menu item enum.
	match item_id:
		MenuEnums.FileMenuItem.NEW_GRAPH:
			print("[OpenShaderGraphEditor] File > New Graph")
			graph_manager.create_new_graph()
		MenuEnums.FileMenuItem.OPEN_GRAPH:
			print("[OpenShaderGraphEditor] File > Open Graph")
		MenuEnums.FileMenuItem.SAVE:
			print("[OpenShaderGraphEditor] File > Save")
		MenuEnums.FileMenuItem.SAVE_AS:
			print("[OpenShaderGraphEditor] File > Save As")
		MenuEnums.FileMenuItem.EXPORT:
			print("[OpenShaderGraphEditor] File > Export")
		_:
			print("[OpenShaderGraphEditor] Unknown file menu action: " + str(item_id))