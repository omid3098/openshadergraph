# Open Shader Graph Plugin

A node-based shader editor for Godot 4.3+ that provides a visual interface for creating shaders.

## Development Notes

The plugin follows the naming conventions:
- "scn_" prefix for scene assets
- "gd_" prefix for script assets

Main plugin entry point: `gd_plugin.gd`
Main editor interface: `scripts/gd_open_shader_editor.gd`


## TODO:
- Implement Group, local subgraphs and sub-graphs. groups should be able to be nested and should be able to be used as a node in the graph. it basically packs a set of nodes into a single node preserving the connections between the nodes. a local subgraph is basically a group that changing one instance will change all instances of the subgraph. like a local function in a programming language. and a normal subgraph is a separate graph that can be used as a node in multiple shader graphs.
- Fix the node execution functionality. nodes should have an equivalent to a shader code block or a function. so the "add" node should not actually add input pins and return a value. it should just return a shader code block that can be used to generate the final shader code. same as all other nodes. the code generation should start from the output node and work its way back to the input nodes. for exammple if the node struction is like this:
```
Color, float3 > Add > Output_ALBEDO
```

the code generation should be like this:
```
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_lambert, specular_schlick_ggx;

void fragment() {
// ColorConstant:2
	vec4 n_out2p0 = vec4(1.000000, 1.000000, 1.000000, 1.000000);
// Vector3Constant:4
	vec3 n_out4p0 = vec3(0.000000, 0.000000, 0.000000);
// VectorOp:3
	vec3 n_out3p0 = vec3(n_out2p0.xyz) + n_out4p0;
// Output:0
	ALBEDO = n_out3p0;
}
```
Output nodes define the final structure of the shader to know if it is a fragment shader or a vertex shader. So we should have different output nodes for shader functions to parse backwards. (fragment, vertex, etc.)
the shader type (spatial, canvas_item, blend_mode, etc.) should be defined in the main properties of the graph.
But I am looking for a way to encapsulate the graph functionality with the shader code generation in order to be able to generate different shaders from different languages like GLSL, HLSL, Godot, Unity, etc.. but I am not sure how to do that.

- Map a resource to a graph to be able to save a graph as a resource correctly serialized.
- Generate the shader code from the graph.
- Node arrangement feature.
- right click on nodes for custom popup menu for tasks like deleting nodes or duplicating nodes.
- Right-click on connections to remove them
- Type Conversion for input pins like "add" node to auto detect the pin type based on the input type and update the pin type. we should be able to add vector3 and a float and it should automatically convert the float to a vector3.
- If a new connection is requested, we should disconnect the previous connection if it exists.
- Undo/Redo for the whole plugin (nodes, properties, connections, etc.)
- Add a console to the editor to see errors and warnings.
- Add another tab near the console to see the generated shader code.
