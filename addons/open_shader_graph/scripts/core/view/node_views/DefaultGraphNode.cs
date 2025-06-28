using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.View.NodeViews
{
    // Fallback node view for unregistered node types (e.g., Input/Output nodes in subgraphs)
    public partial class DefaultGraphNode : NodeView
    {
        public DefaultGraphNode() : base() { }
    }
}