using Godot;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.View.UI.ContextMenu
{
    public partial class ContextMenuManager : Node
    {
        private CreationPopup _creationPopup;
        private NodeContextMenu _nodeContextMenu;
        private GroupingContextMenu _groupingContextMenu;

        public override void _Ready()
        {
            Logger.Log("[ContextMenuManager] init");

            _creationPopup = new CreationPopup { Name = "CreationPopup" };
            AddChild(_creationPopup);
            // _nodeContextMenu = new NodeContextMenu { Name = "NodeContextMenu" };
            // AddChild(_nodeContextMenu);
            // _groupingContextMenu = new GroupingContextMenu { Name = "GroupingContextMenu" };
            // AddChild(_groupingContextMenu);
        }

        public void ShowCreationMenu(Vector2 globalPosition, Vector2 localPosition)
        {
            _creationPopup.ShowMenu(globalPosition, localPosition);
        }
    }

    public partial class NodeContextMenu : Node
    {
        public NodeContextMenu()
        {
            Logger.Log("[NodeContextMenu] init");
        }
    }

    public partial class GroupingContextMenu : Node
    {
        public GroupingContextMenu()
        {
            Logger.Log("[GroupingContextMenu] init");
        }
    }
}