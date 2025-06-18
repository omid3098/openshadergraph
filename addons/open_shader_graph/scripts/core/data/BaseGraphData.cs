#nullable enable
namespace OpenShaderGraph.Core.Data;

using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Utils;

public enum GraphType
{
    ShaderGraph,
    GroupGraph,
    LocalSubgraph,
    GlobalSubgraph,
}

public partial class BaseGraphData : RefCounted
{
    private string _name = "";
    private GraphType _graphType = GraphType.ShaderGraph;
    private List<BaseNodeData> _nodes = new();
    private List<ConnectionData> _connections = new();
    private string _filePath = ""; // asset path used for saving and loading
    private string _version = "1.0"; // version identifier for the graph asset
    private Dictionary<string, Variant> _properties = new(); // custom graph properties

    public BaseGraphData(string name, GraphType graphType, List<BaseNodeData>? nodes = null, List<ConnectionData>? connections = null)
    {
        _name = name;
        _graphType = graphType;
        _nodes = nodes ?? new List<BaseNodeData>();
        _connections = connections ?? new List<ConnectionData>();
        Logger.Log($"[BaseGraphData]: {_name}");
    }

    public string GetName() => _name;
    public GraphType GetGraphType() => _graphType;
    public List<BaseNodeData> GetNodes() => _nodes;
    public List<ConnectionData> GetConnections() => _connections;
    public string GetVersion() => _version;
    public string GetFilePath() => _filePath;
    public Dictionary<string, Variant> GetProperties() => _properties;

    public void SetVersion(string version) => _version = version;
    public void SetFilePath(string filePath) => _filePath = filePath;
    public void SetProperties(Dictionary<string, Variant> properties) => _properties = properties;

    public void AddNode(BaseNodeData node)
    {
        if (node == null)
            return; // Silently ignore null nodes
        _nodes.Add(node);
    }

    public void AddConnection(ConnectionData connection)
    {
        Logger.Log($"[BaseGraphData] Adding connection: {connection.GetFrom().Node.GetName()} -> {connection.GetTo().Node.GetName()}");
        if (connection == null)
            return; // Silently ignore null connections

        bool valid = ValidateConnection(connection);
        if (valid)
            _connections.Add(connection);
    }

    public void RemoveConnection(ConnectionData connection)
    {
        _connections.Remove(connection);
    }

    public ConnectionData? FindConnection(BaseNodeData fromNode, PinData fromPin, BaseNodeData toNode, PinData toPin)
    {
        foreach (var connection in _connections)
        {
            if (connection.GetFrom().Node == fromNode &&
                connection.GetFrom().Pin == fromPin &&
                connection.GetTo().Node == toNode &&
                connection.GetTo().Pin == toPin)
            {
                return connection;
            }
        }
        return null;
    }

    public bool ValidateConnection(ConnectionData connection)
    {
        // Handle null connection
        if (connection == null)
            return false;

        var from = connection.GetFrom();
        var to = connection.GetTo();
        var fromNode = from.Node;
        var fromPin = from.Pin;
        var toNode = to.Node;
        var toPin = to.Pin;

        // Handle null nodes or pins
        if (fromNode == null || toNode == null || fromPin == null || toPin == null)
            return false;

        // Connection from and to the same node
        if (fromNode == toNode)
        {
            Logger.Log($"[BaseGraphData] Connection from and to the same node: {fromNode.GetName()}");
            return false;
        }

        // Connection from and to the same pin
        if (fromPin.GetDirection() == toPin.GetDirection())
        {
            Logger.Log($"[BaseGraphData] Connection from and to the same pin: {fromPin.GetName()}");
            return false;
        }

        // Node has no output pin
        if (fromNode.GetOutputs().Count == 0)
        {
            Logger.Log($"[BaseGraphData] Node has no output pin: {fromNode.GetName()}");
            return false;
        }

        // Node has no input pin
        if (toNode.GetInputs().Count == 0)
        {
            Logger.Log($"[BaseGraphData] Node has no input pin: {toNode.GetName()}");
            return false;
        }

        // Node source does not exist in the graph
        if (!_nodes.Contains(fromNode))
        {
            Logger.Log($"[BaseGraphData] Node does not exist in the graph: {fromNode.GetName()}");
            return false;
        }

        // Node destination does not exist in the graph
        if (!_nodes.Contains(toNode))
        {
            Logger.Log($"[BaseGraphData] Node does not exist in the graph: {toNode.GetName()}");
            return false;
        }

        // Type mismatch : TODO: Fix this after type conversion is implemented
        if (fromPin.GetDataType() != toPin.GetDataType())
        {
            Logger.Log($"[BaseGraphData] Type mismatch: {fromPin.GetDataType()} -> {toPin.GetDataType()}");
            return false;
        }

        return true;
    }
}