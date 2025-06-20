using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.View.NodeViews.Grouping;

namespace OpenShaderGraph.Core.View.NodeViews
{
    [RegisterNode(name: "Group", category: "Grouping")]
    public partial class GroupNode : BaseGroupingNode
    {
        public GroupNode() : base()
        {
        }

        public new static BaseNodeData CreateNodeData(string name, string type, Vector2 position)
        {
            var subGraph = new BaseGroupGraphData("Group", GraphType.GroupGraph);
            var nodeData = new GroupNodeData(name, type, position, subGraph);
            return nodeData;
        }
    }
}