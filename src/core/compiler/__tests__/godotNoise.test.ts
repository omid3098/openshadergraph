import { beforeAll, describe, expect, it } from "vitest";
import { NodeBuilder } from "../../graph/node";
import type { LanguagePack } from "../../graph/types";
import { GraphCompiler } from "../graphCompiler";
import { loadLanguage } from "../../schema/registry";

describe("Godot noise templates", () => {
  let godotLang: LanguagePack;

  beforeAll(async () => {
    godotLang = await loadLanguage("Godot");
  });

  it("emits voronoi noise without unsupported mat2 constructors", () => {
    const surfaceBuilder = new NodeBuilder("surface");
    const fragmentPass = surfaceBuilder.get_node_by_type("fragment_pass");
    expect(fragmentPass).toBeTruthy();
    if (!fragmentPass) return;

    const fragmentOutput = surfaceBuilder.find_nested_node_by_type(fragmentPass, "fragment_output");
    expect(fragmentOutput).toBeTruthy();
    if (!fragmentOutput) return;

    const voronoi = surfaceBuilder.create_node("voronoi_noise", fragmentPass);
    surfaceBuilder.connect_nodes(voronoi, fragmentOutput, 0, 0);

    const compiler = new GraphCompiler(surfaceBuilder.to_dict(), godotLang);
    compiler.compile();

    expect(compiler.result_code).not.toMatch(/mat2\s*\(/);
    expect(compiler.result_code).toMatch(/dot\(/);
  });
});
