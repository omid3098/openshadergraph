@tool
class_name OpenShaderSubgraphAsset extends OpenShaderGraphAsset

## Subgraph resource class for groups, local subgraphs, and normal subgraphs
## Extends OpenShaderGraphAsset with input/output pin definitions
## Does not contain shader-specific properties like render modes

## Array of input pin definitions
## Each dictionary contains: name (String), type (String), default_value (Variant)
@export var input_definitions: Array[Dictionary] = []

## Array of output pin definitions  
## Each dictionary contains: name (String), type (String)
@export var output_definitions: Array[Dictionary] = []

## Subgraph metadata
@export var subgraph_name: String = "New Subgraph"
@export var subgraph_description: String = ""
@export var subgraph_author: String = ""
@export var subgraph_version: String = "1.0.0"

func _init():
	super ()
	input_definitions = []
	output_definitions = []
	subgraph_name = "New Subgraph"
	subgraph_description = ""
	subgraph_author = ""
	subgraph_version = "1.0.0"
	
	# Set default graph properties for subgraphs
	set_graph_property("asset_type", "subgraph")

## Validates the subgraph resource
## Extends base validation with subgraph-specific checks
func validate() -> bool:
	if not super ():
		return false
	
	# Validate input definitions
	for i in range(input_definitions.size()):
		var input_def = input_definitions[i]
		if not input_def.has("name") or not input_def.has("type"):
			push_error("OpenShaderSubgraphAsset: Invalid input definition at index " + str(i))
			return false
		
		if not input_def.has("default_value"):
			input_def["default_value"] = _get_default_value_for_type(input_def["type"])
	
	# Validate output definitions
	for i in range(output_definitions.size()):
		var output_def = output_definitions[i]
		if not output_def.has("name") or not output_def.has("type"):
			push_error("OpenShaderSubgraphAsset: Invalid output definition at index " + str(i))
			return false
	
	# Check for duplicate pin names
	if not _validate_unique_pin_names():
		return false
	
	return true

## Helper function to get default value for a pin type
func _get_default_value_for_type(type: String):
	match type:
		"float":
			return 0.0
		"int":
			return 0
		"bool":
			return false
		"float2":
			return Vector2.ZERO
		"float3":
			return Vector3.ZERO
		"float4":
			return Vector4.ZERO
		"color":
			return Color.WHITE
		"texture2d":
			return null
		_:
			return null

## Validates that all pin names are unique within inputs and outputs separately
func _validate_unique_pin_names() -> bool:
	# Check input names
	var input_names = []
	for input_def in input_definitions:
		var name = input_def["name"]
		if name in input_names:
			push_error("OpenShaderSubgraphAsset: Duplicate input pin name: " + name)
			return false
		input_names.append(name)
	
	# Check output names
	var output_names = []
	for output_def in output_definitions:
		var name = output_def["name"]
		if name in output_names:
			push_error("OpenShaderSubgraphAsset: Duplicate output pin name: " + name)
			return false
		output_names.append(name)
	
	return true

## Adds an input pin definition
func add_input_definition(name: String, type: String, default_value = null) -> void:
	if default_value == null:
		default_value = _get_default_value_for_type(type)
	
	var input_def = {
		"name": name,
		"type": type,
		"default_value": default_value
	}
	input_definitions.append(input_def)

## Removes an input pin definition by name
func remove_input_definition(name: String) -> void:
	for i in range(input_definitions.size() - 1, -1, -1):
		if input_definitions[i]["name"] == name:
			input_definitions.remove_at(i)
			break

## Adds an output pin definition
func add_output_definition(name: String, type: String) -> void:
	var output_def = {
		"name": name,
		"type": type
	}
	output_definitions.append(output_def)

## Removes an output pin definition by name
func remove_output_definition(name: String) -> void:
	for i in range(output_definitions.size() - 1, -1, -1):
		if output_definitions[i]["name"] == name:
			output_definitions.remove_at(i)
			break

## Gets an input definition by name
func get_input_definition(name: String) -> Dictionary:
	for input_def in input_definitions:
		if input_def["name"] == name:
			return input_def
	return {}

## Gets an output definition by name
func get_output_definition(name: String) -> Dictionary:
	for output_def in output_definitions:
		if output_def["name"] == name:
			return output_def
	return {}

## Updates an input definition
func update_input_definition(old_name: String, new_name: String, new_type: String, new_default_value = null) -> void:
	for input_def in input_definitions:
		if input_def["name"] == old_name:
			input_def["name"] = new_name
			input_def["type"] = new_type
			if new_default_value != null:
				input_def["default_value"] = new_default_value
			else:
				input_def["default_value"] = _get_default_value_for_type(new_type)
			break

## Updates an output definition
func update_output_definition(old_name: String, new_name: String, new_type: String) -> void:
	for output_def in output_definitions:
		if output_def["name"] == old_name:
			output_def["name"] = new_name
			output_def["type"] = new_type
			break

## Gets the number of input pins
func get_input_count() -> int:
	return input_definitions.size()

## Gets the number of output pins
func get_output_count() -> int:
	return output_definitions.size()

## Sets subgraph metadata
func set_subgraph_name(name: String) -> void:
	subgraph_name = name

func set_subgraph_description(description: String) -> void:
	subgraph_description = description

func set_subgraph_author(author: String) -> void:
	subgraph_author = author

func set_subgraph_version(version: String) -> void:
	subgraph_version = version

## Creates a deep copy of this subgraph resource
func duplicate_graph() -> OpenShaderSubgraphAsset:
	var duplicate = OpenShaderSubgraphAsset.new()
	
	# Copy base properties
	duplicate.nodes.clear()
	for node in nodes:
		duplicate.nodes.append(node.duplicate(true))
	
	duplicate.connections.clear()
	for connection in connections:
		duplicate.connections.append(connection.duplicate(true))
	
	duplicate.graph_properties = graph_properties.duplicate(true)
	duplicate.version = version
	
	# Copy subgraph-specific properties
	duplicate.input_definitions = []
	for input_def in input_definitions:
		duplicate.input_definitions.append(input_def.duplicate(true))
	
	duplicate.output_definitions = []
	for output_def in output_definitions:
		duplicate.output_definitions.append(output_def.duplicate(true))
	
	duplicate.subgraph_name = subgraph_name
	duplicate.subgraph_description = subgraph_description
	duplicate.subgraph_author = subgraph_author
	duplicate.subgraph_version = subgraph_version
	
	return duplicate

## Clears all data from the resource
func clear() -> void:
	super ()
	input_definitions.clear()
	output_definitions.clear()
	subgraph_name = "New Subgraph"
	subgraph_description = ""
	subgraph_author = ""
	subgraph_version = "1.0.0"
	set_graph_property("asset_type", "subgraph")

## Gets a summary of the subgraph interface
func get_interface_summary() -> Dictionary:
	return {
		"name": subgraph_name,
		"description": subgraph_description,
		"author": subgraph_author,
		"version": subgraph_version,
		"input_count": get_input_count(),
		"output_count": get_output_count(),
		"inputs": input_definitions.duplicate(),
		"outputs": output_definitions.duplicate()
	}