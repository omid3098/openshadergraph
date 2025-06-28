using Godot;
#nullable enable
namespace OpenShaderGraph.Core.Data;

using System.Collections.Generic;

public partial class GroupNodeData : BaseNodeData
{
    public GroupGraphData SubGraph { get; private set; }

    public GroupNodeData(Vector2 position, GroupGraphData subGraph, List<PinData>? inputs = null, List<PinData>? outputs = null)
        : base(new NodeTemplate(), position)
    {
        SubGraph = subGraph;
    }
}