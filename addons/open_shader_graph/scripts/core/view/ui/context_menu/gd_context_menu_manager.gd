class_name ContextMenuManager extends Node

var creation_popup: CreationPopup
var node_context_menu: NodeContextMenu
var grouping_context_menu: GroupingContextMenu

func _init() -> void:
	Logger.log("[ContextMenuManager] init")

	creation_popup = CreationPopup.new()
	node_context_menu = NodeContextMenu.new()
	grouping_context_menu = GroupingContextMenu.new()