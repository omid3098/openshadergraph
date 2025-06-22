using System;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Data
{
    [AttributeUsage(AttributeTargets.Class, Inherited = false, AllowMultiple = false)]
    public sealed class RegisterNodeAttribute : Attribute
    {
        public string Category { get; }
        public string Name { get; }
        public ShaderLanguage[] Engines { get; set; } = Array.Empty<ShaderLanguage>();
        public ShaderStage[] Stages { get; set; } = Array.Empty<ShaderStage>();
        public GraphType[] GraphTypes { get; set; } = Array.Empty<GraphType>();

        public RegisterNodeAttribute(string name, string category = "General")
        {
            Name = name;
            Category = category;
        }
    }
}