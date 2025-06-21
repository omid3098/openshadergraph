using System.Collections.Generic;
using Godot;

namespace OpenShaderGraph.Core.Data
{
    /// <summary>
    /// Strongly-typed graph data for shader graphs, including engine and stage.
    /// </summary>
    public partial class ShaderGraphData : BaseGraphData
    {
        /// <summary>Rendering engine target (Godot, Bevy, GLSL, HLSL).</summary>
        public EngineType Engine { get; set; }
        /// <summary>Shader stage (Vertex, Fragment, Compute).</summary>
        public ShaderStage Stage { get; set; }

        public ShaderGraphData(string name, EngineType engine, ShaderStage stage)
            : base(name, GraphType.ShaderGraph, new List<BaseNodeData>(), new List<ConnectionData>())
        {
            Engine = engine;
            Stage = stage;
            // Backward compatibility for UI and filtering that use properties dictionary
            var props = GetProperties();
            props["engine"] = (int)Engine;
            props["shader_stage"] = (int)Stage;
        }
    }
}