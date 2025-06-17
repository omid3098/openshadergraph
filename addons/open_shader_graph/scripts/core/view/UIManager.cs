using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI;
using OpenShaderGraph.Core.View.UI.Sidebar;
using OpenShaderGraph.Core.View.UI.BottomPanel;
using OpenShaderGraph.Core.View.UI.ContextMenu;

namespace OpenShaderGraph.Core.View
{
    public partial class UIManager : Node
    {
        // Direct signals for parent communication
        [Signal]
        public delegate void GraphTabSelectedEventHandler(BaseGraphData graph);

        [Signal]
        public delegate void FileMenuItemSelectedEventHandler(int itemId);

        private TabContainer _graphTabs;
        private ContextMenuManager _contextMenuManager;
        private BottomPanel _bottomPanel;
        private Sidebar _sidebar;

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
            return mainScene;
        }

        // Tab management - orchestrates UI updates based on graph operations
        public void OnGraphCreated(BaseGraphData graph)
        {
            Logger.Log($"[UIManager] Adding graph tab: {graph.GetName()}");
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
                    return;
                }
            }

            // Create new tab
            var newEdit = new ShaderGraphEdit();
            newEdit.SetGraph(graph);
            _graphTabs.AddChild(newEdit);
            _graphTabs.SetTabTitle(_graphTabs.GetChildCount() - 1, graph.GetName());
            _graphTabs.CurrentTab = _graphTabs.GetChildCount() - 1;
        }

        public void OnGraphDeleted(BaseGraphData graph)
        {
            for (int i = 0; i < _graphTabs.GetChildCount(); i++)
            {
                var child = _graphTabs.GetChild(i);
                if (child is ShaderGraphEdit edit && edit.GetGraphData() == graph)
                {
                    _graphTabs.RemoveChild(child);
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
                // Emit signal to parent instead of direct call to GraphManager
                EmitSignal(SignalName.GraphTabSelected, edit.GetGraphData());
            }
        }

        private void OnFileMenuItemSelected(int itemId)
        {
            // Forward signal to parent
            EmitSignal(SignalName.FileMenuItemSelected, itemId);
        }
    }
}