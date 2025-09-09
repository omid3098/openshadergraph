import { describe, it, expect } from "vitest";
import { materialxToGraph } from "../src/core/io/materialx";
import { examplesHandler } from "../src/server/examples";
import { promises as fs } from "fs";
import path from "path";

const examplePath = path.resolve(process.cwd(), "data", "materialx", "examples", "cycle.mtlx");

describe("MaterialX examples", () => {
  it("parses cycle.mtlx into graph", async () => {
    const xml = await fs.readFile(examplePath, "utf8");
    const graph = materialxToGraph(xml);
    expect(graph.nodes.length).toBe(4);
    const add = graph.nodes.find((n: any) => n.name === "add1");
    expect(add).toBeTruthy();
    expect(add?.inputs[0]?.value).toBe("../1/0");
    const output = graph.nodes.find((n: any) => n.type === "output");
    expect(output?.inputs[0]?.value).toBe("../3/0");
  });

  it("serves MaterialX example via API", async () => {
    const listRes = await examplesHandler(new Request("http://localhost/api/example-graphs"));
    const list = await listRes.json() as any;
    const entry = list.examples.find((e: any) => e.key === "cycle");
    expect(entry).toBeTruthy();

    const graphRes = await examplesHandler(new Request("http://localhost/api/example-graphs?name=cycle"));
    const data = await graphRes.json() as any;
    expect(data.graph.nodes.length).toBe(4);
  });
});
