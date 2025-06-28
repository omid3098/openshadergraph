#nullable enable
namespace OpenShaderGraph.Core.Logic;

using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using System.Collections.Generic;
using System.Linq;

public class GroupingService : IInitializable
{

    public void Init()
    {
        throw new System.NotImplementedException();
    }
    /// <summary>
    /// Creates a new group graph from a selection of nodes and connections.
    /// It remaps the node IDs to be local to the new group graph.
    /// The original nodes and connections should be removed from the main graph afterwards,
    /// and a new GroupNode referencing this graph should be added.
    /// </summary>
    public virtual GroupGraphData Group(string groupName, GraphType graphType, GraphData parentGraph, List<BaseNodeData> nodesToGroup)
    {
        var groupGraph = new GroupGraphData(groupName, graphType);
        var idMap = new Dictionary<long, long>();
        var nodesToGroupIdSet = new HashSet<long>(nodesToGroup.Select(n => n.Id));

        // Add nodes to the group and create an ID map
        foreach (var node in nodesToGroup)
        {
            // Clone the node so we don't modify the original, preserving its ID for later removal
            var oldId = node.Id;
            BaseNodeData nodeClone;
            // Preserve group node subgraphs when nesting groups
            if (node is GroupNodeData groupNodeData)
            {
                // Copy inputs and outputs for the group node by reference to preserve identity
                var cloneInputs = new List<PinData>(groupNodeData.GetInputs());
                var cloneOutputs = new List<PinData>(groupNodeData.GetOutputs());
                // Create a new GroupNodeData with the existing subgraph reference
                nodeClone = new GroupNodeData(
                    groupNodeData.GetPosition(),
                    groupNodeData.SubGraph,
                    cloneInputs,
                    cloneOutputs);
            }
            else
            {
                var baseClone = node.Clone();
                nodeClone = baseClone;
            }
            // Add the cloned node to the subgroup graph, it will receive a new ID
            groupGraph.AddNode(nodeClone);
            idMap[oldId] = nodeClone.Id;
        }

        var allParentConnections = parentGraph.GetConnections();
        var internalConnections = allParentConnections.Where(c => nodesToGroupIdSet.Contains(c.GetFrom().NodeId) && nodesToGroupIdSet.Contains(c.GetTo().NodeId)).ToList();
        var incomingConnections = allParentConnections.Where(c => !nodesToGroupIdSet.Contains(c.GetFrom().NodeId) && nodesToGroupIdSet.Contains(c.GetTo().NodeId)).ToList();
        var outgoingConnections = allParentConnections.Where(c => nodesToGroupIdSet.Contains(c.GetFrom().NodeId) && !nodesToGroupIdSet.Contains(c.GetTo().NodeId)).ToList();

        // Remap and add internal connections
        foreach (var connection in internalConnections)
        {
            if (idMap.TryGetValue(connection.GetFrom().NodeId, out var newFromId) && idMap.TryGetValue(connection.GetTo().NodeId, out var newToId))
            {
                var remappedConnection = new ConnectionData(newFromId, connection.GetFrom().Pin.Clone(), newToId, connection.GetTo().Pin.Clone());
                groupGraph.AddConnection(remappedConnection);
            }
        }

        // Handle incoming connections -> Create output pins on InputNode
        foreach (var connection in incomingConnections)
        {
            var toPin = connection.GetTo().Pin;
            var newOutputPin = toPin.Clone();
            newOutputPin.SetDirection(DirectionType.Output);
            // todo: InputNode does not support AddOutput ATM
            // groupGraph.InputNode.AddOutput(newOutputPin);

            var newConnection = new ConnectionData(groupGraph.InputNode.Id, newOutputPin, idMap[connection.GetTo().NodeId], toPin);
            groupGraph.AddConnection(newConnection);
        }

        // Handle outgoing connections -> Create input pins on OutputNode
        foreach (var connection in outgoingConnections)
        {
            var fromPin = connection.GetFrom().Pin;
            var newInputPin = fromPin.Clone();
            newInputPin.SetDirection(DirectionType.Input);
            // todo: OutputNode does not support AddOutput ATM
            // groupGraph.OutputNode.AddInput(newInputPin);

            var newConnection = new ConnectionData(idMap[connection.GetFrom().NodeId], fromPin, groupGraph.OutputNode.Id, newInputPin);
            groupGraph.AddConnection(newConnection);
        }

        return groupGraph;
    }


