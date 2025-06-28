using Godot;
using OpenShaderGraph.Core.View;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Logic.Services.TemplateRegistry;

namespace OpenShaderGraph
{
    [Tool]
    public partial class Plugin : EditorPlugin
    {
        private Control _dock;
        private readonly DockSlot _dockSlot = DockSlot.LeftUl;

        public override void _EnterTree()
        {
            // Instantiate service instances for constructor-based DI
            ITemplateRegistry templateRegistry = new YamlTemplateRegistry();
            Services.Register(templateRegistry);
            UIManager uiManager = new();
            Services.Register(uiManager);
            GraphManager graphManager = new();
            Services.Register(graphManager);
            NodeFilteringService nodeFilteringService = new();
            Services.Register(nodeFilteringService);

            // TODO: Implement these services later
            // var groupingService = new GroupingService();
            // var shaderGeneratorService = new ShaderGeneratorService();
            // var graphSerializer = new YamlGraphSerializer();
            // Services.Register(groupingService);
            // Services.Register<IGraphSerializerService>(graphSerializer);
            // Services.Register<IShaderGeneratorService>(shaderGeneratorService);

            Services.InitAll();

            // Build the editor UI
            _dock = uiManager.GetMainScene();
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