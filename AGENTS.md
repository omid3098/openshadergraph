# AGENTS – Minimal Working Agreement

Purpose: Keep agents aligned on the absolute essentials needed to build, test, and ship the TypeScript-first OpenShaderGraph. Be brief. Be consistent. Ship green. Focus on clean, maintainable and extensible code.

## Tech Stack
- Runtime: `bun` (package manager + task runner)
- Core + UI: TypeScript, ReactFlow
- Tests: `vitest` (unit), `playwright` (E2E/visual)
- Lint/Format: ESLint (treat warnings as failures)
- Docs via MCP: Context7 (for up-to-date library APIs)

## Canonical Data (Single Source of Truth)
- Nodes: `data/nodes/**.json`
- Base node schema: `data/node.json`
- Language packs: `data/languages/*.json`
- Python is reference only: `python_backup/**` must not be modified or used at runtime.

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
- Data integrity first: adhere to `data/node.json` and language packs; fail safe with clear errors on unknown/missing templates.
- Small, surgical diffs; prefer targeted fixes over broad refactors.
- When adding core features, extend the TypeScript core under `src/core/**` and keep UI as a thin consumer.
 - Preview source of truth: preview panel always renders using a ThreeJS GLSL fragment shader compiled from the current graph. Always compile `ThreeJS_GLSL` under the hood for preview, regardless of the selected output language.
 - Default compiler: default compile output language is `ThreeJS_GLSL`. Users can switch the compile output view, but preview remains bound to the ThreeJS GLSL compilation.

## Pitfalls & Guardrails (Retro)
- Duplicate type definitions: never redefine core types in multiple files. Source them from a single `src/core/schema/types.ts` module.
- Unvalidated JSON: always validate `data/nodes/**.json` and `data/languages/*.json` at load time using zod. Fail with clear, actionable errors.
- Mixed runtime APIs: avoid Bun-only utilities (e.g., `Bun.Glob`) inside reusable handlers. Prefer Node FS (`fs.readdir` + recursion) for portability and testability.
- UI monoliths: do not cram complex editors into node renderers. Extract inputs (color, numeric vector, etc.) into `src/components/inputs/**` and keep `GraphNode` focused on layout.
- Handle id regex drift: centralize handle helpers (`parseHandleId`, `makeInHandle`, `makeOutHandle`) in `src/core/ui/handles.ts`. Reuse everywhere.
- Serialization ownership: keep graph (de)serialization UI-agnostic and tested under `src/core/graph/**`. Do not reorder IDs, pins, or children.
- Example graphs coupling: keep example-building logic in `src/server/examples.ts`, not in the server bootstrap. Handlers live in `src/server/**`.
- Type safety drift: turn on TypeScript `strict` and favor precise types in `src/core/**`. Add tests when tightening types to avoid regressions.

These are non-negotiable to ship green and stay maintainable.

## Quick Commands
- Run unit tests: `bun run test`
- Run E2E tests: `bun run test:e2e`
- Run linter: `bun run lint`
- Typecheck (optional): `bun x tsc -p tsconfig.json --noEmit`

That’s it. If in doubt, follow the data in `data/**`, confirm APIs with Context7, and don’t submit unless tests and lint are clean.
