@tool
extends EditorPlugin

var dock

func _enter_tree():
	# Register custom resource types
	print("[DEBUG] Plugin: Registering resource types...")
	add_custom_type(
		"OpenShaderGraphAsset",
		"Resource",
		preload("res://addons/open_shader_graph/scripts/resources/gd_open_shader_graph_asset.gd"),
		EditorInterface.get_editor_theme().get_icon("Resource", "EditorIcons")
	)
	add_custom_type(
		"OpenShaderMainAsset",
		"Resource",
		preload("res://addons/open_shader_graph/scripts/resources/gd_open_shader_main_asset.gd"),
		EditorInterface.get_editor_theme().get_icon("Shader", "EditorIcons")
	)
	add_custom_type(
		"OpenShaderSubgraphAsset",
		"Resource",
		preload("res://addons/open_shader_graph/scripts/resources/gd_open_shader_subgraph_asset.gd"),
		EditorInterface.get_editor_theme().get_icon("GraphNode", "EditorIcons")
	)
	
	# Initialize the NodeFactory with automatic node discovery
	print("[DEBUG] Plugin: Initializing NodeFactory...")
	var NodeFactory = preload("res://addons/open_shader_graph/scripts/core/gd_node_factory.gd")
	NodeFactory._initialize()
	# NodeFactory.debug_print_registry()
	
	# Load the main interface scene
	var scene = preload("res://addons/open_shader_graph/scenes/scn_open_shader_graph.tscn")
	dock = scene.instantiate()
	
	# Add the dock to the top left panel beside the import tab
	add_control_to_dock(DOCK_SLOT_LEFT_UL, dock)

func _exit_tree():
	# Remove custom resource types
	remove_custom_type("OpenShaderGraphAsset")
	remove_custom_type("OpenShaderMainAsset")
	remove_custom_type("OpenShaderSubgraphAsset")
	
	# Clean up when the plugin is disabled
	if dock:
		remove_control_from_docks(dock)
		dock = null
