# AGENTS – Working Agreement for OpenShaderGraph (TypeScript‑First)

This document is the source-of-truth for how agents design, implement, and validate the TypeScript core and GUI layer for OpenShaderGraph. It reflects the updated goal: port all logic to TypeScript and treat the Python directory as reference only.

## Project Snapshot
- Goal: Build a TypeScript core + GUI editor that authors shader graphs in YAML and compiles them to shader code for any platform defined by a language YAML.
- Canonical Data: `data/` at repo root is language‑agnostic and the heart of the system (node templates, base node schema, language packs). This must remain the single source of truth for nodes and languages.
- Python Reference: `python_backup/` contains the prior implementation; use it strictly as behavioral reference while porting.
- Stack
  - Runtime & scripts: `bun` (package manager + task runner)
  - Core + UI: TypeScript; Editor UI with `ReactFlow`
  - Testing: `Playwright` (E2E/visual) and `vitest` (unit)
  - Docs/Tooling Intel: `Context7` via MCP for up‑to‑date library docs
- Non‑Goals: None regarding the compiler. We will ship a full TypeScript compiler and runtime, not rely on Python at runtime.

## Canonical Data Model
Authoritative files to follow:
- Node templates (palette): `data/nodes/**.yml`
- Base node schema: `data/node.yml`
- Language packs (templating rules): `data/languages/*.yml` (e.g., `Godot.yml`)
- Behavioral reference only: `python_backup/core/node.py`, `python_backup/core/graph_compiler.py`, `python_backup/tests/*.py`

### Graph Schema (YAML)
Root and nodes share a common structure (see `python_backup/data/node.yml` and examples under `python_backup/data/nodes/`):
- id: integer (unique within the containing graph)
- type: string (node kind; must match a template under `data/nodes` or be a container like `surface`, `vertex_pass`, `fragment_pass`)
- name: string (display name; optional in some templates)
- meta: list of strings (graph- or node-level flags; e.g., `blend_mode_transparent`, `exposed`)
- position: `[x, y]` (UI concern; currently optional in many templates but should be required when a node is created)
- nodes: list of child nodes (for hierarchical graphs like `surface` containing passes)
- inputs: list of pins: `{ id, name, type, value }`
  - type: string or list of allowed types (overload). Examples: `float`, `float2`, `float3`, `float4`, `matrix2`, `matrix3`, `matrix4` etc. logic needs to support polymorphic nodes like `add` that accept multiple types.
  - value: literal (e.g., `[1.0, 0.0, 0.0, 1.0]`) or a relative ref string to another node output: `../<nodeId>/<pinId>` to indicate connections.
- outputs: list of pins: `{ id, name, type }` (no default `value`)

Connection encoding (authoritative behavior in `Node.connect_nodes`):
- When connecting `from_node.output <from_pin>` to `to_node.input <to_pin>`, set:
  - Output value: `../<toNodeId>/<toPinId>`
  - Input value: `../<fromNodeId>/<fromPinId>`

Type resolution rules (see `GraphCompiler.convert_type`):
- Supports widening/narrowing among float vectors (float ↔ float2/3/4). Narrowing uses swizzles (`.x`, `.xy`, `.rgb`, `.xyzw`). currently Widening wraps via `vecN(value)` for godot. it may differ per language and later needs to be templated in the language yml.
- Inputs may declare multiple allowed types; the resolved type is captured on node as `_resolved_type` during template resolution.

Template tokens (example from `data/languages/Godot.yml`):
- `{{name}}`, `{{inputs:i}}`, `{{internal_nodes}}`, `{{meta}}`, `{{exposed_nodes}}`
- Node meta `exposed` wraps node definition in a `uniform` declaration.
- Graph/meta like `blend_mode_transparent` injects `render_mode` lines.

## TypeScript Architecture
We are implementing the core graph/runtime and compiler in TypeScript. The UI consumes this core.

Core modules (proposed structure):
- `src/core/schema`
  - Load/validate YAML (`data/node.yml` as schema reference)
  - Registry for node templates under `data/nodes/**.yml`
  - Registry for language packs under `data/languages/*.yml`
- `src/core/graph`
  - Graph/Node/Pin types and factories
  - ID allocator (single counter per graph instance, matching Python behavior)
  - CRUD: create/delete nodes, connect/disconnect pins, find by id/type/name
  - Relative reference encoder/decoder for connections: `../<nodeId>/<pinId>`
