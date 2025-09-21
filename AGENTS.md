# OpenShaderGraph – Working Agreement

Purpose: Keep agents aligned on the absolute essentials needed to build, test, and ship the TypeScript-first OpenShaderGraph. Be brief. Be consistent. Ship green. Focus on clean, maintainable and extensible code.

## Tech Stack

- Runtime: `bun` (package manager + task runner)
- Core + UI: TypeScript, ShadCN for UI components and ReactFlow for graph rendering
- Tests: `vitest` (unit), `playwright` (E2E/visual)
- Lint/Format: ESLint (treat warnings as failures)
- Docs via MCP: Context7 (for up-to-date library APIs)

## Canonical Data (Single Source of Truth)

- Nodes: `data/nodes/**.json`
- Base node schema: `data/node.json`
- Language packs: `data/languages/*.json`

Minimal graph rules:

- IDs are integers unique within the graph hierarchy.
- Connections encode as relative refs: `../<nodeId>/<pinId>` on both ends (input and output).
- Never reorder pins, children, or IDs during load/save round-trips.

## Required Gates (must pass locally before submitting)

- `bun run test` → all unit tests green (vitest)
- `bun run lint` → 0 errors, 0 warnings (ESLint)
- If Playwright is configured: `bun run test:e2e` → all E2E tests green
- Optional: `bun x tsc -p tsconfig.json --noEmit` → clean typecheck

## MCP Docs (Context7) Usage

- Resolve library first, then fetch focused docs.
- Typical targets: `reactflow`, `bun`, `@playwright/test`, `vitest`.
- Keep token caps reasonable and request specific topics (e.g., "parent/child nodes", "edges API").

## Development Rules

- ALWAYS Tests first: add/modify unit tests in `src/core/**` and E2E tests in `e2e/**` for all new features and bug fixes.
- Data integrity next: adhere to `data/node.json` and language packs; fail safe with clear errors on unknown/missing templates.
- Small, surgical diffs; prefer targeted fixes over broad refactors.
- When asked to create new nodes, make sure to put it in the right directory and also create correct templates in data/languages for all avaibale languages.
- When adding core features, extend the TypeScript core under `src/core/**` and keep UI as a thin consumer.
- Preview source of truth: preview panel always renders using a ThreeJS GLSL fragment shader compiled from the current graph. Always compile `ThreeJS_GLSL` under the hood for preview, regardless of the selected output language.
- Default compiler: default compile output language is `Godot`. Users can switch the compile output view, but preview remains bound to the ThreeJS GLSL compilation.
- Centralized updates: define node update callbacks in `App` (e.g., `updateInputValue`, `updateNodeLabel`, `addNodeMeta`, `removeNodeMeta`) and attach them to `node.data`. Panels and renderers MUST use these callbacks instead of calling `rf.setNodes` directly.
- Environment & lighting ownership: Never hardcode environment/lighting defaults inside shader templates. Declare uniforms only; do not assign default values in language packs. The ThreeJS 3D Preview owns and configures preview lighting (three‑point rig), ambient term, and exposure, and passes them as uniforms at runtime. The generated shader code must be environment‑agnostic so it can be embedded in other engines that provide their own lighting.
- Exposure policy: Do not bake exposure into shader templates. If exposure is needed for preview, set it from the preview panel via a uniform or renderer option. Templates must not include exposure initializers.

## Pitfalls & Guardrails (Retro)

