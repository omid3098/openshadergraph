using Godot;
using System.Collections.Generic;
using System.Linq;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.Logic
{
    public partial class GraphManager : Node
    {
        // Direct signals instead of using EventBus
        [Signal]
        public delegate void GraphCreatedEventHandler(BaseGraphData graph);

        [Signal]
        public delegate void GraphSelectedEventHandler(BaseGraphData graph);

        [Signal]
        public delegate void GraphDeletedEventHandler(BaseGraphData graph);

        private List<BaseGraphData> _allGraphsData = new();
        private BaseGraphData _currentGraphData;

        public GraphManager()
        {
            Logger.Log("[GraphManager] init");
        }

        // Clean up signal connections when the GraphManager is freed
        public void Cleanup()
        {
            // No longer need to disconnect from EventBus
        }

        public BaseGraphData CreateNewGraph(string name = "New Graph", GraphType graphType = GraphType.ShaderGraph)
        {
            var emptyNodes = new List<BaseNodeData>();
            var emptyConnections = new List<ConnectionData>();
            _currentGraphData = new BaseGraphData(name, graphType, emptyNodes, emptyConnections);
            _allGraphsData.Add(_currentGraphData);
            Logger.Log($"[GraphManager] Created new graph: {_currentGraphData.GetName()}");

            // Emit direct signal instead of using EventBus
            EmitSignal(SignalName.GraphCreated, _currentGraphData);
            return _currentGraphData;
        }

        public BaseGraphData GetCurrentGraph()
        {
            return _currentGraphData;
        }

        public List<BaseGraphData> GetAllGraphs()
        {
            return _allGraphsData;
        }

        // Select a graph for editing
        public void SelectGraph(BaseGraphData graph)
        {
            _currentGraphData = graph;
            if (graph != null)
            {
                Logger.Log($"[GraphManager] Selected graph: {_currentGraphData.GetName()}");
            }
            else
            {
                Logger.Log("[GraphManager] Attempted to select null graph");
            }
            // Emit direct signal instead of using EventBus
            EmitSignal(SignalName.GraphSelected, _currentGraphData);
        }

        // Delete a graph and emit a signal; auto-select first graph if any remain
        public void DeleteGraph(BaseGraphData graph)
        {
            if (_allGraphsData.Contains(graph))
            {
                _allGraphsData.Remove(graph);
                Logger.Log($"[GraphManager] Deleted graph: {graph.GetName()}");
                // Emit direct signal instead of using EventBus
                EmitSignal(SignalName.GraphDeleted, graph);
                if (_allGraphsData.Count > 0)
                {
                    SelectGraph(_allGraphsData[0]);
                }
            }
        }
    }
}