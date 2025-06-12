class_name EventBus
extends Node

# Menu items
signal menu_item_selected(menu_name: String, item_id: int, item_text: String)


static var _instance: EventBus = null

static func get_instance() -> EventBus:
	if _instance == null:
		_instance = EventBus.new()
	return _instance

func _init() -> void:
	print("[EventBus] init")