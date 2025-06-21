using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.NodeViews;
using System;

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

            // Engine type selector
            var engineLabel = new Label { Text = "Engine" };
            var engineSelect = new OptionButton();
            foreach (EngineType eng in Enum.GetValues(typeof(EngineType)))
            {
                engineSelect.AddItem(eng.ToString(), (int)eng);
            }
            // Set current selection
            var props = currentGraphData.GetProperties();
            int currentEngine = props.TryGetValue("engine", out var engVar) ? engVar.AsInt32() : (int)EngineType.Godot;
            engineSelect.Selected = currentEngine;
            engineSelect.ItemSelected += id => { props["engine"] = id; };
            _vbox.AddChild(engineLabel);
            _vbox.AddChild(engineSelect);

            // Shader stage selector
            var stageLabel = new Label { Text = "Shader Stage" };
            var stageSelect = new OptionButton();
            foreach (ShaderStage st in Enum.GetValues(typeof(ShaderStage)))
            {
                stageSelect.AddItem(st.ToString(), (int)st);
            }
            int currentStage = props.TryGetValue("shader_stage", out var stVar) ? stVar.AsInt32() : (int)ShaderStage.Fragment;
            stageSelect.Selected = currentStage;
            stageSelect.ItemSelected += id => { props["shader_stage"] = id; };
            _vbox.AddChild(stageLabel);
            _vbox.AddChild(stageSelect);
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