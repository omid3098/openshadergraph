using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.View.NodeViews.Grouping;

namespace OpenShaderGraph.Core.View.NodeViews
{
    public partial class GroupNode : BaseGroupingNode
    {
        public GroupNode() : base()
        {
        }

        public static NodeData CreateNodeData(string name, string type, Vector2 position)
        {
            var subGraph = new GroupGraphData("Group", GraphType.GroupGraph);
            var nodeData = new GroupNodeData(position, subGraph);
            return nodeData;
        }
    }
}