using System;

namespace OpenShaderGraph.Core.View.NodeViews
{
    /// <summary>
    /// Metadata holder for a registered graph node type.
    /// </summary>
    public sealed class RegisteredNode
    {
        public Type NodeType { get; }
        public RegisterNodeAttribute Attribute { get; }

        public RegisteredNode(Type nodeType, RegisterNodeAttribute attribute)
        {
            NodeType = nodeType;
            Attribute = attribute;
        }
    }
}