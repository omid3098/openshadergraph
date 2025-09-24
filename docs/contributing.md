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
