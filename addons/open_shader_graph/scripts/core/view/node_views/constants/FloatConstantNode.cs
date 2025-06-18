using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.View.NodeViews.Constants;

namespace OpenShaderGraph.Core.View.NodeViews
{
    [RegisterNode(name: "Float", category: "Constants")]
    public partial class FloatConstantNode : BaseConstantNode
    {
        public new static BaseNodeData CreateNodeData(string name, string type, Vector2 position)
        {
            var nodeData = new BaseNodeData(name, type, position);
            nodeData.AddInput(new PinData("value", PinDataType.Float, DirectionType.Input, 0f));
            nodeData.AddOutput(new PinData("out", PinDataType.Float, DirectionType.Output));
            return nodeData;
        }
    }
}