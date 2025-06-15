@tool
extends BaseTest
class_name TestEventBus

var event_bus: EventBus
var received_signals: Array = []

func before_all():
	# Get EventBus singleton instance
	event_bus = EventBus.get_instance()

func before_each():
	received_signals.clear()
	
	# Ensure clean state - disconnect all connections first
	_disconnect_all_signals()
	
	# Connect to all signals for testing
	event_bus.file_menu_item_selected.connect(_on_file_menu_item_selected)
	event_bus.graph_created.connect(_on_graph_created)
	event_bus.graph_selected.connect(_on_graph_selected)
	event_bus.graph_deleted.connect(_on_graph_deleted)

func after_each():
	# Clean up signal connections
	_disconnect_all_signals()
	received_signals.clear()

# Helper function to ensure all signals are properly disconnected
func _disconnect_all_signals():
	# Force disconnect ALL connections from EventBus to ensure clean state
	event_bus.disconnect_all_signals()

# Signal handlers for testing
func _on_file_menu_item_selected(item_id: int):
	received_signals.append({"type": "file_menu", "item_id": item_id})

func _on_graph_created(graph: BaseGraphData):
	received_signals.append({"type": "graph_created", "graph": graph})

func _on_graph_selected(graph: BaseGraphData):
	received_signals.append({"type": "graph_selected", "graph": graph})

func _on_graph_deleted(graph: BaseGraphData):
	received_signals.append({"type": "graph_deleted", "graph": graph})

# Test singleton behavior
func test_singleton_instance():
	var instance1 = EventBus.get_instance()
	var instance2 = EventBus.get_instance()
	
	assert_not_null(instance1, "First instance should not be null")
	assert_not_null(instance2, "Second instance should not be null")
	assert_equal(instance1, instance2, "Both instances should be the same (singleton)")

func test_singleton_is_event_bus():
	var instance = EventBus.get_instance()
	assert_type(instance, TYPE_OBJECT, "Instance should be an object")
	# Note: In Godot 4, we can't easily check exact class type, but we can verify it's our EventBus
	assert_not_null(instance, "Instance should be EventBus")

# Test signal emissions
func test_file_menu_item_selected_signal():
	var test_item_id = 42
	
	event_bus.file_menu_item_selected.emit(test_item_id)
	
	assert_equal(1, received_signals.size(), "Should receive one signal")
	assert_equal("file_menu", received_signals[0]["type"], "Should be file menu signal")
	assert_equal(test_item_id, received_signals[0]["item_id"], "Item ID should match")

