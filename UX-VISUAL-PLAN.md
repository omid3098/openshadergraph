## OpenShaderGraph Visual UX Plan

This document tracks the plan and implementation status for improving node and connection visuals while adhering to repository rules and data-first design.

### Goals

- Improve clarity of node roles and pin compatibility at a glance.
- Keep editor-only nodes visible but visually distinct; exclude them from compile.
- Elevate awareness of asset-bound nodes and project portability.
- Preserve canonical data and not affect compile logic; visuals only in Phase 1.

### Taxonomy

- Node categories: `editor`, `asset`, `input`, `transform`, `output`.
- Pin types (visual language): `scalar`, `vec2`, `vec3`, `vec4`, `color`, `int`, `bool`, `mat3`, `mat4`, `texture2D`, `textureCube`, `sampler`, `uv`, `normal`, `position`.

### Visual Language

- Node header bands by category (color + subtle iconography):
  - editor: slate band + hatch pattern
  - asset: orange band + paperclip badge
  - input: green band
  - transform: blue band
  - output: violet band
- Pins: color + shape cues (circles for numeric/color, squares for textures/samplers, diamonds for bool, hex for int). Edge color inherits from source pin color (later phases).
- Headers use compact icons instead of category text; icon placed left of node title (keeps header compact).
- Card corners remain rounded; header inherits rounded top corners.

### Phases

1. Phase 1 – Safe visuals only (no behavior change)

   - Node header bands and badges by category
   - Pin color and shape mapping on Handles
   - Legend (optional later) and MiniMap color alignment

2. Phase 2 – Validation & feedback

   - Type compatibility checks during connect; block mismatches
   - Drag feedback (valid/invalid) and micro-toasts

3. Phase 3 – Assistive features
   - Adapter suggestions (auto-insert helpers)
   - Usage guideline for target platforms (replaces asset manifest export)

### Implementation Notes

- Source category from template `meta` and node `type`:
  - `editor`: `meta` includes `editor_node`
  - `asset`: node has `properties` with `type: "asset"` or `data.asset` present
  - `input`: constants, exposed uniforms, generators (e.g., `uv`, `time`)
  - `output`: `vertex_output`, `fragment_output`
  - `transform`: everything else
- Pin type detection uses the `type` string from node JSON (`float`, `float2/3/4`, `sampler2D`, etc.).
- No change to serialization or compilation; visuals are UI-only.

### Status Checklist

- [x] Plan document created
- [x] Phase 1: Theme tokens for categories and pins
- [x] Phase 1: Node header bands + badges (icons only, no text; icon left of title; rounded top)
- [x] Phase 1: Pin color/shape mapping for Handles
- [x] Lint + tests green

Delivered in Phase 1:

- Category header bands and compact iconography (Editor, Asset, Input, Output, Transform)
- Pin shapes and colors applied to Handles
- Restored rounded node headers for consistent curvature
- No behavioral changes (compile/serde untouched)

Next (Phase 2 – Validation & feedback):

- Type compatibility checks in connect flow (block mismatches) [done]
- Drag feedback colors (valid/invalid) and a micro-toast on mismatch [skipped]

### Future Tests (Phase 2/3)

- Unit: compatibility matrix; adapter suggestions; editor-only exclusion in compile
- E2E: connect blocking; visual badges render; compile-only view hides editor nodes; asset warnings
