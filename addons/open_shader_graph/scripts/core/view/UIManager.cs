using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI;
using OpenShaderGraph.Core.View.UI.Sidebar;
using OpenShaderGraph.Core.View.UI.BottomPanel;
using OpenShaderGraph.Core.View.UI.ContextMenu;
using OpenShaderGraph.Core.View.NodeViews;
using System;

namespace OpenShaderGraph.Core.View
{
    public partial class UIManager : Node
    {
        // Direct signals for parent communication
        public Action<BaseGraphData> GraphTabSelected;
        public Action<int> FileMenuItemSelected;

        private TabContainer _graphTabs = default!;
        private ContextMenuManager _contextMenuManager = default!;
        private BottomPanel _bottomPanel = default!;
        private Sidebar _sidebar = default!;
        private ShaderGraphEdit _currentGraphEdit;

        private const int SidebarWidth = 250;
        private const int BottomPanelHeight = 250;

        public UIManager()
        {
            Logger.Log("[UIManager] init");

            // Set up UI components
            _graphTabs = new TabContainer();
            _contextMenuManager = new ContextMenuManager();
            _bottomPanel = new BottomPanel();
            _sidebar = new Sidebar();

            // Connect to view layer events
            _graphTabs.TabChanged += OnTabChanged;
            _sidebar.FileMenuItemSelected += OnFileMenuItemSelected;
        }

        public Control GetMainScene()
        {
            // A main control node that will contain all the other nodes
            var mainScene = new Control();

            // A VBoxContainer that will contain the menu bar and the main split container
            var vboxContainer = new VBoxContainer();
            vboxContainer.SetAnchorsPreset(Control.LayoutPreset.FullRect);

            // VSplitContainer to separate main content from bottom panel (resizable vertically)
            var mainVsplit = new VSplitContainer();
            mainVsplit.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            mainVsplit.SizeFlagsVertical = Control.SizeFlags.ExpandFill;

            // HSplitContainer for sidebar and graph edit (resizable horizontally)
            var mainHsplit = new HSplitContainer();
            mainHsplit.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            mainHsplit.SizeFlagsVertical = Control.SizeFlags.ExpandFill;

            // Set initial split ratios
            mainHsplit.SplitOffset = -SidebarWidth; // Initial sidebar width
            mainVsplit.SplitOffset = BottomPanelHeight; // Initial bottom panel height

            // Set up sidebar
            _sidebar.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            _sidebar.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
            _sidebar.CustomMinimumSize = new Vector2(SidebarWidth, 0); // Give it a minimum width
            mainHsplit.AddChild(_sidebar);

            // Set up graph edit
            _graphTabs.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            _graphTabs.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
            mainHsplit.AddChild(_graphTabs);

            // Add the horizontal split to the vertical split
            mainVsplit.AddChild(mainHsplit);

            // Set up bottom panel
            _bottomPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            _bottomPanel.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
            _bottomPanel.CustomMinimumSize = new Vector2(0, BottomPanelHeight); // Give it a minimum height
            mainVsplit.AddChild(_bottomPanel);

            vboxContainer.AddChild(mainVsplit);
            mainScene.AddChild(vboxContainer);
            mainScene.AddChild(_contextMenuManager);
            return mainScene;
        }

        // Tab management - orchestrates UI updates based on graph operations
        public void OnGraphCreated(BaseGraphData graph)
        {
            Logger.Log($"[UIManager] Adding graph tab: {graph.GetName()}");
            graph.NameChanged += (newName) => OnGraphNameChanged(graph, newName);
            CreateOrSwitchToTab(graph);
        }

        public void OnGraphSelected(BaseGraphData graph)
        {
            Logger.Log($"[UIManager] Switching to graph: {graph.GetName()}");
            CreateOrSwitchToTab(graph);
        }

        private void CreateOrSwitchToTab(BaseGraphData graph)
        {
            // Check if tab already exists
            for (int i = 0; i < _graphTabs.GetChildCount(); i++)
            {
                var child = _graphTabs.GetChild(i);
                if (child is ShaderGraphEdit edit && edit.GetGraphData() == graph)
                {
                    _graphTabs.CurrentTab = i;
                    // No new tab created, but we need to ensure signals are connected
                    // which is handled by OnTabChanged
                    return;
                }
            }

            // Create new tab
            var newEdit = new ShaderGraphEdit();
            newEdit.Initialize(graph, _contextMenuManager);
            _graphTabs.AddChild(newEdit);
            _graphTabs.SetTabTitle(_graphTabs.GetChildCount() - 1, graph.GetName());
            _graphTabs.CurrentTab = _graphTabs.GetChildCount() - 1;
            // OnTabChanged will handle connecting signals
        }

        public void OnGraphDeleted(BaseGraphData graph)
        {
            for (int i = 0; i < _graphTabs.GetChildCount(); i++)
            {
                var child = _graphTabs.GetChild(i);
                if (child is ShaderGraphEdit edit && edit.GetGraphData() == graph)
                {
                    _graphTabs.RemoveChild(child);
                    graph.NameChanged -= (newName) => OnGraphNameChanged(graph, newName);
                    child.QueueFree();
                    break;
                }
            }
        }

        private void OnTabChanged(long tabIndex)
        {
            var child = _graphTabs.GetChild((int)tabIndex);
            if (child is ShaderGraphEdit edit && edit.GetGraphData() != null)
            {
                if (_currentGraphEdit != null)
                {
                    _currentGraphEdit.NodeSelectedInGraph -= OnNodeSelectedInGraph;
                    _currentGraphEdit.NodeDeselectedInGraph -= OnNodeDeselectedInGraph;
                }

                _currentGraphEdit = edit;
                _currentGraphEdit.NodeSelectedInGraph += OnNodeSelectedInGraph;
                _currentGraphEdit.NodeDeselectedInGraph += OnNodeDeselectedInGraph;

                // Emit signal to parent instead of direct call to GraphManager
                GraphTabSelected?.Invoke(edit.GetGraphData());
                // Update properties panel to show graph properties
                OnNodeDeselectedInGraph();
            }
        }

        private void OnFileMenuItemSelected(int itemId)
        {
            // Forward signal to parent
            FileMenuItemSelected?.Invoke(itemId);
        }

        private void OnGraphNameChanged(BaseGraphData graph, string newName)
        {
            for (int i = 0; i < _graphTabs.GetTabCount(); i++)
            {
                if (_graphTabs.GetTabControl(i) is ShaderGraphEdit edit && edit.GraphData == graph)
                {
                    _graphTabs.SetTabTitle(i, newName);
                    break;
                }
            }
        }

        private void OnNodeSelectedInGraph(BaseGraphNode node)
        {
            var propertiesPanel = _sidebar.GetPropertiesPanel();
            propertiesPanel.DisplayNodeProperties(node);
        }

        private void OnNodeDeselectedInGraph()
        {
            var propertiesPanel = _sidebar.GetPropertiesPanel();
            if (_currentGraphEdit != null)
            {
                propertiesPanel.DisplayGraphProperties();
            }
        }

        public void RefreshGraph(BaseGraphData graph)
        {
            for (int i = 0; i < _graphTabs.GetChildCount(); i++)
            {
                var child = _graphTabs.GetChild(i);
                if (child is ShaderGraphEdit edit && edit.GetGraphData() == graph)
                {
                    edit.Initialize(graph, _contextMenuManager); // Re-initialize with the new data
                    break;
                }
            }
        }
    }
}