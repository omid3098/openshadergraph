# Project Context

## Purpose

OpenShaderGraph is an engine‑agnostic, node‑based shader graph. It compiles graphs using template‑driven code generation to multiple targets (e.g., Godot, ThreeJS GLSL, Bevy WGSL, etc.) while keeping a single canonical data model. The UI is a thin React client over a Bun server that handles compilation and serves canonical data.

## Tech Stack

- Runtime: Bun (package manager + task runner)
- Language: TypeScript (strict)
- UI: React 19, ShadCN UI components, Tailwind CSS 4
- Graph renderer: `@xyflow/react` (ReactFlow)
- 3D/preview: `three` (fragment shader preview)
- Server/build: Bun HTTP + custom `build.ts` with Bun define embedding
- Validation: `zod` (JSON schemas)
- Lint/format: ESLint 9 (warnings fail), Prettier defaults
- Tests: Vitest (unit, coverage), Playwright (E2E/visual)
- Releases: `semantic-release` (Conventional Commits)
- Docs: MkDocs (`bun run docs:dev`, `docs/build`)
- MCP Docs helper: Context7 (resolve → fetch focused docs)

## Project Conventions

### Code Style

- TypeScript strict mode on; avoid `any`; prefer precise, explicit public API types.
- Naming: PascalCase for React components; camelCase for vars/functions; UPPER_SNAKE_CASE for true constants.
- Imports: prefer absolute `@/*` alias across app; use short relative imports only within the same folder.
- ESLint: warnings are errors (`--max-warnings=0`). Keep code auto‑fixable; no unused imports/exports.
- Comments: only for non‑obvious rationale, invariants, and caveats; avoid redundant comments.
- Formatting: Prettier/Eslint defaults; match existing style; keep lines readable.

### Architecture Patterns

- Single source of truth lives under `data/`:
  - Node definitions: `data/nodes/**.json` (no logic; pins/properties/layout only)
  - Base node schema: `data/node.json`
  - Language packs (templates): `data/languages/*.json`
- JSON validation: validate all `data/nodes/**` and `data/languages/*.json` with `zod` at load; fail safe with actionable errors.
- Template compilation: graph compilation is template replacement per language pack; no business logic in node JSON.
- Preview policy: preview always compiles `ThreeJS_GLSL` regardless of selected output language; export view can switch languages (default Godot).
- Environment ownership: never bake lighting/exposure defaults in language templates. Preview provides uniforms at runtime. Templates declare uniforms only.
- Meta vs Properties policy (hard rules): user‑configurable shader semantics must be properties, not meta. Meta is editor‑only and must not change shader output. Assets use property types, not meta tokens. See repo policy for details.
- UI is thin over core: extend core under `src/core/**`; keep renderers/components simple consumers.
- Centralized UI updates: define and pass callbacks in `App` (e.g., `updateInputValue`, `updateNodeLabel`, `addNodeMeta`, `removeNodeMeta`); panels/renderers must use these instead of mutating ReactFlow state directly.
- Handles/helpers centralized in `src/core/ui/handles.ts` (`parseHandleId`, `makeInHandle`, `makeOutHandle`).
- Graph (de)serialization is UI‑agnostic and tested under `src/core/graph/**`. Do not reorder IDs, pins, or children.
- "Visible nodes" are derived for display; never persist from this filtered set to avoid parent loss.
- Built‑in defaults: use lightweight `builtin:<key>` tokens in node JSON; compiler resolves per language.
- Avoid Bun‑only helpers inside reusable library code; prefer Node‑compatible APIs for portability/tests.

### Testing Strategy

- Gates: always run `bun run gates` locally before committing/merging. This umbrella task runs lint, typecheck, unit tests, coverage, shader validation (Godot + Three), and Playwright E2E.
- Treat ESLint warnings as failures. Fix and rerun the full gates command until green.
- First‑time E2E setup: `bun run test:e2e:install` to install Chromium.
- Unit tests live under `src/core/**`; E2E tests live under `e2e/**` and run against the production server (`bun run start`).
- Preview invariants are enforced by tests (e.g., uniforms for lighting/exposure must not be baked into templates).

### Git Workflow

- Conventional Commits for every change (e.g., `feat:`, `fix:`, `refactor:`). Breaking changes must use `!` or a `BREAKING CHANGE:` footer.
- Semantic Release computes versions and changelogs; do not push tags manually. Dry‑run locally via `bun run release:dry`.
- CI must fast‑fail on `bun run lint` and `bun x tsc`. Agents/humans should attach logs (with Bun version) for gates when proposing PRs.
- Branch protection requires green gates before merge. Agents do not self‑approve/merge.

## Domain Context

- Graph rules:
  - Node IDs are integers and unique within the graph hierarchy.
  - Connections encode as relative refs: `../<nodeId>/<pinId>` on both ends (input and output).
  - Never reorder pins, children, or IDs during load/save round‑trips.
- Compilation:
  - Canonical nodes and language packs drive codegen; compiler resolves `builtin:*` tokens and property templates.
  - Preview always uses `ThreeJS_GLSL`; selected export language can differ (default Godot).
- Server/runtime:
  - API endpoints serve canonical data: `/api/languages`, `/api/nodes`, `/api/assets`, `/api/example-graphs`.
  - Compilation endpoint: `POST /api/compile` (used by preview and export).
- Viewer embedding (`viewer.html`): accepts `graph64`/`graph`, `demo`, `theme`, `fit`, `interactive`, `menubar`, `sidebar` via query or iframe `data-*` attributes. Compilation panels are disabled in the viewer.

## Important Constraints

- Do not bake preview environment or exposure into templates; preview passes uniforms (e.g., `uKeyDir`, `uKeyColor`, `uFillDir`, `uFillColor`, `uRimDir`, `uRimColor`, `uAmbient`, `uExposure`).
- Properties‑first: `shading_model`, render/blend modes, asset bindings, toggles must be properties. Meta is editor/infra only.
- Assets use property types; no `asset:<id>` meta tokens. Serialization may normalize property values.
- Preserve `parentId`, `position`, and children on all UI edits; never move nodes across parents as a side effect.
- Treat `meta` canonically as `string[]`; strip transient UI objects during graph build.
- Build does not mutate source files; build metadata is embedded via Bun `define` and read by `src/version.ts`.
- TypeScript strict; avoid unsafe casts; keep core types centralized (no duplication across files).

## External Dependencies

- Libraries: `@xyflow/react`, `three`, `zod`, `@testing-library/react`, `@playwright/test`, `vitest`, `tailwindcss`, `lucide-react`, Radix UI primitives, `react-hook-form`.
- Tooling: `semantic-release` (+ plugins), ESLint 9, Typescript 5.9, MkDocs.
- MCP: Context7 for up‑to‑date library API docs (resolve library → fetch focused docs).

---

Quick commands (local):

- Dev server: `bun run dev`
- Lint: `bun run lint`
- Unit tests: `bun run test`
- E2E tests: `bun run test:e2e` (first run: `bun run test:e2e:install`)
- Build: `bun run build`
- Start (prod): `bun run start`
