using Godot;

namespace OpenShaderGraph.Core.View.NodeViews
{
    [RegisterNode(name: "Add", category: "Math")]
    public partial class AddNode : BaseGraphNode
    {
        public override void _Ready()
        {
            base._Ready();
            // Custom logic for the Add node
        }
    }
}