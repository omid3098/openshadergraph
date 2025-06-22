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
    private string _name;
    private PinDataType _dataType;
    private DirectionType _direction;
    private Variant _defaultValue;
    private Variant _value;

    public PinData(string name, PinDataType dataType, DirectionType direction, Variant defaultValue = new())
    {
        _name = name;
        _dataType = dataType;
        _direction = direction;
        _defaultValue = defaultValue;
        _value = defaultValue;
    }

    public string GetName() => _name;
    public PinDataType GetDataType() => _dataType;
    public DirectionType GetDirection() => _direction;
    public Variant GetDefaultValue() => _defaultValue;
    public Variant GetValue() => _value;

    public void SetValue(Variant value) => _value = value;
    public void SetName(string name) => _name = name;
    public void SetDataType(PinDataType dataType) => _dataType = dataType;
    public void SetDirection(DirectionType direction) => _direction = direction;

    public PinData Clone()
    {
        var newPin = new PinData(_name, _dataType, _direction, _defaultValue);
        newPin.SetValue(_value);
        return newPin;
    }
}