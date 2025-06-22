using System;

namespace OpenShaderGraph.Core.View.Utils
{
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false)]
    public class ShaderCodeAttribute : Attribute
    {
        public string TemplateFile { get; }

        public ShaderCodeAttribute(string templateFile)
        {
            TemplateFile = templateFile;
        }
    }
}