    /// <summary>
    /// Merges a group graph into a main graph at the position of the group node.
    /// It remaps the node IDs from the group to be unique in the main graph.
    /// The groupNodeData should be removed from the main graph after this operation.
    /// </summary>
    public virtual (List<BaseNodeData> newNodes, List<ConnectionData> newConnections) Ungroup(GraphData mainGraph, BaseNodeData groupNode, GroupGraphData subGraph)
    {
        var newNodes = new List<BaseNodeData>();
        var newConnections = new List<ConnectionData>();

        var idMap = new Dictionary<long, long>();

        // Remap nodes from subgraph to maingraph
        var nodesToRemap = subGraph.GetNodes().Where(n => n.GetTitle() != "Input" && n.GetTitle() != "Output").ToList();

        foreach (var node in nodesToRemap)
        {
            var oldId = node.Id;
            node.Id = -1; // Reset ID for the main graph to assign a new one
            mainGraph.AddNode(node);
            idMap[oldId] = node.Id;
            newNodes.Add(node);
        }

        // Remap internal connections
        foreach (var connection in subGraph.GetConnections())
        {
            var from = connection.GetFrom();
            var to = connection.GetTo();

            bool fromIsInput = from.NodeId == subGraph.InputNode.Id;
            bool toIsOutput = to.NodeId == subGraph.OutputNode.Id;

            // This is an internal connection
            if (!fromIsInput && !toIsOutput)
            {
                if (idMap.TryGetValue(from.NodeId, out var newFromId) && idMap.TryGetValue(to.NodeId, out var newToId))
                {
                    var remappedConnection = new ConnectionData(newFromId, from.Pin, newToId, to.Pin);
                    mainGraph.AddConnection(remappedConnection);
                    newConnections.Add(remappedConnection);
                }
            }
        }

        // Remap external connections
        var incomingConnections = mainGraph.GetConnections().Where(c => c.GetTo().NodeId == groupNode.Id).ToList();
        var outgoingConnections = mainGraph.GetConnections().Where(c => c.GetFrom().NodeId == groupNode.Id).ToList();

        // Remap incoming connections to the new nodes
        foreach (var incoming in incomingConnections)
        {
            var subGraphConnections = subGraph.GetConnections()
                .Where(c => c.GetFrom().NodeId == subGraph.InputNode.Id && c.GetFrom().Pin.GetName() == incoming.GetTo().Pin.GetName());
            foreach (var subConn in subGraphConnections)
            {
                if (idMap.TryGetValue(subConn.GetTo().NodeId, out var newInternalToNodeId))
                {
                    var newConnection = new ConnectionData(incoming.GetFrom().NodeId, incoming.GetFrom().Pin, newInternalToNodeId, subConn.GetTo().Pin);
                    mainGraph.AddConnection(newConnection);
                    newConnections.Add(newConnection);
                }
            }
        }

        // Remap outgoing connections from the new nodes using index-based mapping
        var outputPins = subGraph.OutputNode.GetInputs();
        for (int idx = 0; idx < outgoingConnections.Count && idx < outputPins.Count; idx++)
        {
            var outgoing = outgoingConnections[idx];
            var outputPin = outputPins[idx];
            var subGraphConns = subGraph.GetConnections()
                .Where(c => c.GetTo().NodeId == subGraph.OutputNode.Id && c.GetTo().Pin == outputPin);
            foreach (var subConn in subGraphConns)
            {
                if (idMap.TryGetValue(subConn.GetFrom().NodeId, out var newInternalFromNodeId))
                {
                    var newConnection = new ConnectionData(newInternalFromNodeId, subConn.GetFrom().Pin, outgoing.GetTo().NodeId, outgoing.GetTo().Pin);
                    mainGraph.AddConnection(newConnection);
                    newConnections.Add(newConnection);
                }
            }
        }

        // It is the responsibility of the caller to remove the old group node and its connections.

        return (newNodes, newConnections);
    }
}