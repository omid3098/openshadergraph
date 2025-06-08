@tool
class_name NodeFactory
extends RefCounted

# Node registry organized by categories
static var _node_registry = {
	"Input": {
		"Constant": "res://addons/open_shader_graph/scripts/nodes/gd_constant.gd",
		"Float": "res://addons/open_shader_graph/scripts/nodes/gd_float.gd"
	},
	"Math": {
		"Add": "res://addons/open_shader_graph/scripts/nodes/gd_add.gd",
		"Multiply": "res://addons/open_shader_graph/scripts/nodes/gd_multiply.gd"
	}
}

# Get all available categories
static func get_categories() -> Array:
	return _node_registry.keys()

# Get all nodes in a specific category
static func get_nodes_in_category(category: String) -> Array:
	if _node_registry.has(category):
		return _node_registry[category].keys()
	return []

# Get all nodes flattened for search
static func get_all_nodes() -> Dictionary:
	var all_nodes = {}
	for category in _node_registry:
		for node_name in _node_registry[category]:
			all_nodes[node_name] = {
				"category": category,
				"script_path": _node_registry[category][node_name]
			}
	return all_nodes

# Create a node instance
static func create_node(node_name: String) -> BaseNode:
	var all_nodes = get_all_nodes()
	if not all_nodes.has(node_name):
		print("[ERROR] Unknown node type: ", node_name)
		return null
	
	var node_info = all_nodes[node_name]
	var script_path = node_info.script_path
	
	# Load the script
	var script = load(script_path)
	if not script:
		print("[ERROR] Failed to load script: ", script_path)
		return null
	
	# Create node instance
	var node = BaseNode.new()
	node.set_script(script)
	
	return node

# Register a new node type (for future extensibility)
static func register_node(category: String, node_name: String, script_path: String):
	if not _node_registry.has(category):
		_node_registry[category] = {}
	_node_registry[category][node_name] = script_path