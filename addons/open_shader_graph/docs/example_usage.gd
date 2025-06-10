## Example usage of the OpenShaderGraph Resource System
## This script demonstrates how to create, manipulate, and save graph resources
## For testing and documentation purposes

extends RefCounted

## Example: Creating and using a main shader resource
static func example_main_shader():
	print("=== OpenShaderGraph Resource System Example: Main Shader ===")
	
	# Create a new main shader resource
	var main_shader = OpenShaderResourceManager.create_main_shader_resource()
	
	# Configure shader properties
	main_shader.set_shader_type("spatial")
	main_shader.set_blend_mode("mix")
	main_shader.add_render_mode("cull_back")
	main_shader.add_render_mode("depth_draw_opaque")
	
	# Add some nodes
	main_shader.add_node("float_const_1", "OpenShaderFloatConstant", {"value": 1.5}, {"x": 100, "y": 200})
	main_shader.add_node("float_const_2", "OpenShaderFloatConstant", {"value": 2.0}, {"x": 100, "y": 300})
	main_shader.add_node("add_1", "OpenShaderAdd", {}, {"x": 300, "y": 250})
	main_shader.add_node("output", "OpenShaderOutput", {}, {"x": 500, "y": 250})
	
	# Add connections
	main_shader.add_connection("float_const_1", 0, "add_1", 0)
	main_shader.add_connection("float_const_2", 0, "add_1", 1)
	main_shader.add_connection("add_1", 0, "output", 0)
	
	# Validate the resource
	if main_shader.validate():
		print("✓ Main shader resource is valid")
		print("  Shader type: ", main_shader.shader_type)
		print("  Render modes: ", main_shader.render_mode)
		print("  Node count: ", main_shader.nodes.size())
		print("  Connection count: ", main_shader.connections.size())
		print("  Generated header: ")
		print(main_shader.generate_shader_header())
	else:
		print("✗ Main shader resource validation failed")
	
	return main_shader

## Example: Creating and using a subgraph resource
static func example_subgraph():
	print("=== OpenShaderGraph Resource System Example: Subgraph ===")
	
	# Create a new subgraph resource
	var subgraph = OpenShaderResourceManager.create_subgraph_resource()
	
	# Configure subgraph metadata
	subgraph.set_subgraph_name("Math Operations")
	subgraph.set_subgraph_description("Performs basic math operations on two float inputs")
	subgraph.set_subgraph_author("OpenShaderGraph")
	
	# Define input and output pins
	subgraph.add_input_definition("Input A", "float", 0.0)
	subgraph.add_input_definition("Input B", "float", 1.0)
	subgraph.add_output_definition("Sum", "float")
	subgraph.add_output_definition("Product", "float")
	
	# Add internal nodes
	subgraph.add_node("input", "OpenShaderGroupInput", {}, {"x": 100, "y": 200})
	subgraph.add_node("add", "OpenShaderAdd", {}, {"x": 300, "y": 150})
	subgraph.add_node("multiply", "OpenShaderMultiply", {}, {"x": 300, "y": 250})
	subgraph.add_node("output", "OpenShaderGroupOutput", {}, {"x": 500, "y": 200})
	
	# Add internal connections
	subgraph.add_connection("input", 0, "add", 0) # Input A -> Add.A
	subgraph.add_connection("input", 1, "add", 1) # Input B -> Add.B
	subgraph.add_connection("input", 0, "multiply", 0) # Input A -> Multiply.A
	subgraph.add_connection("input", 1, "multiply", 1) # Input B -> Multiply.B
	subgraph.add_connection("add", 0, "output", 0) # Add.Result -> Sum Output
	subgraph.add_connection("multiply", 0, "output", 1) # Multiply.Result -> Product Output
	
	# Validate the resource
	if subgraph.validate():
		print("✓ Subgraph resource is valid")
		print("  Name: ", subgraph.subgraph_name)
		print("  Description: ", subgraph.subgraph_description)
		print("  Input count: ", subgraph.get_input_count())
		print("  Output count: ", subgraph.get_output_count())
		print("  Node count: ", subgraph.nodes.size())
		print("  Connection count: ", subgraph.connections.size())
		
		var interface = subgraph.get_interface_summary()
		print("  Interface summary: ", interface)
	else:
		print("✗ Subgraph resource validation failed")
	
	return subgraph

## Example: Saving and loading resources
static func example_save_load():
	print("=== OpenShaderGraph Resource System Example: Save/Load ===")
	
	# Create a test resource
	var original = example_main_shader()
	
	# Save the resource
	var save_path = "res://test_shader.tres"
	if OpenShaderResourceManager.save_graph_resource(original, save_path):
		print("✓ Resource saved to: ", save_path)
		
		# Load the resource back
		var loaded = OpenShaderResourceManager.load_graph_resource(save_path)
		if loaded != null:
			print("✓ Resource loaded successfully")
			print("  Loaded shader type: ", loaded.shader_type)
			print("  Loaded node count: ", loaded.nodes.size())
			print("  Loaded connection count: ", loaded.connections.size())
			
			# Compare some properties
			if loaded.shader_type == original.shader_type and \
			   loaded.nodes.size() == original.nodes.size() and \
			   loaded.connections.size() == original.connections.size():
				print("✓ Loaded resource matches original")
			else:
				print("✗ Loaded resource differs from original")
		else:
			print("✗ Failed to load resource: ", OpenShaderResourceManager.get_last_error())
	else:
		print("✗ Failed to save resource: ", OpenShaderResourceManager.get_last_error())

## Example: Resource validation and error handling
static func example_validation():
	print("=== OpenShaderGraph Resource System Example: Validation ===")
	
	# Create a resource with invalid data
	var invalid_resource = OpenShaderMainAsset.new()
	
	# Add a node with missing required fields
	invalid_resource.nodes.append({"type": "SomeNode"}) # Missing "id"
	
	# Add an invalid connection
	invalid_resource.connections.append({"from": "invalid_format"}) # Missing "to", invalid format
	
	# Test validation
	if invalid_resource.validate():
		print("✗ Validation should have failed")
	else:
		print("✓ Validation correctly detected invalid resource")
	
	# Test resource repair
	if OpenShaderResourceManager.repair_corrupted_resource(invalid_resource):
		print("✓ Resource repair successful")
	else:
		print("✗ Resource repair failed")

## Example: Resource duplication
static func example_duplication():
	print("=== OpenShaderGraph Resource System Example: Duplication ===")
	
	# Create original resource
	var original = example_subgraph()
	
	# Create a duplicate
	var duplicate = original.duplicate_graph()
	
	# Modify the duplicate
	duplicate.set_subgraph_name("Modified Copy")
	duplicate.add_input_definition("Input C", "float", 5.0)
	
	# Verify they are independent
	if original.subgraph_name != duplicate.subgraph_name:
		print("✓ Duplicate is independent from original")
		print("  Original name: ", original.subgraph_name)
		print("  Duplicate name: ", duplicate.subgraph_name)
		print("  Original inputs: ", original.get_input_count())
		print("  Duplicate inputs: ", duplicate.get_input_count())
	else:
		print("✗ Duplicate is not independent")

## Run all examples
static func run_all_examples():
	print("Starting OpenShaderGraph Resource System Examples...")
	print("")
	
	example_main_shader()
	print("")
	
	example_subgraph()
	print("")
	
	example_validation()
	print("")
	
	example_duplication()
	print("")
	
	# Note: Commented out save/load example as it creates files
	# Uncomment to test file operations:
	# example_save_load()
	
	print("OpenShaderGraph Resource System Examples completed!")