using System;

namespace OpenShaderGraph.Core.View.NodeViews
{
    [AttributeUsage(AttributeTargets.Class, Inherited = false, AllowMultiple = false)]
    public sealed class RegisterNodeAttribute : Attribute
    {
        public string Category { get; }
        public string Name { get; }

        public RegisterNodeAttribute(string name, string category = "General")
        {
            Name = name;
            Category = category;
        }
    }
}