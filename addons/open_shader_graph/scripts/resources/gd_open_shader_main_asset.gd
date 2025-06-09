@tool
class_name OpenShaderMainAsset extends OpenShaderGraphAsset

## Main shader graph resource class
## Extends OpenShaderGraphAsset with shader-specific properties
## Used for main shader graphs that can be compiled to actual shaders

## The type of shader (spatial, canvas_item, particles, etc.)
@export var shader_type: String = "spatial"

## Render mode properties for the shader
@export var render_mode: Array[String] = []

## Blend mode for the shader
@export var blend_mode: String = "mix"

## Additional shader compilation properties
@export var shader_properties: Dictionary = {}

func _init():
	super ()
	shader_type = "spatial"
	render_mode = []
	blend_mode = "mix"
	shader_properties = {}
	
	# Set default graph properties for main shaders
	set_graph_property("asset_type", "main_shader")

## Validates the main shader resource
## Extends base validation with shader-specific checks
func validate() -> bool:
	if not super ():
		return false
	
	# Validate shader type
	var valid_shader_types = ["spatial", "canvas_item", "particles", "fog", "sky"]
	if not shader_type in valid_shader_types:
		push_error("OpenShaderMainAsset: Invalid shader_type: " + shader_type)
		return false
	
	# Validate render modes are strings
	for mode in render_mode:
		if not mode is String:
			push_error("OpenShaderMainAsset: Invalid render_mode entry: " + str(mode))
			return false
	
	# Validate blend mode
	var valid_blend_modes = ["mix", "add", "sub", "mul"]
	if not blend_mode in valid_blend_modes:
		push_error("OpenShaderMainAsset: Invalid blend_mode: " + blend_mode)
		return false
	
	return true

## Sets the shader type and updates related properties
func set_shader_type(new_type: String) -> void:
	var valid_shader_types = ["spatial", "canvas_item", "particles", "fog", "sky"]
	if new_type in valid_shader_types:
		shader_type = new_type
		_update_default_render_modes()
	else:
		push_error("OpenShaderMainAsset: Invalid shader_type: " + new_type)

## Updates default render modes based on shader type
func _update_default_render_modes() -> void:
	match shader_type:
		"spatial":
			if render_mode.is_empty():
				render_mode = ["blend_mix", "depth_draw_opaque", "cull_back", "diffuse_burley", "specular_schlick_ggx"]
		"canvas_item":
			if render_mode.is_empty():
				render_mode = ["blend_mix"]
		"particles":
			if render_mode.is_empty():
				render_mode = ["blend_mix"]
		_:
			# For fog and sky, leave render_mode empty by default
			pass

## Adds a render mode if it doesn't already exist
func add_render_mode(mode: String) -> void:
	if mode not in render_mode:
		render_mode.append(mode)

## Removes a render mode
func remove_render_mode(mode: String) -> void:
	var index = render_mode.find(mode)
	if index >= 0:
		render_mode.remove_at(index)

## Sets the blend mode
func set_blend_mode(new_blend: String) -> void:
	var valid_blend_modes = ["mix", "add", "sub", "mul"]
	if new_blend in valid_blend_modes:
		blend_mode = new_blend
		# Update render mode to match blend mode
		_update_blend_render_mode()
	else:
		push_error("OpenShaderMainAsset: Invalid blend_mode: " + new_blend)

## Updates render mode to match the current blend mode
func _update_blend_render_mode() -> void:
	# Remove existing blend modes
	var blend_modes = ["blend_mix", "blend_add", "blend_sub", "blend_mul"]
	for mode in blend_modes:
		remove_render_mode(mode)
	
	# Add new blend mode
	add_render_mode("blend_" + blend_mode)

## Sets a shader property
func set_shader_property(key: String, value) -> void:
	shader_properties[key] = value

## Gets a shader property
func get_shader_property(key: String, default_value = null):
	return shader_properties.get(key, default_value)

## Generates the shader header based on current properties
func generate_shader_header() -> String:
	var header = "shader_type " + shader_type + ";\n"
	
	if not render_mode.is_empty():
		header += "render_mode " + ", ".join(render_mode) + ";\n"
	
	header += "\n"
	return header

## Gets all properties that should be exposed in the shader
func get_shader_uniforms() -> Dictionary:
	var uniforms = {}
	
	# Collect uniforms from shader_properties
	for key in shader_properties:
		if key.begins_with("uniform_"):
			uniforms[key] = shader_properties[key]
	
	return uniforms

## Creates a deep copy of this main shader resource
func duplicate_graph() -> OpenShaderMainAsset:
	var duplicate = OpenShaderMainAsset.new()
	
	# Copy base properties
	duplicate.nodes.clear()
	for node in nodes:
		duplicate.nodes.append(node.duplicate(true))
	
	duplicate.connections.clear()
	for connection in connections:
		duplicate.connections.append(connection.duplicate(true))
	
	duplicate.graph_properties = graph_properties.duplicate(true)
	duplicate.version = version
	
	# Copy shader-specific properties
	duplicate.shader_type = shader_type
	duplicate.render_mode = render_mode.duplicate()
	duplicate.blend_mode = blend_mode
	duplicate.shader_properties = shader_properties.duplicate(true)
	
	return duplicate

## Clears all data from the resource
func clear() -> void:
	super ()
	shader_type = "spatial"
	render_mode.clear()
	blend_mode = "mix"
	shader_properties.clear()
	set_graph_property("asset_type", "main_shader")