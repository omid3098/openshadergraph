# AGENTS – Minimal Working Agreement

Purpose: Keep agents aligned on the absolute essentials needed to build, test, and ship the TypeScript-first OpenShaderGraph. Be brief. Be consistent. Ship green.

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
- Scope discipline: do not touch `python_backup/**`.
- Data integrity first: adhere to `data/node.json` and language packs; fail safe with clear errors on unknown/missing templates.
- Small, surgical diffs; prefer targeted fixes over broad refactors.
- When adding core features, extend the TypeScript core under `src/core/**` and keep UI as a thin consumer.

## Quick Commands
- Run unit tests: `bun run test`
- Run E2E tests: `bun run test:e2e`
- Run linter: `bun run lint`
- Typecheck (optional): `bun x tsc -p tsconfig.json --noEmit`

That’s it. If in doubt, follow the data in `data/**`, confirm APIs with Context7, and don’t submit unless tests and lint are clean.
