## OpenShaderGraph Technical Audit

### Executive Summary

- The project demonstrates solid engineering practices: strong test coverage, data-first architecture, and a pragmatic Bun build/deploy pipeline.
- The most critical risks relate to inadvertent graph mutations during compile and duplicated preview-default logic. These threaten round‑trip integrity and future maintainability.
- This report lists strengths, issues, and prioritized, actionable Jira tasks with acceptance criteria.

---

### What’s Working Well

- Strong testing discipline with Vitest and focused jsdom UI tests.
- Data integrity via zod validators and runtime normalization for nodes and language packs.
- Bun build script that generates indices, precompresses artifacts, and integrates docs when available.
- Centralized UI update callbacks (`nodeUpdaterApi`) injected into node data, avoiding direct ReactFlow mutations from panels.
- Guardrails in server routing: safe path normalization; production serves from `dist/**`.
- Compiler’s type and GLSL formatting utilities maintain consistent shader generation.

---

### Risks and Issues

1. Compiler mutates canonical graph inputs

```410:417:src/core/compiler/graphCompiler.ts
      if ((input.value === undefined || input.value === null || (Array.isArray(input.value) && input.value.length === 0))) {
        try {
          const tpl = getNodeTemplate(node.type);
          const defVal = tpl?.inputs?.[index] ? (tpl as any).inputs[index].value : undefined;
          if (defVal !== undefined) {
            (input as any).value = defVal;
          }
        } catch (_err) { /* ignore missing template */ }
      }
```

2. Compiler reorders children and writes back

```779:783:src/core/compiler/graphCompiler.ts
    const sorted = this.sort_children_by_dependencies(node);
    node.nodes = sorted;
    for (const child of sorted) {
      child.parent = node;
```

3. Duplicated preview shading defaults (risk of drift)

```13:35:src/core/compiler/graphCompiler.ts
// applyPreviewEngineDefaults(...)
```

```78:100:src/server/handlers.ts
if (engine === "preview") { /* applies default shading model */ }
```

4. Unused CDN rewrite helpers add noise

```12:39:src/server/routes.ts
// toCdn / rewriteBareImports declared but unused
```

5. Dev server serves project-root files in development

```98:120:src/server/routes.ts
// In dev, falls back to project-root candidates
```

6. Lint rule intent vs. severity

```47:72:eslint.config.js
"@typescript-eslint/no-unused-vars": [ "warn", ... ]
```

---

### Recommendations

- Make the compiler pure: avoid mutating inputs or child arrays; compute render-time fallbacks in local variables or clones.
- Preserve original child order; use a local sorted view for compile order only.
- Centralize preview-default logic into a single helper and reuse from server/compiler.
- Remove or wire CDN rewrite helpers; document if kept.
- Align ESLint rule severities with the zero-warning gate.
- Add tests that assert no graph mutation during compile (inputs, order, IDs).

---

### Jira Tasks

1. CORE-101: Make compiler side-effect free on graph

- Description: Update `GraphCompiler` to avoid mutating provided graph objects. Do not assign template defaults into `input.value`. Do not overwrite `node.nodes` for ordering; instead, use a local ordered list when compiling. Ensure `parent` references are not written into caller objects or are confined to an internal clone.
- Acceptance Criteria:
  - A new unit test verifies deep equality of graph before/after compile (values, order, IDs unchanged).
  - Inputs with empty values are rendered using defaults without mutating the graph.
  - Child order in the graph remains identical before/after compile.
  - All existing tests remain green.

2. CORE-102: Centralize preview shading defaults

- Description: Extract preview shading default logic into a shared module (e.g., `src/core/preview/defaultShading.ts`). Replace duplicate logic in server handler with a call to the shared helper. If the compiler needs it, import the same helper rather than maintaining a second version.
- Acceptance Criteria:
  - Single exported function applies default `shading_model` to `fragment_output` when missing and strips `shading_*` meta.
  - Server `/api/compile` uses the helper when `engine === "preview"`.
  - No duplicated implementations remain.
  - Unit test covers behavior across nested nodes.

3. SERV-103: Remove or integrate CDN rewrite helpers

- Description: In `src/server/routes.ts`, either remove `toCdn`/`rewriteBareImports` if unused, or add a documented feature flag that applies them for specific dev endpoints. Prefer deletion to reduce complexity unless there’s a planned use.
- Acceptance Criteria:
  - Unused helpers removed or gated behind a clear, documented path.
  - Lint passes without unused code warnings.

4. SERV-104: Harden dev/prod route selection

- Description: Ensure production never serves files from the project root. Add an explicit assertion/log when `development === false`, and simplify the candidate list in prod to `dist/**` only (current behavior is correct; add guardrails/docs).
- Acceptance Criteria:
  - Production path only serves `dist/**` and `index.html` fallback.
  - Added inline docstring explaining dev vs prod behavior.
  - Test (integration or unit) verifies prod path resolution does not read project-root files.

5. DX-105: Align ESLint severities with zero-warning policy

- Description: Change warning-level rules that are intended to fail CI (given `--max-warnings=0`) to `"error"` to better express intent in editors and logs. Start with `@typescript-eslint/no-unused-vars` and `react-hooks/exhaustive-deps`.
- Acceptance Criteria:
  - ESLint config updated; local run shows 0 warnings, 0 errors on clean branch.
  - CI continues to pass with no unexpected churn.

6. TEST-106: Add compile immutability and order-preservation tests

- Description: Add unit tests asserting compile does not mutate the input graph:
  - Inputs: values unchanged when renderer consumes defaults.
  - Order: `nodes` array order preserved for all containers.
  - IDs: no renumbering or reassignments.
- Acceptance Criteria:
  - New tests under `tests/` pass and fail if mutations occur.
  - Coverage includes nested groups and pass nodes.

7. DX-107 (Optional): Default jsdom for TSX tests

- Description: Configure Vitest to auto-apply `jsdom` for `**/*.spec.tsx` to reduce per-file annotations, unless explicit per-file pragma is preferred.
- Acceptance Criteria:
  - Vitest config updated with `environmentMatchGlobs` (or equivalent) for `*.tsx`.
  - Existing UI tests run without the pragma and pass.

---

### Rollout Plan

1. Land CORE-101 with tests (TEST-106) to stabilize graph immutability and ordering.
2. Land CORE-102 to remove duplication and reduce drift.
3. Clean up server helpers (SERV-103) and add docs/guards (SERV-104).
4. Tighten ESLint severities (DX-105).
5. Optional DX enhancement (DX-107).

---

### Closing Note

The team has built a clean, extensible foundation. Addressing the mutation and duplication hotspots will protect data integrity and reduce maintenance cost as the node and language libraries grow.
