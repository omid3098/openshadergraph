#nullable enable
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI.ContextMenu;
using OpenShaderGraph.Core.View.NodeViews;
using OpenShaderGraph.Core.Logic;
using System;
using System.Linq;
using System.Collections.Generic;
using Godot.Collections;
using OpenShaderGraph.Core.Logic.Services.TemplateRegistry;

namespace OpenShaderGraph.Core.View.UI
{
    public partial class GraphView : GraphEdit
    {
        public Action<NodeView>? NodeSelectedInGraph { get; set; }
        public Action? NodeDeselectedInGraph { get; set; }

        public GraphData? GraphData { get; private set; }
        private ContextMenuManager? _contextMenuManager;
        private readonly System.Collections.Generic.Dictionary<long, NodeView> _nodeViewCache = new();

        public GraphView()
        {
            Logger.Log("[ShaderGraphEdit] init");
            DeactivateGraphEdit();
        }

        // TODO: Clean up this initialize method
        public void Initialize(GraphData graph, ContextMenuManager contextMenuManager)
        {
            if (GraphData != null)
            {
                // Unsubscribe from old events to prevent multiple subscriptions
                ConnectionRequest -= OnConnectionRequest;
                DisconnectionRequest -= OnDisconnectionRequest;
                NodeSelected -= OnNodeSelected;
                NodeDeselected -= OnNodeDeselected;
                GraphData.NodeRemoved -= OnNodeRemoved;
                GraphData.NodeAdded -= OnNodeAdded;
            }

            GraphData = graph;
            _contextMenuManager = contextMenuManager;
            GraphData.NodeRemoved += OnNodeRemoved;
            GraphData.NodeAdded += OnNodeAdded;

            ClearGraph();
            // Defer drawing until this control is in the scene tree so GraphEdit can hook up signals
            CallDeferred(nameof(DeferredDrawGraph));
            ActivateGraphEdit();

            ConnectionRequest += OnConnectionRequest;
            DisconnectionRequest += OnDisconnectionRequest;
            NodeSelected += OnNodeSelected;
            NodeDeselected += OnNodeDeselected;

            RightDisconnects = true;
        }

        public override void _ExitTree()
        {
            base._ExitTree();
            ConnectionRequest -= OnConnectionRequest;
            DisconnectionRequest -= OnDisconnectionRequest;
            NodeSelected -= OnNodeSelected;
            NodeDeselected -= OnNodeDeselected;
            if (GraphData != null)
            {
                GraphData.NodeRemoved -= OnNodeRemoved;
                GraphData.NodeAdded -= OnNodeAdded;
            }
        }

