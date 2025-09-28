# Node Duplication, Hotkeys, and Group Instancing Roadmap

## Context & Goals

- Introduce reliable node duplication with hotkey support while preserving graph invariants (stable pin order, relative connection refs, parent/child hierarchy).
- Extend architecture to support reusable node groupings: lightweight Groups, Local SubGraphs (instanced definitions inside a graph), and SubGraph Resources (shareable assets across projects).
- Maintain data integrity via `data/node.json` schema, centralized callbacks in `App`, and existing serialization guarantees.

## Assumptions & Constraints

- ID generation remains integer-only and unique within each graph or subgraph scope; duplication must request IDs from a single source of truth via `idGen: () => string` sourced from `App`'s `idCounter` (no new allocator class for now).
- Canonical graph mutations flow through `App`-level helpers (`updateInputValue`, `addNodeMeta`, etc.); no direct `reactflow` mutations.
- Subgraph definitions must validate with zod and reuse core schema types from `src/core/schema/types.ts`.
- Tests (vitest + Playwright) and linting must pass locally before merge.
- Preview renderer always compiles ThreeJS GLSL; subgraph instancing cannot assume preview-only uniforms.
- Duplicated nodes must update `data.template.id` to match the new numeric node ID produced by `idGen`.

## Architectural Outcomes

1. **Duplication Engine**: Pure function(s) in `src/core/graph/` that clone selected nodes, rewire connections via relative refs, and preserve ordering.
2. **Command Layer**: UI integration that triggers duplication via toolbar/menu and hotkeys (e.g., `Cmd/Ctrl+D`, optional shift variants for instancing).
3. **Selection Cohesion**: Multi-select aware duplication that anchors pasted nodes with spatial offsets and retains group hierarchies.
4. **Grouping Model**:
   - _Groups_: Visual containers with shared styling, no shared definition.
   - _Local SubGraphs_: Named, instanced groups stored within the owning graph; editing one updates all instances.
   - _SubGraph Resources_: Serialized subgraph assets (likely `data/subgraphs/*.json`) that can be referenced across projects.
5. **Validation & Serialization**: Round-trip safe storage for groups/subgraphs with strict schema enforcement and downgrade paths if assets missing.
6. **Documentation & UX**: Updated help/tooltips describing duplication shortcuts and instancing workflow.

## JIRA-Style Tasks

### EPIC: Node Duplication & Hotkeys (Priority P0)

- **Task: Core duplication helper (`OG-1`, P0)**
  - Description: Implement `duplicateNodes` in `src/core/graph/duplicate.ts` that accepts current graph state + selected IDs, clones nodes, regenerates IDs via centralized allocator, remaps handles, and returns the mutation payload.
  - Acceptance:
    - Unit tests covering single node, multi-node with internal edges, cross-parent scenarios.
    - No pin/child reordering; handle names remain `in-<pid>`/`out-<pid>` with correct remapping.
    - Edge visual props (labels/styles) preserved where applicable.
    - New IDs are unique via `idGen` and applied to both RF node `id` and `data.template.id` (numeric).
    - Does not use `prepareVisibleNodes` output for persistence paths (avoids parent loss); operates on canonical RF nodes.
- **Task: UI command integration (`OG-2`, P0)**
  - Description: Add duplication command to `App` mutation pipeline, exposing `duplicateSelection` callback on node data; ensure toolbar and context menu actions invoke the helper (add "Duplicate" to `GraphContextMenu`).
  - Acceptance:
    - Manual trigger duplicates nodes without console errors; clipboard/history remains intact.
    - One history entry per duplication using `useGraphHistory` (begin/end once); undo/redo restores exact pre-duplication state.
- **Task: Hotkey bindings (`OG-3`, P0)**
  - Description: Register `Cmd/Ctrl+D` (and `Shift+Cmd/Ctrl+D` if needed for instanced duplication) via `useGraphHotkeys`, guarding with `isEditableHotkeyTarget` to avoid inputs.
  - Acceptance:
    - Playwright E2E verifies: with selection, `Cmd/Ctrl+D` duplicates; in text inputs, no-op; with no selection, no-op.
- **Task: Selection placement rules (`OG-4`, P1)**
  - Description: Apply spatial offset to duplicated nodes, maintaining parent container alignment; handle collisions and viewport bounds gracefully. Use a small default offset (e.g., 24x24) and reuse `computeEditorSpawnPosition` heuristics where applicable.
  - Acceptance: UX tests confirm duplicates appear offset but within same parent; no nodes spawn off-screen.

### EPIC: Group & SubGraph Instancing Foundations (Priority P0)

- **Task: Group schema design (`OG-5`, P0)**
  - Description: Define Groups as editor-only containers (no shader semantics). Ensure compiler and schema ignore `group`/`group_input`/`group_output` for codegen. Introduce clear editor metadata for groups so they can be filtered.
  - Acceptance: Schema PRD reviewed; validators/guards added with unit tests; compiler ignores group types; round-trip tests confirm inner nodes are unaffected and ordering is preserved.
- **Task: Group serialization + loader (`OG-6`, P0)**
  - Description: Keep Groups editor-only: do not persist group containers into canonical graph JSON built by `buildGraphData`. Tag RF group nodes with editor metadata and ensure `buildGraphData` strips editor-only nodes while preserving children and ordering.
  - Acceptance: Building a graph from grouped RF nodes omits group containers in canonical JSON; ordering/IDs/pins/parents of inner nodes preserved; unit tests cover round-trip UI → JSON → compile.
- **Task: Local SubGraph instancing engine (`OG-7`, P0)**
  - Description: Define internal registry for subgraph definitions inside a graph, allowing multiple instances to reference a shared template; update duplication logic to support instanced clones.
  - Acceptance: Unit tests confirm editing a template updates all instances; undo/redo retains linkage; detaching an instance creates standalone group when requested.
- **Task: SubGraph Resource pipeline (`OG-8`, P1)**
  - Description: Plan storage format for external subgraph assets (`data/subgraphs/*.json`), including loader, versioning, and validation. Extend `build.ts` to copy `data/subgraphs/**` and emit `dist/subgraphs/index.json`. Add server endpoints `/api/subgraphs` and `/api/subgraphs/:id` mirroring nodes/languages.
  - Acceptance: Build emits subgraph indices; server endpoints return 200 with index and content; unit/API tests pass in dev/prod; missing assets fail with actionable errors.

### EPIC: UX & Documentation (Priority P1)

- **Task: UI affordances for groups (`OG-9`, P1)**
  - Description: Design minimal UI elements (badges, panels) to manage groups and subgraphs without bloating node renderers; leverage `src/components/inputs/**` for editors.
  - Acceptance: Figma or lightweight mock; alignment with development guidelines approved.
- **Task: Docs & onboarding (`OG-10`, P1)**
  - Description: Update project docs/help overlays describing duplication shortcuts, group creation, instancing workflow, and subgraph asset management.
  - Acceptance: Documentation passes lint, reflects final shortcuts, and links to any new CLI commands or APIs.

## Dependencies & Follow-Ups

- Ensure `build.ts` tagging remains unaffected; version bump occurs naturally after merge.
- Coordinate with data team if new directories (`data/subgraphs`) require tooling updates.
- Plan future sprint for Playwright visual regression coverage of grouped nodes once visual designs stabilize.
