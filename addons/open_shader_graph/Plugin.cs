using Godot;
using OpenShaderGraph.Core.View;

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