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
            // Register core services and perform initialization
            Services.Register<GraphManager>(new GraphManager());
            Services.Register<PreferencesManager>(new PreferencesManager());
            Services.Register<UIManager>(new UIManager());
            Services.Register<NodeRegistry>(new NodeRegistry());
            Services.Register<GroupingService>(new GroupingService());
            Services.Register<NodeFilteringService>(new NodeFilteringService());
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