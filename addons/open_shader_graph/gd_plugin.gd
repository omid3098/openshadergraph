@tool
extends EditorPlugin

var dock

func _enter_tree():
	# Load the main interface scene
	var scene = preload("res://addons/open_shader_graph/scenes/scn_open_shader_graph.tscn")
	dock = scene.instantiate()
	
	# Add the dock to the top left panel beside the import tab
	add_control_to_dock(DOCK_SLOT_LEFT_UL, dock)

func _exit_tree():
	# Clean up when the plugin is disabled
	if dock:
		remove_control_from_docks(dock)
		dock = null
