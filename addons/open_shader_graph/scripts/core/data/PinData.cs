using Godot;

namespace OpenShaderGraph.Core.Data
{
    public enum DirectionType
    {
        Input = 0,
        Output = 1
    }

    public partial class PinData : RefCounted
    {
        private string _name;
        private PinDataType _dataType;
        private DirectionType _direction;
        private Variant _value;

        public PinData(string name, PinDataType dataType, DirectionType direction, Variant? value = null)
        {
            _name = name;
            _dataType = dataType;
            _direction = direction;
            _value = value ?? new Variant();
        }

        public string GetName() => _name;
        public PinDataType GetDataType() => _dataType;
        public DirectionType GetDirection() => _direction;
        public Variant GetValue() => _value;

        public void SetValue(Variant value) => _value = value;
        public void SetName(string name) => _name = name;
        public void SetDataType(PinDataType dataType) => _dataType = dataType;
        public void SetDirection(DirectionType direction) => _direction = direction;
    }
}