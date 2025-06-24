using System;
using System.Collections.Generic;
using System.Linq;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using System.IO;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using Godot;
using OpenShaderGraph.Core.View.NodeViews;

namespace OpenShaderGraph.Core.Logic.Services.NodeRegistry
{
    public class YamlNodeRegistry : INodeRegistry
    {
        private readonly Dictionary<string, List<BaseNodeData>> _registeredNodes = new();

        public YamlNodeRegistry()
        {
            ScanForNodes();
        }

        private void ScanForNodes()
        {
            Logger.Log("[YamlNodeRegistry] Scanning for YAML-defined nodes...");
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
                try
                {
                    var yaml = File.ReadAllText(file);
                    var def = deserializer.Deserialize<NodeYamlDefinition>(yaml);
                    if (def == null) continue;
                    var inputs = new List<PinData>();
                    if (def.Inputs != null)
                    {
                        foreach (var pin in def.Inputs)
                        {
                            var defaultValue = ConvertDefaultValue(pin.DefaultValue, pin.DataType);
                            inputs.Add(new PinData(pin.Name, pin.DataType, pin.Direction, defaultValue));
                        }
                    }
                    var outputs = new List<PinData>();
                    if (def.Outputs != null)
                    {
                        foreach (var pin in def.Outputs)
                        {
                            var defaultValue = ConvertDefaultValue(pin.DefaultValue, pin.DataType);
                            outputs.Add(new PinData(pin.Name, pin.DataType, pin.Direction, defaultValue));
                        }
                    }
                    var nodeData = new BaseNodeData(def.Name, def.Type, new Vector2(), inputs, outputs, def.CodeGenDefinitions);
                    if (!_registeredNodes.TryGetValue(def.Category, out var list))
                    {
                        list = new List<BaseNodeData>();
                        _registeredNodes[def.Category] = list;
                    }
                    list.Add(nodeData);
                }
                catch (Exception ex)
                {
                    Logger.Log($"[YamlNodeRegistry] Error loading node definition from {file}: {ex.Message}");
                }
            }
            // Sort categories and nodes
            var sortedCategories = _registeredNodes.Keys.OrderBy(c => c).ToList();
            var sorted = new Dictionary<string, List<BaseNodeData>>();
            foreach (var category in sortedCategories)
            {
                sorted[category] = _registeredNodes[category].OrderBy(n => n.GetName()).ToList();
            }
            _registeredNodes.Clear();
            foreach (var kvp in sorted)
            {
                _registeredNodes[kvp.Key] = kvp.Value;
            }
        }

        public BaseNodeData FindNode(string name)
        {
            foreach (var category in _registeredNodes.Values)
            {
                foreach (var node in category)
                {
                    if (node.GetName() == name)
                        return node;
                }
            }
            return null;
        }

        public Dictionary<string, List<BaseNodeData>> GetRegisteredNodes()
        {
            return _registeredNodes;
        }

        // Helper to convert YAML default values into Godot Variant based on PinDataType
        private static Variant ConvertDefaultValue(Variant defaultValue, PinDataType type)
        {
            return type switch
            {
                PinDataType.Float => (Variant)(float)defaultValue,
                PinDataType.Int => (Variant)Convert.ToInt32(defaultValue),
                PinDataType.Bool => (Variant)(bool)defaultValue,
                _ => new Variant()
            };
        }
    }
}