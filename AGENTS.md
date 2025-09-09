# AGENTS – Minimal Working Agreement

Purpose: Keep agents aligned on the absolute essentials needed to build, test, and ship the TypeScript-first OpenShaderGraph. Be brief. Be consistent. Ship green. Focus on clean, maintainable and extensible code.

## Tech Stack

- Runtime: `bun` (package manager + task runner)
- Core + UI: TypeScript, Shadcn for UI, ReactFlow for node editor and MaterialX for data structure and premade nodes, graphs and libraries
- Tests: `vitest` (unit), `playwright` (E2E/visual)
- Lint/Format: ESLint (treat warnings as failures)
- Docs via MCP: Context7 (for up-to-date library APIs)

## Canonical Data (Single Source of Truth)

- Nodes: Use all node libraries provided by MaterialX project
- Base node schema: Rely on MaterialX specification: https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/documents/Specification/MaterialX.Specification.md

## Required Gates (must pass locally before submitting)

- `bun run test` → all unit tests green (vitest)
- `bun run lint` → 0 errors, 0 warnings (ESLint)
- `bun dev` and ping the server to make sure loading the main page does not produce any errors.
- If Playwright is configured: `bun run test:e2e` → all E2E tests green
- Optional: `bun x tsc -p tsconfig.json --noEmit` → clean typecheck

## MCP Docs (Context7) Usage

- Resolve library first, then fetch focused docs.
- Typical targets: `reactflow`, `bun`, `@playwright/test`, `vitest`, `shadcn`, `materialx`

## Development Rules

- Data integrity first: adhere to materialx data structure; fail safe with clear errors on unknown/missing templates.
- ALWAYS Tests first: add/modify unit tests in `src/core/**` and E2E tests in `e2e/**` for all new features and bug fixes.
- Small, surgical diffs; prefer targeted fixes over broad refactors.
- When adding core features, extend the TypeScript core under `src/core/**` and keep UI as a thin consumer.
- Preview source of truth: preview panel always renders using a ThreeJS GLSL fragment shader compiled from the current graph. Always compile `ThreeJS_GLSL` under the hood for preview, regardless of the selected output language.
- Default compiler: default compile output language is `ThreeJS_GLSL`. Users can switch the compile output view, but preview remains bound to the ThreeJS GLSL compilation.
- Centralized updates: define node update callbacks in `App` (e.g., `updateInputValue`, `updateNodeLabel`, `addNodeMeta`, `removeNodeMeta`) and attach them to `node.data`. Panels and renderers MUST use these callbacks instead of calling `rf.setNodes` directly.

## Lessons Learned

- Avoid leaving stub implementations in shared utilities. Provide safe fallbacks and unit tests so missing preview helpers cannot crash the app at runtime.
- Keep server endpoints in sync with MaterialX as the canonical node source. Tests should cover node palette generation and MaterialX serialization so UI menus and graph data reflect the true graph.
- Load example graphs from MaterialX XML files and ensure graph data updates whenever nodes or connections change.
- Source example graphs from MaterialX's `resources/Materials/Examples` directory and keep the parser in sync with typed nodes and graph outputs used there.
- Mirror MaterialX's example directory structure so all upstream materials are available and grouped by their folders.
- Avoid committing large or binary example assets (textures, images). Fetch MaterialX examples on demand and cache them locally so pushes stay light.
- Ensure the MaterialX parser handles top-level shader nodes and multiple nodegraphs so example selections never load empty; cover both styles in tests.

## Quick Commands

- Run unit tests: `bun run test`
- Run E2E tests: `bun run test:e2e`
- Run linter: `bun run lint`
- Typecheck (optional): `bun x tsc -p tsconfig.json --noEmit`

That’s it. If in doubt, follow the data in materialx repository, confirm APIs with Context7, and don’t submit unless tests and lint are clean.
