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

namespace OpenShaderGraph.Core.View.UI
{
    public partial class ShaderGraphEdit : GraphEdit
    {
        public Action<BaseGraphNode>? NodeSelectedInGraph { get; set; }
        public Action? NodeDeselectedInGraph { get; set; }

        public BaseGraphData? GraphData { get; private set; }
        private ContextMenuManager? _contextMenuManager;

        public ShaderGraphEdit()
        {
            Logger.Log("[ShaderGraphEdit] init");
            DeactivateGraphEdit();
        }

        public void Initialize(BaseGraphData graph, ContextMenuManager contextMenuManager)
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
                Logger.Log("[ShaderGraphEdit] DrawGraph aborted: GraphData is null");
                return;
            }
            // Log graph content before drawing
            Logger.Log($"[ShaderGraphEdit] DrawGraph: Graph='{GraphData.GetName()}', Nodes={GraphData.GetNodes().Count}, Connections={GraphData.GetConnections().Count}");
            // Draw nodes
            foreach (var nodeData in GraphData.GetNodes())
            {
                var registeredNode = Services.Get<NodeRegistry>().FindRegisteredNode(nodeData.GetNodeType());
                BaseGraphNode nodeView;
                if (registeredNode != null)
                {
                    nodeView = (BaseGraphNode)System.Activator.CreateInstance(registeredNode.NodeType)!;
                }
                else
                {
                    // Fallback for unregistered node types (e.g., Input/Output in subgraphs)
                    nodeView = new DefaultGraphNode();
                }
                // Ensure unique Name for ConnectNode
                nodeView.Name = nodeData.Id.ToString();
                nodeView.Initialize(nodeData);
                AddChild(nodeView);
            }

