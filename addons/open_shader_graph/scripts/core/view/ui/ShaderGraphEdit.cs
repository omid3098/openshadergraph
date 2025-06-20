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
                return;
            }
            // Draw nodes
            foreach (var nodeData in GraphData.GetNodes())
            {
                var registeredNode = Services.Get<NodeRegistry>().FindRegisteredNode(nodeData.GetNodeType());
                if (registeredNode != null)
                {
                    var nodeView = (BaseGraphNode)System.Activator.CreateInstance(registeredNode.NodeType)!;
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

                if (fromNode != null && toNode != null)
                {
                    var fromPinIndex = fromNode.Data?.GetOutputs().IndexOf(connectionData.GetFrom().Pin) ?? -1;
                    var toPinIndex = toNode.Data?.GetInputs().IndexOf(connectionData.GetTo().Pin) ?? -1;

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
    }
}