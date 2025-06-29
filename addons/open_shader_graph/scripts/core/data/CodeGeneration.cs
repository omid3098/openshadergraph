using Godot;
namespace OpenShaderGraph.Core.Data;

using System;
using System.Collections.Generic;


public class CodeGeneration
{
    // public ShaderLanguage Language { get; set; } // the language of the node
    public List<string> Stages { get; set; } = new(); // the stages of the node
                                                      // the code of the node. parameters in the code should be in the format of {parameter_name} matching the name of the input and output pins
    public string Code { get; set; } = "";
}
