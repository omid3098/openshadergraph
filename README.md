# OpenShaderGraph

[![CI](https://github.com/omid3098/openshadergraph/actions/workflows/ci.yml/badge.svg)](https://github.com/omid3098/openshadergraph/actions/workflows/ci.yml)

Engine-agnostic node-based shader graph for authoring shaders with template-driven compilation to multiple targets.

## Getting Started

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

This project implements a TypeScript-first node-based shader graph with ReactFlow and a Bun server, using canonical node templates in `data/nodes/**` and language packs in `data/languages/**`.

Quick commands:

- Run unit tests: `bun run test`
- Run linter: `bun run lint`
- Start dev server: `bun run dev`
- Build for production: `bun run build`

## Documentation

- Serve locally: `bun run docs:dev` (requires Python + `pip install -r requirements.txt`)
- Build into `dist/docs`: `bun run docs:build`
- At runtime, the Bun server serves docs at `/docs` when built.

See `AGENTS.md` for the minimal working agreement and gates.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started, code style, testing requirements, and the pull request process.

## Static Bundles Mode (parity with Pages)

- Build bundles and manifest:

```bash
bun run build
```

- Start dev server (serves bundles from dist with immutable cache):

```bash
OSG_STATIC_BUNDLES=1 bun run dev
```

- Notes:
  - The app runs against server APIs only; static bundle fallbacks are not used.
  - First compile is gated on language readiness; preview should render quickly on cold start.

---

Note: Minor README edit to validate versioning bump workflow.
