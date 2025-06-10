@tool
class_name ConnectionManager extends RefCounted

## Manages node connections for OpenShaderGraph
## Handles connection validation, tracking, and node input/output updates

signal nodes_connected(from_node: String, from_port: int, to_node: String, to_port: int)
signal nodes_disconnected(from_node: String, from_port: int, to_node: String, to_port: int)

# Connection tracking
var node_connections: Array[Dictionary] = []
var graph_edit: GraphEdit

func _init(graph: GraphEdit) -> void:
	graph_edit = graph

## Handles connection requests with validation
func handle_connection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> bool:
	if OS.is_debug_build():
		print("[DEBUG] ConnectionManager: Connection request: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	
	# Validate the connection
	if not _is_valid_connection(from_node, from_port, to_node, to_port):
		if OS.is_debug_build():
			print("[DEBUG] ConnectionManager: Connection rejected - validation failed")
		return false
	
	# Create the connection visually
	graph_edit.connect_node(from_node, from_port, to_node, to_port)
	
	# Track the connection
	var connection_data := {
		"from_node": str(from_node),
		"from_port": from_port,
		"to_node": str(to_node),
		"to_port": to_port
	}
	node_connections.append(connection_data)
	
	# Update the receiving node's input
	_update_node_input(to_node, to_port, from_node, from_port)
	
	# Emit signal for external listeners
	nodes_connected.emit(str(from_node), from_port, str(to_node), to_port)
	
	if OS.is_debug_build():
		print("[DEBUG] ConnectionManager: Connection created successfully")
	
	return true

## Handles disconnection requests
func handle_disconnection_request(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> bool:
	if OS.is_debug_build():
		print("[DEBUG] ConnectionManager: Disconnection request: ", from_node, ":", from_port, " -> ", to_node, ":", to_port)
	
	# Remove the connection visually
	graph_edit.disconnect_node(from_node, from_port, to_node, to_port)
	
	# Remove from tracking
	var connection_found := false
	for i in range(node_connections.size() - 1, -1, -1):
		var conn := node_connections[i]
		if conn.from_node == str(from_node) and conn.from_port == from_port and conn.to_node == str(to_node) and conn.to_port == to_port:
			node_connections.remove_at(i)
			connection_found = true
			break
	
	# Reset the receiving node's input to default
	_reset_node_input(to_node, to_port)
	
	# Emit signal for external listeners
	nodes_disconnected.emit(str(from_node), from_port, str(to_node), to_port)
	
	if OS.is_debug_build():
		print("[DEBUG] ConnectionManager: Connection removed successfully")
	
	return connection_found

## Disconnects all connections to/from a specific node
func disconnect_all_node_connections(node_name: String) -> void:
	var connections_to_remove: Array[Dictionary] = []
	
	# Find all connections involving this node
	for conn in node_connections:
		if conn.from_node == node_name or conn.to_node == node_name:
			connections_to_remove.append(conn)
	
	# Remove each connection
	for conn in connections_to_remove:
		handle_disconnection_request(conn.from_node, conn.from_port, conn.to_node, conn.to_port)

## Gets all current connections
func get_connections() -> Array[Dictionary]:
	return node_connections.duplicate()

## Clears all connections
func clear_connections() -> void:
	node_connections.clear()

## Loads connections from data
func load_connections(connections_data: Array) -> void:
	for connection_data in connections_data:
		var from_parts: PackedStringArray = connection_data.from.split(":")
		var to_parts: PackedStringArray = connection_data.to.split(":")
		
		if from_parts.size() == 2 and to_parts.size() == 2:
			var from_node: String = from_parts[0]
			var from_port: int = from_parts[1].to_int()
			var to_node: String = to_parts[0]
			var to_port: int = to_parts[1].to_int()
			
			# Create visual connection
			if graph_edit.has_node(NodePath(from_node)) and graph_edit.has_node(NodePath(to_node)):
				graph_edit.connect_node(from_node, from_port, to_node, to_port)
				
				# Update tracking
				var connection_tracking: Dictionary = {
					"from_node": from_node,
					"from_port": from_port,
					"to_node": to_node,
					"to_port": to_port
				}
				node_connections.append(connection_tracking)
				
				# Update receiving node input
				_update_node_input(to_node, to_port, from_node, from_port)

## Validates if a connection is allowed
func _is_valid_connection(from_node: StringName, from_port: int, to_node: StringName, to_port: int) -> bool:
	# Don't allow self-connections
	if from_node == to_node:
		if OS.is_debug_build():
			print("[DEBUG] ConnectionManager: Connection validation failed: self-connection not allowed")
		return false
	
	# Get the actual node objects
	var from_node_obj := graph_edit.get_node_or_null(NodePath(from_node))
	var to_node_obj := graph_edit.get_node_or_null(NodePath(to_node))
	
	if not from_node_obj or not to_node_obj:
		if OS.is_debug_build():
			print("[DEBUG] ConnectionManager: Connection validation failed: node not found")
		return false
	
	# Check if both nodes inherit from BaseNode
	if not (from_node_obj is BaseNode and to_node_obj is BaseNode):
		if OS.is_debug_build():
			print("[DEBUG] ConnectionManager: Connection validation failed: not BaseNode instances")
		return false
	
	# Check if target port already has a connection (only one input per port)
	for conn in node_connections:
		if conn.to_node == str(to_node) and conn.to_port == to_port:
			if OS.is_debug_build():
				print("[DEBUG] ConnectionManager: Connection validation failed: target port already connected")
			return false
	
	# Type validation would go here - for now, allow all connections
	# TODO: Add pin type compatibility checking
	
	return true

## Updates a node's input when a connection is made
func _update_node_input(to_node: StringName, to_port: int, from_node: StringName, from_port: int) -> void:
	var to_node_obj := graph_edit.get_node_or_null(NodePath(to_node))
	var from_node_obj := graph_edit.get_node_or_null(NodePath(from_node))
	
	if not to_node_obj or not from_node_obj:
		return
	
	# Update input based on node type and port
	if to_node_obj is BaseMathNode:
		var output_value: Variant = _get_node_output_value(from_node_obj, from_port)
		
		# Convert value to float if needed (BaseMathNode expects float inputs)
		var float_value: float = 0.0
		if output_value is float:
			float_value = output_value
		elif output_value is int:
			float_value = float(output_value)
		elif output_value is bool:
			float_value = 1.0 if output_value else 0.0
		else:
			if OS.is_debug_build():
				print("[DEBUG] ConnectionManager: Warning - unexpected value type, using 0.0")
			float_value = 0.0
		
		if to_port == 0: # Input A
			to_node_obj.set_input_a(float_value)
		elif to_port == 1: # Input B
			to_node_obj.set_input_b(float_value)
	
	if OS.is_debug_build():
		print("[DEBUG] ConnectionManager: Updated node input: ", to_node, " port ", to_port, " with value from ", from_node)

## Resets a node's input to default when disconnected
func _reset_node_input(to_node: StringName, to_port: int) -> void:
	var to_node_obj := graph_edit.get_node_or_null(NodePath(to_node))
	
	if not to_node_obj:
		return
	
	# Reset input to default value based on node type and port
	if to_node_obj is BaseMathNode:
		if to_port == 0: # Input A
			to_node_obj.set_input_a(to_node_obj.get_default_input_a())
		elif to_port == 1: # Input B
			to_node_obj.set_input_b(to_node_obj.get_default_input_b())
	
	if OS.is_debug_build():
		print("[DEBUG] ConnectionManager: Reset node input: ", to_node, " port ", to_port, " to default")

## Gets the output value from a node at a specific port
func _get_node_output_value(node: BaseNode, _port: int) -> Variant:
	# Get output value based on node type
	# Note: _port parameter currently unused as most nodes have single outputs
	if node is BaseConstantNode:
		return node.get_output_value()
	elif node is BaseMathNode:
		return node.get_output_value()
	else:
		if OS.is_debug_build():
			print("[DEBUG] ConnectionManager: Unknown node type: ", node.get_class(), " - returning 0.0")
		return 0.0