@tool
extends EditorInspectorPlugin

func _can_handle(object):
	return object is TestFramework

func _parse_begin(object):
	if object is TestFramework:
		var test_framework = object as TestFramework
		var button = Button.new()
		button.text = "Run All Tests"
		button.icon = EditorInterface.get_editor_theme().get_icon("Play", "EditorIcons")
		
		button.pressed.connect(_on_run_tests_pressed.bind(test_framework))
		
		add_custom_control(button)

func _on_run_tests_pressed(test_framework: TestFramework):
	print("Running tests from inspector button...")
	
	# Execute the tests (automatic discovery will happen if needed)
	test_framework.execute_all_tests()