        private void DrawGraph()
        {
            if (GraphData == null)
            {
                Logger.Debug("[ShaderGraphEdit] DrawGraph aborted: GraphData is null");
                return;
            }
            _nodeViewCache.Clear();
            // Log graph content before drawing
            Logger.Debug($"[ShaderGraphEdit] DrawGraph: Graph='{GraphData.GetName()}', Nodes={GraphData.GetNodes().Count}, Connections={GraphData.GetConnections().Count}");
            // Draw nodes
            foreach (var nodeData in GraphData.GetNodes())
            {
                var registeredTemplate = nodeData.Template;
                NodeView nodeView;
                if (registeredTemplate == null)
                {
                    throw new Exception($"Node template not found for node with title: {nodeData.Title}");
                }
                else
                {
                    // todo: not sure what this is doing
                    nodeView = new NodeView();
                }
                // Ensure unique Name for ConnectNode
                nodeView.Name = nodeData.Id.ToString();
                nodeView.Initialize(nodeData);
                AddChild(nodeView);
                _nodeViewCache[nodeData.Id] = nodeView;
            }

            // Draw connections
            Logger.Debug("[ShaderGraphEdit] DrawGraph: starting connection loop");
            foreach (var connectionData in GraphData.GetConnections())
            {
                // Log each connection to draw
                Logger.Debug($"[ShaderGraphEdit] DrawGraph: examining connection from {connectionData.GetFrom().NodeId}:{connectionData.GetFrom().Pin.GetName()} to {connectionData.GetTo().NodeId}:{connectionData.GetTo().Pin.GetName()}");
                // Use cache for O(1) lookups
                _nodeViewCache.TryGetValue(connectionData.GetFrom().NodeId, out var fromNode);
                _nodeViewCache.TryGetValue(connectionData.GetTo().NodeId, out var toNode);

                if (fromNode == null)
                    Logger.Debug($"[ShaderGraphEdit] DrawGraph: could not find fromNode view for ID {connectionData.GetFrom().NodeId}");
                if (toNode == null)
                    Logger.Debug($"[ShaderGraphEdit] DrawGraph: could not find toNode view for ID {connectionData.GetTo().NodeId}");

                if (fromNode != null && toNode != null)
                {
                    // Determine pin indices using reference-based lookup first, fallback to name-based
                    var outputs = fromNode.Data.GetOutputs();
                    int fromPinIndex = outputs.FindIndex(p => p == connectionData.GetFrom().Pin);
                    if (fromPinIndex == -1)
                    {
                        fromPinIndex = outputs.FindIndex(p => p.GetName() == connectionData.GetFrom().Pin.GetName());
                    }
                    var inputs = toNode.Data.GetInputs();
                    int toPinIndex = inputs.FindIndex(p => p == connectionData.GetTo().Pin);
                    if (toPinIndex == -1)
                    {
                        toPinIndex = inputs.FindIndex(p => p.GetName() == connectionData.GetTo().Pin.GetName());
                    }
                    Logger.Debug($"[ShaderGraphEdit] DrawGraph: pin indices fromPinIndex={fromPinIndex}, toPinIndex={toPinIndex}");
                    if (fromPinIndex != -1 && toPinIndex != -1)
                    {
                        Logger.Debug($"[ShaderGraphEdit] DrawGraph: connecting node '{fromNode.Name}' slot {fromPinIndex} -> node '{toNode.Name}' slot {toPinIndex}");
                        ConnectNode(fromNode.Name, fromPinIndex, toNode.Name, toPinIndex);
                    }
                }
            }
        }

        public override void _GuiInput(InputEvent @event)
        {
            if (@event is InputEventMouseButton mouseButton && mouseButton.ButtonIndex == MouseButton.Right && mouseButton.Pressed)
            {
                if (GraphData != null && _contextMenuManager != null)
                {
                    var globalMousePosition = GetGlobalMousePosition();
                    NodeView? topNode = null;

                    for (int i = GetChildCount() - 1; i >= 0; i--)
                    {
                        var child = GetChild(i);
                        if (child is NodeView nodeView)
                        {
                            if (nodeView.GetGlobalRect().HasPoint(globalMousePosition))
                            {
                                topNode = nodeView;
                                break;
                            }
                        }
                    }

                    if (topNode != null)
                    {
                        var selectedNodes = GetSelectedNodes();
                        if (selectedNodes.Count > 1 && selectedNodes.Contains(topNode))
                        {
                            _contextMenuManager.ShowGroupingMenu(globalMousePosition, new Array<GraphNode>(selectedNodes), this);
                        }
                        else
                        {
                            _contextMenuManager.ShowNodeMenu(globalMousePosition, topNode, this);
                        }
                    }
                    else
                    {
                        var localMousePosition = GetLocalMousePosition();
                        var graphPosition = (localMousePosition + ScrollOffset) / Zoom;
                        Logger.Log($"[DEBUG] Mouse position fix - Local: {localMousePosition}, ScrollOffset: {ScrollOffset}, Zoom: {Zoom}, Final: {graphPosition}");
                        _contextMenuManager.ShowCreationMenu(GetGlobalMousePosition(), graphPosition, this);
                    }
                    AcceptEvent();
                }
            }
        }

        private List<GraphNode> GetSelectedNodes()
        {
            var selectedNodes = new List<GraphNode>();
            foreach (var child in GetChildren())
            {
                if (child is GraphNode graphNode && graphNode.Selected)
                {
                    selectedNodes.Add(graphNode);
                }
            }
            return selectedNodes;
        }

