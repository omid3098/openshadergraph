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
    [Signal]
    public delegate void NameChangedEventHandler(string newName);

    private string _name = "";
    private GraphType _graphType = GraphType.ShaderGraph;
    private List<BaseNodeData> _nodes = new();
    private List<ConnectionData> _connections = new();
    private long _nextNodeId = 0;
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

    public void SetName(string name)
    {
        if (_name != name)
        {
            _name = name;
            EmitSignal(SignalName.NameChanged, name);
        }
    }
    public void SetVersion(string version) => _version = version;
    public void SetFilePath(string filePath) => _filePath = filePath;
    public void SetProperties(Dictionary<string, Variant> properties) => _properties = properties;

    public BaseNodeData? GetNodeById(long id)
    {
        foreach (var node in _nodes)
        {
            if (node.Id == id)
                return node;
        }
        return null;
    }

    public void AddNode(BaseNodeData node)
    {
        if (node == null)
            return; // Silently ignore null nodes
        node.Id = _nextNodeId++;
        _nodes.Add(node);
    }

    public void AddConnection(ConnectionData connection)
    {
        if (connection == null)
            return; // Silently ignore null connections

        var fromNode = GetNodeById(connection.GetFrom().NodeId);
        var toNode = GetNodeById(connection.GetTo().NodeId);
        Logger.Log($"[BaseGraphData] Adding connection: {fromNode?.GetName()} -> {toNode?.GetName()}");

        bool valid = ValidateConnection(connection);
        if (valid)
        {
            _connections.Add(connection);
            Logger.Log($"[BaseGraphData] Connection added. Total connections: {_connections.Count}");
        }
        else
        {
            Logger.Log("[BaseGraphData] WARNING: Connection validation failed. Connection not added.");
        }
    }

    public void RemoveConnection(ConnectionData connection)
    {
        _connections.Remove(connection);
    }

    public ConnectionData? FindConnection(long fromNodeId, PinData fromPin, long toNodeId, PinData toPin)
    {
        foreach (var connection in _connections)
        {
            if (connection.GetFrom().NodeId == fromNodeId &&
                connection.GetFrom().Pin == fromPin &&
                connection.GetTo().NodeId == toNodeId &&
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
        var fromNode = GetNodeById(from.NodeId);
        var fromPin = from.Pin;
        var toNode = GetNodeById(to.NodeId);
        var toPin = to.Pin;

        // Handle null nodes or pins
        if (fromNode == null || toNode == null || fromPin == null || toPin == null)
            return false;

        // Connection from and to the same node
        if (fromNode.Id == toNode.Id)
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

    public bool IsPinConnected(PinData pin)
    {
        if (pin.GetDirection() == DirectionType.Input)
        {
            return _connections.Exists(c => c.GetTo().Pin == pin);
        }
        else
        {
            return _connections.Exists(c => c.GetFrom().Pin == pin);
        }
    }
}