- Duplicate type definitions: never redefine core types in multiple files. Source them from a single `src/core/schema/types.ts` module.
- Unvalidated JSON: always validate `data/nodes/**.json` and `data/languages/*.json` at load time using zod. Fail with clear, actionable errors.
- Mixed runtime APIs: avoid Bun-only utilities (e.g., `Bun.Glob`) inside reusable handlers. Prefer Node FS (`fs.readdir` + recursion) for portability and testability.
- UI monoliths: do not cram complex editors into node renderers. Extract inputs (color, numeric vector, etc.) into `src/components/inputs/**` and keep `GraphNode` focused on layout.
- Handle id regex drift: centralize handle helpers (`parseHandleId`, `makeInHandle`, `makeOutHandle`) in `src/core/ui/handles.ts`. Reuse everywhere.
- Serialization ownership: keep graph (de)serialization UI-agnostic and tested under `src/core/graph/**`. Do not reorder IDs, pins, or children.
- Visible-nodes trap (parent loss): `prepareVisibleNodes` may strip `parentId` for display-only purposes. Never persist nodes coming from this filtered/derived list. Always update the canonical ReactFlow nodes via the centralized callbacks to preserve `parentId` and hierarchy.
- Parent/child integrity: All UI edits (name, metas, inputs) must preserve `parentId`, `position`, and children. Do not move nodes across parents as a side effect of panel edits.
- Meta hygiene: Treat `meta` as `string[]` for canonical data. UI-only/transient objects (e.g., polymorphic helpers) must not be rendered as text and must be filtered out during graph build (see `src/core/ui/graphData.ts`).
- Builtin defaults: Encode shared defaults in node JSON using lightweight `builtin:<key>` string tokens (e.g., `builtin:uv`) so templates stay declarative. The compiler owns token resolution per language.
- json node definitions are only skeleton of the graph. without any logic. just what comes in, what comes out and in some cases, how it should be displayed in the UI. We do not deal with any logic at all. its only template replacement. Raw data come from node definitions. they build a graph together and the graph will be compiled and each node will be replaced by a template defined in language definition.

- Example graphs coupling: keep example-building logic in `src/server/examples.ts`, not in the server bootstrap. Handlers live in `src/server/**`.
- Type safety drift: turn on TypeScript `strict` and favor precise types in `src/core/**`. Add tests when tightening types to avoid regressions.
- Hardcoded preview environment: Language templates must not include default values for preview uniforms like `uKeyDir`, `uKeyColor`, `uFillDir`, `uFillColor`, `uRimDir`, `uRimColor`, `uAmbient`, or `uExposure`. These are preview concerns and must be supplied by the preview panel. Unit tests enforce this.

- React Flow ResizeObserver warnings (dev-only): Resizing nodes via React Flow's `NodeResizer` can emit "ResizeObserver loop completed/limit exceeded" when running under React Strict Mode in development. This is benign upstream behavior; production does not show it. We suppress the dev overlay for these messages in `src/frontend.tsx`. Verify by running the production server (`bun run start`). Do not chase feedback-loop fixes unless the issue reproduces in production.

These are non-negotiable to ship green and stay maintainable.

### Meta vs Properties Policy (Hard Rules)

- Properties-first: Any user-configurable option that affects generated shader code or runtime parameters MUST be a property, not meta.
  - Examples: `shading_model`, render/blend modes, asset bindings (`source`, `texture_source`, `model_source`), boolean/enum feature toggles, and constant exposure/uniform toggles.
- Meta is reserved for editor/infra only and MUST NOT change shader semantics:
  - Allowed: `editor_node`, `editor_panel:*`, `editor_size:WxH`, transient UI tokens/objects that are stripped on save.
  - Disallowed: `shading_*`, `asset:*`, `exposed`, or any token that affects shader output. Use properties instead.
- Render/blend/engine modes live as properties on the owning pass (prefer `fragment_pass`). The language pack maps these properties to code with `placement: "meta"` when needed.
- Exposed uniforms: Implement via a property (e.g., `expose` or `is_uniform`) on nodes that support it. The compiler suppresses node body code based on that property and relies on the property template (with `placement: "meta"`) to emit uniform definitions. Do not gate this behavior on meta.
- Assets: Use `asset`-typed properties only. Do not use `asset:<id>` meta tokens as a transport. Serialization may normalize property values (e.g., swap data URI → stable asset id) without writing meta.
- Graph-level meta: Avoid for shader configuration. Prefer properties on `surface` or the owning pass.
- Meta hygiene: Treat `meta` as `string[]` in canonical data. UI-only/transient objects (e.g., polymorphic helpers) must not be rendered as text and must be filtered out during graph build.

## Quick Commands

- Run unit tests: `bun run test`
- Run E2E tests: `bun run test:e2e`
- Run linter: `bun run lint`
- Typecheck (optional): `bun x tsc -p tsconfig.json --noEmit`

- Run production server: `bun run start`

That’s it. If in doubt, follow the data in `data/**`, confirm APIs with Context7, and don’t submit unless tests and lint are clean.
