<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

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

## Required Gates (run ALL locally before confirming a solution, adding a feature, or pushing)

- Agents MUST execute `bun run gates` **before committing**. This umbrella task sequentially runs lint, typecheck, unit tests, coverage, shader validation, and Playwright E2E checks, ensuring every gate is exercised in one command.
- If `bun run gates` surfaces a failing subcommand, fix the issue and rerun the full command until it passes. Do **not** rely on running individual gate commands in isolation.
- First time only: run `bun run test:e2e:install` before `bun run gates` so Playwright has the required browsers.
- `bun install --frozen-lockfile` remains required whenever dependencies change.

Agent behavior requirements:

- Attach the full stdout/stderr for each command to the PR (as artifacts or a comment). Logs should include the exact Bun version and the commands run.
- If any command exits non-zero, the agent MUST abort the change, mark the PR as failing, and include a remediation plan.
- Agents MUST call `todo_write` (merge=true) to record each gate's status (pending → in_progress → completed/failed) before approving or merging. The todo entries should be one-line, verb-led items matching the repo `todo_spec` style.
- Agents MUST not merge or approve PRs on behalf of humans. They may propose changes and create PRs, but approval/merge requires a human reviewer after gates pass in CI.
- Agents SHOULD pin/declare the Bun runtime version used for validation and prefer reproducing the CI Bun version (from `bun.lock` or workflow) to avoid environment drift.

Enforcement & recommended infra:

- CI MUST include a fast-fail job that runs `bun run lint` and `bun x tsc` and be marked as a required status check in branch protection rules.
- PR templates should include an "Agent Validation" checklist and require attached logs/artifacts for lint/tsc/tests when an agent created the PR.
- Consider adding `husky` + `lint-staged` to enforce local pre-push checks for contributors (human or agent-run workflows).

These requirements are mandatory for any automation labeled as an "agent" in PR metadata. Failure to follow these rules will cause automated validations to mark the PR as non-compliant and block merges.

### E2E Testing Setup

First time only - install Chromium browser:

```bash
bun run test:e2e:install
```

Run E2E tests (Chromium - matches CI):

```bash
bun run test:e2e
```

For local development with VSCode Playwright extension:

- Use Testing sidebar to run/debug individual tests
- Tests run against production server (`bun run start`)
- See `e2e/README.md` for detailed guide

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

## Versioning & Build Metadata

- `build.ts` no longer mutates source files. It embeds build metadata (version, commit, dirty flag, deploy label) through Bun's `define` mechanism so browser bundles receive the right constants without touching git.
- `src/version.ts` reads those compile-time constants and gracefully falls back to environment variables (useful for tests or ad-hoc builds).
- The header badge shows `vX.Y.Z` plus the deploy label with a tooltip that includes the commit hash and build timestamp. It's informational only.
- Semantic Release owns version bumps, changelog updates, and git tags. Local builds should not attempt to rewrite tags or bump versions manually.

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

- Run development (watch build + hot server): `bun run dev`

- Run production server: `bun run start`

- Publish tags created by the production build: `git push --tags`

## Versioning & Release Flow

