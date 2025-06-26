using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI;
using OpenShaderGraph.Core.View.UI.Sidebar;
using OpenShaderGraph.Core.View.UI.BottomPanel;
using OpenShaderGraph.Core.View.UI.ContextMenu;
using OpenShaderGraph.Core.View.NodeViews;
using System;
using OpenShaderGraph.Core.View.UI.Sidebar.MenuBar;
using OpenShaderGraph.Core.Logic;

namespace OpenShaderGraph.Core.View
{
    public partial class UIManager : Control, IInitializable
    {
        private Control _rootControl = default!; // root UI scene returned by GetMainScene

        public Action<BaseGraphData> GraphTabSelected;
        public Action<int> FileMenuItemSelected;
        public Action<BaseGraphData> GraphCloseRequested;

        private TabContainer _graphTabs = default!;
        private ContextMenuManager _contextMenuManager = default!;
        private BottomPanel _bottomPanel = default!;
        private Sidebar _sidebar = default!;
        // TODO: current graph edit should be in the graph manager
        private ShaderGraphEdit _currentGraphEdit;
        private const int SidebarWidth = 250;
        private const int BottomPanelHeight = 250;

        public void Init()
        {
            Logger.Log("[UIManager] init");

            InitializeMainScene();
            AddListeners();
        }

        void AddListeners()
        {
            _graphTabs.TabChanged += OnTabChanged;
            _graphTabs.GetTabBar().TabClosePressed += OnTabCloseRequested;
            _graphTabs.GetTabBar().GuiInput += OnTabBarGuiInput;
            _sidebar.FileMenuItemSelected += OnFileMenuItemSelected;

            var graphManager = Services.Get<GraphManager>();
            graphManager.GraphCreated += OnGraphCreated;
            graphManager.GraphSelected += OnGraphSelected;
            graphManager.GraphDeleted += OnGraphDeleted;
        }

        void InitializeMainScene()
        {
            // Set up UI components
            _graphTabs = new TabContainer();
            _graphTabs.Set("tabs_closable", true);
            _contextMenuManager = new ContextMenuManager();
            _bottomPanel = new BottomPanel();
            _sidebar = new Sidebar();

            // A main control node that will contain all the other nodes
            _rootControl = new Control();

            // A VBoxContainer that will contain the menu bar and the main split container
            var vboxContainer = new VBoxContainer();
            vboxContainer.SetAnchorsPreset(LayoutPreset.FullRect);

            // VSplitContainer to separate main content from bottom panel (resizable vertically)
            var mainVsplit = new VSplitContainer();
            mainVsplit.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            mainVsplit.SizeFlagsVertical = SizeFlags.ExpandFill;

            // HSplitContainer for sidebar and graph edit (resizable horizontally)
            var mainHsplit = new HSplitContainer();
            mainHsplit.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            mainHsplit.SizeFlagsVertical = SizeFlags.ExpandFill;

            // Set initial split ratios
            mainHsplit.SplitOffset = -SidebarWidth; // Initial sidebar width
            mainVsplit.SplitOffset = BottomPanelHeight; // Initial bottom panel height

            // Set up sidebar
            _sidebar.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            _sidebar.SizeFlagsVertical = SizeFlags.ExpandFill;
            _sidebar.CustomMinimumSize = new Vector2(SidebarWidth, 0); // Give it a minimum width
            mainHsplit.AddChild(_sidebar);

            // Set up graph edit
            _graphTabs.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            _graphTabs.SizeFlagsVertical = SizeFlags.ExpandFill;
            mainHsplit.AddChild(_graphTabs);

            // Add the horizontal split to the vertical split
            mainVsplit.AddChild(mainHsplit);

            // Set up bottom panel
            _bottomPanel.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            _bottomPanel.SizeFlagsVertical = SizeFlags.ExpandFill;
            _bottomPanel.CustomMinimumSize = new Vector2(0, BottomPanelHeight); // Give it a minimum height
            mainVsplit.AddChild(_bottomPanel);

            vboxContainer.AddChild(mainVsplit);
            _rootControl.AddChild(vboxContainer);
            _rootControl.AddChild(_contextMenuManager);
        }

        private void OnFileMenuItemSelected(int itemId)
        {
            var graphManager = Services.Get<GraphManager>();
            // Handle actions based on the selected File menu item enum.
            switch ((MenuEnums.FileMenuItem)itemId)
            {
                case MenuEnums.FileMenuItem.NewGraph:
                    Logger.Log("[UIManager] File > New Graph");
                    graphManager.CreateNewGraph();
                    break;
                case MenuEnums.FileMenuItem.OpenGraph:
                    Logger.Log("[UIManager] File > Open Graph");
                    // _fileDialog.FileMode = FileDialog.FileModeEnum.OpenFile;
                    // _fileDialog.PopupCentered();
                    break;
                case MenuEnums.FileMenuItem.Save:
                    Logger.Log("[UIManager] File > Save");
                    // OnSaveMenu();
                    break;
                case MenuEnums.FileMenuItem.SaveAs:
                    Logger.Log("[UIManager] File > Save As");
                    // OnSaveAsMenu();
                    break;
                case MenuEnums.FileMenuItem.Export:
                    Logger.Log("[UIManager] File > Export");
                    break;
                default:
                    Logger.Log($"[UIManager] Unknown file menu action: {itemId}");
                    break;
            }
        }

