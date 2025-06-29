using System.Linq;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using System;
using Godot;

namespace OpenShaderGraph.Core.Logic
{
    public class NodeFilteringService : IInitializable
    {
        // No initialization needed
        public void Init()
        {
            Logger.Log("[NodeFilteringService] Init");
        }

        // Determines whether a given node should be visible in the menu for the provided graph context
        public bool IsNodeVisible(NodeData node, GraphData graphData)
        {
            Logger.Log("Implement me", Logger.LogLevel.Error);
            return true;
            // var attr = node.GetNodeType();
            // var graphType = graphData.GetGraphType();

            // // GraphType filter
            // if (attr.GraphTypes.Length > 0 && !attr.GraphTypes.Contains(graphType))
            //     return false;

            // // Determine engine and stage from strongly-typed GraphData when possible
            // ShaderLanguage shaderLanguage;
            // ShaderStage stage;
            // if (graphData is ShaderGraphData sg)
            // {
            //     shaderLanguage = sg.Language;
            //     stage = sg.Stage;
            // }
            // else
            // {
            //     var props = graphData.GetProperties();
            //     shaderLanguage = props.TryGetValue("shader_language", out var shaderLanguageVariant) ? (ShaderLanguage)shaderLanguageVariant.AsInt32() : ShaderLanguage.Godot;
            //     stage = props.TryGetValue("shader_stage", out var sv) ? (ShaderStage)sv.AsInt32() : ShaderStage.Fragment;
            // }

            // // ShaderStage filter
            // if (attr.Stages.Length > 0 && !attr.Stages.Contains(stage))
            //     return false;

            // // EngineType filter
            // if (attr.Engines.Length > 0 && !attr.Engines.Contains(shaderLanguage))
            //     return false;

            // // Passed all checks
            // return true;
        }
    }
}