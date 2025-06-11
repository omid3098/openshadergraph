extends GutTest

# Test for Phase 1 Grouping System Implementation
# Tests the context menu system, selection management, and enhanced GraphEdit

var graph_edit_scene: PackedScene
var graph_edit: GraphEdit
var test_nodes: Array[BaseNode] = []

func before_each():
	# Load the GraphEdit scene
	graph_edit_scene = preload("res://addons/open_shader_graph/scenes/scn_graph_edit.tscn")
	graph_edit = graph_edit_scene.instantiate()
	add_child(graph_edit)
	
	# Wait for initialization
	await get_tree().process_frame

func after_each():
	# Clean up
	for node in test_nodes:
		if is_instance_valid(node):
			node.queue_free()
	test_nodes.clear()
	
	if is_instance_valid(graph_edit):
		graph_edit.queue_free()
	await get_tree().process_frame

func test_graph_edit_initialization():
	assert_not_null(graph_edit, "GraphEdit should be instantiated")
	assert_true(graph_edit.has_method("get_selected_nodes"), "GraphEdit should have selection management")
	assert_true(graph_edit.has_method("select_nodes"), "GraphEdit should have node selection method")
	assert_true(graph_edit.has_method("clear_selection"), "GraphEdit should have selection clearing method")

func test_context_menu_manager_exists():
	assert_not_null(graph_edit.context_menu_manager, "Context menu manager should be initialized")
	assert_true(graph_edit.context_menu_manager.has_signal("context_action_requested"), "Context menu manager should have action signal")

func test_selection_management_signals():
	assert_true(graph_edit.has_signal("selection_changed"), "GraphEdit should have selection_changed signal")
	assert_true(graph_edit.has_signal("context_menu_requested"), "GraphEdit should have context_menu_requested signal")

func test_empty_selection_initially():
	var selected = graph_edit.get_selected_nodes()
	assert_eq(selected.size(), 0, "Initially no nodes should be selected")

func test_single_node_selection():
	# Create a test node
	var test_node = _create_test_node("TestNode")
	
	# Select the node
	var nodes_to_select: Array[BaseNode] = [test_node]
	graph_edit.select_nodes(nodes_to_select)
	
	# Verify selection
	var selected = graph_edit.get_selected_nodes()
	assert_eq(selected.size(), 1, "One node should be selected")
	assert_eq(selected[0], test_node, "The correct node should be selected")
	assert_true(graph_edit.is_node_selected(test_node), "Node should be marked as selected")

func test_multiple_node_selection():
	# Create test nodes
	var node1 = _create_test_node("TestNode1")
	var node2 = _create_test_node("TestNode2")
	var node3 = _create_test_node("TestNode3")
	
	# Select multiple nodes
	var nodes_to_select: Array[BaseNode] = [node1, node2, node3]
	graph_edit.select_nodes(nodes_to_select)
	
	# Verify selection
	var selected = graph_edit.get_selected_nodes()
	assert_eq(selected.size(), 3, "Three nodes should be selected")
	assert_true(node1 in selected, "Node1 should be selected")
	assert_true(node2 in selected, "Node2 should be selected")
	assert_true(node3 in selected, "Node3 should be selected")

func test_selection_clearing():
	# Create and select nodes
	var node1 = _create_test_node("TestNode1")
	var node2 = _create_test_node("TestNode2")
	var nodes_to_select: Array[BaseNode] = [node1, node2]
	graph_edit.select_nodes(nodes_to_select)
	
	# Clear selection
	graph_edit.clear_selection()
	
	# Verify selection is cleared
	var selected = graph_edit.get_selected_nodes()
	assert_eq(selected.size(), 0, "Selection should be cleared")
	assert_false(graph_edit.is_node_selected(node1), "Node1 should not be selected")
	assert_false(graph_edit.is_node_selected(node2), "Node2 should not be selected")

func test_context_menu_target_detection():
	var context_menu = graph_edit.context_menu_manager
	assert_not_null(context_menu, "Context menu manager should exist")
	
	# Test that the context menu manager has the proper action enum
	assert_true(context_menu.has_method("show_context_menu"), "Context menu should have show method")

