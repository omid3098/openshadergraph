#nullable enable
namespace OpenShaderGraph.Core.Data;

using Godot;
using System.Collections.Generic;

public partial class BaseNodeData : RefCounted
{
    private string _name;
    private string _type;
    private Vector2 _position;
    private List<PinData> _inputs;
    private List<PinData> _outputs;

    public BaseNodeData(string name, string type, Vector2 position, List<PinData>? inputs = null, List<PinData>? outputs = null)
    {
        _name = name;
        _type = type;
        _position = position;
        _inputs = inputs ?? new List<PinData>();
        _outputs = outputs ?? new List<PinData>();
    }

    public string GetName() => _name;
    public string GetNodeType() => _type;
    public Vector2 GetPosition() => _position;
    public List<PinData> GetInputs() => _inputs;
    public List<PinData> GetOutputs() => _outputs;

    public void SetPosition(Vector2 value) => _position = value;
    public void SetName(string value) => _name = value;
    public void SetNodeType(string value) => _type = value;
    public void SetInputs(List<PinData> value) => _inputs = value;
    public void SetOutputs(List<PinData> value) => _outputs = value;

    public void AddInput(PinData pin)
    {
        if (pin.GetDirection() == DirectionType.Input)
        {
            _inputs.Add(pin);
        }
    }

    public void AddOutput(PinData pin)
    {
        if (pin.GetDirection() == DirectionType.Output)
        {
            _outputs.Add(pin);
        }
    }

    public PinData? GetInputBySlot(int slot)
    {
        if (slot >= 0 && slot < _inputs.Count)
        {
            return _inputs[slot];
        }
        return null;
    }

    public PinData? GetOutputByIndex(int index)
    {
        if (index >= 0 && index < _outputs.Count)
        {
            return _outputs[index];
        }
        return null;
    }
}
