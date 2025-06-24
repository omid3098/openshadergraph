using Godot;
#nullable enable
namespace OpenShaderGraph.Core.Data;

using System.Collections.Generic;


public class CodeGeneration
{
    public ShaderLanguage Language { get; set; } // the language of the node
    public List<ShaderStage> Stages { get; set; } // the stages of the node
                                                  // the code of the node. parameters in the code should be in the format of {parameter_name} matching the name of the input and output pins
    public string Code { get; set; }
}

public partial class BaseNodeData : RefCounted
{
    public long Id { get; set; } = -1;
    public string Name { get; set; }
    public string Type { get; set; }
    public string Category { get; set; }
    public Vector2 Position { get; set; }
    public List<PinData> Inputs { get; set; }
    public List<PinData> Outputs { get; set; }
    public List<CodeGeneration> CodeGenerations { get; set; }

    public BaseNodeData(string name, string type, Vector2 position, List<PinData>? inputs = null, List<PinData>? outputs = null, List<CodeGeneration>? codeGenDefinitions = null)
    {
        Name = name;
        Type = type;
        Position = position;
        Inputs = inputs ?? new List<PinData>();
        Outputs = outputs ?? new List<PinData>();
        CodeGenerations = codeGenDefinitions ?? new List<CodeGeneration>();
    }

    public string GetName() => Name;
    public string GetNodeType() => Type;
    public Vector2 GetPosition() => Position;
    public List<PinData> GetInputs() => Inputs;
    public List<PinData> GetOutputs() => Outputs;

    public void SetPosition(Vector2 value) => Position = value;
    public void SetName(string value) => Name = value;
    public void SetNodeType(string value) => Type = value;
    public void SetInputs(List<PinData> value) => Inputs = value;
    public void SetOutputs(List<PinData> value) => Outputs = value;

    public void AddInput(PinData pin)
    {
        if (pin.GetDirection() == DirectionType.Input)
        {
            Inputs.Add(pin);
        }
    }

    public void AddOutput(PinData pin)
    {
        if (pin.GetDirection() == DirectionType.Output)
        {
            Outputs.Add(pin);
        }
    }

    public PinData? GetInputByIndex(int slot)
    {
        if (slot >= 0 && slot < Inputs.Count)
        {
            return Inputs[slot];
        }
        return null;
    }

    public PinData? GetOutputByIndex(int index)
    {
        if (index >= 0 && index < Outputs.Count)
        {
            return Outputs[index];
        }
        return null;
    }

    public BaseNodeData Clone()
    {
        var inputs = new List<PinData>();
        foreach (var pin in Inputs)
        {
            inputs.Add(pin.Clone());
        }
        var outputs = new List<PinData>();
        foreach (var pin in Outputs)
        {
            outputs.Add(pin.Clone());
        }
        var newNode = new BaseNodeData(Name, Type, Position, inputs, outputs);
        return newNode;
    }
}
