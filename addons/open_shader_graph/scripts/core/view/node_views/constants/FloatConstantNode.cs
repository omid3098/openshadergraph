using Godot;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.View.NodeViews
{
    [RegisterNode(name: "Float", category: "Constants")]
    public partial class FloatConstantNode : BaseGraphNode
    {
        public override void _Ready()
        {
            base._Ready();
            // Custom logic for the float constant node can go here.
            // For now, we rely on the BaseGraphNode's initialization.
        }

        public void SetValue(float value)
        {
            if (Data.GetOutputs().Count > 0)
            {
                var pin = Data.GetOutputs()[0];
                pin.SetValue(Variant.From(value));
            }
        }
    }
}