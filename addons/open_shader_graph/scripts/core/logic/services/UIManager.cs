using Godot;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI.Sidebar;
using OpenShaderGraph.Core.View.UI.BottomPanel;
using OpenShaderGraph.Core.View.UI.ContextMenu;
using System;
using OpenShaderGraph.Core.View.UI.Sidebar.MenuBar;
using OpenShaderGraph.Core.Logic.Services.GraphManager;
using OpenShaderGraph.Core.View.UI;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.View
{
    public partial class UIManager : Control, IInitializable
    {
        public Action<int> FileMenuItemSelected;

        private Control _rootControl = default!; // root UI scene returned by GetMainScene
        private TabContainer _tabContainer = default!;
        private ContextMenuManager _contextMenuManager = default!;
        private BottomPanel _bottomPanel = default!;
        private Sidebar _sidebar = default!;
        private IGraphManager _graphManager;
        private const int SidebarWidth = 250;
        private const int BottomPanelHeight = 250;

        public void Init()
        {
            Logger.Log("[UIManager] init");
            InitializeMainScene();
            AddListeners();

            _graphManager = Services.Get<IGraphManager>();
            _graphManager.SetTabContainer(_tabContainer);
            _graphManager.GraphSelected += OnGraphSelected;
            _graphManager.GraphDeleted += OnGraphDeleted;
            _graphManager.GraphNameChanged += OnGraphNameChanged;
        }

        void AddListeners()
        {
            _sidebar.FileMenuItemSelected += OnFileMenuItemSelected;
        }

        void InitializeMainScene()
        {
            // Set up UI components
            _tabContainer = new TabContainer();
            _tabContainer.Set("tabs_closable", true);
            _tabContainer.GetTabBar().TabCloseDisplayPolicy = TabBar.CloseButtonDisplayPolicy.ShowAlways;
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
            _tabContainer.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            _tabContainer.SizeFlagsVertical = SizeFlags.ExpandFill;
            mainHsplit.AddChild(_tabContainer);

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

        public Control GetMainScene()
        {
            return _rootControl;
        }

        private void OnFileMenuItemSelected(int itemId)
        {
            // Handle actions based on the selected File menu item enum.
            switch ((MenuEnums.FileMenuItem)itemId)
            {
                case MenuEnums.FileMenuItem.NewSurfaceShader:
                    Logger.Log("[UIManager] File > New Surface Shader");
                    _graphManager.CreateGraph(ShaderType.Surface);
                    break;
                case MenuEnums.FileMenuItem.NewCanvasShader:
                    Logger.Log("[UIManager] File > New Canvas Shader");
                    _graphManager.CreateGraph(ShaderType.Canvas);
                    break;
                case MenuEnums.FileMenuItem.NewComputeShader:
                    Logger.Log("[UIManager] File > New Compute Shader");
                    _graphManager.CreateGraph(ShaderType.Compute);
                    break;
                case MenuEnums.FileMenuItem.Save:
                    Logger.Log("[UIManager] File > Save");
                    // OnSaveMenu();
                    break;
                case MenuEnums.FileMenuItem.SaveAs:
                    Logger.Log("[UIManager] File > Save As");
                    // OnSaveAsMenu();
                    break;
                case MenuEnums.FileMenuItem.Open:
                    Logger.Log("[UIManager] File > Open");
                    // _fileDialog.FileMode = FileDialog.FileModeEnum.OpenFile;
                    // _fileDialog.PopupCentered();
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

        private void OnGraphSelected(GraphView graphView)
        {
            Logger.Log("[UIManager] Graph selected");
            _tabContainer.CurrentTab = graphView.GetIndex();
            _sidebar.GetPropertiesPanel().ShowGraphProperties(graphView);
        }

        private void OnGraphDeleted(GraphView graphView)
        {
            Logger.Log("[UIManager] Graph deleted");
        }

        private void OnGraphNameChanged(GraphView graphView)
        {
            Logger.Log("[UIManager] Graph name changed");
        }

        // private void OnGraphCreated(GraphView graphView)
        // {
        //     Logger.Log("[UIManager] Graph created");
        // }
    }
}