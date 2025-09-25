---
title: Contributing
---

## Local Setup

```bash
bun install
bun run dev
```

## Docs Development

1. Ensure Python 3.10+ is installed
2. Create a venv and install deps:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Serve docs locally:

```bash
mkdocs serve
```

Or via Bun:

```bash
bun run docs:dev
```

## Gates

- `bun run lint` → 0 warnings
- `bun run test` → all green
- `mkdocs build` → succeeds

## Handle Helpers (Required)

When working with React Flow handles or serializing connections, always use the centralized helpers from `src/core/ui/handles.ts`:

- `parseHandleId(handleId: string)`
- `makeInHandle(pinId: number | string)`
- `makeOutHandle(pinId: number | string)`

Guidelines:

- Do not parse or format handle IDs ad‑hoc. The helpers encapsulate the canonical format and future changes.
- Use `parseHandleId` to extract side/pin id from a handle string before logic branches.
- Use `makeInHandle`/`makeOutHandle` when creating edges or locating pins, including in tests.
- Keep all handle ID regex changes in `src/core/ui/handles.ts` and update tests accordingly.
