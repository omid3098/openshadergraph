#nullable enable
namespace OpenShaderGraph.Core.Data;

using Godot;
using System.Collections.Generic;

public partial class GroupNodeData : BaseNodeData
{
    public BaseGroupGraphData SubGraph { get; private set; }

    public GroupNodeData(string name, string type, Vector2 position, BaseGroupGraphData subGraph, List<PinData>? inputs = null, List<PinData>? outputs = null)
        : base(name, type, position, inputs, outputs)
    {
        SubGraph = subGraph;
    }
}