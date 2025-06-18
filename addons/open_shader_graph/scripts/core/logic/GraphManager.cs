#nullable enable
using Godot;
using System.Collections.Generic;
using System.Linq;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using System;

namespace OpenShaderGraph.Core.Logic
{
    public partial class GraphManager : Node
    {
        // Direct signals instead of using EventBus
        public Action<BaseGraphData> GraphCreated;

        public Action<BaseGraphData?> GraphSelected;

        public Action<BaseGraphData> GraphDeleted;

        private List<BaseGraphData> _allGraphsData = new();
        private BaseGraphData? _currentGraphData;

        public GraphManager()
        {
            Logger.Log("[GraphManager] init");
        }

        public BaseGraphData CreateNewGraph(string name = "New Graph", GraphType graphType = GraphType.ShaderGraph)
        {
            var emptyNodes = new List<BaseNodeData>();
            var emptyConnections = new List<ConnectionData>();
            _currentGraphData = new BaseGraphData(name, graphType, emptyNodes, emptyConnections);
            _allGraphsData.Add(_currentGraphData);
            Logger.Log($"[GraphManager] Created new graph: {_currentGraphData.GetName()}");

            GraphCreated?.Invoke(_currentGraphData);
            return _currentGraphData;
        }

        public BaseGraphData? GetCurrentGraph()
        {
            return _currentGraphData;
        }

        public List<BaseGraphData> GetAllGraphs()
        {
            return _allGraphsData;
        }

        // Select a graph for editing
        public void SelectGraph(BaseGraphData? graph)
        {
            _currentGraphData = graph;
            if (graph != null)
            {
                Logger.Log($"[GraphManager] Selected graph: {graph.GetName()}");
                GraphSelected?.Invoke(graph);
            }
            else
            {
                Logger.Log("[GraphManager] Attempted to select null graph");
                GraphSelected?.Invoke(null);
            }
        }

        // Delete a graph and emit a signal; auto-select first graph if any remain
        public void DeleteGraph(BaseGraphData graph)
        {
            if (_allGraphsData.Contains(graph))
            {
                _allGraphsData.Remove(graph);
                Logger.Log($"[GraphManager] Deleted graph: {graph.GetName()}");
                GraphDeleted?.Invoke(graph);
                if (_allGraphsData.Count > 0)
                {
                    SelectGraph(_allGraphsData[0]);
                }
                else
                {
                    SelectGraph(null);
                }
            }
        }
    }
}