import "./index.css";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Position,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useEffect, useState } from "react";
import { GraphContextMenu, type ContextKind } from "./components/GraphContextMenu";
import { fetchNodePalette, type NodePalette } from "./core/schema/nodes";

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

const initialNodes: Node[] = [
  {
    id: "1",
    position: { x: 0, y: 150 },
    data: { label: "Node 1" },
    ...nodeDefaults,
  },
  {
    id: "2",
    position: { x: 300, y: 150 },
    data: { label: "Node 2" },
    ...nodeDefaults,
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2" },
];

export function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [palette, setPalette] = useState<NodePalette | null>(null);
  const [menu, setMenu] = useState<{
    open: boolean;
    kind: ContextKind;
    x: number;
    y: number;
    targetId?: string;
  }>({ open: false, kind: "background", x: 0, y: 0 });

  const onConnect = (params: Connection) =>
    setEdges((eds) => addEdge(params, eds));

  useEffect(() => {
    const ctrl = new AbortController();
    fetchNodePalette(ctrl.signal)
      .then(setPalette)
      .catch((err) => console.warn("Failed to load node palette", err));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="w-screen h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => {
          // Close context menu when clicking the background pane
          setMenu((m) => (m.open ? { ...m, open: false } : m));
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          setMenu({ open: true, kind: "background", x: e.clientX, y: e.clientY });
        }}
        onNodeContextMenu={(e, node) => {
          e.preventDefault();
          setMenu({ open: true, kind: "node", x: e.clientX, y: e.clientY, targetId: node.id });
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          setMenu({ open: true, kind: "edge", x: e.clientX, y: e.clientY, targetId: edge.id });
        }}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      <GraphContextMenu
        open={menu.open}
        kind={menu.kind}
        x={menu.x}
        y={menu.y}
        targetId={menu.targetId}
        palette={palette ?? undefined}
        onClose={() => setMenu((m) => ({ ...m, open: false }))}
      />
    </div>
  );
}

export default App;
