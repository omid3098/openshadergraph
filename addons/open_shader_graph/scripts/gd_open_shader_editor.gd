@tool
extends Control

class_name OpenShaderEditor

const NodeCreationPopup = preload("res://addons/open_shader_graph/scripts/gd_node_creation_popup.gd")

var graph_edit_path: String = "res://addons/open_shader_graph/scenes/graph_edit.tscn"
var current_graph_edit: GraphEdit
var node_creation_popup: NodeCreationPopup

func _ready():
	print("[DEBUG] OpenShaderEditor Loaded")
	# Create a new graph_edit
	current_graph_edit = load(graph_edit_path).instantiate()
	# listen for the right_clicked signal
	current_graph_edit.right_clicked.connect(_on_graph_edit_right_clicked)
	# add it as a child of the editor
	add_child(current_graph_edit)
	
	# Initialize the node creation popup
	node_creation_popup = NodeCreationPopup.new(self)
	node_creation_popup.node_type_selected.connect(_on_node_type_selected)

func _on_graph_edit_right_clicked(global_mouse_position: Vector2):
	# Show the node creation popup
	node_creation_popup.show_popup(global_mouse_position)

func _on_node_type_selected(node_type: String):
	print("[DEBUG] Node type selected: ", node_type)
	var new_node = NodeFactory.create_node(node_type)
	if new_node:
		current_graph_edit.add_child(new_node)
		# Position the node at the right-click location (convert global to local)
		var local_position = current_graph_edit.get_local_mouse_position()
		new_node.position_offset = local_position
		print("[DEBUG] Node created and added at position: ", local_position)
	else:
		print("[ERROR] Failed to create node: ", node_type)
