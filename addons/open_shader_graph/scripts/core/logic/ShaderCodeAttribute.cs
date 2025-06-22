using System;

namespace OpenShaderGraph.Core.Logic
{
    [AttributeUsage(AttributeTargets.Class, Inherited = false, AllowMultiple = false)]
    public sealed class ShaderCodeAttribute : Attribute
    {
        public string TemplateFile { get; }

        public ShaderCodeAttribute(string templateFile)
        {
            TemplateFile = templateFile;
        }
    }
}