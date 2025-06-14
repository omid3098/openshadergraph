@tool
extends EditorPlugin

var inspector_plugin

func _enter_tree():
	# Add inspector plugin for TestFramework resources
	inspector_plugin = EditorInspectorPlugin.new()
	add_inspector_plugin(inspector_plugin)

func _exit_tree():
	if inspector_plugin:
		remove_inspector_plugin(inspector_plugin)
	remove_custom_type("TestFramework")
