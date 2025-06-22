using System.Collections.Generic;
using Godot;

namespace OpenShaderGraph.Core.Data
{
    /// <summary>
    /// Strongly-typed graph data for shader graphs, including shader language and stage.
    /// </summary>
    public partial class ShaderGraphData : BaseGraphData
    {
        /// <summary>Shader language (Godot, Bevy, GLSL, HLSL).</summary>
        public ShaderLanguage Language { get; set; }
        /// <summary>Shader stage (Vertex, Fragment, Compute).</summary>
        public ShaderStage Stage { get; set; }

        public ShaderGraphData(string name, ShaderLanguage language, ShaderStage stage)
            : base(name, GraphType.ShaderGraph, new List<BaseNodeData>(), new List<ConnectionData>())
        {
            Language = language;
            Stage = stage;
            // Backward compatibility for UI and filtering that use properties dictionary
            var props = GetProperties();
            props["shader_language"] = (int)Language;
            props["shader_stage"] = (int)Stage;
        }
    }
}