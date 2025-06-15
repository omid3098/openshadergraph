@tool
extends BaseTest
class_name TestGraphManager

var graph_manager: GraphManager
var event_bus: EventBus
var received_signals: Array = []

func before_all():
	# Get EventBus instance to connect to signals
	event_bus = EventBus.get_instance()

func before_each():
	graph_manager = GraphManager.new()
	received_signals.clear()
	
	# Ensure clean state - disconnect all connections first
	_disconnect_all_signals()
	
	# Connect to signals to track them
	event_bus.graph_created.connect(_on_graph_created)
	event_bus.graph_selected.connect(_on_graph_selected)
	event_bus.graph_deleted.connect(_on_graph_deleted)

func after_each():
	# Clean up signal connections
	_disconnect_all_signals()
	if graph_manager:
		graph_manager.cleanup()
	graph_manager = null
	received_signals.clear()

# Helper function to ensure all signals are properly disconnected
func _disconnect_all_signals():
	# Force disconnect ALL connections from EventBus to ensure clean state
	event_bus.disconnect_all_signals()

# Signal handlers for testing
func _on_graph_created(graph: BaseGraphData):
	received_signals.append({"type": "created", "graph": graph})

func _on_graph_selected(graph: BaseGraphData):
	received_signals.append({"type": "selected", "graph": graph})

func _on_graph_deleted(graph: BaseGraphData):
	received_signals.append({"type": "deleted", "graph": graph})

# Test initial state
func test_initial_state():
	assert_not_null(graph_manager, "GraphManager should be created")
	assert_equal(0, graph_manager.get_all_graphs().size(), "Should start with no graphs")
	assert_null(graph_manager.get_current_graph(), "Should start with no current graph")

# Test create new graph
func test_create_new_graph():
	graph_manager.create_new_graph()
	
	var all_graphs = graph_manager.get_all_graphs()
	var current_graph = graph_manager.get_current_graph()
	
	assert_equal(1, all_graphs.size(), "Should have one graph after creation")
	assert_not_null(current_graph, "Should have a current graph after creation")
	assert_equal("New Graph", current_graph.name, "Default name should be 'New Graph'")
	assert_equal(BaseGraphData.GraphType.SHADER_GRAPH, current_graph.graph_type, "Default type should be SHADER_GRAPH")

func test_create_new_graph_emits_signal():
	graph_manager.create_new_graph()
	
	assert_equal(1, received_signals.size(), "Should emit one signal")
	assert_equal("created", received_signals[0]["type"], "Should emit graph_created signal")
	assert_equal("New Graph", received_signals[0]["graph"].name, "Signal should contain the created graph")

# Test multiple graph creation
func test_create_multiple_graphs():
	graph_manager.create_new_graph()
	graph_manager.create_new_graph()
	graph_manager.create_new_graph()
	
	var all_graphs = graph_manager.get_all_graphs()
	assert_equal(3, all_graphs.size(), "Should have three graphs after creation")

func test_current_graph_updates_on_creation():
	graph_manager.create_new_graph()
	var first_graph = graph_manager.get_current_graph()
	
	graph_manager.create_new_graph()
	var second_graph = graph_manager.get_current_graph()
	
	assert_not_equal(first_graph, second_graph, "Current graph should update on new creation")
	assert_equal("New Graph", second_graph.name, "Second graph should also have default name")

# Test graph selection
func test_select_graph():
	graph_manager.create_new_graph()
	graph_manager.create_new_graph()
	
	var all_graphs = graph_manager.get_all_graphs()
	var first_graph = all_graphs[0]
	var second_graph = all_graphs[1]
	
	# Current should be second graph (last created)
	assert_equal(second_graph, graph_manager.get_current_graph(), "Current should be last created")
	
	# Select first graph
	graph_manager.select_graph(first_graph)
	assert_equal(first_graph, graph_manager.get_current_graph(), "Current should be selected graph")

func test_select_graph_emits_signal():
	graph_manager.create_new_graph()
	var graph = graph_manager.get_current_graph()
	received_signals.clear() # Clear creation signal
	
	graph_manager.select_graph(graph)
	
	assert_equal(1, received_signals.size(), "Should emit one signal")
	assert_equal("selected", received_signals[0]["type"], "Should emit graph_selected signal")
	assert_equal(graph, received_signals[0]["graph"], "Signal should contain the selected graph")

# Test graph deletion
func test_delete_graph():
	graph_manager.create_new_graph()
	graph_manager.create_new_graph()
	
	var all_graphs = graph_manager.get_all_graphs()
	var graph_to_delete = all_graphs[0]
	
	graph_manager.delete_graph(graph_to_delete)
	
	var remaining_graphs = graph_manager.get_all_graphs()
	assert_equal(1, remaining_graphs.size(), "Should have one graph remaining after deletion")
	assert_not_contains(remaining_graphs, graph_to_delete, "Deleted graph should not be in remaining graphs")

