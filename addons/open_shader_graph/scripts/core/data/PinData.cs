using Godot;
#nullable enable
namespace OpenShaderGraph.Core.Data;


public enum DirectionType
{
    Input,
    Output
}

public partial class PinData : RefCounted
{
    public PinData() { Name = ""; }
    public string Name { get; set; }
    public PinDataType DataType {get; set;}
    public DirectionType Direction {get; set;}
    public Variant DefaultValue {get; set;}
    public Variant Value {get; set;}

    public PinData(string name, PinDataType dataType, DirectionType direction, Variant defaultValue = new())
    {
        Name = name;
        DataType = dataType;
        Direction = direction;
        DefaultValue = defaultValue;
        Value = defaultValue;
    }

    public string GetName() => Name;
    public PinDataType GetDataType() => DataType;
    public DirectionType GetDirection() => Direction;
    public Variant GetDefaultValue() => DefaultValue;
    public Variant GetValue() => Value;

    public void SetValue(Variant value) => Value = value;
    public void SetName(string name) => Name = name;
    public void SetDataType(PinDataType dataType) => DataType = dataType;
    public void SetDirection(DirectionType direction) => Direction = direction;

    public PinData Clone()
    {
        var newPin = new PinData(Name, DataType, Direction, DefaultValue);
        newPin.SetValue(Value);
        return newPin;
    }
}