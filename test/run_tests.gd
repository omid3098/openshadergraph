extends SceneTree

# Simple test runner for OpenShaderGraph unit tests
# This script can be used to run tests programmatically

func _init():
	print("Starting OpenShaderGraph Unit Tests...")
	
	# Load and run GUT
	var gut_scene: PackedScene = preload("res://addons/gut/gui/GutControl.tscn")
	var gut_instance: Control = gut_scene.instantiate()
	
	# Configure GUT to load config file
	gut_instance.load_config_file("res://.gutconfig.json")
	
	# Add to scene
	get_root().add_child(gut_instance)
	
	print("GUT test runner initialized with configuration file")
	print("Tests will run automatically...")

func _notification(what):
	if what == Node.NOTIFICATION_WM_CLOSE_REQUEST:
		print("Test runner closing...")
		quit()