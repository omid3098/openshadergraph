# Node Validation Test Harness Plan

## Why we are doing this
- Prevent regressions where node templates compile for export but break the ThreeJS preview or downstream engines.
- Provide deterministic coverage for every node JSON so new additions inherit the same guarantees without manual QA.
- Unify shader validation (unit + GPU compilers) so CI gates catch missing uniforms, duplicate varyings, or mis-declared sampler requirements early.

## How we will do it
- Build a reusable harness that converts any node template into a minimal, compilable surface graph targeting `ThreeJS_GLSL`.
- Run the generated shader through the same preview pipeline used by `PreviewPanel` to surface uniform/sampler issues.
- Extend existing validation scripts so both ThreeJS (WebGL) and Godot compilers exercise the per-node shaders alongside example graphs.
- Document the workflow so contributors know how to add fixtures for complex nodes and interpret failures.

## Jira Task Breakdown
| Task ID | Title | Description | Priority | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| OSG-1 | Inventory & Harness Requirements | Audit node templates, classify which can run standalone vs. needing fixtures, and document harness constraints. | High | Inventory covers all `data/nodes/**`; fixture needs are captured in a shared config draft. |
| OSG-2 | Implement Node Harness Core | Create `src/core/testing/nodeHarness.ts` that builds minimal surface graphs, supports type coercion, and exposes hooks for fixture overrides. | High | Harness produces compilable graphs for at least five representative nodes (math, texture, lighting, container) with unit tests proving graph structure. |
| OSG-3 | Add Vitest Coverage Suite | Add `src/core/compiler/__tests__/nodeTemplates.test.ts` running `GraphCompiler` + preview sanitization for every harnessable node; parameterize pin type permutations where applicable. | High | Test suite passes on main; failures identify the specific node/pin; coverage report includes new specs. |
| OSG-4 | Extend Shader Validation Scripts | Update `scripts/validateThree.ts` and `scripts/validateGodot.ts` to compile harness output, sharing code via a new helper module. | Medium | `bun run validate:shaders` exercises both example graphs and per-node shaders; failures emit node IDs and compiler logs. |
| OSG-5 | Documentation & Contributor Guide | Document harness usage, fixture mechanics, and troubleshooting steps in `docs` and PR template checklist. | Medium | Docs merged; PR template references attaching harness logs; contributors can follow guide without additional onboarding. |
| OSG-6 | CI & Runtime Integration | Ensure CI jobs run the new test suite and validation scripts, update required checks, and capture logs as artifacts per working agreement. | Medium | CI pipeline includes new steps; logs show Bun version and commands; required checks enforced on PR branches. |