func test_delete_graph_emits_signal():
	graph_manager.create_new_graph()
	var graph = graph_manager.get_current_graph()
	received_signals.clear() # Clear creation signal
	
	graph_manager.delete_graph(graph)
	
	assert_equal(1, received_signals.size(), "Should emit one signal")
	assert_equal("deleted", received_signals[0]["type"], "Should emit graph_deleted signal")
	assert_equal(graph, received_signals[0]["graph"], "Signal should contain the deleted graph")

func test_delete_graph_auto_selects_remaining():
	graph_manager.create_new_graph()
	graph_manager.create_new_graph()
	
	var all_graphs = graph_manager.get_all_graphs()
	var first_graph = all_graphs[0]
	var second_graph = all_graphs[1]
	
	# Current should be second graph
	assert_equal(second_graph, graph_manager.get_current_graph(), "Current should be second graph")
	
	# Delete current graph
	graph_manager.delete_graph(second_graph)
	
	# Should auto-select first graph
	assert_equal(first_graph, graph_manager.get_current_graph(), "Should auto-select remaining graph")

func test_delete_all_graphs():
	graph_manager.create_new_graph()
	var graph = graph_manager.get_current_graph()
	
	graph_manager.delete_graph(graph)
	
	assert_equal(0, graph_manager.get_all_graphs().size(), "Should have no graphs after deleting all")
	# Note: current_graph might still reference the deleted graph until explicitly set to null

func test_delete_nonexistent_graph():
	graph_manager.create_new_graph()
	var existing_graph = graph_manager.get_current_graph()
	
	# Create a graph that's not in the manager
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var external_graph = BaseGraphData.new("External", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	
	graph_manager.delete_graph(external_graph)
	
	# Should still have the original graph
	assert_equal(1, graph_manager.get_all_graphs().size(), "Should still have original graph")
	assert_equal(existing_graph, graph_manager.get_current_graph(), "Current graph should be unchanged")

# Test external graph_selected signal handling
func test_external_graph_selected_signal():
	graph_manager.create_new_graph()
	var graph = graph_manager.get_current_graph()
	
	# Create another graph manager instance to simulate external selection
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var external_graph = BaseGraphData.new("External Graph", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	
	# Simulate external graph selection by emitting signal directly
	event_bus.graph_selected.emit(external_graph)
	
	# The graph_manager should update its current_graph
	assert_equal(external_graph, graph_manager.get_current_graph(), "Current graph should be updated by external signal")

# Test get_all_graphs returns copy vs reference
func test_get_all_graphs_array():
	graph_manager.create_new_graph()
	graph_manager.create_new_graph()
	
	var graphs1 = graph_manager.get_all_graphs()
	var graphs2 = graph_manager.get_all_graphs()
	
	assert_equal(graphs1.size(), graphs2.size(), "Both calls should return same size")
	# In GDScript, array return is by reference, so they should be the same
	assert_equal(graphs1, graphs2, "Should return reference to same array")

# Test error handling
func test_select_null_graph():
	graph_manager.create_new_graph()
	var original_current = graph_manager.get_current_graph()
	
	graph_manager.select_graph(null)
	
	# This should still work (null is a valid value)
	assert_null(graph_manager.get_current_graph(), "Current graph should be null after selecting null")

func test_delete_null_graph():
	graph_manager.create_new_graph()
	var original_count = graph_manager.get_all_graphs().size()
	
	graph_manager.delete_graph(null)
	
	# Should not crash and should not affect existing graphs
	assert_equal(original_count, graph_manager.get_all_graphs().size(), "Graph count should be unchanged")

# Test signal sequence for complex operations
func test_create_select_delete_signal_sequence():
	# Create graph
	graph_manager.create_new_graph()
	var graph1 = graph_manager.get_current_graph()
	
	# Create second graph
	graph_manager.create_new_graph()
	var graph2 = graph_manager.get_current_graph()
	
	# Select first graph
	graph_manager.select_graph(graph1)
	
	# Delete first graph
	graph_manager.delete_graph(graph1)
	
	# Should have signals in order: created, created, selected, deleted, selected (auto-select)
	var signal_types = []
	for signal_data in received_signals:
		signal_types.append(signal_data["type"])
	
	assert_contains(signal_types, "created", "Should have created signals")
	assert_contains(signal_types, "selected", "Should have selected signals")
	assert_contains(signal_types, "deleted", "Should have deleted signal")
	
	# Last signal should be selection of remaining graph
	assert_equal("selected", signal_types[-1], "Last signal should be auto-selection")

# Helper function for assert_not_contains (if not in base test)
func assert_not_contains(container, item, message: String = ""):
	var contains = false
	if container is Array:
		contains = item in container
	elif container is String:
		contains = container.find(str(item)) != -1
	elif container is Dictionary:
		contains = container.has(item)
	
	if contains:
		var error_msg = "Expected container to NOT contain '%s'" % str(item)
		if message != "":
			error_msg += ": " + message
		_assertion_failures.append(error_msg)