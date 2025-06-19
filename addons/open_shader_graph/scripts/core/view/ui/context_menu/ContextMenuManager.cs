using Godot;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.NodeViews;

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
            _nodeContextMenu = new NodeContextMenu { Name = "NodeContextMenu" };
            AddChild(_nodeContextMenu);
            // _groupingContextMenu = new GroupingContextMenu { Name = "GroupingContextMenu" };
            // AddChild(_groupingContextMenu);
        }

        public void ShowCreationMenu(Vector2 globalPosition, Vector2 localPosition, ShaderGraphEdit target)
        {
            _creationPopup.ShowMenu(globalPosition, localPosition, target);
        }

        public void ShowNodeMenu(Vector2 globalPosition, BaseGraphNode node)
        {
            _nodeContextMenu.ShowMenu(globalPosition, node);
        }
    }

    public partial class NodeContextMenu : PopupMenu
    {
        private BaseGraphNode _targetNode;

        private enum MenuOptions
        {
            Delete,
            Duplicate,
            Copy,
            Cut
        }

        public NodeContextMenu()
        {
            Logger.Log("[NodeContextMenu] init");
            AddItem("Delete", (int)MenuOptions.Delete);
            AddItem("Duplicate", (int)MenuOptions.Duplicate);
            AddItem("Copy", (int)MenuOptions.Copy);
            AddItem("Cut", (int)MenuOptions.Cut);
            IdPressed += OnIdPressed;
        }

        public void ShowMenu(Vector2 globalPosition, BaseGraphNode node)
        {
            _targetNode = node;
            Position = (Vector2I)globalPosition;
            Popup();
        }

        private void OnIdPressed(long id)
        {
            switch ((MenuOptions)id)
            {
                case MenuOptions.Delete:
                    _targetNode?.QueueFree();
                    break;
                case MenuOptions.Duplicate:
                    GD.Print("Duplicate not implemented");
                    break;
                case MenuOptions.Copy:
                    GD.Print("Copy not implemented");
                    break;
                case MenuOptions.Cut:
                    GD.Print("Cut not implemented");
                    break;
            }
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