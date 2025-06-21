---
created: 2025-06-20T20:43:16.134Z
updated: 2025-06-21T12:42:05.585Z
assigned: ""
progress: 0
tags: []
completed: 2025-06-21T12:42:05.585Z
---

# P1 - Brainstorm node filtering factors

I need to define a target shader type to filter some nodes and have some validations. 
- Some nodes may be specific to compute shaders
- Different output nodes needs to be filtered based on this. and this type in on of multiple factors to filter. for example if the target shader is for godot, we need to know if the shader is vertex or fragment.
- Group input/output nodes should not be visible in the create node menu.

Maybe we can have vertex and fragment shader in the same graph. but the compute shader should be in a separate graph. and probably separate nodes.

Target Engine:
    - Godot:
        - Vertex Shader
        - Fragment Shader
        - Compute Shader
    - Bevy:
        - Vertex Shader
        - Fragment Shader
        - Compute Shader
    - GLSL:
        - Vertex Shader
        - Fragment Shader
        - Compute Shader
    - HLSL:
        - Vertex Shader
        - Fragment Shader
        - Compute Shader
