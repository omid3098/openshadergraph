@tool
extends GraphEdit

signal right_clicked(global_mouse_position)
signal shader_node_selected(node)
signal nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int)
signal nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int)

# Connection tracking
var node_connections: Array[Dictionary] = []

# Node index management for shader code generation
var next_node_index: int = 0

# We use the _gui_input function to detect mouse clicks on this specific node.
func _gui_input(event: InputEvent) -> void:
	# Check for a right mouse button click.
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.is_pressed():
		# Emit the signal, providing the current global mouse position.
		# The main plugin will listen for this.
		emit_signal("right_clicked", get_global_mouse_position())
		accept_event()

# When a child node is added, connect to its selection signal and assign index
func _on_child_entered_tree(node):
	if node is BaseNode:
		node.node_selection_changed.connect(_on_node_selection_changed)
		# Assign a unique index to the node
		node.set_node_index(next_node_index)
		next_node_index += 1
		print("[DEBUG] Assigned index ", node.get_node_index(), " to node: ", node.name)

# When a child node is removed, we may need to recompact indices (optional)
func _on_child_exiting_tree(node):
	if node is BaseNode:
		print("[DEBUG] Node with index ", node.get_node_index(), " is being removed: ", node.name)
		# Note: We could recompact indices here, but for shader generation
		# it might be better to keep stable indices until a full reindex is needed

func _on_node_selection_changed(selected_node: BaseNode):
	emit_signal("shader_node_selected", selected_node)

func _ready():
	# Connect to child management signals
	child_entered_tree.connect(_on_child_entered_tree)
	child_exiting_tree.connect(_on_child_exiting_tree)
	
	# Connect to GraphEdit's connection signals
	connection_request.connect(_on_connection_request)
	disconnection_request.connect(_on_disconnection_request)
	
	# Enable right-click on background to delete connections
	delete_nodes_request.connect(_on_delete_nodes_request)
	
	print("[DEBUG] GraphEdit: Connection signals connected and node index management initialized")