        public void CreateNodeAt(string nodeName, Vector2 position)
        {

            Logger.Log($"[DEBUG] Node creation requested: {nodeName} at position {position}");
            Logger.Log($"Node creation requested: {nodeName} at {position}");
            var registeredTemplate = Services.Get<ITemplateRegistry>().FindTemplate(nodeName);

            if (registeredTemplate != null)
            {
                var nodeData = new NodeData(registeredTemplate, position);
                // 2. Add to Graph Data
                if (nodeData != null && GraphData != null)
                {
                    GraphData.AddNode(nodeData);
                }
            }
        }

        private void OnConnectionRequest(StringName fromNode, long fromPort, StringName toNode, long toPort)
        {
            if (GraphData == null)
            {
                return;
            }

            var fromNodeView = GetNode<NodeView>(new NodePath(fromNode));
            var toNodeView = GetNode<NodeView>(new NodePath(toNode));

            if (fromNodeView == null || toNodeView == null)
            {
                return;
            }

            var fromPin = fromNodeView.Data?.GetOutPin((int)fromPort);
            var toPin = toNodeView.Data?.GetInPin((int)toPort);

            if (fromPin == null || toPin == null)
            {
                return;
            }

            // Prevent multiple connections to a single input pin
            if (GraphData.IsPinConnected(toPin))
            {
                var existing = GraphData.GetConnections().FirstOrDefault(c => c.GetTo().Pin == toPin);
                if (existing != null)
                {
                    // Remove existing connection in data model
                    GraphData.RemoveConnection(existing);

                    // Remove existing connection in UI
                    var oldFromNodeName = new StringName(existing.GetFrom().NodeId.ToString());
                    var oldFromNodeView = GetNode<NodeView>(new NodePath(oldFromNodeName));
                    if (oldFromNodeView != null)
                    {
                        int oldFromIndex = oldFromNodeView.Data.GetOutputs().FindIndex(p => p == existing.GetFrom().Pin);
                        if (oldFromIndex == -1)
                        {
                            oldFromIndex = oldFromNodeView.Data.GetOutputs().FindIndex(p => p.GetName() == existing.GetFrom().Pin.GetName());
                        }
                        DisconnectNode(oldFromNodeName, oldFromIndex, toNode, (int)toPort);
                    }
                }
            }

            // Add new connection
            var connection = new ConnectionData(fromNodeView.Data!.Id, fromPin, toNodeView.Data!.Id, toPin);
            if (GraphData.AddConnection(connection))
            {
                ConnectNode(fromNode, (int)fromPort, toNode, (int)toPort);
            }
        }

        private void OnDisconnectionRequest(StringName fromNode, long fromPort, StringName toNode, long toPort)
        {
            if (GraphData == null)
            {
                return;
            }

            var fromNodeView = GetNode<NodeView>(new NodePath(fromNode));
            var toNodeView = GetNode<NodeView>(new NodePath(toNode));

            if (fromNodeView == null || toNodeView == null)
            {
                return;
            }

            var fromPin = fromNodeView.Data?.GetOutPin((int)fromPort);
            var toPin = toNodeView.Data?.GetInPin((int)toPort);


            if (fromPin != null && toPin != null)
            {
                var connection = GraphData.FindConnection(fromNodeView.Data!.Id, fromPin, toNodeView.Data!.Id, toPin);
                if (connection != null)
                {
                    GraphData.RemoveConnection(connection);
                    DisconnectNode(fromNode, (int)fromPort, toNode, (int)toPort);
                }
            }
        }

        private void OnNodeSelected(Node node)
        {
            if (node is NodeView selectedNode)
            {
                NodeSelectedInGraph?.Invoke(selectedNode);
            }
        }

        private void OnNodeDeselected(Node node)
        {
            NodeDeselectedInGraph?.Invoke();
        }

