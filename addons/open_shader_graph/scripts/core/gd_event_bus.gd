class_name EventBus
extends Node

signal graph_selected(graph_name: String)

static var _instance: EventBus = null

static func get_instance() -> EventBus:
	if _instance == null:
		_instance = EventBus.new()
	return _instance

func _init() -> void:
	print("[EventBus] init")

func emit_graph_selected(graph_name: String) -> void:
	graph_selected.emit(graph_name)