            // Draw connections
            Logger.Log("[ShaderGraphEdit] DrawGraph: starting connection loop");
            foreach (var connectionData in GraphData.GetConnections())
            {
                // Log each connection to draw
                Logger.Log($"[ShaderGraphEdit] DrawGraph: examining connection from {connectionData.GetFrom().NodeId}:{connectionData.GetFrom().Pin.GetName()} to {connectionData.GetTo().NodeId}:{connectionData.GetTo().Pin.GetName()}");
                BaseGraphNode? fromNode = null;
                BaseGraphNode? toNode = null;

                foreach (var child in GetChildren())
                {
                    if (child is BaseGraphNode nodeView)
                    {
                        if (nodeView.Data != null && nodeView.Data.Id == connectionData.GetFrom().NodeId)
                        {
                            fromNode = nodeView;
                        }
                        if (nodeView.Data != null && nodeView.Data.Id == connectionData.GetTo().NodeId)
                        {
                            toNode = nodeView;
                        }
                    }
                }
                if (fromNode == null)
                    Logger.Log($"[ShaderGraphEdit] DrawGraph: could not find fromNode view for ID {connectionData.GetFrom().NodeId}");
                if (toNode == null)
                    Logger.Log($"[ShaderGraphEdit] DrawGraph: could not find toNode view for ID {connectionData.GetTo().NodeId}");

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
                    Logger.Log($"[ShaderGraphEdit] DrawGraph: pin indices fromPinIndex={fromPinIndex}, toPinIndex={toPinIndex}");
                    if (fromPinIndex != -1 && toPinIndex != -1)
                    {
                        Logger.Log($"[ShaderGraphEdit] DrawGraph: connecting node '{fromNode.Name}' slot {fromPinIndex} -> node '{toNode.Name}' slot {toPinIndex}");
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
                    BaseGraphNode? topNode = null;

                    for (int i = GetChildCount() - 1; i >= 0; i--)
                    {
                        var child = GetChild(i);
                        if (child is BaseGraphNode nodeView)
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
                            _contextMenuManager.ShowGroupingMenu(globalMousePosition, new Godot.Collections.Array<GraphNode>(selectedNodes), this);
                        }
                        else
                        {
                            _contextMenuManager.ShowNodeMenu(globalMousePosition, topNode, this);
                        }
                    }
                    else
                    {
                        _contextMenuManager.ShowCreationMenu(GetGlobalMousePosition(), GetLocalMousePosition(), this);
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
            Logger.Log($"Node creation requested: {nodeName} at {position}");
            var registeredNode = Services.Get<NodeRegistry>().FindRegisteredNode(nodeName);

            if (registeredNode != null)
            {
                // 1. Create Node Data using the static method on the node's type
                var createNodeDataMethod = registeredNode.NodeType.GetMethod("CreateNodeData");
                if (createNodeDataMethod != null)
                {
                    var nodeData = (BaseNodeData?)createNodeDataMethod.Invoke(null, new object[] { registeredNode.Attribute.Name, registeredNode.Attribute.Name, position });

                    // 2. Add to Graph Data
                    if (nodeData != null && GraphData != null)
                    {
                        GraphData.AddNode(nodeData);
                        // Node view will be created by the OnNodeAdded event
                    }
                }
            }
        }

        private void OnConnectionRequest(StringName fromNode, long fromPort, StringName toNode, long toPort)
        {
            if (GraphData == null)
            {
                return;
            }

            var fromNodeView = GetNode<BaseGraphNode>(new NodePath(fromNode));
            var toNodeView = GetNode<BaseGraphNode>(new NodePath(toNode));

            if (fromNodeView == null || toNodeView == null)
            {
                return;
            }

            var fromPin = fromNodeView.Data?.GetOutputByIndex((int)fromPort);
            var toPin = toNodeView.Data?.GetInputByIndex((int)toPort);


            if (fromPin != null && toPin != null)
            {
                var connection = new ConnectionData(fromNodeView.Data!.Id, fromPin, toNodeView.Data!.Id, toPin);
                if (GraphData.AddConnection(connection))
                {
                    ConnectNode(fromNode, (int)fromPort, toNode, (int)toPort);
                }
            }
        }

        private void OnDisconnectionRequest(StringName fromNode, long fromPort, StringName toNode, long toPort)
        {
            if (GraphData == null)
            {
                return;
            }

            var fromNodeView = GetNode<BaseGraphNode>(new NodePath(fromNode));
            var toNodeView = GetNode<BaseGraphNode>(new NodePath(toNode));

            if (fromNodeView == null || toNodeView == null)
            {
                return;
            }

            var fromPin = fromNodeView.Data?.GetOutputByIndex((int)fromPort);
            var toPin = toNodeView.Data?.GetInputByIndex((int)toPort);


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
            if (node is BaseGraphNode selectedNode)
            {
                NodeSelectedInGraph?.Invoke(selectedNode);
            }
        }

        private void OnNodeDeselected(Node node)
        {
            NodeDeselectedInGraph?.Invoke();
        }

        private void OnNodeAdded(BaseNodeData nodeData)
        {
            var registeredNode = Services.Get<NodeRegistry>().FindRegisteredNode(nodeData.GetNodeType());
            if (registeredNode != null)
            {
                var nodeView = (BaseGraphNode?)System.Activator.CreateInstance(registeredNode.NodeType);
                if (nodeView != null)
                {
                    nodeView.Initialize(nodeData);
                    AddChild(nodeView);
                }
            }
        }

        private void OnNodeRemoved(BaseNodeData nodeData)
        {
            foreach (var child in GetChildren())
            {
                if (child is BaseGraphNode nodeView && nodeView.Data != null && nodeView.Data.Id == nodeData.Id)
                {
                    nodeView.DeleteNode();
                    break;
                }
            }
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

        public BaseGraphData? GetGraphData()
        {
            return GraphData;
        }

        private void ClearGraph()
        {
            foreach (var connection in GetConnectionList())
            {
                var fromNode = (string)connection["from_node"];
                var fromPort = (int)connection["from_port"];
                var toNode = (string)connection["to_node"];
                var toPort = (int)connection["to_port"];
                DisconnectNode(fromNode, fromPort, toNode, toPort);
            }

            foreach (var child in GetChildren())
            {
                if (child is BaseGraphNode nodeView)
                {
                    nodeView.DeleteNode();
                }
            }
        }

        public void RequestNodeDeletion(BaseGraphNode node)
        {
            Services.Get<GraphManager>().RemoveNode(node.Data!);
        }

        public void RequestNodeDuplication(BaseGraphNode node)
        {
            Services.Get<GraphManager>().DuplicateNode(node.Data!);
        }

        public void RequestGrouping(Godot.Collections.Array<GraphNode> nodes)
        {
            var nodesData = nodes.Cast<BaseGraphNode>().Select(n => n.Data!).ToList();
            Services.Get<GraphManager>().GroupNodes(nodesData);
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