func _on_connection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int):
	print("[DEBUG] Connection request: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	
	# Validate the connection
	if _is_valid_connection(from_node, from_port, to_node, to_port):
		# Create the connection visually
		connect_node(from_node, from_port, to_node, to_port)
		
		# Track the connection
		var connection_data = {
			"from_node": str(from_node),
			"from_port": from_port,
			"to_node": str(to_node),
			"to_port": to_port
		}
		node_connections.append(connection_data)
		
		# Update the receiving node's input
		_update_node_input(to_node, to_port, from_node, from_port)
		
		# Emit signal for external listeners
		emit_signal("nodes_connected", str(from_node), from_port, str(to_node), to_port)
		
		print("[DEBUG] Connection created successfully")
	else:
		print("[DEBUG] Connection rejected - validation failed")

func _on_disconnection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int):
	print("[DEBUG] Disconnection request: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	
	# Remove the connection visually
	disconnect_node(from_node, from_port, to_node, to_port)
	
	# Remove from tracking
	var connection_found = false
	for i in range(node_connections.size() - 1, -1, -1):
		var conn = node_connections[i]
		if conn.from_node == str(from_node) and conn.from_port == from_port and conn.to_node == str(to_node) and conn.to_port == to_port:
			node_connections.remove_at(i)
			connection_found = true
			break
	
	# Reset the receiving node's input to default
	_reset_node_input(to_node, to_port)
	
	# Emit signal for external listeners
	emit_signal("nodes_disconnected", str(from_node), from_port, str(to_node), to_port)
	
	print("[DEBUG] Connection removed successfully")

func _on_delete_nodes_request(nodes: Array):
	print("[DEBUG] Delete nodes request: ", nodes)
	# Handle node deletion - disconnect all connections to/from deleted nodes
	for node_name in nodes:
		_disconnect_all_node_connections(node_name)

func _is_valid_connection(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> bool:
	# Don't allow self-connections
	if from_node == to_node:
		print("[DEBUG] Connection validation failed: self-connection not allowed")
		return false
	
	# Get the actual node objects
	var from_node_obj = get_node_or_null(NodePath(from_node))
	var to_node_obj = get_node_or_null(NodePath(to_node))
	
	if not from_node_obj or not to_node_obj:
		print("[DEBUG] Connection validation failed: node not found")
		return false
	
	# Check if both nodes inherit from BaseNode
	if not (from_node_obj is BaseNode and to_node_obj is BaseNode):
		print("[DEBUG] Connection validation failed: not BaseNode instances")
		return false
	
	# Check if target port already has a connection (only one input per port)
	for conn in node_connections:
		if conn.to_node == str(to_node) and conn.to_port == to_port:
			print("[DEBUG] Connection validation failed: target port already connected")
			return false
	
	# Type validation would go here - for now, allow all connections
	# TODO: Add pin type compatibility checking
	
	return true

func _update_node_input(to_node: StringName, to_port: int, from_node: StringName, from_port: int):
	var to_node_obj = get_node_or_null(NodePath(to_node))
	var from_node_obj = get_node_or_null(NodePath(from_node))
	
	if not to_node_obj or not from_node_obj:
		return
	
	# Update input based on node type and port
	if to_node_obj is BaseMathNode:
		var output_value = _get_node_output_value(from_node_obj, from_port)
		if to_port == 0: # Input A
			to_node_obj.set_input_a(output_value)
		elif to_port == 1: # Input B
			to_node_obj.set_input_b(output_value)
	
	print("[DEBUG] Updated node input: ", to_node, " port ", to_port, " with value from ", from_node)

func _reset_node_input(to_node: StringName, to_port: int):
	var to_node_obj = get_node_or_null(NodePath(to_node))
	
	if not to_node_obj:
		return
	
	# Reset input to default value based on node type and port
	if to_node_obj is BaseMathNode:
		if to_port == 0: # Input A
			to_node_obj.set_input_a(to_node_obj.get_default_input_a())
		elif to_port == 1: # Input B
			to_node_obj.set_input_b(to_node_obj.get_default_input_b())
	
	print("[DEBUG] Reset node input: ", to_node, " port ", to_port, " to default")

func _get_node_output_value(node: BaseNode, port: int) -> float:
	# Get output value from a node based on its type
	if node is BaseMathNode:
		return node.get_output_value()
	elif node is BaseConstantNode:
		var value = node.get_output_value()
		if value is float:
			return value
		elif value is int:
			return float(value)
		else:
			return 0.0
	
	return 0.0

func _disconnect_all_node_connections(node_name: String):
	var connections_to_remove = []
	
	# Find all connections involving this node
	for i in range(node_connections.size()):
		var conn = node_connections[i]
		if conn.from_node == node_name or conn.to_node == node_name:
			connections_to_remove.append(i)
			
			# Remove visual connection
			disconnect_node(conn.from_node, conn.from_port, conn.to_node, conn.to_port)
			
			# Reset input if this was an input connection
			if conn.to_node != node_name:
				_reset_node_input(conn.to_node, conn.to_port)
	
	# Remove connections from tracking (reverse order to maintain indices)
	connections_to_remove.reverse()
	for i in connections_to_remove:
		node_connections.remove_at(i)
	
	print("[DEBUG] Disconnected all connections for node: ", node_name)

# Public API for external access
func get_connections() -> Array[Dictionary]:
	return node_connections.duplicate()

# Get all nodes sorted by their index (useful for shader code generation)
func get_nodes_by_index() -> Array[BaseNode]:
	var nodes: Array[BaseNode] = []
	
	# Collect all BaseNode children
	for child in get_children():
		if child is BaseNode:
			nodes.append(child)
	
	# Sort by index
	nodes.sort_custom(func(a, b): return a.get_node_index() < b.get_node_index())
	
	return nodes

# Recompact node indices (removes gaps in numbering)
func recompact_node_indices():
	var nodes = get_nodes_by_index()
	next_node_index = 0
	
	for node in nodes:
		node.set_node_index(next_node_index)
		next_node_index += 1
		print("[DEBUG] Recompacted node index: ", node.get_node_index(), " for node: ", node.name)
	
	print("[DEBUG] Node indices recompacted. Next index will be: ", next_node_index)

# Get the current next index (useful for external components)
func get_next_node_index() -> int:
	return next_node_index