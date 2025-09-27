---
title: Getting Started
---

# Getting Started

This guide helps you run the app, explore nodes, and create your first graph.

## Prerequisites

- Bun runtime installed (`bun --version`)
- Node-compatible toolchain for dev (TypeScript, ESLint are included)
- Optional for docs: Python + `mkdocs` per `requirements.txt`

## Install and Run

```bash
bun install

# Start dev server (hot):
bun run dev

# Or run production build and server:
bun run build && bun run start
```

When the server starts, you’ll see a URL like:

```text
🚀 Server running at http://localhost:3000
```

Open the URL to access the editor. The preview compiles ThreeJS GLSL under the hood regardless of the selected export language.

## Explore Nodes

Canonical node definitions live in `data/nodes/**.json`. The editor loads these at runtime via `/api/nodes`. Language packs live in `data/languages/*.json` and define how nodes compile per backend.

Key nodes to try:

- `constants/color` → RGBA color input
- `math/add`, `math/multiply` → arithmetic
- `fragment_output` → connects material channels like Albedo, Roughness, Metallic

## Create Your First Graph

1. Add a `Color` node and pick a color.
2. Add `FragmentOutput` and connect `Color.out` to `Albedo`.
3. Adjust `Roughness` and `Metallic` as needed.

You should see the preview update instantly. Use the inspector to tweak inputs and properties. IDs, pin order, and hierarchy are preserved on save.

## Examples

Two ready-made examples are included under `examples/` and in the UI examples panel:

- Basic Color (`examples/basic_color.json`)
- Addition (Color + Color) (`examples/addition_color_color.json`)

## Running the Docs Locally

```bash
# Serve docs at http://localhost:8000 by default
bun run docs:dev

# Build docs into dist/docs (served by the app in production)
bun run docs:build
```

If `mkdocs` is missing, follow the hint printed by the scripts to create a virtualenv and install from `requirements.txt`.

Continue with Features to understand the core concepts and guardrails.
