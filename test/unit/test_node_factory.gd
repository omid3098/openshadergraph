extends GutTest

# Test cases for NodeFactory (Phase 1.4 implementation)
class_name TestNodeFactory

const NodeFactory = preload("res://addons/open_shader_graph/scripts/core/gd_node_factory.gd")

func before_all():
	gut.p("Setting up NodeFactory tests")

func before_each():
	# Clear static state for each test
	NodeFactory._node_registry.clear()
	NodeFactory._initialized = false
	NodeFactory._cache_valid = false
	NodeFactory._manual_registrations.clear()

func after_each():
	# Ensure warnings are always re-enabled after each test
	NodeFactory.set_suppress_warnings(false)
	gut.p("Cleaning up after NodeFactory test")

func test_initialization():
	# Test that NodeFactory initializes properly
	NodeFactory._initialize()
	
	assert_true(NodeFactory._initialized, "NodeFactory should be initialized")
	assert_true(NodeFactory._cache_valid, "Cache should be valid after initialization")
	assert_true(NodeFactory._node_registry.size() > 0, "Registry should contain node categories")

func test_manual_registration():
	# Test manual node registration functionality
	var test_category: String = "TestCategory"
	var test_node_name: String = "TestNode"
	# Use an existing BaseNode script for testing instead of a non-existent path
	var test_script_path: String = "res://addons/open_shader_graph/scripts/nodes/gd_base_node.gd"
	
	var registration_success: bool = NodeFactory.register_node_manual(test_category, test_node_name, test_script_path)
	
	assert_true(registration_success, "Manual registration should succeed with valid script")
	
	NodeFactory._initialize()
	
	assert_true(NodeFactory._node_registry.has(test_category), "Registry should contain manually registered category")
	assert_true(NodeFactory._node_registry[test_category].has(test_node_name), "Category should contain manually registered node")
	assert_eq(NodeFactory._node_registry[test_category][test_node_name], test_script_path, "Node should have correct script path")

func test_manual_registration_error_handling():
	# Test error handling for invalid manual registrations
	# Suppress warnings for this test since we're testing error conditions
	NodeFactory.set_suppress_warnings(true)
	
	var test_category: String = "TestCategory"
	var test_node_name: String = "TestNode"
	var non_existent_script: String = "res://test/non_existent_script.gd"
	
	var registration_success: bool = NodeFactory.register_node_manual(test_category, test_node_name, non_existent_script)
	
	assert_false(registration_success, "Registration should fail for non-existent script")
	
	NodeFactory._initialize()
	
	# Should not have added the invalid registration to the registry
	assert_false(NodeFactory._node_registry.has(test_category), "Registry should not contain category with invalid script")
	
	# Re-enable warnings for other tests
	NodeFactory.set_suppress_warnings(false)

func test_get_available_categories():
	NodeFactory._initialize()
	var categories: Array = NodeFactory.get_categories()
	
	assert_true(categories is Array, "Should return an array of categories")
	assert_true(categories.size() > 0, "Should have at least one category")

func test_get_nodes_in_category():
	NodeFactory._initialize()
	var categories: Array = NodeFactory.get_categories()
	
	if categories.size() > 0:
		var first_category: String = categories[0]
		var nodes: Array = NodeFactory.get_nodes_in_category(first_category)
		
		assert_true(nodes is Array, "Should return an array of nodes")

func test_get_node_script_path():
	NodeFactory._initialize()
	var all_nodes: Dictionary = NodeFactory.get_all_nodes()
	
	if all_nodes.size() > 0:
		var first_node_name: String = all_nodes.keys()[0]
		var node_info: Dictionary = all_nodes[first_node_name]
		var script_path: String = node_info.script_path
		
		assert_ne(script_path, "", "Should return a valid script path")
		assert_true(script_path.begins_with("res://"), "Script path should be a resource path")

func test_cache_invalidation():
	# Test cache timeout functionality
	NodeFactory._cache_timeout = 0.001 # Very short timeout for testing
	NodeFactory._initialize()
	
	assert_true(NodeFactory._cache_valid, "Cache should be valid initially")
	
	await wait_seconds(0.002) # Wait longer than timeout
	
	# Trigger re-initialization to check cache invalidation
	NodeFactory._initialize()
	assert_true(NodeFactory._cache_valid, "Cache should be renewed after timeout")

func test_excluded_files_are_ignored():
	NodeFactory._initialize()
	var all_categories: Array = NodeFactory.get_categories()
	
	# Check that excluded files are not in any category
	for category in all_categories:
		var nodes: Array = NodeFactory.get_nodes_in_category(category)
		for node_name in nodes:
			var all_nodes: Dictionary = NodeFactory.get_all_nodes()
			if all_nodes.has(node_name):
				var script_path: String = all_nodes[node_name].script_path
				var filename: String = script_path.get_file()
				
				assert_false(filename in NodeFactory._excluded_files, "Excluded file should not be registered: " + filename)

func test_recursive_directory_scanning():
	NodeFactory._initialize()
	
	# Test that nodes from subdirectories are found
	var found_math_nodes: bool = false
	var found_constant_nodes: bool = false
	var found_input_nodes: bool = false
	var found_output_nodes: bool = false
	
	var categories: Array = NodeFactory.get_categories()
	for category in categories:
		var category_lower: String = category.to_lower()
		if "math" in category_lower:
			found_math_nodes = true
		elif "constant" in category_lower:
			found_constant_nodes = true
		elif "input" in category_lower:
			found_input_nodes = true
		elif "output" in category_lower:
			found_output_nodes = true
	
	# At least one of these categories should exist if recursive scanning works
	var found_any: bool = found_math_nodes or found_constant_nodes or found_input_nodes or found_output_nodes
	assert_true(found_any, "Should find nodes from subdirectories")

func test_performance_improvement():
	# Test that repeated calls use cache efficiently
	# First, force a clean initialization (no cache)
	NodeFactory._initialized = false
	NodeFactory._cache_valid = false
	
	var start_time: int = Time.get_ticks_msec()
	NodeFactory._initialize() # Fresh initialization - no cache
	var first_init_time: int = Time.get_ticks_msec() - start_time
	
	# Now test cached initialization
	start_time = Time.get_ticks_msec()
	NodeFactory._initialize() # Should use cache
	var second_init_time: int = Time.get_ticks_msec() - start_time
	
	# Second initialization should be significantly faster (cache hit)
	assert_true(second_init_time < first_init_time, "Cached initialization should be faster")

func test_error_handling_invalid_directory():
	# Test handling of invalid base path
	# Suppress warnings for this test since we're testing error conditions
	NodeFactory.set_suppress_warnings(true)
	
	var original_path: String = NodeFactory._nodes_base_path
	NodeFactory._nodes_base_path = "res://nonexistent/path"
	
	# Should not crash and should handle gracefully
	NodeFactory._initialize()
	
	# Restore original path
	NodeFactory._nodes_base_path = original_path
	
	# Re-enable warnings for other tests
	NodeFactory.set_suppress_warnings(false)
	
	# Test passes if no crash occurred
	assert_true(true, "Should handle invalid directory gracefully")

func test_node_counting():
	NodeFactory._initialize()
	var total_nodes: int = NodeFactory._count_total_nodes()
	
	assert_true(total_nodes >= 0, "Node count should be non-negative")
	assert_true(total_nodes is int, "Node count should be an integer")