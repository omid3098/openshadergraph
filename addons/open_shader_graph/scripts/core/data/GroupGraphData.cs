using Godot;
#nullable enable
namespace OpenShaderGraph.Core.Data;

using System.Collections.Generic;
using OpenShaderGraph.Core.Utils;

public class LocalSubgraphData : GroupGraphData
{
    public LocalSubgraphData(string name, GraphType graphType, List<NodeData>? nodes = null, List<ConnectionData>? connections = null) : base(name, graphType, nodes, connections)
    {
    }
}

public class GlobalSubgraphData : GroupGraphData
{
    public GlobalSubgraphData(string name, GraphType graphType, List<NodeData>? nodes = null, List<ConnectionData>? connections = null) : base(name, graphType, nodes, connections)
    {
    }
}

public partial class GroupGraphData : GraphData
{
    /**
       todo: the input and output should be removed
       - we need to separate the group and subgraph, group can be node that has children.
       public List<NodeView> Children = new();

       - group should be inherited from node
       - subgraph sohuld be inherited from graph
       - subgraph also has node, aka subgraphnode, that is inherited from node and will represented as a node in graph.
       - double clicking on subgraphnode, it should open the subgraph as another graph.
       - for the template, it can has an explicit value that sets the explicit logic, 
       e.g, a template for group with explicit value as group, that will be detected in the code and apply some hard coded logic,
       that won't be avoidable.
    **/
    public NodeData InputNode { get; private set; }
    public NodeData OutputNode { get; private set; }

    public GroupGraphData(string name,
                              GraphType graphType,
                              List<NodeData>? nodes = null,
                              List<ConnectionData>? connections = null) : base(name, graphType, nodes, connections)
    {
        InputNode = new NodeData(new NodeTemplate(), new Vector2(0, 0));
        OutputNode = new NodeData(new NodeTemplate(), new Vector2(500, 0));
        AddNode(InputNode);
        AddNode(OutputNode);
    }

    public override bool AddConnection(ConnectionData connection)
    {
        // If the connection node does not exist in the graph, use the input/output nodes as the connection nodes based on the direction of the connection.
        if (connection == null)
            return false; // Silently ignore null connections

        var fromNode = GetNodeById(connection.GetFrom().NodeId);
        var toNode = GetNodeById(connection.GetTo().NodeId);
        if (fromNode == null)
        {
            fromNode = InputNode;
            PinData pin = connection.GetFrom().Pin;
            // fromNode.AddInput(pin);
            // Update the connection to use the input node as the from node.
            connection = new ConnectionData(fromNode.Id, pin, connection.GetTo().NodeId, connection.GetTo().Pin);
        }
        if (toNode == null)
        {
            toNode = OutputNode;
            // toNode.AddOutput(connection.GetTo().Pin);
        }



        bool valid = ValidateConnection(connection);
        if (valid)
        {
            _connections.Add(connection);
            Logger.Log($"[GraphData] Connection added. Total connections: {_connections.Count}");
            return true;
        }
        else
        {
            Logger.Log("[GraphData] WARNING: Connection validation failed. Connection not added.");
            return false;
        }
    }
}