- `src/core/types`
  - Shader types, unions, helpers, swizzle maps
  - Polymorphic pin resolution and propagation
- `src/core/compiler`
  - Port of Python `GraphCompiler` with feature parity
  - Template resolution: inputs, internals, meta, exposed nodes
  - Type conversion: widening/narrowing (float ↔ float2/3/4) with swizzles
  - Default‑input elision (remove code lines matching default template values)
- `src/core/io`
  - YAML serialize/deserialize preserving order and values
  - Language selection, compile entrypoints

Public API (sketch):
- `loadNodeTemplates(root = 'data/nodes')`
- `loadLanguage(nameOrPath: string)`
- `createGraph(templateType = 'surface'): Graph`
- `createNode(graph, type: string, parent?: Node): Node`
- `connect(graph, from: {nodeId, pinId}, to: {nodeId, pinId})`
- `compile(graph, language: LanguagePack): string`
- `toYAML(graph): string` / `fromYAML(text: string): Graph`

Porting parity checklist (must match Python):
- Single `last_id` counter per graph instance; IDs unique across entire graph hierarchy
- Connection encoding updates both ends’ `value`
- Type conversion swizzles: 4→3 uses `.rgb`; 4→2 uses `.rg`; otherwise `.x|xy|xyz|xyzw`
- `exposed` meta wraps node definition via language meta template
- Default-input lines removed when unchanged literal and not a ref

## GUI Layer: Design and Mapping
The editor must be a faithful, reversible view over the YAML model. Round‑tripping YAML ⇄ UI must not lose information. The UI uses the TypeScript core for all graph and compile operations.

### Node Representation (ReactFlow)
- Each YAML node becomes a ReactFlow node.
- `id`: keep a numeric string mirroring YAML’s integer id (e.g., `"3"`). Maintain uniqueness within the parent graph.
- `type`: ReactFlow node type equals YAML `type` for simple nodes. For container nodes (`surface`, `vertex_pass`, `fragment_pass`) use ReactFlow’s parent/child nodes.
- Display: title = YAML `name` or derived from `type` if absent.
- Ports: render inputs on the left, outputs on the right.
- Position: map YAML `position` to/from ReactFlow node position.

### Graph Hierarchy
- The root is a `surface` node which contains `vertex_pass` and `fragment_pass` children (see `data/nodes/shader_types/surface.yml`).
- Use ReactFlow parent-child nodes to visualize nesting. Child ids remain unique within their parent context as per Python’s `last_id` scheme.

### Edges and Connections
- ReactFlow edges represent connections between output and input pins.
- On connect:
  - Validate type compatibility using the input’s allowed `type` list and, if needed, mark the node’s `_resolved_type` in UI state.
  - Update both ends’ YAML `value` fields with the relative references exactly as `Node.connect_nodes` does.
- On disconnect:
  - Clear `value` on the input pin to its default literal per template; clear output `value` if it only pointed to this input.

### Type System & Propagation
- For nodes with polymorphic types (e.g., `add`), inputs and output types are lists. Resolve the effective pin type on first connection based on the input’s expected type and the source output type; propagate to output. Mirror `GraphCompiler.resolve_template_input` behavior.
- Show the resolved type on the node badge for clarity.

### Node Palette
- Build palette dynamically by scanning `python_backup/data/nodes/**.yml`.
- Categories come from folder names (e.g., `constants`, `math`, `passes`).
- Template fields seed default inputs and outputs when instancing a node.

### Meta Controls
- Graph-level meta (e.g., `blend_mode_transparent`) exposed as toggles on the root `surface` node.
- Node-level meta (e.g., `exposed`) available per node.

### Serialization/Deserialization
- Load: parse YAML into an in-memory graph, preserving order, ids, and values exactly.
- Save/Export: write YAML that matches the schema and relative connection encoding. Never reorder pins or children unnecessarily.
- Validation: ensure every ref `../<nodeId>/<pinId>` resolves within the correct parent chain.

### Compile
- The UI calls the TypeScript `compile` with a selected language pack loaded from `data/languages`. No Python is involved at runtime.
/- To support multiple targets, ensure all node `type` names used in the graph have templates in the selected language pack; surface missing templates clearly.

## Runtime & Scripts (bun)
Define these tasks in `package.json` (names reserved; do not implement in this step):
- dev: start the Vite/Next dev server and open the editor
- test: run `vitest`
- test:e2e: run `playwright test`
- test:e2e:update: update snapshots/baselines
- lint/format: conventional linting/formatting if configured
- docs: helper that fetches docs via Context7 for local caching/reference (optional)

