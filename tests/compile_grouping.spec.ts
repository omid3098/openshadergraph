import { describe, it, expect } from "vitest";
import { NodeBuilder } from "../src/core/graph/node";
import type { Node, Edge } from "@xyflow/react";
import { groupSelected } from "../src/core/graph/grouping";
import { buildGraphData } from "../src/core/ui/graphData";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { loadLanguage } from "../src/core/schema/registry";

function rfFromGraph(graph: any) {
    const createdNodes: Node[] = [] as any;
    const createdEdges: Edge[] = [] as any;
    const walk = (n: any, parentId?: string) => {
        const idStr = String(n.id);
        createdNodes.push({
            id: idStr,
            type: "graphNode",
            position: { x: 0, y: 0 },
            data: {
                label: n.name ?? n.type,
                type: n.type,
                template: {
                    id: n.id,
                    type: n.type,
                    name: n.name,
                    meta: n.meta ?? [],
                    position: n.position ?? [0, 0],
                    nodes: n.nodes ?? [],
                    inputs: n.inputs ?? [],
                    outputs: n.outputs ?? [],
                    properties: n.properties ?? [],
                },
            },
            ...(parentId ? { parentId } : {}),
        } as any);
        for (const child of n.nodes ?? []) walk(child, idStr);
    };
    walk(graph, undefined);

    const refRe = /^\.\.\/(\d+)\/(\d+)$/;
    const all: Record<string, any> = {};
    const collect = (n: any) => { all[String(n.id)] = n; for (const c of n.nodes ?? []) collect(c); };
    collect(graph);
    for (const gid of Object.keys(all)) {
        const gn = all[gid];
        for (const pin of gn.inputs ?? []) {
            if (typeof pin.value !== "string") continue;
            const m = pin.value.match(refRe);
            if (!m) continue;
            const fromId = m[1];
            const fromPin = Number(m[2]);
            const toId = gid;
            const toPin = pin.id;
            createdEdges.push({
                id: `e${fromId}-${toId}-${fromPin}-${toPin}`,
                source: String(fromId),
                target: String(toId),
                sourceHandle: `out-${fromPin}`,
                targetHandle: `in-${toPin}`,
            } as any);
        }
    }
    return { nodes: createdNodes, edges: createdEdges };
}

describe("compile with grouped nodes", () => {
    it("emits declarations for nodes inside a group", async () => {
        // Build the same as 'basic_color' example
        const surface = new NodeBuilder("surface");
        const fragment_pass = surface.get_node_by_type("fragment_pass")!;
        const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
        const color = surface.create_node("color", fragment_pass);
        const flt = surface.create_node("float", fragment_pass);
        surface.connect_nodes(color, fragment_output, 0, 0);
        surface.connect_nodes(flt, fragment_output, 0, 1);

        const rf = rfFromGraph(surface.to_dict());
        const idGen = (() => { let i = 1000; return () => String(++i); })();
        const selected = new Set([String(color.id), String(flt.id)]);
        const grouped = groupSelected(rf.nodes as any, rf.edges as any, selected, idGen);

        const wrapper = buildGraphData(grouped.nodes as any, grouped.edges as any, "Test");
        const surfaceNode = (wrapper.nodes as any[]).find((n) => n.type === "surface");
        const lang = await loadLanguage("Godot.json");
        const compiler = new GraphCompiler(surfaceNode!, lang);
        compiler.compile();
        const code = compiler.result_code;
        expect(code).toMatch(/void fragment\(\) \{/);
        // Declarations for color and float should be present
        expect(code).toMatch(/vec4\s+color_\d+\s*=\s*vec4\(/);
        expect(code).toMatch(/float\s+float_\d+\s*=\s*/);
        // And assignments should still reference them
        expect(code).toMatch(/ALBEDO\s*=\s*vec3\(color_\d+\.rgb\)/);
        expect(code).toMatch(/ROUGHNESS\s*=\s*float_\d+;/);
    });
});

