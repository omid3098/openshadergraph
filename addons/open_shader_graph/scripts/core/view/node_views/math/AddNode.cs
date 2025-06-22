using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.View.NodeViews.Math;
using OpenShaderGraph.Core.View.Utils;

namespace OpenShaderGraph.Core.View.NodeViews
{
    [ShaderCode("Core/Logic/AddNode.yaml")]
    [RegisterNode(name: "Add", category: "Math")]
    public partial class AddNode : BaseMathNode
    {
        public new static BaseNodeData CreateNodeData(string name, string type, Vector2 position)
        {
            var nodeData = new BaseNodeData(name, type, position);
            nodeData.AddInput(new PinData("a", PinDataType.Float, DirectionType.Input));
            nodeData.AddInput(new PinData("b", PinDataType.Float, DirectionType.Input));
            nodeData.AddOutput(new PinData("out", PinDataType.Float, DirectionType.Output));
            return nodeData;
        }
    }
}