## Testing Strategy
- Unit (vitest)
  - YAML round‑trip: serialize → deserialize → deepEqual
  - Type resolution utilities: inputs with lists, conversions (floatN swizzles)
  - Edge encoding: ensure bidirectional `value` updates on connect
  - Template loading/indexing from `data/nodes`
  - Compiler parity tests mirroring Python behavior using TS fixtures equivalent to `python_backup/tests/graph_samples.py`
- E2E/Visual (Playwright)
  - Basic flows: create graph, add nodes, connect pins, save, reload
  - Visual regressions: baseline screenshots of common node types and nested graphs
  - Error states: invalid connection attempts (blocked), missing templates, unresolved refs

## Using Context7 (MCP) for Docs
Agents should fetch up‑to‑date docs before making API‑sensitive changes.
- Resolve library id: query by name to get the Context7 id
- Fetch docs: request focused topics with a token cap for context
- Typical targets: `reactflow`, `bun`, `@playwright/test`, `vitest`

Example agent flow (conceptual):
1) Resolve: library = "reactflow" → get `/xyflow/xyflow` (example)
2) Fetch: topic = "parent child nodes" or "edges API"
3) Apply: update code accordingly with confirmed APIs

## Agent Workflow & Conventions
- Scope Discipline: Do not modify anything under `python_backup/` unless explicitly asked. It is reference only. The authoritative data/templates are under `data/`.
- Small, Surgical Changes: Keep diffs minimal and focused on the current task.
- Planning: For multi‑step tasks, maintain a short plan and update status as you go.
- Preambles: Before running grouped commands or large edits, state what you are about to do.
- Validation First: Prefer unit tests close to the code you touch; run E2E only when meaningful.
- Data Integrity: Never change ids, pin order, or connection encoding during round‑trip.
- Error Handling: Fail safe on unknown node templates; surface actionable messages in UI.
- Naming
  - ReactFlow node/edge ids: strings; mirror YAML ints for node ids by stringifying
  - YAML strictly follows the schema shown above
- Accessibility: Favor keyboard navigation for node selection and port connections where feasible.

## Milestones (Proposed)
1) Schema Loader + Palette Index (no UI) – read templates, build internal registry
2) Minimal Canvas – render root `surface` with passes and drop a few nodes
3) Connections – enforce types, encode/decode refs exactly
4) Persistence – full YAML save/load parity
5) Visual Polish – grouping, alignment, search, meta controls
6) Tests – unit + baseline E2E for the MVP flows
7) Optional Preview – shell out to Python compiler for text preview

## Open Decisions (Document As Resolved)
- State manager: local state/React Context vs. a lightweight store (e.g., Zustand). Default to React state unless complexity demands otherwise.
- File IO: local filesystem (desktop app) vs. browser download/upload. Start with browser download/upload, provide adapters later.
- Drag/Drop: how palette items become instantiated (sidebar vs. context menu).

## Appendix A – Quick Node Examples
Color (constant): `data/nodes/constants/color.yml`
```yaml
id: -1
type: color
name: Color
meta: []
position: [0, 0]
nodes: []
inputs:
  - id: 0
    name: in
    type: float4
    value: [1.0, 1.0, 1.0, 1.0]
outputs:
  - id: 0
    name: out
    type: float4
```

Add (polymorphic): `data/nodes/math/add.yml`
```yaml
id: -1
type: add
name: Add
meta: [{ current_pintype: float }]
position: [0, 0]
nodes: []
inputs:
  - id: 0
    name: a
    type: [float, float2, float3, float4, matrix2, matrix3, matrix4]
    value: [1.0]
  - id: 1
    name: b
    type: [float, float2, float3, float4, matrix2, matrix3, matrix4]
    value: [1.0]
outputs:
  - id: 0
    name: out
    type: [float, float2, float3, float4, matrix2, matrix3, matrix4]
```

Fragment output: `data/nodes/fragment_output.yml` pairs with language template `fragment_output` in `data/languages/Godot.yml`. Multiple platforms are supported by adding more language packs.

---
If any ambiguity arises, first defer to the data and language packs in `data/`. Use `python_backup/core/*.py` and `python_backup/tests/` as behavioral reference only while porting. The shipped runtime and compiler are the TypeScript implementations.
