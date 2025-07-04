#nullable enable

using System.Collections.Generic;
using System.IO;
using System.Linq;
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace OpenShaderGraph.Core.Logic.Services.LanguageRegistry
{
    public class YamlLanguageRegistry : ILanguageRegistry, IInitializable
    {
        private readonly Dictionary<string, LanguageTemplate> _registeredLanguages = new();

        public LanguageTemplate? FindTemplate(string name)
        {
            if (!_registeredLanguages.Keys.Contains(name))
            {
                Logger.Warn($"[YamlLanguageRegistry] Language {name} not found");
                return null;
            }
            return _registeredLanguages[name];
        }

        public Dictionary<string, LanguageTemplate> GetRegisteredTemplates()
        {
            return _registeredLanguages;
        }

        public string GetDefaultLanguage()
        {
            return _registeredLanguages.Keys.First();
        }

        public void Init()
        {
            Logger.Log("[YamlLanguageRegistry] init");
            ScanLanguages();
        }

        private void ScanLanguages()
        {
            Logger.Log("[YamlLanguageRegistry] Scanning for YAML-defined languages...");
            var definitionsPath = ProjectSettings.GlobalizePath("res://addons/open_shader_graph/scripts/core/data/language_definitions");
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
                var template = deserializer.Deserialize<LanguageTemplate>(yaml);
                if (template == null)
                {
                    Logger.Warn($"[YamlLanguageRegistry] Failed to deserialize template from {file}");
                    continue;
                }
                if (_registeredLanguages.Keys.Contains(template.Name))
                {
                    Logger.Warn($"[YamlLanguageRegistry] Language {template.Name} already exists");
                    continue;
                }
                _registeredLanguages[template.Name] = template;
                Logger.Log($"[YamlLanguageRegistry] Language {template.Name} registered");
            }
        }
    }
}