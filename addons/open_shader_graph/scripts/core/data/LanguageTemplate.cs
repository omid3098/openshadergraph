namespace OpenShaderGraph.Core.Data;

using System.Collections.Generic;

public class LanguageTemplate
{
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Version { get; set; } = "";
    public Dictionary<string, object> Meta { get; set; } = new();
}