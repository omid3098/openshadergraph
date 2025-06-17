using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Godot;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.View.NodeViews
{
    public class RegisteredNode
    {
        public Type NodeType { get; }
        public RegisterNodeAttribute Attribute { get; }

        public RegisteredNode(Type nodeType, RegisterNodeAttribute attribute)
        {
            NodeType = nodeType;
            Attribute = attribute;
        }
    }

    public partial class NodeRegistry : Node
    {
        private static NodeRegistry _instance;
        public static NodeRegistry Instance => _instance;

        private readonly Dictionary<string, List<RegisteredNode>> _registeredNodes = new();

        public override void _EnterTree()
        {
            _instance = this;
        }

        public override void _Ready()
        {
            ScanForNodes();
        }

        private void ScanForNodes()
        {
            Logger.Log("[NodeRegistry] Scanning for nodes...");
            var assembly = Assembly.GetExecutingAssembly();

            foreach (var type in assembly.GetTypes())
            {
                var attribute = type.GetCustomAttribute<RegisterNodeAttribute>();
                if (attribute != null && type.IsSubclassOf(typeof(BaseGraphNode)))
                {
                    if (!_registeredNodes.ContainsKey(attribute.Category))
                    {
                        _registeredNodes[attribute.Category] = new List<RegisteredNode>();
                    }
                    _registeredNodes[attribute.Category].Add(new RegisteredNode(type, attribute));
                    Logger.Log($"[NodeRegistry] Registered node '{attribute.Name}' in category '{attribute.Category}'");
                }
            }

            // Sort categories and nodes alphabetically
            var sortedCategories = _registeredNodes.Keys.OrderBy(c => c).ToList();
            var sortedDictionary = new Dictionary<string, List<RegisteredNode>>();
            foreach (var category in sortedCategories)
            {
                sortedDictionary[category] = _registeredNodes[category].OrderBy(n => n.Attribute.Name).ToList();
            }
            _registeredNodes.Clear();
            foreach (var kvp in sortedDictionary)
            {
                _registeredNodes.Add(kvp.Key, kvp.Value);
            }

            Logger.Log($"[NodeRegistry] Scan complete. Found {_registeredNodes.Count} categories.");
        }

        public Dictionary<string, List<RegisteredNode>> GetRegisteredNodes()
        {
            return _registeredNodes;
        }

        public RegisteredNode FindRegisteredNode(string name)
        {
            foreach (var category in _registeredNodes.Values)
            {
                foreach (var node in category)
                {
                    if (node.Attribute.Name == name)
                    {
                        return node;
                    }
                }
            }
            return null;
        }
    }
}