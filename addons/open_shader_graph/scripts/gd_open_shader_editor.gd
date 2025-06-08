@tool
extends Control

class_name OpenShaderEditor

const NodeCreationPopup = preload("res://addons/open_shader_graph/scripts/gd_node_creation_popup.gd")
const PropertiesPanel = preload("res://addons/open_shader_graph/scripts/gd_properties_panel.gd")

var graph_edit_path: String = "res://addons/open_shader_graph/scenes/graph_edit.tscn"
var current_graph_edit: GraphEdit
var node_creation_popup: NodeCreationPopup
var properties_panel: PropertiesPanel

# Constants for layout
const PROPERTIES_PANEL_RATIO = 0.25 # 1/4 of the total width

func _ready():
	print("[DEBUG] OpenShaderEditor Loaded")
	
	# Create the main layout
	_setup_layout()
	
	# Initialize the node creation popup
	node_creation_popup = NodeCreationPopup.new(self)
	node_creation_popup.node_type_selected.connect(_on_node_type_selected)

func _setup_layout():
	# Create a HSplitContainer for the main layout
	var hsplit = HSplitContainer.new()
	add_child(hsplit)
	hsplit.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	
	# Create properties panel on the left
	properties_panel = PropertiesPanel.new()
	properties_panel.custom_minimum_size.x = 200 # Minimum width to ensure usability
	properties_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	properties_panel.size_flags_stretch_ratio = PROPERTIES_PANEL_RATIO
	hsplit.add_child(properties_panel)
	
	# Create a container for the graph edit (to add top margin)
	var graph_container = Control.new()
	graph_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	graph_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	graph_container.size_flags_stretch_ratio = 1.0 - PROPERTIES_PANEL_RATIO
	hsplit.add_child(graph_container)
	
	# Create a new graph_edit
	current_graph_edit = load(graph_edit_path).instantiate()
	current_graph_edit.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	
	# Listen for signals
	current_graph_edit.right_clicked.connect(_on_graph_edit_right_clicked)
	current_graph_edit.shader_node_selected.connect(_on_node_selected)
	current_graph_edit.nodes_connected.connect(_on_nodes_connected)
	current_graph_edit.nodes_disconnected.connect(_on_nodes_disconnected)
	
	# Add graph edit to its container
	graph_container.add_child(current_graph_edit)

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

func _on_node_selected(node: BaseNode):
	print("[DEBUG] Node selected: ", node.title if node else "None")
	if properties_panel:
		properties_panel.set_selected_node(node)

func _on_nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int):
	print("[DEBUG] Nodes connected: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	# Here we could update UI or trigger other events when nodes are connected

func _on_nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int):
	print("[DEBUG] Nodes disconnected: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	# Here we could update UI or trigger other events when nodes are disconnected

# Development helper function to refresh node registry
func refresh_node_registry():
	print("[DEBUG] Refreshing node registry...")
	NodeFactory.refresh_registry()
	NodeFactory.debug_print_registry()

# Development helper function to debug connections
func debug_connections():
	if current_graph_edit:
		var connections = current_graph_edit.get_connections()
		print("[DEBUG] Current connections: ", connections)
		return connections
	return []
