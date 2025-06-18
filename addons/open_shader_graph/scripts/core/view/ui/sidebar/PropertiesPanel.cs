using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.NodeViews;

namespace OpenShaderGraph.Core.View.UI.Sidebar
{
    public partial class PropertiesPanel : PanelContainer
    {
        private VBoxContainer _vbox;
        private BaseGraphData _currentGraphData;

        public PropertiesPanel()
        {
            Logger.Log("[PropertiesPanel] init");
            _vbox = new VBoxContainer();
            AddChild(_vbox);
        }

        public void ClearProperties()
        {
            foreach (Node child in _vbox.GetChildren())
            {
                _vbox.RemoveChild(child);
                child.QueueFree();
            }
        }

        public void DisplayGraphProperties(BaseGraphData graphData)
        {
            ClearProperties();
            if (graphData == null) return;
            _currentGraphData = graphData;

            var nameLabel = new Label { Text = "Graph Name" };
            var nameEdit = new LineEdit { Text = graphData.GetName() };
            nameEdit.TextChanged += OnGraphNameChanged;
            _vbox.AddChild(nameLabel);
            _vbox.AddChild(nameEdit);
        }

        private void OnGraphNameChanged(string newText)
        {
            if (_currentGraphData != null)
            {
                _currentGraphData.SetName(newText);
            }
        }

        public void DisplayNodeProperties(BaseGraphNode node, BaseGraphData graphData)
        {
            ClearProperties();
            if (node == null || graphData == null) return;

            foreach (var pin in node.Data.GetInputs())
            {
                if (!graphData.IsPinConnected(pin))
                {
                    var pinLabel = new Label { Text = pin.GetName() };
                    _vbox.AddChild(pinLabel);

                    Node control = CreateControlForPin(pin);
                    if (control != null)
                    {
                        _vbox.AddChild(control);
                    }
                }
            }
        }

        private Node CreateControlForPin(PinData pin)
        {
            switch (pin.GetDataType())
            {
                case PinDataType.Float:
                    var lineEdit = new LineEdit
                    {
                        Text = pin.GetValue().As<float>().ToString("0.000")
                    };
                    lineEdit.TextChanged += (newText) =>
                    {
                        if (float.TryParse(newText, out var floatValue))
                        {
                            pin.SetValue(floatValue);
                        }
                    };
                    lineEdit.FocusExited += () =>
                    {
                        lineEdit.Text = pin.GetValue().As<float>().ToString("0.000");
                    };
                    return lineEdit;
                case PinDataType.Int:
                    var intSpinBox = new SpinBox
                    {
                        Value = pin.GetValue().As<double>(),
                        Step = 1,
                        AllowLesser = true,
                        AllowGreater = true,
                    };
                    intSpinBox.ValueChanged += (value) => pin.SetValue((int)value);
                    return intSpinBox;
                case PinDataType.Bool:
                    var checkBox = new CheckBox
                    {
                        ButtonPressed = pin.GetValue().As<bool>()
                    };
                    checkBox.Toggled += (toggled) => pin.SetValue(toggled);
                    return checkBox;
                case PinDataType.Vector2:
                    return CreateVectorControl(pin, 2);
                case PinDataType.Vector3:
                    return CreateVectorControl(pin, 3);
                case PinDataType.Vector4:
                    return CreateVectorControl(pin, 4);
                default:
                    var unsupportedLabel = new Label { Text = "Unsupported type" };
                    return unsupportedLabel;
            }
        }

        private Node CreateVectorControl(PinData pin, int components)
        {
            var hbox = new HBoxContainer();
            var value = pin.GetValue();

            for (int i = 0; i < components; i++)
            {
                var spinBox = new SpinBox
                {
                    Step = 0.01,
                    AllowLesser = true,
                    AllowGreater = true,
                };

                switch (components)
                {
                    case 2:
                        var v2 = value.As<Vector2>();
                        spinBox.Value = i == 0 ? v2.X : v2.Y;
                        break;
                    case 3:
                        var v3 = value.As<Vector3>();
                        spinBox.Value = i == 0 ? v3.X : i == 1 ? v3.Y : v3.Z;
                        break;
                    case 4:
                        var v4 = value.As<Vector4>();
                        spinBox.Value = i == 0 ? v4.X : i == 1 ? v4.Y : i == 2 ? v4.Z : v4.W;
                        break;
                }

                var local_i = i;
                spinBox.ValueChanged += (newValue) =>
                {
                    var currentValue = pin.GetValue();
                    switch (components)
                    {
                        case 2:
                            var v2 = currentValue.As<Vector2>();
                            if (local_i == 0) v2.X = (float)newValue; else v2.Y = (float)newValue;
                            pin.SetValue(v2);
                            break;
                        case 3:
                            var v3 = currentValue.As<Vector3>();
                            if (local_i == 0) v3.X = (float)newValue; else if (local_i == 1) v3.Y = (float)newValue; else v3.Z = (float)newValue;
                            pin.SetValue(v3);
                            break;
                        case 4:
                            var v4 = currentValue.As<Vector4>();
                            if (local_i == 0) v4.X = (float)newValue; else if (local_i == 1) v4.Y = (float)newValue; else if (local_i == 2) v4.Z = (float)newValue; else v4.W = (float)newValue;
                            pin.SetValue(v4);
                            break;
                    }
                };

                hbox.AddChild(spinBox);
            }
            return hbox;
        }
    }
}