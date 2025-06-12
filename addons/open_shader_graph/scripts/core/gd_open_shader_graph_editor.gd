class_name OpenShaderGraphEditor
extends Control

var graph_manager: GraphManager
var ui_manager: UIManager
var preferences_manager: PreferencesManager
var event_bus: EventBus

func _init() -> void:
	print("[OpenShaderGraphEditor] init")
	graph_manager = GraphManager.new()
	ui_manager = UIManager.new()
	preferences_manager = PreferencesManager.new()
	event_bus = EventBus.new()

func get_main_scene() -> Control:
	print("[OpenShaderGraphEditor] get_main_scene")
	return ui_manager.get_main_scene()