        private void OnNodeAdded(NodeData nodeData)
        {
            var nodeTemplate = nodeData.Template;
            if (nodeTemplate != null)
            {
                // todo: make sure this is correct
                // previously: var nodeView = (NodeView?)System.Activator.CreateInstance(registeredNode.NodeType);

                var nodeView = new NodeView();
                if (nodeView != null)
                {
                    nodeView.Initialize(nodeData);
                    AddChild(nodeView);
                    _nodeViewCache[nodeData.Id] = nodeView;
                }
            }
        }

        private void OnNodeRemoved(NodeData nodeData)
        {
            Logger.Log($"[ShaderGraphEdit] OnNodeRemoved called for nodeData.Id {nodeData.Id}");
            bool removed = false;
            foreach (var child in GetChildren())
            {
                if (child is NodeView nodeView && nodeView.Data != null && nodeView.Data.Id == nodeData.Id)
                {
                    Logger.Log($"[ShaderGraphEdit] OnNodeRemoved: Deleting nodeView {nodeView.Data.Title}({nodeView.Data.Id})");
                    nodeView.DeleteNode();
                    _nodeViewCache.Remove(nodeData.Id);
                    Logger.Log($"[ShaderGraphEdit] OnNodeRemoved: Removed from cache nodeId {nodeData.Id}");
                    removed = true;
                    break;
                }
            }
            if (!removed)
                Logger.Log($"[ShaderGraphEdit] OnNodeRemoved: No matching NodeView found for nodeId {nodeData.Id}");
        }

        private void DeactivateGraphEdit()
        {
            SetProcess(false);
            SetProcessInput(false);
        }

        private void ActivateGraphEdit()
        {
            SetProcess(true);
            SetProcessInput(true);
        }

        public GraphData? GetGraphData()
        {
            return GraphData;
        }

        private void ClearGraph()
        {
            var connections = GetConnectionList();
            Logger.Log($"[ShaderGraphEdit] ClearGraph: connections count = {connections.Count}");
            foreach (var connection in connections)
            {
                var fromNode = (string)connection["from_node"];
                var fromPort = (int)connection["from_port"];
                var toNode = (string)connection["to_node"];
                var toPort = (int)connection["to_port"];
                Logger.Log($"[ShaderGraphEdit] ClearGraph: Disconnecting connection from {fromNode}:{fromPort} -> {toNode}:{toPort}");
                DisconnectNode(fromNode, fromPort, toNode, toPort);
            }

            // Only delete nodes that are still in the cache (i.e., not already removed)
            var baseNodes = GetChildren().OfType<NodeView>()
                .Where(n => _nodeViewCache.ContainsKey(n.Data.Id))
                .ToList();
            Logger.Log($"[ShaderGraphEdit] ClearGraph: Deleting {baseNodes.Count} NodeView children from cache");
            foreach (var nodeView in baseNodes)
            {
                Logger.Log($"[ShaderGraphEdit] ClearGraph: Deleting nodeView {nodeView.Data.Title}({nodeView.Data.Id}) with Name {nodeView.Name}");
                nodeView.DeleteNode();
            }
            _nodeViewCache.Clear();
            Logger.Log($"[ShaderGraphEdit] ClearGraph: _nodeViewCache cleared");
        }

        public void RequestNodeDeletion(NodeView node)
        {
            Services.Get<GraphManager>().RemoveNode(node.Data!);
        }

        public void RequestNodeDuplication(NodeView node)
        {
            Services.Get<GraphManager>().DuplicateNode(node.Data!);
        }

        public void RequestGrouping(Array<GraphNode> nodes)
        {
            var nodesData = nodes.Cast<NodeView>().Select(n => n.Data!).ToList();
            // Services.Get<GraphManager>().GroupNodes(nodesData);
            ClearGraph();
            CallDeferred(nameof(DeferredDrawGraph));
        }

        public void RequestNodeCreation(string nodeName, Vector2 position)
        {
            CreateNodeAt(nodeName, position);
        }

        private void DeferredDrawGraph()
        {
            DrawGraph();
        }

        /// <summary>
        /// Deselect all nodes in this graph edit.
        /// </summary>
        public void DeselectAllNodes()
        {
            foreach (var child in GetChildren())
            {
                if (child is GraphNode node)
                {
                    node.Selected = false;
                }
            }
        }
    }
}