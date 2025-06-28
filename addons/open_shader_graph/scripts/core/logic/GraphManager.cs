#nullable enable
using Godot;
using System.Collections.Generic;
using System.Linq;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using System;

namespace OpenShaderGraph.Core.Logic
{
    public partial class GraphManager : Node, IInitializable
    {

        // Direct signals instead of using EventBus
        public Action<GraphData> GraphCreated = delegate { };

        public Action<GraphData?> GraphSelected = delegate { };

        public Action<GraphData> GraphDeleted = delegate { };

        private List<GraphData> _allGraphsData = new();
        private GraphData? _currentGraphData;

        public void Init()
        {
            Logger.Log("[GraphManager] init");
        }

        /// <summary>
        /// Creates a new graph. For ShaderGraph types, returns a ShaderGraphData with explicit engine and stage.
        /// </summary>
        public GraphData CreateNewGraph(
            string name = "New Graph",
            GraphType graphType = GraphType.ShaderGraph,
            ShaderLanguage engine = ShaderLanguage.Godot,
            ShaderStage shaderStage = ShaderStage.Fragment)
        {
            Logger.Log("[GraphManager] CreateNewGraph -> Returning a new GraphData");
            if (name == null) throw new ArgumentNullException(nameof(name));
            GraphData graph;
            if (graphType == GraphType.ShaderGraph)
            {
                graph = new ShaderGraphData(name, engine, shaderStage);
            }
            else if (graphType == GraphType.GroupGraph)
            {
                // Group graphs have built-in input/output nodes
                graph = new GroupGraphData(name, graphType);
            }
            else
            {
                // Other graph types (subgraphs) use basic GraphData
                graph = new GraphData(name, graphType, new List<NodeData>(), new List<ConnectionData>());
            }
            AddGraph(graph);
            return graph;
        }

        public void AddGraph(GraphData graph)
        {
            if (graph == null) throw new ArgumentNullException(nameof(graph));
            if (!_allGraphsData.Contains(graph))
            {
                _allGraphsData.Add(graph);
                GraphCreated?.Invoke(graph);
                SelectGraph(graph);
            }
        }

        // TODO: Move this one GraphData
        public void RemoveNode(NodeData node)
        {
            if (node == null) throw new ArgumentNullException(nameof(node));
            if (_currentGraphData == null) throw new InvalidOperationException("No graph selected.");
            _currentGraphData.RemoveNode(node);
        }

        // TODO: Move this one GraphData
        public void DuplicateNode(NodeData node)
        {
            if (node == null) throw new ArgumentNullException(nameof(node));
            if (_currentGraphData == null) throw new InvalidOperationException("No graph selected.");
            _currentGraphData.AddNode(node.Clone());
        }

        public GraphData? GetCurrentGraph()
        {
            return _currentGraphData;
        }

        public List<GraphData> GetAllGraphs()
        {
            return _allGraphsData;
        }

        // Select a graph for editing
        public void SelectGraph(GraphData? graph)
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
        public void DeleteGraph(GraphData? graph)
        {
            // Handle null input gracefully
            if (graph == null)
            {
                Logger.Log("[GraphManager] Attempted to delete null graph");
                return;
            }
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