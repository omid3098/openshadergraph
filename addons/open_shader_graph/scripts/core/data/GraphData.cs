using Godot;
#nullable enable
namespace OpenShaderGraph.Core.Data;

using System.Collections.Generic;
using OpenShaderGraph.Core.Utils;
using System;

public static class ShaderPass
{
    public static string VERTEX = "vertex";
    public static string FRAGMENT = "fragment";
    public static string LIGHT = "light";
    public static string COMPUTE = "compute";
}

public partial class GraphData
{
    private string _name = "";
    protected List<NodeData> _nodes = new();
    protected List<ConnectionData> _connections = new();
    protected long _nextNodeId = 0;
    private string _filePath = ""; // asset path used for saving and loading
    private string _version = "1.0"; // version identifier for the graph asset
    private Dictionary<string, object> _properties = new(); // custom graph properties

    public GraphData()
    {
        _name = "New Graph";
        _nodes = new List<NodeData>();
        _connections = new List<ConnectionData>();
        AddProperty("shaderpass", ShaderPass.FRAGMENT);
        Logger.Log($"[GraphData]: {_name}");
    }

    public string GetName() => _name;
    public List<NodeData> GetNodes() => _nodes;
    public List<ConnectionData> GetConnections() => _connections;
    public string GetVersion() => _version;
    public string GetFilePath() => _filePath;
    public Dictionary<string, object> GetProperties() => _properties;
    public void SetName(string name) => _name = name;
    public void SetVersion(string version) => _version = version;
    public void SetFilePath(string filePath) => _filePath = filePath;
    public void AddProperty(string key, object value)
    {
        Logger.Log($"[GraphData] Adding property: {key} = {value}");
        if (!_properties.ContainsKey(key))
        {
            _properties.Add(key, value);
        }
        else
        {
            _properties[key] = value;
        }
    }

    public NodeData? GetNodeById(long id)
    {
        foreach (var node in _nodes)
        {
            if (node.Id == id)
                return node;
        }
        return null;
    }

    public void AddNode(NodeData node)
    {
        if (node == null)
            throw new Exception("Trying to add a null node to the graph");

        if (node.Id == -1)
        {
            _nextNodeId++;
            node.SetId(_nextNodeId);
            Logger.Log($"[GraphData] Assigning new ID to node: {node.Title} : {_nextNodeId}");
        }
        else
        {
            if (node.Id >= _nextNodeId)
            {
                _nextNodeId = node.Id + 1;
            }
        }

        _nodes.Add(node);
    }

    public void RemoveNode(NodeData node)
    {
        if (node == null || !_nodes.Contains(node))
            return;

        // Remove connections associated with the node
        _connections.RemoveAll(connection =>
            connection.GetFrom().NodeId == node.Id || connection.GetTo().NodeId == node.Id
        );

        _nodes.Remove(node);
    }

    public virtual bool AddConnection(ConnectionData connection)
    {
        if (connection == null)
            return false; // Silently ignore null connections

        var fromNode = GetNodeById(connection.GetFrom().NodeId);
        var toNode = GetNodeById(connection.GetTo().NodeId);
        Logger.Log($"[GraphData] Adding connection: {fromNode?.Title} -> {toNode?.Title}");

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
            Logger.Log($"[GraphData] Connection from and to the same node: {fromNode.Title}");
            return false;
        }

        // Connection from and to the same pin
        if (fromPin.GetDirection() == toPin.GetDirection())
        {
            Logger.Log($"[GraphData] Connection from and to the same pin: {fromPin.GetName()}");
            return false;
        }

        // Node has no output pin
        if (fromNode.GetOutputs().Count == 0)
        {
            Logger.Log($"[GraphData] Node has no output pin: {fromNode.Title}");
            return false;
        }

        // Node has no input pin
        if (toNode.GetInputs().Count == 0)
        {
            Logger.Log($"[GraphData] Node has no input pin: {toNode.Title}");
            return false;
        }

        // Node source does not exist in the graph
        if (!_nodes.Contains(fromNode))
        {
            Logger.Log($"[GraphData] Node does not exist in the graph: {fromNode.Title}");
            return false;
        }

        // Node destination does not exist in the graph
        if (!_nodes.Contains(toNode))
        {
            Logger.Log($"[GraphData] Node does not exist in the graph: {toNode.Title}");
            return false;
        }

        // Type mismatch : TODO: Fix this after type conversion is implemented
        if (fromPin.GetDataType() != toPin.GetDataType())
        {
            Logger.Log($"[GraphData] Type mismatch: {fromPin.GetDataType()} -> {toPin.GetDataType()}");
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

