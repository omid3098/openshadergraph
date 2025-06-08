# Open Shader Graph Plugin

A node-based shader editor for Godot 4.3+ that provides a visual interface for creating shaders.

## Development Notes

The plugin follows the naming conventions:
- "scn_" prefix for scene assets
- "gd_" prefix for script assets

Main plugin entry point: `gd_plugin.gd`
Main editor interface: `scripts/gd_open_shader_editor.gd`


TODO:
- Fix the node execution functionality. nodes should have an equivalent to a shader code block or a function. so add node should not actually add input pins and return a value. it should just return a shader code block that can be used in the shader.
- Simplify node codes by moving the shareable parts of the code to the base node and only keep the unique parts in the child nodes.
- Map a resource to a graph to be able to save a graph as a resource correctly serialized.
- Generate the shader code from the graph.
- Fix float decimal precision issue in the GraphEdit after changing the value in the properties panel.