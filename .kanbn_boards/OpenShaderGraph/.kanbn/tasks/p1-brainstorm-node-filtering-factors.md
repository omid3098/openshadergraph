---
created: 2025-06-20T20:43:16.134Z
updated: 2025-06-20T20:43:21.376Z
assigned: ""
progress: 0
tags: []
---

# P1 - Brainstorm node filtering factors

I need to define a target shader type to filter some nodes and have some validations. 
- Some nodes may not work in all platforms like a particular noise node may work in godot shader but not in bevy
- Some nodes may be specific to compute shaders
- Different output nodes needs to be filtered based on this. and this type in on of multiple factors to filter. for example if the target shader is for godot, we need to know if the shader is vertex or fragment.
