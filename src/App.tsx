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

  const onConnect = (params: Connection) =>
    setEdges((eds) => addEdge(params, eds));

  return (
    <div className="w-screen h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export default App;
