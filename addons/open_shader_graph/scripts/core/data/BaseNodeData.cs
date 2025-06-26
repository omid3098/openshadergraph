using Godot;
#nullable enable
namespace OpenShaderGraph.Core.Data;

using System.Collections.Generic;


public partial class BaseNodeData : RefCounted
{
    public long Id { get; set; } = -1;
    public string Title { get; set; } = "";
    public Vector2 Position { get; set; }

    public NodeTemplate Template;
    public BaseNodeData(NodeTemplate template, Vector2 position)
    {
        Position = position;
        Template = template;
    }

    public string GetTitle() => Title;
    public Vector2 GetPosition() => Position;
    public string GetNodeType() => Template.Type;
    public List<PinData> GetInputs() => Template.Inputs;
    public List<PinData> GetOutputs() => Template.Outputs;

    public void SetPosition(Vector2 value) => Position = value;
    public void SetName(string value) => Title = value;

    public PinData GetInputByIndex(int index)
    {
        if (index < 0 && index >= Template.Inputs.Count)
        {
            throw new System.IndexOutOfRangeException();
        }
        return Template.Inputs[index];
    }

    public PinData GetOutputByIndex(int index)
    {
        if (index < 0 && index >= Template.Outputs.Count)
        {
            throw new System.IndexOutOfRangeException();
        }
        return Template.Outputs[index];
    }

    public BaseNodeData Clone()
    {
        var newNode = new BaseNodeData(Template, Position+new Vector2(10, 10));
        return newNode;
    }
}