        private void SaveGraphToPath(string path)
        {
            // TODO: Implement this after we have a serializer service
        }


        private void LoadGraphFromPath(string path)
        {
            // TODO: Implement this after we have a serializer service
        }

        public Control GetMainScene()
        {
            return _rootControl;
        }

        // Tab management - orchestrates UI updates based on graph operations
        public void OnGraphCreated(BaseGraphData graph)
        {
            Logger.Log($"[UIManager] Adding graph tab: {graph.GetName()}");
            graph.NameChanged += (newName) => OnGraphNameChanged(graph, newName);
            CreateOrSwitchToTab(graph);
            // Display graph properties immediately on graph creation
            OnNodeDeselectedInGraph();
        }

        public void OnGraphSelected(BaseGraphData graph)
        {
            Logger.Log($"[UIManager] Switching to graph: {graph.GetName()}");
            CreateOrSwitchToTab(graph);
            // Clear any lingering selection so no nodes remain selected when switching graphs
            _currentGraphEdit.DeselectAllNodes();
            // Display graph properties immediately on graph selection
            OnNodeDeselectedInGraph();
        }

        private void CreateOrSwitchToTab(BaseGraphData graph)
        {
            // Check if tab already exists
            for (int i = 0; i < _graphTabs.GetChildCount(); i++)
            {
                var child = _graphTabs.GetChild(i);
                if (child is ShaderGraphEdit edit && edit.GetGraphData() == graph)
                {
                    // Prevent firing TabChanged while programmatically switching
                    _graphTabs.TabChanged -= OnTabChanged;
                    _currentGraphEdit = edit;
                    _graphTabs.CurrentTab = i;
                    _graphTabs.TabChanged += OnTabChanged;
                    return;
                }
            }

            // Create new tab
            var newEdit = new ShaderGraphEdit();
            newEdit.Initialize(graph, _contextMenuManager);
            // Prevent automatic selection on add
            _graphTabs.TabChanged -= OnTabChanged;
            _graphTabs.AddChild(newEdit);
            _graphTabs.SetTabTitle(_graphTabs.GetChildCount() - 1, graph.GetName());

            // Connect signals for the new tab
            newEdit.NodeSelectedInGraph += OnNodeSelectedInGraph;
            newEdit.NodeDeselectedInGraph += OnNodeDeselectedInGraph;

            var newIndex = _graphTabs.GetChildCount() - 1;
            _currentGraphEdit = newEdit;
            _graphTabs.CurrentTab = newIndex;
            _graphTabs.TabChanged += OnTabChanged;
        }

        public void OnGraphDeleted(BaseGraphData graph)
        {
            for (int i = 0; i < _graphTabs.GetChildCount(); i++)
            {
                var child = _graphTabs.GetChild(i);
                if (child is ShaderGraphEdit edit && edit.GetGraphData() == graph)
                {
                    // Disconnect signals before removing
                    edit.NodeSelectedInGraph -= OnNodeSelectedInGraph;
                    edit.NodeDeselectedInGraph -= OnNodeDeselectedInGraph;

                    _graphTabs.RemoveChild(child);
                    graph.NameChanged -= (newName) => OnGraphNameChanged(graph, newName);
                    child.QueueFree();
                    break;
                }
            }
            // Refresh active tab selection and properties panel after deletion
            if (_graphTabs.GetChildCount() > 0)
            {
                int currentIndex = _graphTabs.CurrentTab;
                if (currentIndex < 0 || currentIndex >= _graphTabs.GetChildCount())
                {
                    currentIndex = 0;
                    _graphTabs.CurrentTab = 0;
                }
                if (_graphTabs.GetChild(currentIndex) is ShaderGraphEdit newEdit)
                {
                    _currentGraphEdit = newEdit;
                    OnNodeDeselectedInGraph();
                }
            }
            else
            {
                // No tabs remain: clear properties panel
                _sidebar.GetPropertiesPanel().ClearProperties();
            }
        }

        private void OnTabChanged(long tabIndex)
        {
            var child = _graphTabs.GetChild((int)tabIndex);
            if (child is ShaderGraphEdit edit && edit.GetGraphData() != null)
            {
                if (_currentGraphEdit == edit)
                {
                    return; // No change
                }

                _currentGraphEdit = edit;

                // Emit signal to parent instead of direct call to GraphManager
                GraphTabSelected?.Invoke(edit.GetGraphData());
                // Update properties panel to show graph properties
                OnNodeDeselectedInGraph();
            }
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

        private void OnTabCloseRequested(long tabIndex)
        {
            if (_graphTabs.GetTabControl((int)tabIndex) is ShaderGraphEdit graphEdit)
            {
                GraphCloseRequested?.Invoke(graphEdit.GraphData);
            }
        }

        private void OnTabBarGuiInput(InputEvent @event)
        {
            if (@event is InputEventMouseButton mouseButton && mouseButton.Pressed && mouseButton.ButtonIndex == MouseButton.Middle)
            {
                var tabBar = _graphTabs.GetTabBar();
                if (tabBar == null)
                {
                    return;
                }

                for (int i = 0; i < tabBar.GetTabCount(); i++)
                {
                    if (tabBar.GetTabRect(i).HasPoint(mouseButton.Position))
                    {
                        OnTabCloseRequested(i);
                        break;
                    }
                }
            }
        }
    }
}