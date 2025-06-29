#nullable enable
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.View.UI;
using System;

namespace OpenShaderGraph.Core.Logic.Services.GraphManager
{
    public interface IGraphManager
    {
        void Init();
        GraphView CreateGraph();
        void DeleteGraph(GraphView graph);
        void SelectGraph(GraphView graph);
        void SetTabContainer(TabContainer tabContainer);
        GraphView GetCurrentGraph();
    }
}