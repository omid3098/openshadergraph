namespace OpenShaderGraph.Core.Data
{
    public enum ShaderLanguage
    {
        Godot,
        Bevy,
        GLSL,
        HLSL
    }

    public enum ShaderStage
    {
        All,
        Vertex,
        Fragment,
        Light,
        Compute
    }
}