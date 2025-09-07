import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";
import GraphNode from "@/components/GraphNode";

export type NodeEditorProps = {
  onChange?: (nodes: Node[], edges: Edge[]) => void;
};

export function NodeEditor({ onChange }: NodeEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

  const nodeTypes = useMemo(() => ({ graphNode: GraphNode }), []);

  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge(conn, eds)),
    [setEdges],
  );

  // Load first example graph on mount
  useEffect(() => {
    type GNode = {
      id: number;
      type: string;
      name?: string;
      meta?: any[];
      position?: [number, number];
      nodes?: GNode[];
      inputs?: Array<{ id: number; name: string; type: any; value?: any }>;
      outputs?: Array<{ id: number; name: string; type: any }>;
    };

    const load = async () => {
      try {
        const listRes = await fetch("/api/example-graphs");
        if (!listRes.ok) throw new Error(String(listRes.status));
        const listData = await listRes.json();
        const examples: Array<{ key: string; label: string }> = Array.isArray(listData.examples)
          ? listData.examples
          : [];
        const first = examples[0];
        if (!first) return;
        const url = new URL("/api/example-graphs", location.origin);
        url.searchParams.set("name", first.key);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const graph = data.graph as GNode;

        const createdNodes: Node[] = [];
        const createdEdges: Edge[] = [];
        const depthX = 240;
        const rowY = 120;
        const baseX = 80;
        const baseY = 40;
        const perParentRow: Record<string, number> = {};
        const all: Record<string, GNode> = {};
        const nodeDefaults = { sourcePosition: Position.Right, targetPosition: Position.Left };

        const walk = (n: GNode, parentId?: string, depth = 0) => {
          const idStr = String(n.id);
          all[idStr] = n;
          const row = perParentRow[parentId ?? "root"] ?? 0;
          const pos = n.position
            ? { x: n.position[0], y: n.position[1] }
            : { x: baseX + depth * depthX, y: baseY + row * rowY };
          perParentRow[parentId ?? "root"] = row + 1;
          createdNodes.push({
            id: idStr,
            type: "graphNode",
            position: pos,
            data: {
              label: n.name ?? n.type,
              type: n.type,
              template: {
                id: n.id,
                type: n.type,
                name: n.name,
                meta: n.meta ?? [],
                position: n.position ?? [pos.x, pos.y],
                nodes: n.nodes ?? [],
                inputs: n.inputs ?? [],
                outputs: n.outputs ?? [],
              },
            },
            ...(parentId ? { parentId } : {}),
            ...nodeDefaults,
          } as any);
          for (const child of n.nodes ?? []) walk(child, idStr, depth + 1);
        };
        walk(graph);

        const refRe = /^\.\.\/(\d+)\/(\d+)$/;
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
            });
          }
        }

        setNodes(createdNodes);
        setEdges(createdEdges);
      } catch (err) {
        console.error("Failed to load example graph", err);
      }
    };

    void load();
  }, [setNodes, setEdges]);

  useEffect(() => {
    onChange?.(nodes, edges);
  }, [nodes, edges, onChange]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}

export default NodeEditor;
