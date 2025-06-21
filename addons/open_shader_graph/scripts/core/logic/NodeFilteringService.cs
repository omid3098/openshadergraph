using System.Linq;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.View.NodeViews;
using OpenShaderGraph.Core.Utils;
using System;
using Godot;

namespace OpenShaderGraph.Core.Logic
{
    public class NodeFilteringService : IInitializable
    {
        // No initialization needed
        public void Init() { }

        // Determines whether a given node should be visible in the menu for the provided graph context
        public bool IsNodeVisible(RegisteredNode node, BaseGraphData graphData)
        {
            var attr = node.Attribute;
            var graphType = graphData.GetGraphType();

            // GraphType filter
            if (attr.GraphTypes.Length > 0 && !attr.GraphTypes.Contains(graphType))
                return false;

            // Determine engine and stage from strongly-typed GraphData when possible
            EngineType engine;
            ShaderStage stage;
            if (graphData is ShaderGraphData sg)
            {
                engine = sg.Engine;
                stage = sg.Stage;
            }
            else
            {
                var props = graphData.GetProperties();
                engine = props.TryGetValue("engine", out var ev) ? (EngineType)ev.AsInt32() : EngineType.Godot;
                stage = props.TryGetValue("shader_stage", out var sv) ? (ShaderStage)sv.AsInt32() : ShaderStage.Fragment;
            }

            // ShaderStage filter
            if (attr.Stages.Length > 0 && !attr.Stages.Contains(stage))
                return false;

            // EngineType filter
            if (attr.Engines.Length > 0 && !attr.Engines.Contains(engine))
                return false;

            // Passed all checks
            return true;
        }
    }
}