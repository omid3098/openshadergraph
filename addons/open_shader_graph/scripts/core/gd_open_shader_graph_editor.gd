class_name OpenShaderGraphEditor
extends Control

var graph_manager: GraphManager
var ui_manager: UIManager
var preferences_manager: PreferencesManager
# var event_bus: EventBus

func _init() -> void:
	print("[OpenShaderGraphEditor] init")
	graph_manager = GraphManager.new()
	ui_manager = UIManager.new()
	preferences_manager = PreferencesManager.new()
	# event_bus = EventBus.new()
	EventBus.get_instance().menu_item_selected.connect(_on_menu_item_selected)

func get_main_scene() -> Control:
	print("[OpenShaderGraphEditor] get_main_scene")
	return ui_manager.get_main_scene()

func _on_menu_item_selected(menu_name: String, item_id: int, item_text: String) -> void:
	print("[OpenShaderGraphEditor] Menu item:" + menu_name + " > " + item_text)