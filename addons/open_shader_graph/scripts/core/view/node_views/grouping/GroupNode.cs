using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.View.NodeViews.Grouping;

namespace OpenShaderGraph.Core.View.NodeViews
{
    [RegisterNode(name: "Group", category: "Grouping")]
    public partial class GroupNode : BaseGroupingNode
    {
        public GroupNode() : base(GraphType.GroupGraph)
        {
        }

        public new static BaseNodeData CreateNodeData(string name, string type, Vector2 position)
        {
            var nodeData = new BaseNodeData(name, type, position);
            return nodeData;
        }
    }
}