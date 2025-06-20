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

        public BaseGraphData CreateNewGraph(string name = "New Graph", GraphType graphType = GraphType.ShaderGraph)
        {
            var emptyNodes = new List<BaseNodeData>();
            var emptyConnections = new List<ConnectionData>();
            var graph = new BaseGraphData(name, graphType, emptyNodes, emptyConnections);
            AddGraph(graph);
            return graph;
        }

        public void AddGraph(BaseGraphData graph)
        {
            if (!_allGraphsData.Contains(graph))
            {
                _allGraphsData.Add(graph);
                GraphCreated?.Invoke(graph);
                SelectGraph(graph);
            }
        }

        public void RemoveNode(BaseNodeData node)
        {
            _currentGraphData?.RemoveNode(node);
        }

        public void DuplicateNode(BaseNodeData node)
        {
            if (_currentGraphData == null)
                return;

            var newNode = node.Clone();
            var newPosition = new Vector2(newNode.GetPosition().X + 30, newNode.GetPosition().Y + 30);
            newNode.SetPosition(newPosition);
            _currentGraphData.AddNode(newNode);
        }

        public void GroupNodes(List<BaseNodeData> nodesToGroup)
        {
            if (_currentGraphData == null || nodesToGroup == null || nodesToGroup.Count <= 1)
                return;

            var groupingService = Services.Get<GroupingService>();

            var nodesToGroupIdSet = new HashSet<long>(nodesToGroup.Select(n => n.Id));

            var incomingConnections = _currentGraphData.GetConnections()
                .Where(c => !nodesToGroupIdSet.Contains(c.GetFrom().NodeId) && nodesToGroupIdSet.Contains(c.GetTo().NodeId))
                .ToList();

            var outgoingConnections = _currentGraphData.GetConnections()
                .Where(c => nodesToGroupIdSet.Contains(c.GetFrom().NodeId) && !nodesToGroupIdSet.Contains(c.GetTo().NodeId))
                .ToList();

            // The grouping service modifies the nodes, so we should pass clones if we want to keep the originals for now.
            // However, we are deleting them, so it's fine.
            var groupGraphData = groupingService.Group("New Group", GraphType.GroupGraph, _currentGraphData, nodesToGroup);

            var groupPosition = new Vector2(
                nodesToGroup.Average(n => n.GetPosition().X),
                nodesToGroup.Average(n => n.GetPosition().Y)
            );

            var groupInputs = groupGraphData.OutputNode.GetInputs().Select(p => p.Clone()).ToList();
            var groupOutputs = groupGraphData.InputNode.GetOutputs().Select(p => p.Clone()).ToList();

            var groupNodeData = new GroupNodeData("Group", "Group", groupPosition, groupGraphData, groupInputs, groupOutputs);

            // This is the tricky part, we need to remove the old nodes *before* adding the new one,
            // to avoid issues with node ids. But we need connection info first.
            // The incoming/outgoing connection lists we made earlier save the day.

            foreach (var node in nodesToGroup)
            {
                _currentGraphData.RemoveNode(node);
            }

            _currentGraphData.AddNode(groupNodeData);

            foreach (var connection in incomingConnections)
            {
                var originalToPin = connection.GetTo().Pin;
                var newOutputPin = groupNodeData.GetOutputs().FirstOrDefault(p => p.GetName() == originalToPin.GetName() && p.GetDataType() == originalToPin.GetDataType());
                if (newOutputPin != null)
                {
                    _currentGraphData.AddConnection(new ConnectionData(connection.GetFrom().NodeId, connection.GetFrom().Pin, groupNodeData.Id, newOutputPin));
                }
            }

            foreach (var connection in outgoingConnections)
            {
                var originalFromPin = connection.GetFrom().Pin;
                var newInputPin = groupNodeData.GetInputs().FirstOrDefault(p => p.GetName() == originalFromPin.GetName() && p.GetDataType() == originalFromPin.GetDataType());
                if (newInputPin != null)
                {
                    _currentGraphData.AddConnection(new ConnectionData(groupNodeData.Id, newInputPin, connection.GetTo().NodeId, connection.GetTo().Pin));
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