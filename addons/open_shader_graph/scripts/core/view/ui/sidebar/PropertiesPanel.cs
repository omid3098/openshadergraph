using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Logic.Services.GraphManager;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.NodeViews;
using System;
using System.Linq;

namespace OpenShaderGraph.Core.View.UI.Sidebar
{
    public partial class PropertiesPanel : PanelContainer
    {
        private VBoxContainer _vbox;

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

        public void ShowGraphProperties(GraphView graphView)
        {
            ClearProperties();
            var nameLabel = new Label { Text = "Graph Name" };
            var nameEdit = new LineEdit { Text = graphView.GetName() };
            nameEdit.TextChanged += graphView.SetName;
            _vbox.AddChild(nameLabel);
            _vbox.AddChild(nameEdit);

            // Shader Type as a read only label
            var shaderTypeLabel = new Label { Text = "Shader Type: " + graphView.GraphData.GetShaderType().ToString() };
            _vbox.AddChild(shaderTypeLabel);

            var properties = graphView.GraphData.GetProperties();
            foreach (var property in properties)
            {
                // var key = property.Key;
                // Handle shaderpass which is a unique case for all graphs
                // if (key == "shaderpass")
                // {
                //     var shaderPassLabel = new Label { Text = "Shader Pass" };
                //     var shaderPassSelect = new OptionButton();

                //     // Use reflection to get all static string fields from ShaderPass class
                //     var shaderPassType = typeof(ShaderPass);
                //     var staticFields = shaderPassType.GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);

                //     foreach (var field in staticFields)
                //     {
                //         if (field.FieldType == typeof(string))
                //         {
                //             var value = field.GetValue(null).ToString().Capitalize();
                //             shaderPassSelect.AddItem(value);
                //         }
                //     }

                //     _vbox.AddChild(shaderPassLabel);
                //     _vbox.AddChild(shaderPassSelect);

                //     // Get the current property value
                //     var currentValue = graphView.GraphData.GetProperties()[key];

                //     // Find the index of the field that matches the current value
                //     var selectedIndex = Array.FindIndex(staticFields, f => f.GetValue(null).Equals(currentValue));

                //     // Set the selected item (only if a match was found)
                //     if (selectedIndex >= 0)
                //     {
                //         shaderPassSelect.Selected = selectedIndex;
                //     }

                //     shaderPassSelect.ItemSelected += id => graphView.GraphData.SetMeta(key, staticFields[id].GetValue(null));
                // }
            }
        }

        private void OnGraphNameChanged(string newText)
        {
            var graphView = Services.Get<IGraphManager>().GetCurrentGraph();
            if (graphView != null)
            {
                graphView.SetName(newText);
            }
        }

        public void ShowNodeProperties(NodeView node)
        {
            ClearProperties();
            if (node == null) return;

            // var control = NodeInspector.CreateProperties(node);
            // _vbox.AddChild(control);
        }
    }
}