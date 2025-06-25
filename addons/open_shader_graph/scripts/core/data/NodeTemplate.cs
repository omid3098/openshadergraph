namespace OpenShaderGraph.Core.Data;

using System.Collections.Generic;

public class NodeTemplate
{
    public string Name { get; set; } = ""; // the name of the node can be changed from properties panel
    public string Type { get; set; } = ""; // to append to the end of the node name to show the type of the node
    public string Category { get; set; } = ""; // to use in the creation popup panel under correct category
    public List<PinData> Inputs { get; set; } = new(); // a list of input pins
    public List<PinData> Outputs { get; set; } = new();  // a list of output pins
    public List<CodeGeneration> CodeGenDefinitions { get; set; } = new();  // a list of code gen definitions
}