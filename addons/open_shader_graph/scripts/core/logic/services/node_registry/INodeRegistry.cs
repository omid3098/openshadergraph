using System.Collections.Generic;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Logic.Services.NodeRegistry
{
    public interface INodeRegistry
    {
        Dictionary<string, List<BaseNodeData>> GetRegisteredNodes();
        BaseNodeData FindNode(string name);
    }
}