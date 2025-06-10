@tool
class_name NodeIndexManager extends RefCounted

## Manages node indexing for OpenShaderGraph
## Provides consistent evaluation order for nodes during shader code generation

signal node_index_assigned(node: BaseNode, index: int)

# Node index management for shader code generation
var next_node_index: int = 0
var graph_edit: GraphEdit

func _init(graph: GraphEdit) -> void:
	graph_edit = graph

## Assigns a unique index to a node
func assign_node_index(node: BaseNode) -> int:
	if not node:
		return -1
	
	var assigned_index: int = next_node_index
	node.set_node_index(assigned_index)
	next_node_index += 1
	
	node_index_assigned.emit(node, assigned_index)
	
	if OS.is_debug_build():
		print("[DEBUG] NodeIndexManager: Assigned index ", assigned_index, " to node: ", node.name)
	
	return assigned_index

## Gets the next available index
func get_next_node_index() -> int:
	return next_node_index

## Resets the index counter
func reset_index_counter() -> void:
	next_node_index = 0
	if OS.is_debug_build():
		print("[DEBUG] NodeIndexManager: Index counter reset")

## Gets all nodes sorted by their index (useful for shader code generation)
func get_nodes_by_index() -> Array[BaseNode]:
	var nodes: Array[BaseNode] = []
	
	# Collect all BaseNode children from the graph
	for child in graph_edit.get_children():
		if child is BaseNode:
			nodes.append(child)
	
	# Sort by node index
	nodes.sort_custom(func(a: BaseNode, b: BaseNode) -> bool:
		return a.get_node_index() < b.get_node_index()
	)
	
	return nodes

## Recompacts node indices to remove gaps
func recompact_node_indices() -> void:
	var nodes: Array[BaseNode] = get_nodes_by_index()
	
	# Reassign indices starting from 0
	for i in range(nodes.size()):
		nodes[i].set_node_index(i)
		node_index_assigned.emit(nodes[i], i)
	
	# Update next index counter
	next_node_index = nodes.size()
	
	if OS.is_debug_build():
		print("[DEBUG] NodeIndexManager: Indices recompacted. ", nodes.size(), " nodes re-indexed")

## Handles when a node is added to the graph
func handle_node_added(node: BaseNode) -> void:
	if not node:
		return
	
	# Only assign if not already assigned (index -1 means unassigned)
	if node.get_node_index() == -1:
		assign_node_index(node)

## Handles when a node is removed from the graph
func handle_node_removed(node: BaseNode) -> void:
	if not node:
		return
	
	if OS.is_debug_build():
		print("[DEBUG] NodeIndexManager: Node with index ", node.get_node_index(), " is being removed: ", node.name)
	
	# Note: We could recompact indices here, but for shader generation
	# it might be better to keep stable indices until a full reindex is needed

## Gets debug information about current node indices
func get_debug_info() -> Dictionary:
	var nodes: Array[BaseNode] = get_nodes_by_index()
	var debug_info := {
		"total_nodes": nodes.size(),
		"next_index": next_node_index,
		"node_details": []
	}
	
	for node in nodes:
		debug_info.node_details.append({
			"name": node.name,
			"index": node.get_node_index(),
			"type": node.get_script().get_global_name() if node.get_script() else "no script"
		})
	
	return debug_info

## Prints debug information about current node indices
func debug_node_indices() -> void:
	if not OS.is_debug_build():
		return
	
	var debug_info: Dictionary = get_debug_info()
	print("[DEBUG] NodeIndexManager: Nodes by index:")
	for detail in debug_info.node_details:
		print("  Index ", detail.index, ": ", detail.name, " (", detail.type, ")")
	print("[DEBUG] NodeIndexManager: Next node index will be: ", debug_info.next_index)

## Validates that all nodes have valid indices
func validate_indices() -> bool:
	var nodes: Array[BaseNode] = []
	
	# Collect all BaseNode children
	for child in graph_edit.get_children():
		if child is BaseNode:
			nodes.append(child)
	
	var indices_used: Array[int] = []
	
	# Check for duplicate or invalid indices
	for node in nodes:
		var index: int = node.get_node_index()
		
		# Check for unassigned index
		if index == -1:
			if OS.is_debug_build():
				print("[DEBUG] NodeIndexManager: Validation failed - node has unassigned index: ", node.name)
			return false
		
		# Check for duplicate index
		if index in indices_used:
			if OS.is_debug_build():
				print("[DEBUG] NodeIndexManager: Validation failed - duplicate index ", index, " found")
			return false
		
		indices_used.append(index)
	
	if OS.is_debug_build():
		print("[DEBUG] NodeIndexManager: Index validation passed for ", nodes.size(), " nodes")
	
	return true

## Fixes any invalid indices by recompacting
func fix_invalid_indices() -> void:
	if not validate_indices():
		if OS.is_debug_build():
			print("[DEBUG] NodeIndexManager: Invalid indices detected, recompacting...")
		recompact_node_indices()
	else:
		if OS.is_debug_build():
			print("[DEBUG] NodeIndexManager: All indices are valid")