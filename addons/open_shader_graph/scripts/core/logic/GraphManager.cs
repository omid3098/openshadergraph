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
        public Action<BaseGraphData> GraphCreated = delegate { };

        public Action<BaseGraphData?> GraphSelected = delegate { };

        public Action<BaseGraphData> GraphDeleted = delegate { };

        private List<BaseGraphData> _allGraphsData = new();
        private BaseGraphData? _currentGraphData;

        public GraphManager()
        {
            Logger.Log("[GraphManager] init");
        }

        /// <summary>
        /// Creates a new graph. For ShaderGraph types, returns a ShaderGraphData with explicit engine and stage.
        /// </summary>
        public BaseGraphData CreateNewGraph(
            string name = "New Graph",
            GraphType graphType = GraphType.ShaderGraph,
            EngineType engine = EngineType.Godot,
            ShaderStage shaderStage = ShaderStage.Fragment)
        {
            if (name == null) throw new ArgumentNullException(nameof(name));
            BaseGraphData graph;
            if (graphType == GraphType.ShaderGraph)
            {
                graph = new ShaderGraphData(name, engine, shaderStage);
            }
            else if (graphType == GraphType.GroupGraph)
            {
                // Group graphs have built-in input/output nodes
                graph = new BaseGroupGraphData(name, graphType);
            }
            else
            {
                // Other graph types (subgraphs) use basic BaseGraphData
                graph = new BaseGraphData(name, graphType, new List<BaseNodeData>(), new List<ConnectionData>());
            }
            AddGraph(graph);
            return graph;
        }

        public void AddGraph(BaseGraphData graph)
        {
            if (graph == null) throw new ArgumentNullException(nameof(graph));
            if (!_allGraphsData.Contains(graph))
            {
                _allGraphsData.Add(graph);
                GraphCreated?.Invoke(graph);
                SelectGraph(graph);
            }
        }

        public void RemoveNode(BaseNodeData node)
        {
            if (node == null) throw new ArgumentNullException(nameof(node));
            if (_currentGraphData == null) throw new InvalidOperationException("No graph selected.");
            _currentGraphData.RemoveNode(node);
        }

        public void DuplicateNode(BaseNodeData node)
        {
            if (node == null) throw new ArgumentNullException(nameof(node));
            if (_currentGraphData == null) throw new InvalidOperationException("No graph selected.");

            var newNode = node.Clone();
            var newPosition = new Vector2(newNode.GetPosition().X + 30, newNode.GetPosition().Y + 30);
            newNode.SetPosition(newPosition);
            _currentGraphData.AddNode(newNode);
        }

        public void GroupNodes(List<BaseNodeData> nodesToGroup)
        {
            if (nodesToGroup == null) throw new ArgumentNullException(nameof(nodesToGroup));
            // Debug: log GroupNodes invocation and target nodes
            Logger.Log($"[GraphManager] GroupNodes called on graph '{_currentGraphData?.GetName()}' for nodes: {string.Join(",", nodesToGroup.Select(n => n.GetName() + "(" + n.Id + ")"))}");
            if (_currentGraphData == null) throw new InvalidOperationException("No graph selected.");
            if (nodesToGroup.Count <= 1) throw new ArgumentException("At least two nodes are required to group.", nameof(nodesToGroup));

            // Compute incoming and outgoing connections
            var groupingService = Services.Get<GroupingService>();

            var nodesToGroupIdSet = new HashSet<long>(nodesToGroup.Select(n => n.Id));

            var incomingConnections = _currentGraphData.GetConnections()
                .Where(c => !nodesToGroupIdSet.Contains(c.GetFrom().NodeId) && nodesToGroupIdSet.Contains(c.GetTo().NodeId))
                .ToList();

            var outgoingConnections = _currentGraphData.GetConnections()
                .Where(c => nodesToGroupIdSet.Contains(c.GetFrom().NodeId) && !nodesToGroupIdSet.Contains(c.GetTo().NodeId))
                .ToList();
            // Debug: log connection lists
            Logger.Log($"[GraphManager] incomingConnections count={incomingConnections.Count}");
            foreach (var c in incomingConnections)
                Logger.Log($"[GraphManager] incoming: from {c.GetFrom().NodeId}:{c.GetFrom().Pin.GetName()} -> to {c.GetTo().NodeId}:{c.GetTo().Pin.GetName()}");
            Logger.Log($"[GraphManager] outgoingConnections count={outgoingConnections.Count}");
            foreach (var c in outgoingConnections)
                Logger.Log($"[GraphManager] outgoing: from {c.GetFrom().NodeId}:{c.GetFrom().Pin.GetName()} -> to {c.GetTo().NodeId}:{c.GetTo().Pin.GetName()}");

            // The grouping service modifies the nodes, so we should pass clones if we want to keep the originals for now.
            // However, we are deleting them, so it's fine.
            var groupGraphData = groupingService.Group("New Group", GraphType.GroupGraph, _currentGraphData, nodesToGroup);
            // Debug: log subgraph input/output pins after groupingService.Group
            Logger.Log($"[GraphManager] subgraph InputNode outputs: {string.Join(",", groupGraphData.InputNode.GetOutputs().Select(p => p.GetName()))}");
            Logger.Log($"[GraphManager] subgraph OutputNode inputs: {string.Join(",", groupGraphData.OutputNode.GetInputs().Select(p => p.GetName()))}");

            var groupPosition = new Vector2(
                nodesToGroup.Average(n => n.GetPosition().X),
                nodesToGroup.Average(n => n.GetPosition().Y)
            );

            var groupInputs = groupGraphData.InputNode.GetOutputs().Select(p =>
            {
                var clone = p.Clone();
                clone.SetDirection(DirectionType.Input);
                return clone;
            }).ToList();
            var groupOutputs = groupGraphData.OutputNode.GetInputs().Select(p =>
            {
                var clone = p.Clone();
                clone.SetDirection(DirectionType.Output);
                return clone;
            }).ToList();
            // Debug: log group node data pin lists
            Logger.Log($"[GraphManager] groupInputs names: {string.Join(",", groupInputs.Select(p => p.GetName()))}");
            Logger.Log($"[GraphManager] groupOutputs names: {string.Join(",", groupOutputs.Select(p => p.GetName()))}");

            var groupNodeData = new GroupNodeData("Group", "Group", groupPosition, groupGraphData, groupInputs, groupOutputs);

            // This is the tricky part, we need to remove the old nodes *before* adding the new one,
            // to avoid issues with node ids. But we need connection info first.
            // The incoming/outgoing connection lists we made earlier save the day.

            foreach (var node in nodesToGroup)
            {
                _currentGraphData.RemoveNode(node);
                Logger.Log($"[GraphManager] removed node {node.GetName()}({node.Id}) from main graph");
            }

            _currentGraphData.AddNode(groupNodeData);
            Logger.Log($"[GraphManager] added group node {groupNodeData.GetName()}({groupNodeData.Id}) to main graph");

            // Map incoming connections to group input pins by index order
            for (int i = 0; i < incomingConnections.Count; i++)
            {
                var connection = incomingConnections[i];
                Logger.Log($"[GraphManager] mapping incoming connection {i}: from {connection.GetFrom().NodeId} to group input pin index {i} name {(i < groupNodeData.GetInputs().Count ? groupNodeData.GetInputs()[i].GetName() : "<none>")}");
                if (i < groupNodeData.GetInputs().Count)
                {
                    var newInputPin = groupNodeData.GetInputs()[i];
                    _currentGraphData.AddConnection(new ConnectionData(
                        connection.GetFrom().NodeId, connection.GetFrom().Pin,
                        groupNodeData.Id, newInputPin));
                    Logger.Log($"[GraphManager] added connection to group node: from {connection.GetFrom().NodeId}:{connection.GetFrom().Pin.GetName()} -> {groupNodeData.Id}:{newInputPin.GetName()}");
                }
            }

            // Map outgoing connections to group output pins by index order
            for (int i = 0; i < outgoingConnections.Count; i++)
            {
                var connection = outgoingConnections[i];
                Logger.Log($"[GraphManager] mapping outgoing connection {i}: to {connection.GetTo().NodeId} from group output pin index {i} name {(i < groupNodeData.GetOutputs().Count ? groupNodeData.GetOutputs()[i].GetName() : "<none>")}");
                if (i < groupNodeData.GetOutputs().Count)
                {
                    var newOutputPin = groupNodeData.GetOutputs()[i];
                    _currentGraphData.AddConnection(new ConnectionData(
                        groupNodeData.Id, newOutputPin,
                        connection.GetTo().NodeId, connection.GetTo().Pin));
                    Logger.Log($"[GraphManager] added connection from group node: from {groupNodeData.Id}:{newOutputPin.GetName()} -> {connection.GetTo().NodeId}:{connection.GetTo().Pin.GetName()}");
                }
            }
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
            if (graph == null) throw new ArgumentNullException(nameof(graph));
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