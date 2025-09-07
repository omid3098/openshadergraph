import { ReactFlow, Background, Controls, MiniMap, addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node } from "@xyflow/react";
import { useCallback, useEffect } from "react";

export type NodeEditorProps = {
  onChange?: (nodes: Node[], edges: Edge[]) => void;
};

export function NodeEditor({ onChange }: NodeEditorProps) {
  const [nodes, _setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge(conn, eds)),
    [setEdges],
  );

  useEffect(() => {
    onChange?.(nodes, edges);
  }, [nodes, edges, onChange]);

  return (
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
  );
}

export default NodeEditor;