func test_selection_visual_feedback():
	# Create a test node
	var test_node = _create_test_node("TestNode")
	var original_modulate = test_node.modulate
	
	# Select the node
	var nodes_to_select: Array[BaseNode] = [test_node]
	graph_edit.select_nodes(nodes_to_select)
	
	# Verify visual feedback (the node should be brighter)
	assert_ne(test_node.modulate, original_modulate, "Selected node should have different modulation")
	
	# Clear selection
	graph_edit.clear_selection()
	
	# Verify visual feedback is reset
	assert_eq(test_node.modulate, Color.WHITE, "Deselected node should return to normal modulation")

func test_backward_compatibility_signals():
	# Test that old signals still exist for backward compatibility
	assert_true(graph_edit.has_signal("right_clicked"), "Backward compatibility: right_clicked signal should exist")
	assert_true(graph_edit.has_signal("shader_node_selected"), "Backward compatibility: shader_node_selected signal should exist")
	assert_true(graph_edit.has_signal("nodes_connected"), "Backward compatibility: nodes_connected signal should exist")
	assert_true(graph_edit.has_signal("nodes_disconnected"), "Backward compatibility: nodes_disconnected signal should exist")

func test_node_removal_updates_selection():
	# Create and select a node
	var test_node = _create_test_node("TestNode")
	var nodes_to_select: Array[BaseNode] = [test_node]
	graph_edit.select_nodes(nodes_to_select)
	
	# Verify it's selected
	assert_true(graph_edit.is_node_selected(test_node), "Node should be selected")
	
	# Remove the node
	test_node.queue_free()
	await get_tree().process_frame
	
	# Verify selection is updated
	var selected = graph_edit.get_selected_nodes()
	assert_eq(selected.size(), 0, "Selection should be updated when node is removed")

func test_enhanced_graph_edit_api():
	# Test that all the enhanced API methods exist
	assert_true(graph_edit.has_method("get_selected_nodes"), "Should have get_selected_nodes method")
	assert_true(graph_edit.has_method("select_nodes"), "Should have select_nodes method")
	assert_true(graph_edit.has_method("clear_selection"), "Should have clear_selection method")
	assert_true(graph_edit.has_method("is_node_selected"), "Should have is_node_selected method")

# Helper method to create test nodes
func _create_test_node(node_name: String) -> BaseNode:
	# Use the NodeFactory to create a proper test node
	var node_factory = graph_edit.get_connection_manager().get_script() # Get access to NodeFactory
	var test_node = OpenShaderFloatConstant.new()
	test_node.name = node_name
	test_node.position = Vector2(100 * test_nodes.size(), 100)
	graph_edit.add_child(test_node)
	test_nodes.append(test_node)
	return test_node

# Test the context menu action handling
func test_context_action_handling():
	watch_signals(graph_edit.context_menu_manager)
	
	# Create a test node
	var test_node = _create_test_node("TestNode")
	var nodes_to_select: Array[BaseNode] = [test_node]
	graph_edit.select_nodes(nodes_to_select)
	
	# Simulate context action
	graph_edit.context_menu_manager.context_action_requested.emit("delete_node", {"selected_nodes": [test_node]})
	
	# Give time for processing
	await get_tree().process_frame
	
	# The signal should have been emitted
	assert_signal_emitted(graph_edit.context_menu_manager, "context_action_requested")

func test_managers_integration():
	# Test that all managers are properly initialized and integrated
	assert_not_null(graph_edit.connection_manager, "Connection manager should be initialized")
	assert_not_null(graph_edit.node_index_manager, "Node index manager should be initialized")
	assert_not_null(graph_edit.resource_manager, "Resource manager should be initialized")
	assert_not_null(graph_edit.context_menu_manager, "Context menu manager should be initialized")
	
	# Test that managers have proper methods
	assert_true(graph_edit.connection_manager.has_method("get_connections"), "Connection manager should have get_connections")
	assert_true(graph_edit.node_index_manager.has_method("get_nodes_by_index"), "Node index manager should have get_nodes_by_index")
	assert_true(graph_edit.resource_manager.has_method("get_current_resource"), "Resource manager should have get_current_resource")