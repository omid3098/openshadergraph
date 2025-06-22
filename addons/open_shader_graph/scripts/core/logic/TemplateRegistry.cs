using System.Collections.Generic;
using System.IO;
using OpenShaderGraph.Core.Data;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace OpenShaderGraph.Core.Logic
{
    public class TemplateRegistry
    {
        private readonly Dictionary<string, List<TemplateEntry>> _cache = new();
        private readonly IDeserializer _deserializer;

        public TemplateRegistry()
        {
            _deserializer = new DeserializerBuilder()
                .WithNamingConvention(CamelCaseNamingConvention.Instance)
                .Build();
        }

        public virtual List<TemplateEntry> GetTemplateEntries(string templatePath)
        {
            if (_cache.TryGetValue(templatePath, out var cachedEntries))
            {
                return cachedEntries;
            }

            if (!File.Exists(templatePath))
            {
                // In a real Godot environment, we might use Godot's FileAccess, but for now, System.IO is fine for testing.
                // Or we can throw an error. For now, returning an empty list.
                return new List<TemplateEntry>();
            }

            var yamlContent = File.ReadAllText(templatePath);
            var entries = _deserializer.Deserialize<List<TemplateEntry>>(yamlContent);

            if (entries != null)
            {
                _cache[templatePath] = entries;
            }

            return entries ?? new List<TemplateEntry>();
        }
    }
}