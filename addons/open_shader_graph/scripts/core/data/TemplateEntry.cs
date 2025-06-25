using YamlDotNet.Serialization;

namespace OpenShaderGraph.Core.Data
{
    public class TemplateEntry
    {
        [YamlMember(Alias = "engine")]
        public ShaderLanguage Engine { get; set; }

        [YamlMember(Alias = "stage")]
        public ShaderStage Stage { get; set; }

        [YamlMember(Alias = "parameters")]
        public string[] Parameters { get; set; }

        [YamlMember(Alias = "template")]
        public string Template { get; set; } = "";

        public TemplateEntry(ShaderLanguage engine, ShaderStage stage, string[] parameters, string template)
        {
            Engine = engine;
            Stage = stage;
            Parameters = parameters;
            Template = template;
        }

        // Parameterless constructor for deserialization
        // todo: temporary disable this to see if we realy need this!
        // public TemplateEntry()
        // {
        // }
    }
}