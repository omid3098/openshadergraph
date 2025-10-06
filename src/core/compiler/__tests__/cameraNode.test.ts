import { beforeAll, describe, expect, it } from "vitest";
import type { LanguagePack } from "@/core/schema/types";
import { loadLanguage } from "@/core/schema/registry";
import { buildNodeHarness } from "@/core/testing/nodeHarness";
import { GraphCompiler } from "@/core/compiler/graphCompiler";

describe("camera node", () => {
  let language: LanguagePack;

  beforeAll(async () => {
    language = await loadLanguage("ThreeJS_GLSL");
  });

  it("emits camera parameters for the preview shader", () => {
    const harness = buildNodeHarness("camera");
    const compiler = new GraphCompiler(harness.surface, language);
    compiler.compile();

    const code = compiler.result_code;
    const prefixMatch = code.match(/vec3 (camera_\d+)_position = cameraPosition;/);
    expect(prefixMatch).not.toBeNull();

    const prefix = prefixMatch![1];
    const expectedSnippets = [
      `mat3 osg_${prefix}_view_rot = mat3(viewMatrix);`,
      `mat3 osg_${prefix}_inv_view = mat3(`,
      `vec3(osg_${prefix}_view_rot[0][0], osg_${prefix}_view_rot[1][0], osg_${prefix}_view_rot[2][0])`,
      `vec3 ${prefix}_direction = -normalize(osg_${prefix}_inv_view[2]);`,
      `float ${prefix}_orthographic = projectionMatrix[3][3] > 0.5 ? 1.0 : 0.0;`,
      `${prefix}_near_plane = (m32 + 1.0) / m22;`,
      `${prefix}_near_plane = m32 / (m22 - 1.0);`,
      `${prefix}_far_plane = (m32 - 1.0) / m22;`,
      `${prefix}_far_plane = m32 / (m22 + 1.0);`,
      `vec4 ${prefix}_near_clip = projectionMatrix * vec4(0.0, 0.0, -${prefix}_near_plane, 1.0);`,
      `float ${prefix}_z_buffer_sign = sign(${prefix}_far_ndc - ${prefix}_near_ndc);`,
      `${prefix}_width = 2.0 / sx;`,
      `${prefix}_height = 2.0 / sy;`,
    ];

    for (const snippet of expectedSnippets) {
      expect(code).toContain(snippet);
    }
  });
});
