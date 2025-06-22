using System;
using System.Collections.Generic;
using System.IO;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using Godot;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Utils
{
    public class YamlGraphSerializer : IGraphSerializerService
    {
        private readonly IDeserializer _deserializer;
        private readonly ISerializer _serializer;

        public YamlGraphSerializer()
        {
            _deserializer = new DeserializerBuilder()
                .WithNamingConvention(CamelCaseNamingConvention.Instance)
                .Build();
            _serializer = new SerializerBuilder()
                .WithNamingConvention(CamelCaseNamingConvention.Instance)
                .Build();
        }

        // IGraphSerializerService implementation
        public IEnumerable<(string pattern, string description)> FileFilters => new[] {
            ("*.yml", "YAML Graph"),
            ("*.yaml", "YAML Graph")
        };

        public string DefaultFileName => "new_graph.yml";

        public string Save(BaseGraphData graph)
        {
            if (graph is ShaderGraphData shaderGraph)
                return SaveShaderGraph(shaderGraph);
            throw new NotSupportedException("Only ShaderGraphData is supported by YAML serializer");
        }

        public BaseGraphData Load(string content, string? filePath = null)
        {
            return LoadShaderGraph(content, filePath);
        }

        public ShaderGraphData LoadShaderGraph(string yamlContent, string? filePath = null)
        {
            var reader = new StringReader(yamlContent);
            var data = _deserializer.Deserialize<Dictionary<object, object>>(reader);

            // Parse metadata
            var metadata = (Dictionary<object, object>)data["metadata"];
            var name = metadata["name"].ToString()!;
            var version = metadata["version"].ToString()!;
            var properties = (Dictionary<object, object>)metadata["properties"];
            var languageIndex = Convert.ToInt32(properties["shader_language"]);
            var stageIndex = Convert.ToInt32(properties["shader_stage"]);
            var shaderLanguage = (ShaderLanguage)languageIndex;
            var stage = (ShaderStage)stageIndex;

            var graph = new ShaderGraphData(name, shaderLanguage, stage);
            graph.SetVersion(version);
            if (filePath != null)
                graph.SetFilePath(filePath);

            // Load nodes
            var nodeEntries = (List<object>)data["nodes"];
            var nodeMap = new Dictionary<long, BaseNodeData>();
            foreach (var nodeObj in nodeEntries)
            {
                var nodeEntry = (Dictionary<object, object>)nodeObj;
                var id = Convert.ToInt64(nodeEntry["id"]);
                var nodeName = nodeEntry["name"].ToString()!;
                var nodeType = nodeEntry["type"].ToString()!;
                var posList = (List<object>)nodeEntry["position"];
                var x = Convert.ToSingle(posList[0]);
                var y = Convert.ToSingle(posList[1]);
                var position = new Vector2(x, y);

                // Inputs
                var inputsList = (List<object>)nodeEntry["inputs"];
                var inputs = new List<PinData>();
                foreach (var pinObj in inputsList)
                {
                    var pinEntry = (Dictionary<object, object>)pinObj;
                    var pinName = pinEntry["name"].ToString()!;
                    var pinType = StringToPinDataType(pinEntry["type"].ToString()!);
                    var pinValueObj = pinEntry.ContainsKey("value") ? pinEntry["value"] : null;
                    var pinDefaultValue = ParseVariant(pinValueObj, pinType);
                    inputs.Add(new PinData(pinName, pinType, DirectionType.Input, pinDefaultValue));
                }

                // Outputs
                var outputsList = (List<object>)nodeEntry["outputs"];
                var outputs = new List<PinData>();
                foreach (var pinObj in outputsList)
                {
                    var pinEntry = (Dictionary<object, object>)pinObj;
                    var pinName = pinEntry["name"].ToString()!;
                    var pinType = StringToPinDataType(pinEntry["type"].ToString()!);
                    var pinValueObj = pinEntry.ContainsKey("value") ? pinEntry["value"] : null;
                    var pinDefaultValue = ParseVariant(pinValueObj, pinType);
                    outputs.Add(new PinData(pinName, pinType, DirectionType.Output, pinDefaultValue));
                }

                var nodeData = new BaseNodeData(nodeName, nodeType, position, inputs, outputs) { Id = id };
                graph.AddNode(nodeData);
                nodeMap[id] = nodeData;
            }

            // Load connections
            var connectionsList = (List<object>)data["connections"];
            foreach (var connObj in connectionsList)
            {
                var connEntry = (Dictionary<object, object>)connObj;
                var fromNodeId = Convert.ToInt64(connEntry["from_node_id"]);
                var fromPinName = connEntry["from_pin"].ToString()!;
                var toNodeId = Convert.ToInt64(connEntry["to_node_id"]);
                var toPinName = connEntry["to_pin"].ToString()!;

                var fromNode = nodeMap[fromNodeId];
                var toNode = nodeMap[toNodeId];
                var fromPin = fromNode.GetOutputs().Find(p => p.GetName() == fromPinName);
                var toPin = toNode.GetInputs().Find(p => p.GetName() == toPinName);
                if (fromPin != null && toPin != null)
                {
                    graph.AddConnection(new ConnectionData(fromNodeId, fromPin, toNodeId, toPin));
                }
            }

            return graph;
        }

        public string SaveShaderGraph(ShaderGraphData graph)
        {
            var model = BuildModel(graph);
            var writer = new StringWriter();
            _serializer.Serialize(writer, model);
            return writer.ToString();
        }

        private Dictionary<string, object> BuildModel(ShaderGraphData graph)
        {
            // Metadata
            var metadata = new Dictionary<string, object>
            {
                ["name"] = graph.GetName(),
                ["version"] = graph.GetVersion(),
                ["type"] = "SHADER_GRAPH",
                ["properties"] = new Dictionary<string, object>
                {
                    ["shader_language"] = (int)graph.Language,
                    ["shader_stage"] = (int)graph.Stage
                }
            };

            // Nodes
            var nodes = new List<Dictionary<string, object>>();
            foreach (var node in graph.GetNodes())
            {
                var entry = new Dictionary<string, object>
                {
                    ["id"] = node.Id,
                    ["name"] = node.GetName(),
                    ["type"] = node.GetNodeType(),
                    ["position"] = new List<object> { node.GetPosition().X, node.GetPosition().Y }
                };
                var inputList = new List<Dictionary<string, object>>();
                foreach (var pin in node.GetInputs())
                {
                    inputList.Add(new Dictionary<string, object>
                    {
                        ["name"] = pin.GetName(),
                        ["type"] = PinDataTypeToString(pin.GetDataType()),
                        ["value"] = ConvertVariant(pin.GetValue())
                    });
                }
                entry["inputs"] = inputList;
                var outputList = new List<Dictionary<string, object>>();
                foreach (var pin in node.GetOutputs())
                {
                    outputList.Add(new Dictionary<string, object>
                    {
                        ["name"] = pin.GetName(),
                        ["type"] = PinDataTypeToString(pin.GetDataType()),
                        ["value"] = ConvertVariant(pin.GetValue())
                    });
                }
                entry["outputs"] = outputList;
                nodes.Add(entry);
            }

            // Connections
            var conns = new List<Dictionary<string, object>>();
            foreach (var conn in graph.GetConnections())
            {
                var from = conn.GetFrom();
                var to = conn.GetTo();
                conns.Add(new Dictionary<string, object>
                {
                    ["from_node_id"] = from.NodeId,
                    ["from_pin"] = from.Pin.GetName(),
                    ["to_node_id"] = to.NodeId,
                    ["to_pin"] = to.Pin.GetName()
                });
            }

            return new Dictionary<string, object>
            {
                ["metadata"] = metadata,
                ["nodes"] = nodes,
                ["connections"] = conns
            };
        }

        private static object ConvertVariant(Variant value)
        {
            return value.VariantType switch
            {
                Variant.Type.Vector2 => new List<float> { value.AsVector2().X, value.AsVector2().Y },
                Variant.Type.Vector3 => new List<float> { value.AsVector3().X, value.AsVector3().Y, value.AsVector3().Z },
                Variant.Type.Vector4 => new List<float> { value.AsVector4().X, value.AsVector4().Y, value.AsVector4().Z, value.AsVector4().W },
                Variant.Type.Float => value.AsSingle(),
                Variant.Type.Int => value.AsInt32(),
                Variant.Type.Bool => value.AsBool(),
                _ => null
            };
        }

        private static Variant ParseVariant(object value, PinDataType type)
        {
            if (value == null)
            {
                return new Variant();
            }

            switch (type)
            {
                case PinDataType.Float:
                    if (value is IConvertible cFloat)
                    {
                        if (value is int || value is long)
                            return (Variant)cFloat.ToInt32(null);
                        else
                            return (Variant)cFloat.ToSingle(null);
                    }
                    return new Variant();
                case PinDataType.Int:
                    return value is IConvertible cInt ? (Variant)cInt.ToInt32(null) : new Variant();
                case PinDataType.Bool:
                    return value is IConvertible cBool ? (Variant)cBool.ToBoolean(null) : new Variant();
                case PinDataType.Vector2:
                    if (value is List<object> v2)
                        return (Variant)new Vector2(Convert.ToSingle(v2[0]), Convert.ToSingle(v2[1]));
                    break;
                case PinDataType.Vector3:
                    if (value is List<object> v3)
                        return (Variant)new Vector3(Convert.ToSingle(v3[0]), Convert.ToSingle(v3[1]), Convert.ToSingle(v3[2]));
                    break;
                case PinDataType.Vector4:
                    if (value is List<object> v4)
                        return (Variant)new Vector4(Convert.ToSingle(v4[0]), Convert.ToSingle(v4[1]), Convert.ToSingle(v4[2]), Convert.ToSingle(v4[3]));
                    break;
            }

            return new Variant();
        }

        private static PinDataType StringToPinDataType(string type)
        {
            return type.ToUpper() switch
            {
                "FLOAT" => PinDataType.Float,
                "FLOAT2" => PinDataType.Vector2,
                "FLOAT3" => PinDataType.Vector3,
                "FLOAT4" => PinDataType.Vector4,
                "INT" => PinDataType.Int,
                "BOOL" => PinDataType.Bool,
                _ => PinDataType.Float
            };
        }

        private static string PinDataTypeToString(PinDataType type)
        {
            return type switch
            {
                PinDataType.Float => "FLOAT",
                PinDataType.Vector2 => "FLOAT2",
                PinDataType.Vector3 => "FLOAT3",
                PinDataType.Vector4 => "FLOAT4",
                PinDataType.Int => "INT",
                PinDataType.Bool => "BOOL",
                _ => "FLOAT"
            };
        }
    }
}