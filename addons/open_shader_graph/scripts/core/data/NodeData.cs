using Godot;
#nullable enable
namespace OpenShaderGraph.Core.Data;

using System.Collections.Generic;

public class NodeData
{
    public long Id { get; private set; } = -1;
    public string Title { get; private set; } = "";
    public Vector2 Position { get; private set; }

    public NodeTemplate Template;
    public NodeData(NodeTemplate template, Vector2 position)
    {
        Position = position;
        Template = template;
    }
    public string GetNodeType() => Template.Type;
    public List<PinData> GetInputs() => Template.Inputs;
    public List<PinData> GetOutputs() => Template.Outputs;

    public void SetPosition(Vector2 value) => Position = value;
    public void SetTitle(string value) => Title = value;
    public void SetId(long value) => Id = value;

    public PinData GetInPin(int index)
    {
        if (index < 0 || index >= Template.Inputs.Count)
        {
            throw new System.IndexOutOfRangeException();
        }
        return Template.Inputs[index];
    }

    public PinData GetOutPin(int index)
    {
        if (index < 0 || index >= Template.Outputs.Count)
        {
            throw new System.IndexOutOfRangeException();
        }
        return Template.Outputs[index];
    }

    public NodeData Clone()
    {
        var newNode = new NodeData(Template, Position + new Vector2(10, 10));
        return newNode;
    }
}
