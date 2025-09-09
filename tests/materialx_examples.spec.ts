import { describe, it, expect, vi } from "vitest";
import { materialxToGraph } from "../src/core/io/materialx";
import { examplesHandler } from "../src/server/examples";

const exampleRel = "StandardSurface/standard_surface_brass_tiled";
const brassXML = `<?xml version="1.0"?>
<materialx version="1.39" colorspace="lin_rec709" fileprefix="../../../Images/">
  <nodegraph name="NG_brass1">
    <tiledimage name="image_color" type="color3">
      <input name="file" type="filename" value="brass_color.jpg" colorspace="srgb_texture" />
      <input name="uvtiling" type="vector2" value="1.0, 1.0" />
    </tiledimage>
    <tiledimage name="image_roughness" type="float">
      <input name="file" type="filename" value="brass_roughness.jpg" />
      <input name="uvtiling" type="vector2" value="1.0, 1.0" />
    </tiledimage>
    <output name="out_color" type="color3" nodename="image_color" />
    <output name="out_roughness" type="float" nodename="image_roughness" />
  </nodegraph>
  <standard_surface name="SR_brass1" type="surfaceshader">
    <input name="base" type="float" value="1" />
    <input name="base_color" type="color3" value="1, 1, 1" />
    <input name="specular" type="float" value="0" />
    <input name="specular_roughness" type="float" nodegraph="NG_brass1" output="out_roughness" />
    <input name="metalness" type="float" value="1" />
    <input name="coat" type="float" value="1" />
    <input name="coat_color" type="color3" nodegraph="NG_brass1" output="out_color" />
    <input name="coat_roughness" type="float" nodegraph="NG_brass1" output="out_roughness" />
  </standard_surface>
  <surfacematerial name="Tiled_Brass" type="material">
    <input name="surfaceshader" type="surfaceshader" nodename="SR_brass1" />
  </surfacematerial>
</materialx>`;

describe("MaterialX examples", () => {
  it("parses standard_surface_brass_tiled.mtlx into graph", async () => {
    const graph = materialxToGraph(brassXML);
    expect(graph.nodes.length).toBe(4);
    const image = graph.nodes.find((n: any) => n.name === "image_color");
    expect(image).toBeTruthy();
    const out = graph.nodes.find((n: any) => n.type === "output" && n.name === "out_color");
    expect(out?.inputs[0]?.value).toBe(`../${image?.id}/0`);
  });

  it("serves MaterialX example via API and groups by directory", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(brassXML));
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as any);

    const listRes = await examplesHandler(new Request("http://localhost/api/example-graphs"));
    const list = (await listRes.json()) as any;
    const group = list.groups.find((g: any) => g.key === "StandardSurface");
    expect(group).toBeTruthy();
    const entry = group.examples.find((e: any) => e.key === exampleRel);
    expect(entry).toBeTruthy();

    const graphRes = await examplesHandler(new Request(`http://localhost/api/example-graphs?name=${encodeURIComponent(exampleRel)}`));
    const data = (await graphRes.json()) as any;
    expect(data.graph.nodes.length).toBe(4);

    spy.mockRestore();
  });
});
