---
title: Features & Concepts
---

# Features & Concepts

OpenShaderGraph is built around a few non‑negotiable principles to keep graphs portable and maintainable.

## Canonical Data Model

- Nodes live in `data/nodes/**.json`. Each file defines pins, properties, and UI hints only — never logic.
- The base schema is `data/node.json`. All JSON is validated at load using zod. Unknown/missing templates fail fast with clear errors.
- Language packs in `data/languages/*.json` map nodes to backend code via templates. No defaults for preview environment (lighting/exposure) are allowed in templates.

## Minimal Graph Rules

- IDs are integers unique within the graph hierarchy.
- Connections use relative refs on both ends: `../<nodeId>/<pinId>`.
- Never reorder pins, children, or IDs during load/save round‑trips.

## Passes and Preview

- Graphs typically contain a `surface` with `vertex_pass` and `fragment_pass` children.
- The preview always compiles ThreeJS GLSL for consistency, even if the export language is set to Godot.
- The preview renderer owns lighting, ambient term, and exposure; templates must not hardcode these.

## Properties vs Meta

- Properties drive code generation (e.g., `shading_model`, toggles like `enable_clearcoat`).
- Meta is editor‑only (layout, inspector, transient UI tokens) and must not change shader semantics.
- Exposed uniforms are implemented via properties; the compiler emits uniforms via property templates.

## Centralized UI Callbacks

UI updates are centralized in `App` and attached to `node.data`:

- `updateInputValue`, `updateNodeLabel`
- `addNodeMeta`, `removeNodeMeta`

Panels and renderers should use these callbacks rather than mutating React Flow state directly.

## Serialization & Graph Integrity

- Graph (de)serialization is UI‑agnostic and tested in `src/core/graph/**`.
- `prepareVisibleNodes` may strip `parentId` for display; never persist from the visible list.
- All UI edits must preserve `parentId`, `position`, and children.

## Testing & Gates

- Run unit tests with `bun run test` (vitest) and E2E with `bun run test:e2e` (Playwright) if configured.
- Lint with `bun run lint`; warnings are treated as failures.
- Optional: `bun x tsc -p tsconfig.json --noEmit` for type checking.

## Example: Fragment Output Channels

The `fragment_output` node defines material channels (Albedo, Roughness, Metallic, etc.). Connect computed values to these inputs to produce your surface. Feature toggles like Clearcoat/Transmission are modeled as boolean properties that control template emission per language pack.