func test_graph_created_signal():
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var test_graph = BaseGraphData.new("Test Graph", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	
	event_bus.graph_created.emit(test_graph)
	
	assert_equal(1, received_signals.size(), "Should receive one signal")
	assert_equal("graph_created", received_signals[0]["type"], "Should be graph created signal")
	assert_equal(test_graph, received_signals[0]["graph"], "Graph should match")

func test_graph_selected_signal():
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var test_graph = BaseGraphData.new("Selected Graph", BaseGraphData.GraphType.GROUP_GRAPH, empty_nodes, empty_connections)
	
	event_bus.graph_selected.emit(test_graph)
	
	assert_equal(1, received_signals.size(), "Should receive one signal")
	assert_equal("graph_selected", received_signals[0]["type"], "Should be graph selected signal")
	assert_equal(test_graph, received_signals[0]["graph"], "Graph should match")

func test_graph_deleted_signal():
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var test_graph = BaseGraphData.new("Deleted Graph", BaseGraphData.GraphType.LOCAL_SUBGRAPH, empty_nodes, empty_connections)
	
	event_bus.graph_deleted.emit(test_graph)
	
	assert_equal(1, received_signals.size(), "Should receive one signal")
	assert_equal("graph_deleted", received_signals[0]["type"], "Should be graph deleted signal")
	assert_equal(test_graph, received_signals[0]["graph"], "Graph should match")

# Test multiple signals
func test_multiple_signals():
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var graph1 = BaseGraphData.new("Graph 1", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	var graph2 = BaseGraphData.new("Graph 2", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	
	event_bus.graph_created.emit(graph1)
	event_bus.graph_selected.emit(graph1)
	event_bus.graph_created.emit(graph2)
	event_bus.graph_selected.emit(graph2)
	
	assert_equal(4, received_signals.size(), "Should receive four signals")
	assert_equal("graph_created", received_signals[0]["type"], "First should be creation")
	assert_equal("graph_selected", received_signals[1]["type"], "Second should be selection")
	assert_equal("graph_created", received_signals[2]["type"], "Third should be creation")
	assert_equal("graph_selected", received_signals[3]["type"], "Fourth should be selection")

# Test signal with different data types
func test_file_menu_different_ids():
	event_bus.file_menu_item_selected.emit(0)
	event_bus.file_menu_item_selected.emit(1)
	event_bus.file_menu_item_selected.emit(999)
	event_bus.file_menu_item_selected.emit(-1)
	
	assert_equal(4, received_signals.size(), "Should receive four signals")
	assert_equal(0, received_signals[0]["item_id"], "First ID should be 0")
	assert_equal(1, received_signals[1]["item_id"], "Second ID should be 1")
	assert_equal(999, received_signals[2]["item_id"], "Third ID should be 999")
	assert_equal(-1, received_signals[3]["item_id"], "Fourth ID should be -1")

# Test signal with null graph
func test_graph_signals_with_null():
	event_bus.graph_created.emit(null)
	event_bus.graph_selected.emit(null)
	event_bus.graph_deleted.emit(null)
	
	assert_equal(3, received_signals.size(), "Should receive three signals even with null")
	assert_null(received_signals[0]["graph"], "First graph should be null")
	assert_null(received_signals[1]["graph"], "Second graph should be null")
	assert_null(received_signals[2]["graph"], "Third graph should be null")

# Test signal connections and disconnections
func test_signal_disconnect():
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var test_graph = BaseGraphData.new("Test", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	
	# Emit signal - should be received
	event_bus.graph_created.emit(test_graph)
	assert_equal(1, received_signals.size(), "Should receive signal when connected")
	
	# Disconnect and emit again
	event_bus.graph_created.disconnect(_on_graph_created)
	event_bus.graph_created.emit(test_graph)
	assert_equal(1, received_signals.size(), "Should not receive signal after disconnect")
	
	# Reconnect
	event_bus.graph_created.connect(_on_graph_created)
	event_bus.graph_created.emit(test_graph)
	assert_equal(2, received_signals.size(), "Should receive signal after reconnect")

# Test multiple listeners to same signal
func test_multiple_listeners():
	var additional_signals: Array = []
	
	var additional_handler = func(graph: BaseGraphData):
		additional_signals.append(graph)
	
	event_bus.graph_created.connect(additional_handler)
	
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var test_graph = BaseGraphData.new("Multi-listener", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	event_bus.graph_created.emit(test_graph)
	
	assert_equal(1, received_signals.size(), "Original handler should receive signal")
	assert_equal(1, additional_signals.size(), "Additional handler should receive signal")
	assert_equal(test_graph, additional_signals[0], "Additional handler should receive correct graph")
	
	# Clean up
	event_bus.graph_created.disconnect(additional_handler)

# Test signal order
func test_signal_emission_order():
	var order_test_signals: Array = []
	
	var handler1 = func(graph: BaseGraphData):
		order_test_signals.append("handler1")
	
	var handler2 = func(graph: BaseGraphData):
		order_test_signals.append("handler2")
	
	event_bus.graph_created.connect(handler1)
	event_bus.graph_created.connect(handler2)
	
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var test_graph = BaseGraphData.new("Order Test", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	event_bus.graph_created.emit(test_graph)
	
	# Handlers should be called in order of connection
	assert_equal(2, order_test_signals.size(), "Should have two handler calls")
	assert_equal("handler1", order_test_signals[0], "First handler should be called first")
	assert_equal("handler2", order_test_signals[1], "Second handler should be called second")
	
	# Clean up
	event_bus.graph_created.disconnect(handler1)
	event_bus.graph_created.disconnect(handler2)

# Test EventBus persistence
func test_eventbus_persistence():
	var instance1 = EventBus.get_instance()
	var test_data = {"test": "value"}
	
	# Store some data in the instance (if it had properties for that)
	# This tests that the singleton persists between get_instance calls
	var instance2 = EventBus.get_instance()
	
	assert_equal(instance1, instance2, "EventBus should persist as singleton")

# Test signal parameter validation
func test_signal_parameter_types():
	# Test that signals work with different parameter types
	var empty_nodes: Array[BaseNodeData] = []
	var empty_connections: Array[ConnectionData] = []
	var graph_shader = BaseGraphData.new("Shader", BaseGraphData.GraphType.SHADER_GRAPH, empty_nodes, empty_connections)
	var graph_group = BaseGraphData.new("Group", BaseGraphData.GraphType.GROUP_GRAPH, empty_nodes, empty_connections)
	var graph_local = BaseGraphData.new("Local", BaseGraphData.GraphType.LOCAL_SUBGRAPH, empty_nodes, empty_connections)
	var graph_global = BaseGraphData.new("Global", BaseGraphData.GraphType.GLOBAL_SUBGRAPH, empty_nodes, empty_connections)
	
	event_bus.graph_created.emit(graph_shader)
	event_bus.graph_created.emit(graph_group)
	event_bus.graph_created.emit(graph_local)
	event_bus.graph_created.emit(graph_global)
	
	assert_equal(4, received_signals.size(), "Should handle all graph types")
	assert_equal(BaseGraphData.GraphType.SHADER_GRAPH, received_signals[0]["graph"].graph_type, "Shader graph should be received")
	assert_equal(BaseGraphData.GraphType.GROUP_GRAPH, received_signals[1]["graph"].graph_type, "Group graph should be received")
	assert_equal(BaseGraphData.GraphType.LOCAL_SUBGRAPH, received_signals[2]["graph"].graph_type, "Local subgraph should be received")
	assert_equal(BaseGraphData.GraphType.GLOBAL_SUBGRAPH, received_signals[3]["graph"].graph_type, "Global subgraph should be received")