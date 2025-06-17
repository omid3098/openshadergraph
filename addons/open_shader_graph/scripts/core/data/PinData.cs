using Godot;

namespace OpenShaderGraph.Core.Data
{
    public enum PinType
    {
        Input = 0,
        Output = 1
    }

    public partial class PinData : RefCounted
    {
        private string _name;
        private string _dataType;
        private PinType _direction;
        private Variant _value;

        public PinData(string name, string dataType, PinType direction, Variant value)
        {
            _name = name;
            _dataType = dataType;
            _direction = direction;
            _value = value;
        }

        public string GetName() => _name;
        public string GetDataType() => _dataType;
        public PinType GetDirection() => _direction;
        public Variant GetValue() => _value;

        public void SetValue(Variant value) => _value = value;
        public void SetName(string name) => _name = name;
        public void SetDataType(string dataType) => _dataType = dataType;
        public void SetDirection(PinType direction) => _direction = direction;
    }
}