- Automated releases are powered by [Semantic Release](https://semantic-release.gitbook.io/semantic-release/).
- **Always** use [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) messages so release automation can infer the next version.
  - Structure: `<type>(optional scope): <short imperative summary>`.
  - Common types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`.
  - Breaking changes require either an appended `!` (e.g. `feat!: ...`) or a `BREAKING CHANGE:` footer with the rationale.
- To confirm the next release number locally, run `bun run release:dry` after committing. Execute it from `main` or append `-- --branches $(git rev-parse --abbrev-ref HEAD)` so Semantic Release evaluates your feature branch; the CLI prints the computed `nextRelease.version` without publishing.
- GitHub Actions runs `semantic-release` automatically on pushes to `main` after CI succeeds (`.github/workflows/ci.yml`), so never push tags manually.
- Changelog entries are generated from commit messages and will credit contributors automatically, so list co-authors in the commit trailer when relevant.
- For a complete rehearsal, follow `docs/release-testing.md`. It covers crafting a scratch Conventional Commit, verifying the UI badge, and triggering the `.github/workflows/release-dry-run.yml` workflow for a no-tag dry run in GitHub Actions.

That’s it. If in doubt, follow the data in `data/**`, confirm APIs with Context7, and don’t submit unless tests and lint are clean.

## Build/Test Commands

- **Build**: `bun run build`
- **Lint**: `bun run lint` (warnings = errors)
- **Typecheck**: `bun x tsc -p tsconfig.json --noEmit`
- **All tests**: `bun run test`
- **Single test**: `vitest run path/to/file.spec.ts`
- **E2E tests**: `bun run test:e2e` (first run: `bun run test:e2e:install`)
- **Dev server**: `bun run dev`

## Code Style Guidelines

- **TypeScript**: Strict mode enabled. Avoid `any`; use precise types.
- **Imports**: Prefer absolute paths with `@/*` alias. Relative imports only within the same folder when reasonable.
- **Naming**: PascalCase for React components; camelCase for variables/functions; UPPER_SNAKE_CASE for true constants.
- **Components**: React JSX runtime; follow Hooks rules; keep UI thin and declarative.
- **Error handling**: Fail safe with clear, actionable errors (especially for data/language JSON validation).
- **Formatting**: Use ESLint/Prettier defaults; keep code auto-fixable; no unused imports/exports.
- **Architecture**: Core logic in `src/core/**`; UI as a thin consumer. Reuse centralized callbacks and helpers.

## Deployment – Server (API) Playbook

Background: The app is deployed behind a Bun server with full `/api/*` endpoints. Static-only hosts are not targeted. The preview still compiles ThreeJS GLSL via the server compiler for consistency.

What we ship in `dist/` (build.ts):

- Copy canonical assets into output:
  - `dist/data/**` (nodes, languages, assets)
  - `dist/examples/**`
- Generate indices for inspection and tooling (optional for server runtime):
  - `dist/data/nodes.index.json`
  - `dist/data/languages.index.json`
  - `dist/examples/index.json`

Client behavior:

- Nodes, languages, assets, and examples are fetched via `/api/*` endpoints only.
- Compile uses POST `/api/compile` for both preview and export.

Preview policy:

- Always compile ThreeJS GLSL in preview, regardless of selected output language.
- Do not bake environment or exposure into language templates; preview uniforms are provided by the renderer.

Deployment checklist (Server):

1. `bun run build` to create `dist/`.
2. Start server: `bun run start` (or your process manager).
3. Verify in Network tab (Disable cache):
   - 200 for `/api/languages`, `/api/nodes`, `/api/assets`, `/api/example-graphs`.
   - POST `/api/compile` returns code.

## Viewer Embedding Parameters

The documentation viewer at `viewer.html` accepts parameters via query string or iframe `data-*` attributes. Current parameters:

- `graph64`: base64url-encoded DocGraph JSON (preferred; see `src/viewer/DocGraph.ts`).
- `graph`: raw DocGraph JSON string.
- `demo`: optional built-in demo key (e.g., `float-sin`).
- `theme`: `light` or `dark` (default: `dark`).
- `fit`: `true` or `false` (default: `true`) – auto-fit after load.
- `interactive`: `true` or `false` (default: `true`) – enable drag/select/connect and add-node menu.
- `menubar`: `true` or `false` (default: `false`) – show header chrome.
- `sidebar`: `true` or `false` (default: `false`) – show left sidebar chrome.

Notes:

- Compilation and right-side dock panels are disabled in the viewer to preserve performance; `compile`, `preview`, and `graphdata` flags are currently ignored.

Examples

Embed with query parameters (use URL-encoded JSON for `graph`):

```html
<iframe
  src="/viewer.html?graph=%7B%22v%22%3A1%2C%22nodes%22%3A%5B%7B%22id%22%3A1%2C%22t%22%3A%22float%22%2C%22x%22%3A60%2C%22y%22%3A100%2C%22props%22%3A%7B%22value%22%3A0.5%7D%7D%2C%7B%22id%22%3A2%2C%22t%22%3A%22sin%22%2C%22x%22%3A280%2C%22y%22%3A100%7D%5D%2C%22edges%22%3A%5B%7B%22from%22%3A%5B1%2C0%5D%2C%22to%22%3A%5B2%2C0%5D%7D%5D%7D&interactive=true&theme=light&menubar=true"
  width="100%"
  height="420"
  style="border:0"
></iframe>
```

Embed with `data-*` attributes (same keys as query) using raw JSON via `data-graph`:

```html
<iframe
  src="/viewer.html"
  data-graph='{"v":1,"nodes":[{"id":1,"t":"float","x":60,"y":100,"props":{"value":0.5}},{"id":2,"t":"sin","x":280,"y":100}],"edges":[{"from":[1,0],"to":[2,0]}]}'
  data-interactive="true"
  data-theme="dark"
  data-menubar="false"
  data-sidebar="false"
  width="100%"
  height="420"
  style="border:0"
></iframe>
```

Reference implementation lives in `src/viewer.tsx` (flag parsing) and `src/viewer/DocGraph.ts` (graph payload parsing).
