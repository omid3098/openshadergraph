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

        public override void _Ready()
        {
            base._Ready();
            _contextMenuManager = GetNode<ContextMenuManager>("/root/OpenShaderGraph/UIManager/ContextMenuManager");
            if (_contextMenuManager != null)
            {
                var creationPopup = _contextMenuManager.GetNode<CreationPopup>("CreationPopup");
                if (creationPopup != null)
                {
                    creationPopup.NodeCreationRequested += OnNodeCreationRequested;
                }
            }
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
        }

        public override void _GuiInput(InputEvent @event)
        {
            if (@event is InputEventMouseButton mouseButton && mouseButton.ButtonIndex == MouseButton.Right && mouseButton.Pressed)
            {
                if (GraphData != null)
                {
                    _contextMenuManager.ShowCreationMenu(GetGlobalMousePosition());
                    AcceptEvent();
                }
            }
        }

        private void OnNodeCreationRequested(string nodeName, Vector2 position)
        {
            Logger.Log($"Node creation requested: {nodeName} at {position}");
            var registeredNode = NodeRegistry.Instance.FindRegisteredNode(nodeName);

            if (registeredNode != null)
            {
                // 1. Create Node Data
                var nodeData = new BaseNodeData(registeredNode.Attribute.Name, registeredNode.Attribute.Name, ScrollOffset + position / Zoom);
                // TODO: Populate default pins from a definition

                // 2. Add to Graph Data
                GraphData.AddNode(nodeData);

                // 3. Create Node View
                var nodeView = (BaseGraphNode)System.Activator.CreateInstance(registeredNode.NodeType);
                nodeView.Initialize(nodeData);

                // 4. Add to scene
                AddChild(nodeView);
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