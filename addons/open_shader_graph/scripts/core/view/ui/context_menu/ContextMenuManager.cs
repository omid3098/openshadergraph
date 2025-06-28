using Godot;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.NodeViews;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.View;
using Godot.Collections;

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
            _groupingContextMenu = new GroupingContextMenu { Name = "GroupingContextMenu" };
            AddChild(_groupingContextMenu);
        }

        public void ShowCreationMenu(Vector2 globalPosition, Vector2 localPosition, GraphView target)
        {
            _creationPopup.ShowMenu(globalPosition, localPosition, target);
        }

        public void ShowNodeMenu(Vector2 globalPosition, BaseGraphNode node, GraphView graph)
        {
            _nodeContextMenu.ShowMenu(globalPosition, node, graph);
        }

        public void ShowGroupingMenu(Vector2 globalPosition, Array<GraphNode> nodes, GraphView graph)
        {
            _groupingContextMenu.ShowMenu(globalPosition, nodes, graph);
        }
    }

    public partial class NodeContextMenu : PopupMenu
    {
        private BaseGraphNode _targetNode;
        private GraphView _graph;

        private enum MenuOptions
        {
            Delete,
            Duplicate,
            Copy,
            Cut,
            Ungroup
        }

        public NodeContextMenu()
        {
            Logger.Log("[NodeContextMenu] init");
            AddItem("Delete", (int)MenuOptions.Delete);
            AddItem("Duplicate", (int)MenuOptions.Duplicate);
            AddItem("Copy", (int)MenuOptions.Copy);
            AddItem("Cut", (int)MenuOptions.Cut);
            AddItem("Ungroup", (int)MenuOptions.Ungroup);
            IdPressed += OnIdPressed;
        }

        public void ShowMenu(Vector2 globalPosition, BaseGraphNode node, GraphView graph)
        {
            _targetNode = node;
            _graph = graph;
            Position = (Vector2I)globalPosition;
            Popup();
        }

        private void OnIdPressed(long id)
        {
            switch ((MenuOptions)id)
            {
                case MenuOptions.Delete:
                    if (_targetNode != null)
                    {
                        _graph.RequestNodeDeletion(_targetNode);
                    }
                    break;
                case MenuOptions.Duplicate:
                    if (_targetNode != null)
                    {
                        _graph.RequestNodeDuplication(_targetNode);
                    }
                    break;
                case MenuOptions.Ungroup:
                    if (_targetNode.Data is GroupNodeData groupNodeData)
                    {
                        var graphData = _graph.GetGraphData();
                        if (graphData != null)
                        {
                            var subGraph = groupNodeData.SubGraph;
                            Services.Get<GroupingService>().Ungroup(graphData, groupNodeData, subGraph);
                            graphData.RemoveNode(groupNodeData);
                            Services.Get<UIManager>().RefreshGraph(graphData);
                        }
                    }
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

    public partial class GroupingContextMenu : PopupMenu
    {
        private Array<GraphNode> _targetNodes;
        private GraphView _graph;

        private enum MenuOptions
        {
            Group,
            LocalSubgraph,
            Subgraph
        }

        private enum ArrangeMenuOptions
        {
            Left,
            Right,
            Top,
            Bottom,
            Stack
        }

        private const string ArrangeSubmenuName = "Arrange";

        public GroupingContextMenu()
        {
            Logger.Log("[GroupingContextMenu] init");

            AddItem("Group", (int)MenuOptions.Group);
            AddItem("Local Subgraph", (int)MenuOptions.LocalSubgraph);
            AddItem("Subgraph", (int)MenuOptions.Subgraph);

            var arrangeSubmenu = new PopupMenu { Name = ArrangeSubmenuName };
            arrangeSubmenu.AddItem("Left", (int)ArrangeMenuOptions.Left);
            arrangeSubmenu.AddItem("Right", (int)ArrangeMenuOptions.Right);
            arrangeSubmenu.AddItem("Top", (int)ArrangeMenuOptions.Top);
            arrangeSubmenu.AddItem("Bottom", (int)ArrangeMenuOptions.Bottom);
            arrangeSubmenu.AddItem("Stack", (int)ArrangeMenuOptions.Stack);
            AddChild(arrangeSubmenu);
            AddSubmenuNodeItem("Arrange", arrangeSubmenu);

            IdPressed += OnIdPressed;
            arrangeSubmenu.IdPressed += OnArrangeSubmenuIdPressed;
        }

        public void ShowMenu(Vector2 globalPosition, Array<GraphNode> nodes, GraphView graph)
        {
            _targetNodes = nodes;
            _graph = graph;
            Position = (Vector2I)globalPosition;
            Popup();
        }

        private void OnIdPressed(long id)
        {
            switch ((MenuOptions)id)
            {
                case MenuOptions.Group:
                    if (_graph != null && _targetNodes != null)
                    {
                        _graph.RequestGrouping(_targetNodes);
                    }
                    break;
                case MenuOptions.LocalSubgraph:
                    GD.Print("Local Subgraph not implemented");
                    break;
                case MenuOptions.Subgraph:
                    GD.Print("Subgraph not implemented");
                    break;
            }
        }

        private void OnArrangeSubmenuIdPressed(long id)
        {
            switch ((ArrangeMenuOptions)id)
            {
                case ArrangeMenuOptions.Left:
                    GD.Print("Arrange Left not implemented");
                    break;
                case ArrangeMenuOptions.Right:
                    GD.Print("Arrange Right not implemented");
                    break;
                case ArrangeMenuOptions.Top:
                    GD.Print("Arrange Top not implemented");
                    break;
                case ArrangeMenuOptions.Bottom:
                    GD.Print("Arrange Bottom not implemented");
                    break;
                case ArrangeMenuOptions.Stack:
                    GD.Print("Arrange Stack not implemented");
                    break;
            }
        }
    }
}