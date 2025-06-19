using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.NodeViews;

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

        public void DisplayGraphProperties()
        {
            var currentGraphData = Services.Get<GraphManager>().GetCurrentGraph();
            if (currentGraphData == null) return;

            ClearProperties();
            var nameLabel = new Label { Text = "Graph Name" };
            var nameEdit = new LineEdit { Text = currentGraphData.GetName() };
            nameEdit.TextChanged += OnGraphNameChanged;
            _vbox.AddChild(nameLabel);
            _vbox.AddChild(nameEdit);
        }

        private void OnGraphNameChanged(string newText)
        {
            var currentGraphData = Services.Get<GraphManager>().GetCurrentGraph();
            if (currentGraphData != null)
            {
                currentGraphData.SetName(newText);
            }
        }

        public void DisplayNodeProperties(BaseGraphNode node)
        {
            ClearProperties();
            if (node == null) return;

            var control = NodeInspector.CreateProperties(node);
            _vbox.AddChild(control);
        }
    }
}