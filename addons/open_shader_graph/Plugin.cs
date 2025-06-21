using Godot;
using OpenShaderGraph.Core.View;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.View.NodeViews;

namespace OpenShaderGraph
{
    [Tool]
    public partial class Plugin : EditorPlugin
    {
        private Control _dock;
        private readonly DockSlot _dockSlot = DockSlot.LeftUl;
        // TODO: Implement TestFramework in C# later
        // private TestFramework _testFramework = new TestFramework();

        public override void _EnterTree()
        {
            // Instantiate service instances for constructor-based DI
            var groupingService = new GroupingService();
            var nodeFilteringService = new NodeFilteringService();
            var preferencesManager = new PreferencesManager();
            var uiManager = new UIManager();
            var nodeRegistry = new NodeRegistry();
            var graphManager = new GraphManager(groupingService);

            // Register services and perform initialization
            // Serializer service for graph assets
            var graphSerializer = new YamlGraphLoader();
            Services.Register<IGraphSerializerService>(graphSerializer);
            Services.Register<GroupingService>(groupingService);
            Services.Register<NodeFilteringService>(nodeFilteringService);
            Services.Register<PreferencesManager>(preferencesManager);
            Services.Register<UIManager>(uiManager);
            Services.Register<NodeRegistry>(nodeRegistry);
            Services.Register<GraphManager>(graphManager);
            Services.InitAll();

            // Build the editor UI
            var openShaderGraphEditor = new OpenShaderGraphEditor();
            _dock = openShaderGraphEditor.GetMainScene();
            // To create a standalone editor, we only need to add the main scene to the root node of an empty scene
            _dock.Name = "OpenShaderGraph";
            AddControlToDock(_dockSlot, _dock);
        }

        public override void _ExitTree()
        {
            // Clean up when the plugin is disabled
            if (_dock != null)
            {
                RemoveControlFromDocks(_dock);
                _dock = null;
            }
        }
    }
}