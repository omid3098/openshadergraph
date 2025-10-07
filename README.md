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

## Releases

- Versioning is automated by [Semantic Release](https://semantic-release.gitbook.io/semantic-release/).
- Follow the [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) format for every commit so release notes and version bumps are calculated correctly.
- After pushing Conventional Commits, run `bun run release:dry` from `main` (or append `-- --branches $(git rev-parse --abbrev-ref HEAD)` to evaluate your branch) to preview the next version bump and changelog.
- The `CI` workflow publishes releases automatically on pushes to `main` once tests pass; no manual tagging is required.
- Follow the [Release Testing Playbook](docs/release-testing.md) for a full end-to-end smoke test, including the UI badge and the manual GitHub Action dry-run.

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
