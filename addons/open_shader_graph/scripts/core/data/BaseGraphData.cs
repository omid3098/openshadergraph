#nullable enable
namespace OpenShaderGraph.Core.Data;

using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Utils;
using System;

public enum GraphType
{
    ShaderGraph,
    GroupGraph,
    LocalSubgraph,
    GlobalSubgraph,
}

public partial class BaseGroupGraphData : BaseGraphData
{
    public BaseNodeData InputNode { get; private set; }
    public BaseNodeData OutputNode { get; private set; }

    public BaseGroupGraphData(string name,
                              GraphType graphType,
                              List<BaseNodeData>? nodes = null,
                              List<ConnectionData>? connections = null) : base(name, graphType, nodes, connections)
    {
        InputNode = new BaseNodeData("Input", "Input", new Vector2(0, 0));
        OutputNode = new BaseNodeData("Output", "Output", new Vector2(500, 0));
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
            fromNode.AddInput(pin);
            // Update the connection to use the input node as the from node.
            connection = new ConnectionData(fromNode.Id, pin, connection.GetTo().NodeId, connection.GetTo().Pin);
        }
        if (toNode == null)
        {
            toNode = OutputNode;
            toNode.AddOutput(connection.GetTo().Pin);
        }



        bool valid = ValidateConnection(connection);
        if (valid)
        {
            _connections.Add(connection);
            Logger.Log($"[BaseGraphData] Connection added. Total connections: {_connections.Count}");
            return true;
        }
        else
        {
            Logger.Log("[BaseGraphData] WARNING: Connection validation failed. Connection not added.");
            return false;
        }
    }
}

public partial class BaseGraphData : RefCounted
{
    public Action<string> NameChanged { get; set; } = delegate { };
    public Action<BaseNodeData> NodeRemoved { get; set; } = delegate { };
    public Action<BaseNodeData> NodeAdded { get; set; } = delegate { };

    private string _name = "";
    private GraphType _graphType = GraphType.ShaderGraph;
    protected List<BaseNodeData> _nodes = new();
    protected List<ConnectionData> _connections = new();
    protected long _nextNodeId = 0;
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
            NameChanged?.Invoke(name);
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

        if (node.Id == -1)
        {
            node.Id = _nextNodeId++;
        }
        else
        {
            if (node.Id >= _nextNodeId)
            {
                _nextNodeId = node.Id + 1;
            }
        }

        _nodes.Add(node);
        NodeAdded?.Invoke(node);
    }

    public void RemoveNode(BaseNodeData node)
    {
        if (node == null || !_nodes.Contains(node))
            return;

        // Remove connections associated with the node
        _connections.RemoveAll(connection =>
            connection.GetFrom().NodeId == node.Id || connection.GetTo().NodeId == node.Id
        );

        _nodes.Remove(node);
        NodeRemoved?.Invoke(node);
    }

    public virtual bool AddConnection(ConnectionData connection)
    {
        if (connection == null)
            return false; // Silently ignore null connections

        var fromNode = GetNodeById(connection.GetFrom().NodeId);
        var toNode = GetNodeById(connection.GetTo().NodeId);
        Logger.Log($"[BaseGraphData] Adding connection: {fromNode?.GetName()} -> {toNode?.GetName()}");

        bool valid = ValidateConnection(connection);
        if (valid)
        {
            _connections.Add(connection);
            Logger.Log($"[BaseGraphData] Connection added. Total connections: {_connections.Count}");
            return true;
        }
        else
        {
            Logger.Log("[BaseGraphData] WARNING: Connection validation failed. Connection not added.");
            return false;
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