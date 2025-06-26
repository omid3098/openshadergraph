#nullable enable

using System.Collections.Generic;
using System.Linq;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using System.IO;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using Godot;

namespace OpenShaderGraph.Core.Logic.Services.TemplateRegistry
{
    public class YamlTemplateRegistry : ITemplateRegistry, IInitializable
    {
        private readonly Dictionary<string, NodeTemplate> _registeredNodes = new();

        public void Init()
        {
            ScanTemplates();
        }

        private void ScanTemplates()
        {
            Logger.Log("[YamlTemplateRegistry] Scanning for YAML-defined templates...");
            var definitionsPath = ProjectSettings.GlobalizePath("res://addons/open_shader_graph/scripts/core/data/node_definitions");
            if (!Directory.Exists(definitionsPath))
                return;
            var yamlFiles = Directory.GetFiles(definitionsPath, "*.yaml", SearchOption.AllDirectories);
            var deserializer = new DeserializerBuilder()
                .WithNamingConvention(CamelCaseNamingConvention.Instance)
                .IgnoreUnmatchedProperties()
                .Build();
            foreach (var file in yamlFiles)
            {
                var yaml = File.ReadAllText(file);
                var template = deserializer.Deserialize<NodeTemplate>(yaml);
                if (template == null)
                {
                    Logger.Warn($"[YamlTemplateRegistry] Failed to deserialize template from {file}");
                    continue;
                }
                if (_registeredNodes.Keys.Contains(template.Name))
                {
                    Logger.Warn($"[YamlTemplateRegistry] Template {template.Name} already exists");
                    continue;
                }
                _registeredNodes[template.Name] = template;
            }
        }

        public NodeTemplate? FindTemplate(string name)
        {
            if (!_registeredNodes.Keys.Contains(name))
            {
                Logger.Warn($"[YamlTemplateRegistry] Template {name} not found");
                return null;
            }
            return _registeredNodes[name];
        }

        public Dictionary<string, NodeTemplate> GetRegisteredTemplates()
        {
            return _registeredNodes;
        }
    }
}