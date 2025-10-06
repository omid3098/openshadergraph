import { beforeAll, describe, expect, it } from "vitest";
import type { LanguagePack } from "@/core/schema/types";
import { loadLanguage } from "@/core/schema/registry";
import { buildNodeHarness } from "@/core/testing/nodeHarness";
import { GraphCompiler } from "@/core/compiler/graphCompiler";

describe("camera node", () => {
  let threeLanguage: LanguagePack;
  let godotLanguage: LanguagePack;

  beforeAll(async () => {
    [threeLanguage, godotLanguage] = await Promise.all([
      loadLanguage("ThreeJS_GLSL"),
      loadLanguage("Godot"),
    ]);
  });

  it("emits only used camera outputs", () => {
    const harness = buildNodeHarness("camera");
    const compiler = new GraphCompiler(harness.surface, threeLanguage);
    compiler.compile();

    const code = compiler.result_code;
    const prefixMatch = code.match(/vec3 (camera_\d+)_position = cameraPosition;/);
    expect(prefixMatch).not.toBeNull();

    const prefix = prefixMatch![1];
    expect(code).not.toContain(`mat3 osg_${prefix}_view_rot`);
    expect(code).not.toContain(`mat3 osg_${prefix}_inv_view`);
    expect(code).not.toContain(`vec3 ${prefix}_direction`);
    expect(code).not.toContain(`float ${prefix}_orthographic`);
    expect(code).not.toContain(`${prefix}_near_plane`);
    expect(code).not.toContain(`${prefix}_far_plane`);
    expect(code).not.toContain(`${prefix}_z_buffer_sign`);
    expect(code).not.toContain(`${prefix}_width`);
    expect(code).not.toContain(`${prefix}_height`);
  });

  it("emits only used camera outputs in Godot", () => {
    const harness = buildNodeHarness("camera");
    const compiler = new GraphCompiler(harness.surface, godotLanguage);
    compiler.compile();

    const code = compiler.result_code;
    const prefixMatch = code.match(/vec3 (camera_\d+)_position = CAMERA_POSITION_WORLD;/);
    expect(prefixMatch).not.toBeNull();

    const prefix = prefixMatch![1];
    expect(code).not.toContain(`vec3 ${prefix}_direction`);
    expect(code).not.toContain(`float ${prefix}_orthographic`);
    expect(code).not.toContain(`${prefix}_near_plane`);
    expect(code).not.toContain(`${prefix}_far_plane`);
    expect(code).not.toContain(`${prefix}_z_buffer_sign`);
    expect(code).not.toContain(`${prefix}_width`);
    expect(code).not.toContain(`${prefix}_height`);
  });
});
