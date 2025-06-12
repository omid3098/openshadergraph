@tool
extends EditorPlugin

var dock: Control
var dock_slot: int = DOCK_SLOT_LEFT_UL

func _enter_tree() -> void:
	var OpenShaderGraphEditor = OpenShaderGraphEditor.new()
	dock = OpenShaderGraphEditor.get_main_scene()
	# To create a standalone editor, we only need to add the main scene to the root node of an empty scene
	dock.name = "OpenShaderGraph"
	add_control_to_dock(dock_slot, dock)
	pass

func _exit_tree() -> void:
	# Clean up when the plugin is disabled
	if dock:
		remove_control_from_docks(dock)
		dock = null
