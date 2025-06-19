using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI.ContextMenu;
using OpenShaderGraph.Core.View.NodeViews;
using System;
using System.Linq;

namespace OpenShaderGraph.Core.View.UI
{
    public partial class ShaderGraphEdit : GraphEdit
    {
        public Action<BaseGraphNode> NodeSelectedInGraph { get; set; }
        public Action NodeDeselectedInGraph { get; set; }

        public BaseGraphData GraphData { get; private set; }
        private ContextMenuManager _contextMenuManager;

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
            }
        }

        private void DrawGraph()
        {
            // Draw nodes
            foreach (var nodeData in GraphData.GetNodes())
            {
                var registeredNode = Services.Get<NodeRegistry>().FindRegisteredNode(nodeData.GetNodeType());
                if (registeredNode != null)
                {
                    var nodeView = (BaseGraphNode)System.Activator.CreateInstance(registeredNode.NodeType);
                    nodeView.Initialize(nodeData);
                    AddChild(nodeView);
                }
            }

            // Draw connections
            foreach (var connectionData in GraphData.GetConnections())
            {
                BaseGraphNode? fromNode = null;
                BaseGraphNode? toNode = null;

                foreach (var child in GetChildren())
                {
                    if (child is BaseGraphNode nodeView)
                    {
                        if (nodeView.Data.Id == connectionData.GetFrom().NodeId)
                        {
                            fromNode = nodeView;
                        }
                        if (nodeView.Data.Id == connectionData.GetTo().NodeId)
                        {
                            toNode = nodeView;
                        }
                    }
                }

                if (fromNode != null && toNode != null)
                {
                    var fromPinIndex = fromNode.Data.GetOutputs().IndexOf(connectionData.GetFrom().Pin);
                    var toPinIndex = toNode.Data.GetInputs().IndexOf(connectionData.GetTo().Pin);

                    if (fromPinIndex != -1 && toPinIndex != -1)
                    {
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
                    BaseGraphNode topNode = null;

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
                        _contextMenuManager.ShowNodeMenu(globalMousePosition, topNode, this);
                    }
                    else
                    {
                        _contextMenuManager.ShowCreationMenu(GetGlobalMousePosition(), GetLocalMousePosition(), this);
                    }
                    AcceptEvent();
                }
            }
        }

        public void CreateNodeAt(string nodeName, Vector2 position)
        {
            Logger.Log($"Node creation requested: {nodeName} at {position}");
            var registeredNode = Services.Get<NodeRegistry>().FindRegisteredNode(nodeName);

            if (registeredNode != null)
            {
                // 1. Create Node Data using the static method on the node's type
                var createNodeDataMethod = registeredNode.NodeType.GetMethod("CreateNodeData");
                var nodeData = (BaseNodeData)createNodeDataMethod.Invoke(null, new object[] { registeredNode.Attribute.Name, registeredNode.Attribute.Name, position });

                // 2. Add to Graph Data
                GraphData.AddNode(nodeData);

                // 3. Create Node View
                var nodeView = (BaseGraphNode)System.Activator.CreateInstance(registeredNode.NodeType);
                nodeView.Initialize(nodeData);

                // 4. Add to scene
                AddChild(nodeView);
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

            var fromPin = fromNodeView.Data.GetOutputByIndex((int)fromPort);
            var toPin = toNodeView.Data.GetInputByIndex((int)toPort);


            if (fromPin != null && toPin != null)
            {
                var connection = new ConnectionData(fromNodeView.Data.Id, fromPin, toNodeView.Data.Id, toPin);
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

            var fromPin = fromNodeView.Data.GetOutputByIndex((int)fromPort);
            var toPin = toNodeView.Data.GetInputByIndex((int)toPort);


            if (fromPin != null && toPin != null)
            {
                var connection = GraphData.FindConnection(fromNodeView.Data.Id, fromPin, toNodeView.Data.Id, toPin);
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
                var nodeView = (BaseGraphNode)System.Activator.CreateInstance(registeredNode.NodeType);
                nodeView.Initialize(nodeData);
                AddChild(nodeView);
            }
        }

        private void OnNodeRemoved(BaseNodeData nodeData)
        {
            foreach (var nodeView in GetChildren().OfType<BaseGraphNode>())
            {
                if (nodeView.Data.Id == nodeData.Id)
                {
                    nodeView.QueueFree();
                    return;
                }
            }
        }

        private void DeactivateGraphEdit()
        {
            ShowMenu = false;
            Modulate = new Color(1, 1, 1, 0.5f);
            MinimapEnabled = false;
        }

        private void ActivateGraphEdit()
        {
            ShowMenu = true;
            Modulate = new Color(1, 1, 1, 1);
            MinimapEnabled = true;
        }

        public BaseGraphData GetGraphData()
        {
            return GraphData;
        }

        private void ClearGraph()
        {
            // Remove all GraphNode children
            foreach (Node child in GetChildren())
            {
                if (child is GraphNode)
                {
                    RemoveChild(child);
                    child.QueueFree();
                }
            }

            // Remove all connections
            ClearConnections();
        }

        public void RequestNodeDeletion(BaseGraphNode node)
        {
            Services.Get<Logic.GraphManager>().RemoveNode(node.Data);
        }

        public void RequestNodeDuplication(BaseGraphNode node)
        {
            Services.Get<Logic.GraphManager>().DuplicateNode(node.Data);
        }

        public void RequestNodeCreation(string nodeName, Vector2 position)
        {
            Logger.Log($"Node creation requested: {nodeName} at {position}");
            var registeredNode = Services.Get<NodeRegistry>().FindRegisteredNode(nodeName);

            if (registeredNode != null)
            {
                var createNodeDataMethod = registeredNode.NodeType.GetMethod("CreateNodeData");
                var nodeData = (BaseNodeData)createNodeDataMethod.Invoke(null, new object[] { registeredNode.Attribute.Name, registeredNode.Attribute.Name, position });
                GraphData.AddNode(nodeData);
            }
        }

        // Deferred method to draw the graph after this control enters the scene tree
        private void DeferredDrawGraph()
        {
            DrawGraph();
            Logger.Log($"[ShaderGraphEdit] Loaded graph: {GraphData.GetName()}");
        }
    }
}