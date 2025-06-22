using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Logic.Services.ShaderGenerator
{
    /// <summary>
    /// Interface for engine-specific shader generators.
    /// </summary>
    public interface IShaderGenerator
    {
        /// <summary>Shader language produced by this generator.</summary>
        ShaderLanguage Language { get; }

        /// <summary>File extension for generated shader files (e.g., ".gdshader").</summary>
        string FileExtension { get; }

        /// <summary>
        /// Generates shader code for the given graph and stage.
        /// </summary>
        /// <param name="stage">The shader stage to generate (Vertex, Fragment, Light, etc.).</param>
        /// <param name="graph">The graph data to traverse and emit code from.</param>
        /// <returns>Complete shader code as a string.</returns>
        string Generate(ShaderStage stage, ShaderGraphData graph);
    }
}