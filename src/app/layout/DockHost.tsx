import { useMemo, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { DockLayout } from "@/ui/layout/DockLayout";
import { NodeEditor } from "../editor/NodeEditor";
import { buildDockItemDescriptors } from "@/ui/panels/items";
import { PreviewPanel } from "@/components/PreviewPanel";
import { CompilePanel } from "@/components/CompilePanel";
import { GraphDataPanel } from "@/components/GraphDataPanel";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { buildGraphData } from "@/core/ui/graphData";

export function DockHost() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const graph = useMemo(() => buildGraphData(nodes as any, edges as any, "Graph"), [nodes, edges]);

  const editor = <NodeEditor onChange={(n, e) => { setNodes(n); setEdges(e); }} />;

  const desc = buildDockItemDescriptors({});
  const items = [
    { id: "editor", name: "Editor", render: () => editor },
    ...desc.map((d) => ({
      id: d.id,
      name: d.name,
      render: () =>
        d.id === "properties" ? (
          <PropertiesPanel variant="docked" />
        ) : d.id === "compile" ? (
          <CompilePanel variant="docked" graph={graph} />
        ) : d.id === "graphdata" ? (
          <GraphDataPanel variant="docked" data={graph} />
        ) : (
          <PreviewPanel variant="docked" graph={graph} />
        ),
    })),
  ];

  return <DockLayout items={items} className="w-screen h-screen" />;
}

export default DockHost;
