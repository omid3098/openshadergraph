import { beforeAll, describe, expect, it } from "vitest";
import type { LanguagePack } from "@/core/schema/types";
import { loadLanguage } from "@/core/schema/registry";
import { GraphCompiler } from "@/core/compiler/graphCompiler";
import { buildNodeHarness } from "@/core/testing/nodeHarness";
import { getNodeHarnessCatalog } from "@/core/testing/nodeHarnessCatalog";

let language: LanguagePack;

beforeAll(async () => {
  language = await loadLanguage("ThreeJS_GLSL");
});

describe("node harness catalog", () => {
  it("compiles every harnessable node without throwing", () => {
    const entries = getNodeHarnessCatalog();
    const harnessable = entries.filter((entry) => !entry.skip);
    expect(harnessable.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const entry of harnessable) {
      try {
        const harness = buildNodeHarness(entry.type, entry.options);
        const compiler = new GraphCompiler(harness.surface, language);
        compiler.compile();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${entry.type}: ${message}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Node harness compilation failures (${failures.length}):\n- ${failures.join("\n- ")}`);
    }
  });

  it("assigns skip reasons for unsupported nodes", () => {
    const skipped = getNodeHarnessCatalog().filter((entry) => entry.skip);
    for (const entry of skipped) {
      expect(entry.reason ?? "").not.toHaveLength(0);
    }
  });
});
