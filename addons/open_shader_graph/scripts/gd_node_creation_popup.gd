@tool
extends RefCounted

class_name NodeCreationPopup

# Signal emitted when a node type is selected
signal node_type_selected(node_type: String)

# Available node types and their IDs
var node_types = {
	0: "Constant",
	1: "Float",
	2: "Int",
	3: "Bool",
	4: "Vector2"
}

# Reference to the parent node to add the popup as child
var parent_node: Node

func _init(parent: Node):
	parent_node = parent

func show_popup(global_position: Vector2):
	var popup = PopupMenu.new()
	popup.position = global_position
	
	# Add items to the popup menu
	for id in node_types.keys():
		popup.add_item(node_types[id], id)
	
	# Connect to the id_pressed signal
	popup.id_pressed.connect(_on_popup_item_selected)
	
	# Add popup to parent and show it
	parent_node.add_child(popup)
	popup.popup()

func _on_popup_item_selected(id: int):
	var item_name = node_types.get(id, "Unknown")
	print("[DEBUG] Popup item clicked: ", item_name)
	
	# Emit signal with the selected node type
	node_type_selected.emit(item_name)