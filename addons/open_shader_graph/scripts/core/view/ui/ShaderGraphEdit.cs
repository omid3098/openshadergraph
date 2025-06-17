using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.View.UI
{
    public partial class ShaderGraphEdit : GraphEdit
    {
        public BaseGraphData GraphData { get; private set; }

        public ShaderGraphEdit()
        {
            Logger.Log("[ShaderGraphEdit] init");
            DeactivateGraphEdit();
        }

        private void DeactivateGraphEdit()
        {
            ShowMenu = false;
            Modulate = new Color(1, 1, 1, 0.5f);
            MinimapEnabled = false;
        }

        private void ActivateGraphEdit()
        {
            ShowMenu = true;
            Modulate = new Color(1, 1, 1, 1);
            MinimapEnabled = true;
        }

        public void SetGraph(BaseGraphData graph)
        {
            GraphData = graph;
            ClearGraph();
            // TODO: instantiate nodes & connections based on graph_data
            Logger.Log($"[ShaderGraphEdit] Loaded graph: {graph.GetName()}");
            ActivateGraphEdit();
        }

        public BaseGraphData GetGraphData()
        {
            return GraphData;
        }

        private void ClearGraph()
        {
            // Remove all GraphNode children
            foreach (Node child in GetChildren())
            {
                if (child is GraphNode)
                {
                    RemoveChild(child);
                    child.QueueFree();
                }
            }

            // Remove all connections
            foreach (var conn in GetConnectionList())
            {
                var connDict = conn.AsGodotDictionary();
                DisconnectNode(
                    connDict["from"].AsStringName(),
                    connDict["from_port"].AsInt32(),
                    connDict["to"].AsStringName(),
                    connDict["to_port"].AsInt32()
                );
            }
        }
    }
}