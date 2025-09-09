import { describe, it, expect } from "vitest";
import { materialxToGraph } from "../src/core/io/materialx";
import { examplesHandler } from "../src/server/examples";
import { promises as fs } from "fs";
import path from "path";

const examplePath = path.resolve(process.cwd(), "data", "materialx", "examples", "standard_surface_brass_tiled.mtlx");

describe("MaterialX examples", () => {
  it("parses standard_surface_brass_tiled.mtlx into graph", async () => {
    const xml = await fs.readFile(examplePath, "utf8");
    const graph = materialxToGraph(xml);
    expect(graph.nodes.length).toBe(4);
    const image = graph.nodes.find((n: any) => n.name === "image_color");
    expect(image).toBeTruthy();
    const out = graph.nodes.find((n: any) => n.type === "output" && n.name === "out_color");
    expect(out?.inputs[0]?.value).toBe(`../${image?.id}/0`);
  });

  it("serves MaterialX example via API", async () => {
    const listRes = await examplesHandler(new Request("http://localhost/api/example-graphs"));
    const list = await listRes.json() as any;
    const entry = list.examples.find((e: any) => e.key === "standard_surface_brass_tiled");
    expect(entry).toBeTruthy();

    const graphRes = await examplesHandler(new Request("http://localhost/api/example-graphs?name=standard_surface_brass_tiled"));
    const data = await graphRes.json() as any;
    expect(data.graph.nodes.length).toBe(4);
  });
});
