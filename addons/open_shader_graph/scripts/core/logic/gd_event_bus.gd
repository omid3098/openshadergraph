class_name EventBus
extends Node

# Emits whenever a File-menu item is selected. The integer corresponds to a
# value from MenuEnums.FileMenuItem (see gd_menu_enums.gd).
signal file_menu_item_selected(item_id: int)

# Emits whenever a new graph is created.
signal graph_created(graph: BaseGraphData)

# Emits whenever a graph is selected (switched to).
signal graph_selected(graph: BaseGraphData)

# Emits whenever a graph is deleted.
signal graph_deleted(graph: BaseGraphData)

#------------------------------------------
#  Singleton pattern
#------------------------------------------

static var _instance: EventBus = null

static func get_instance() -> EventBus:
	if _instance == null:
		_instance = EventBus.new()
	return _instance

func _init() -> void:
	print("[EventBus] init")