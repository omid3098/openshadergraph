## Meta → Properties Migration Plan

Goal: Make properties the single source of truth for user-controlled behavior. Reserve meta for editor/infra only. Ship green at each phase.

### Scope

- Shading model: `shading_*` meta → `properties.shading_model` enum.
- Assets: `asset:<id>` meta → `asset`-typed properties (`source`, `texture_source`, `model_source`).
- Exposed uniforms: `exposed` meta → boolean property (e.g., `expose` / `is_uniform`) on supported nodes.
- Render/blend/engine toggles: language `meta` entries → properties on `fragment_pass` (preferred owner) with templates using `placement: "meta"`.
- Preserve editor meta: `editor_node`, `editor_panel:*`, `editor_size:WxH`.

### Phases

#### Phase 1 — Additive (no behavior removal)

1. Templates

- Add `shading_model` property to `fragment_output` (or relocate to `fragment_pass` if appropriate in Phase 3) with enum: `pbr | unlit | toon`.
- Ensure texture/model nodes expose `asset`-typed properties (`source`, `texture_source`, `model_source`).
- Add `expose` boolean property to constant nodes that can be turned into uniforms.
- Add render/blend properties on `fragment_pass`:
  - `blend_mode: opaque | transparent | add | multiply`
  - `render_features`: booleans (e.g., `transmission`, `subsurface_scattering`, `sheen`, `anisotropic`, `refraction`, `backlight`).

2. Language pack

- Define property templates for the above with correct `placement`:
  - `shading_model`: inline/meta as required by target language.
  - Render/blend/features: placement `meta` (inject into `{{meta}}`).
  - `expose`: template yields uniform definition with placement `meta`.

3. Compiler

- Suppress node body code for nodes with `expose === true` (only for nodes that support it).

4. Tests

- Add unit tests asserting property-driven behavior for shading, assets, exposed, render modes. Keep legacy tests intact for now.

#### Phase 2 — Remove shims (convertors/filters)

1. UI build (`src/core/ui/reactFlowGraph.ts`)

- Remove conversion from `shading_*` meta to `shading_model` property.
- Stop filtering `shading_*` and `asset:` meta; instead, stop relying on them entirely.
- Keep `editor_*` meta logic as-is.

2. Graph build/save (`src/core/ui/graphData.ts`, `graphSerde.ts`)

- Remove meta → property mapping for `shading_*` and `asset:`.
- Do not append `asset:` tokens to meta during serialization; persist properties directly (normalize values as needed).

3. Language pack cleanup

- Remove obsolete language `meta` for shading/asset that are superseded by properties.

4. Tests update

- Delete or update tests that assert meta tokens for shading/assets. Assert properties instead. Keep editor meta tests.

#### Phase 3 — Consolidation

- Decide final ownership: move `shading_model` to `fragment_pass` if render state belongs there. Update templates and tests accordingly.
- Audit remaining language `meta` entries. Keep only those that correspond to editor-irrelevant engine toggles still mapped via properties (placement `meta`).
- Ensure documentation reflects the final policy (AGENTS.md updated).

### Non-goals / Safety

- Do not change editor meta. Size/panel behavior must remain unchanged.
- Do not reorder pin ids/children/positions.
- Do not embed preview environment defaults in language templates.

### Rollback plan

- Each phase is independently shippable. If a regression appears, revert only the sub-edits in that phase. The old meta paths will remain intact until the end of Phase 2.

### Verification checklist per phase

- `bun run test` passes (unit + E2E if configured).
- `bun run lint` zero errors/warnings.
- Shader snapshots updated for new property-driven code where applicable.
