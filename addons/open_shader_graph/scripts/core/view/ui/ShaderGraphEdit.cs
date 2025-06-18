using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI.ContextMenu;
using OpenShaderGraph.Core.View.NodeViews;

namespace OpenShaderGraph.Core.View.UI
{
    public partial class ShaderGraphEdit : GraphEdit
    {
        public BaseGraphData GraphData { get; private set; }
        private ContextMenuManager _contextMenuManager;

        public ShaderGraphEdit()
        {
            Logger.Log("[ShaderGraphEdit] init");
            DeactivateGraphEdit();
        }

        public void Initialize(BaseGraphData graph, ContextMenuManager contextMenuManager)
        {
            GraphData = graph;
            _contextMenuManager = contextMenuManager;

            ClearGraph();
            Logger.Log($"[ShaderGraphEdit] Loaded graph: {graph.GetName()}");
            ActivateGraphEdit();

            var creationPopup = _contextMenuManager.GetNode<CreationPopup>("CreationPopup");
            if (creationPopup != null)
            {
                creationPopup.NodeCreationRequested += OnNodeCreationRequested;
            }

            ConnectionRequest += OnConnectionRequest;
            DisconnectionRequest += OnDisconnectionRequest;
        }

        public override void _GuiInput(InputEvent @event)
        {
            if (@event is InputEventMouseButton mouseButton && mouseButton.ButtonIndex == MouseButton.Right && mouseButton.Pressed)
            {
                if (GraphData != null)
                {
                    _contextMenuManager.ShowCreationMenu(GetGlobalMousePosition(), GetLocalMousePosition());
                    AcceptEvent();
                }
            }
        }

        private void OnNodeCreationRequested(string nodeName, Vector2 position)
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

            var fromPin = fromNodeView.Data.GetOutputByIndex((int)fromPort - fromNodeView.Data.GetInputs().Count);
            var toPin = toNodeView.Data.GetInputBySlot((int)toPort);


            if (fromPin != null && toPin != null)
            {
                if (IsConnectionValid(fromPin, toPin))
                {
                    var connection = new ConnectionData(fromNodeView.Data, fromPin, toNodeView.Data, toPin);
                    GraphData.AddConnection(connection);
                    ConnectNode(fromNode, (int)fromPort, toNode, (int)toPort);
                }
            }
        }

        private bool IsConnectionValid(PinData fromPin, PinData toPin)
        {
            if (fromPin.GetDirection() == toPin.GetDirection())
            {
                return false;
            }

            if (fromPin.GetDataType() != toPin.GetDataType())
            {
                return false;
            }

            return true;
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

            var fromPin = fromNodeView.Data.GetOutputByIndex((int)fromPort - fromNodeView.Data.GetInputs().Count);
            var toPin = toNodeView.Data.GetInputBySlot((int)toPort);


            if (fromPin != null && toPin != null)
            {
                var connection = GraphData.FindConnection(fromNodeView.Data, fromPin, toNodeView.Data, toPin);
                if (connection != null)
                {
                    GraphData.RemoveConnection(connection);
                    DisconnectNode(fromNode, (int)fromPort, toNode, (int)toPort);
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
    }
}