---
title: Developers
---

# Developers

Set up the project locally, build, and run tests.

## Prerequisites

- Bun runtime (`bun --version`)
- Python (for docs) if you plan to edit docs: `pip install -r requirements.txt`

## Install & Run

```bash
bun install

# Dev (watch build + hot server)
bun run dev

# Production build + server
bun run build && bun run start
```

## Tests & Lint

```bash
bun run test
bun run lint
# optional typecheck
bun x tsc -p tsconfig.json --noEmit
```

## Docs

```bash
# Serve docs locally at /docs
bun run docs:dev
# Build docs to dist/docs (served in production)
bun run docs:build
```

See `AGENTS.md` for project rules and gates.
