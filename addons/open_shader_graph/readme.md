# Open Shader Graph Plugin

A node-based shader editor for Godot 4.3+ that provides a visual interface for creating shaders.

## Development Notes

The plugin follows the naming conventions:
- "scn_" prefix for scene assets
- "gd_" prefix for script assets

Main plugin entry point: `gd_plugin.gd`
Main editor interface: `scripts/gd_open_shader_editor.gd`


## TODO:
- Fix the node execution functionality. nodes should have an equivalent to a shader code block or a function. so the "add" node should not actually add input pins and return a value. it should just return a shader code block that can be used to generate the final shader code. same as all other nodes.
- Map a resource to a graph to be able to save a graph as a resource correctly serialized.
- Generate the shader code from the graph.
- Node arrangement feature.
- right click on nodes for custom popup menu for tasks like deleting nodes or duplicating nodes.
- Right-click on connections to remove them
- Type Conversion for input pins like "add" node to auto detect the pin type based on the input type and update the pin type. we should be able to add vector3 and a float and it should automatically convert the float to a vector3.
- If a new connection is requested, we should disconnect the previous connection if it exists.
- Undo/Redo for the whole plugin (nodes, properties, connections, etc.)
