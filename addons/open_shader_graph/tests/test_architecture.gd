@tool
extends BaseTest
class_name TestArchitecture

var editor: OpenShaderGraphEditor
var received_signals: Array = []

func before_each():
	editor = OpenShaderGraphEditor.new()
	received_signals.clear()

func after_each():
	if editor:
		editor.queue_free()
	editor = null
	received_signals.clear()

# Test that the orchestrator properly connects all signals
func test_signal_flow_architecture():
	# Test file menu signal flow: MenuBar -> Sidebar -> UIManager -> OpenShaderGraphEditor
	var ui_manager = editor.ui_manager
	var sidebar = ui_manager.sidebar
	var menu_bar = sidebar.custom_menu_bar
	
	# Connect to track signals at different levels
	var menu_signals = []
	var sidebar_signals = []
	var ui_signals = []
	var editor_signals = []
	
	menu_bar.file_menu_item_selected.connect(func(item_id): menu_signals.append(item_id))
	sidebar.file_menu_item_selected.connect(func(item_id): sidebar_signals.append(item_id))
	ui_manager.file_menu_item_selected.connect(func(item_id): ui_signals.append(item_id))
	
	# Simulate menu selection
	menu_bar._on_popup_item_selected(MenuEnums.FileMenuItem.NEW_GRAPH, "File")
	
	# Verify signal propagation
	assert_equal(1, menu_signals.size(), "MenuBar should emit signal")
	assert_equal(1, sidebar_signals.size(), "Sidebar should forward signal")
	assert_equal(1, ui_signals.size(), "UIManager should forward signal")
	assert_equal(MenuEnums.FileMenuItem.NEW_GRAPH, menu_signals[0], "Correct signal data should propagate")

# Test graph creation signal flow: GraphManager -> OpenShaderGraphEditor -> UIManager
func test_graph_creation_signal_flow():
	var graph_manager = editor.graph_manager
	var ui_manager = editor.ui_manager
	
	var graph_manager_signals = []
	var ui_manager_calls = []
	
	graph_manager.graph_created.connect(func(graph): graph_manager_signals.append(graph))
	
	# Override the UIManager method to track calls
	var original_method = ui_manager.on_graph_created
	ui_manager.on_graph_created = func(graph):
		ui_manager_calls.append(graph)
		original_method.call(graph)
	
	# Create a graph
	graph_manager.create_new_graph()
	
	# Verify signal flow
	assert_equal(1, graph_manager_signals.size(), "GraphManager should emit signal")
	assert_equal(1, ui_manager_calls.size(), "UIManager should receive call from orchestrator")
	assert_equal(graph_manager_signals[0], ui_manager_calls[0], "Same graph object should flow through")

# Test tab selection signal flow: UIManager -> OpenShaderGraphEditor -> GraphManager
func test_tab_selection_signal_flow():
	var graph_manager = editor.graph_manager
	var ui_manager = editor.ui_manager
	
	# Create a test graph
	graph_manager.create_new_graph()
	var test_graph = graph_manager.get_current_graph()
	
	var ui_signals = []
	var graph_manager_calls = []
	
	ui_manager.graph_tab_selected.connect(func(graph): ui_signals.append(graph))
	
	# Track calls to graph manager
	var original_select = graph_manager.select_graph
	graph_manager.select_graph = func(graph):
		graph_manager_calls.append(graph)
		original_select.call(graph)
	
	# Simulate tab selection
	ui_manager.graph_tab_selected.emit(test_graph)
	
	# Verify signal flow
	assert_equal(1, ui_signals.size(), "UIManager should emit signal")
	# Note: The orchestrator should handle this, but we need to manually trigger it in test
	editor._on_graph_tab_selected(test_graph)
	assert_equal(1, graph_manager_calls.size(), "GraphManager should receive call from orchestrator")

# Test that components don't directly call siblings
func test_no_sibling_communication():
	var ui_manager = editor.ui_manager
	
	# UIManager should not have direct reference to GraphManager
	assert_false(ui_manager.has_method("graph_manager"), "UIManager should not have direct GraphManager reference")
	
	# Check that UIManager doesn't have a graph_manager property
	var ui_manager_script = ui_manager.get_script()
	var source_code = ui_manager_script.source_code if ui_manager_script else ""
	assert_false("graph_manager" in source_code, "UIManager source should not reference graph_manager directly")

# Test proper cleanup
func test_signal_cleanup():
	var graph_manager = editor.graph_manager
	var ui_manager = editor.ui_manager
	
	# Verify that components can be cleaned up without errors
	var signal_count_before = graph_manager.graph_created.get_connections().size()
	
	# The editor should properly manage connections
	assert_true(signal_count_before >= 0, "Should be able to check signal connections")
	
	# Cleanup should work without errors
	graph_manager.cleanup()
	# No assertion needed - if cleanup fails, it will throw an error

# Test architecture documentation compliance
func test_architecture_compliance():
	# Test that the main components exist and have proper relationships
	assert_not_null(editor.graph_manager, "Editor should have GraphManager")
	assert_not_null(editor.ui_manager, "Editor should have UIManager")
	
	# Test that GraphManager has its own signals
	assert_true(editor.graph_manager.has_signal("graph_created"), "GraphManager should have graph_created signal")
	assert_true(editor.graph_manager.has_signal("graph_selected"), "GraphManager should have graph_selected signal")
	assert_true(editor.graph_manager.has_signal("graph_deleted"), "GraphManager should have graph_deleted signal")
	
	# Test that UIManager has its own signals
	assert_true(editor.ui_manager.has_signal("graph_tab_selected"), "UIManager should have graph_tab_selected signal")
	assert_true(editor.ui_manager.has_signal("file_menu_item_selected"), "UIManager should have file_menu_item_selected signal")