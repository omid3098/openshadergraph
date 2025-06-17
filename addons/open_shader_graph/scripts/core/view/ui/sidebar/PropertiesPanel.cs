using Godot;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.View.UI.Sidebar
{
    public partial class PropertiesPanel : PanelContainer
    {
        public PropertiesPanel()
        {
            Logger.Log("[PropertiesPanel] init");

            // A label for the properties panel
            var label = new Label();
            label.Text = "Properties";
            label.HorizontalAlignment = HorizontalAlignment.Left;
            label.VerticalAlignment = VerticalAlignment.Top;
            label.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            label.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
            AddChild(label);
        }
    }
}