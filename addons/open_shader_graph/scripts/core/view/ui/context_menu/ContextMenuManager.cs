using Godot;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.View.UI.ContextMenu
{
    public partial class ContextMenuManager : Node
    {
        private CreationPopup _creationPopup;
        private NodeContextMenu _nodeContextMenu;
        private GroupingContextMenu _groupingContextMenu;

        public ContextMenuManager()
        {
            Logger.Log("[ContextMenuManager] init");

            _creationPopup = new CreationPopup();
            _nodeContextMenu = new NodeContextMenu();
            _groupingContextMenu = new GroupingContextMenu();
        }
    }

    // Placeholder classes for context menu components
    public partial class CreationPopup : Node
    {
        public CreationPopup()
        {
            Logger.Log("[CreationPopup] init");
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