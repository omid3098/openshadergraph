---
created: 2025-06-20T20:46:41.117Z
updated: 2025-06-21T18:15:15.910Z
assigned: ""
progress: 0
tags: []
---

# P1 - Brainstorm Output nodes for shaders

Below is the complete, final design. We’ll start by supporting Godot shaders only, but the structure cleanly extends to GLSL, HLSL, Bevy WGSL, etc. All graph and template files use YAML for easy readability.

---

## 1. Graph Files per Stage

- **Vertex:**  `*.vertgraph` (YAML)  
- **Fragment:** `*.fraggraph` (YAML)  
- **Lighting:** `*.lightgraph` (YAML)  
- **Composite/Final Shader:** engine file format (e.g. `*.gdshader`)

Each `*.vertgraph`/`*.fraggraph`/`*.lightgraph` is a Godot Resource serialized as YAML. You can edit them by hand or via the UI.

---

## 2. Code-Generation UI



### 2.1 Live Preview Panel

- **Real-time**: whenever you add/remove a connection or load a graph tab, the panel regenerates the shader.  
- **Error Reporting**: if the graph has errors (disconnected required pins, cycles, etc.), show errors in this panel instead of code.  
- **Group Graphs**: if you open a Group node’s subgraph, preview its generated code as a function named after the group.

### 2.2 Stages Combination Tab

- A separate “Combine Stages” tab holds three drag-and-drop slots:
  1. **Vertex** → accepts only `*.vertgraph`  
  2. **Fragment** → accepts only `*.fraggraph`  
  3. **Lighting** → accepts only `*.lightgraph`  
- Click **Generate Shader** → merges into one `*.gdshader` file (Godot) via the GodotShaderGenerator.

---

## 3. Missing Stages Behavior

In the GodotShaderGenerator:

- **Omit** entirely any missing stage.  
- (Later engines may choose to stub or omit per their needs.)

---

## 4. Code-Generation Architecture



### 4.1 Common Pipeline

1. **Load** the YAML `ShaderGraphData` for one stage.  
2. **Traverse** backward from that stage’s Output node through connected pins to gather all reachable nodes.  
3. **Topologically sort** these nodes (so dependencies emit before uses).  
4. **Generate** code per node (via its template) into a `ShaderGeneratorContext`.  
5. **Assemble**:
   - Shader version & uniforms  
   - Helper functions (from multi-line templates)  
   - `void vertex() { … }` / `void fragment() { … }`  
6. **Return** the full `.gdshader` text.

### 4.2 Per-Engine Generators

```csharp
public interface IShaderGenerator {
  ShaderLanguage Language  { get; }      // e.g. Godot, GLSL, HLSL...
  string        FileExtension { get; }   // e.g. ".gdshader"
  string        Generate(ShaderStage stage, ShaderGraphData graph);
}
```

- **GodotShaderGenerator** implements this, emits Godot-flavored `shader_type spatial;` headers, etc.

---

## 5. Node-Level Templates via External YAML

Every node’s code lives in its own YAML file.  This keeps large snippets readable.

### 5.1 Folder Layout

Under each category in:
```
addons/open_shader_graph/scripts/core/view/node_views/<Category>/templates/
```
place `<NodeName>.yaml`. For example:
```
…/node_views/math/
  ├ AddNode.cs
  └ templates/
      └ AddNode.yaml
```

### 5.2 Attribute Usage

On your node class, reference its YAML template:

```csharp
[ShaderCode("AddNode.yaml")]
public partial class AddNode : BaseMathNode
{
  // existing code…
}
```

### 5.3 Template YAML Schema

Each file is a YAML list of entries:

```yaml



- engine: Godot
  stage: All
  parameters: ["result","a","b"]
  template: |
    // add two floats
    float {result} = {a} + {b};
```

- **engine**: `"Godot"` for now  
- **stage**: `"Vertex"`, `"Fragment"`, or `"All"`  
- **parameters**: list of placeholder names  
- **template**: multi-line string with `|`  

> We’ll test whether the `parameters` mapping covers all use cases and refine if needed.

### 5.4 Runtime Loader

1. **Reflect** on `[ShaderCode]` to get `"AddNode.yaml"`.  
2. **Read** and parse the YAML into a registry.  
3. **Pick** the matching entry (engine + stage; exact stage overrides `"All"`).  
4. **Replace** `{placeholders}`:
   - `{result}` → unique var name (e.g. `add1_5`)  
   - `{a}`, `{b}` → pin values or linked node vars  
5. **Append** lines to the context (headers or body).

---

## 6. Next Steps

1. **Migrate** existing graph resources (`.vertgraph`, etc.) to YAML if not already.  
2. **Implement** the ShaderCode attribute and YAML-based loader.  
3. **Write** `AddNode.yaml` in `…/math/templates/`.  
4. **Wire** up `GodotShaderGenerator` to traverse, lookup templates, replace placeholders, and emit `.gdshader`.  
5. **Build** the live-preview panel and stages-combiner tab.  
6. **Test** with simple graphs (Add nodes, Constant nodes).  

With this in place, you’ll have a live-preview Godot shader generator ready to extend to other engines later.
