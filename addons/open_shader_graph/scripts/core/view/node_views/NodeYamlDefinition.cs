using System.Collections.Generic;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.View.NodeViews
{
    // DTO for YAML binding of pin definitions
    public class PinYaml
    {
        public string Name { get; set; }
        public PinDataType DataType { get; set; }
        public DirectionType Direction { get; set; }
        public double DefaultValue { get; set; }
    }

    public class NodeYamlDefinition
    {
        public string Name { get; set; } // the name of the node can be changed from properties panel
        public string Type { get; set; } // to append to the end of the node name to show the type of the node
        public string Category { get; set; } // to use in the creation popup panel under correct category
        public List<PinYaml> Inputs { get; set; } // a list of input pins
        public List<PinYaml> Outputs { get; set; } // a list of output pins
        public List<CodeGenDefinition> CodeGenDefinitions { get; set; } // a list of code gen definitions
    }

    public class CodeGenDefinition
    {
        public ShaderLanguage Language { get; set; } // the language of the node
        public List<ShaderStage> Stages { get; set; } // the stages of the node
        // the code of the node. parameters in the code should be in the format of {parameter_name} matching the name of the input and output pins
        public string Code { get; set; }
    }
}