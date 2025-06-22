using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Globalization;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Logic.Services.ShaderGenerator
{

    /// <summary>
    /// Generates Godot shader code from a ShaderGraphData.
    /// </summary>
    public class GodotShaderGenerator : IShaderGenerator
    {
        public ShaderLanguage Language => ShaderLanguage.Godot;
        public string FileExtension => ".gdshader";

        /// <summary>
        /// Generates shader code for the specified stage from the graph.
        /// </summary>
        public string Generate(ShaderStage stage, ShaderGraphData graph)
        {
            var ctx = new ShaderGeneratorContext();
            var sortedNodes = TopologicalSort(graph);

            var sb = new StringBuilder();
            sb.AppendLine("shader_type spatial;");

            // Generate code per node
            foreach (var node in sortedNodes)
            {
                if (IsConstantNode(node))
                {
                    var line = GenerateConstantCode(node, ctx);
                    ctx.AddBodyLine(line);
                }
                else
                {
                    var line = GenerateTemplateCode(node, graph, ctx, stage);
                    if (!string.IsNullOrWhiteSpace(line))
                        ctx.AddBodyLine(line);
                }
            }

            // Append helper functions
            foreach (var func in ctx.HelperFunctions)
            {
                sb.AppendLine(func);
            }

            // Append stage function only if there are body lines
            if (ctx.BodyLines.Any())
            {
                string funcName = stage switch
                {
                    ShaderStage.Vertex => "vertex",
                    ShaderStage.Fragment => "fragment",
                    ShaderStage.Light => "light",
                    ShaderStage.Compute => "compute",
                    _ => null
                };

                if (funcName != null)
                {
                    sb.AppendLine($"void {funcName}() {{");
                    foreach (var bodyLine in ctx.BodyLines)
                    {
                        sb.AppendLine($"    {bodyLine}");
                    }
                    sb.AppendLine("}");
                }
            }

            return sb.ToString();
        }

        private List<BaseNodeData> TopologicalSort(ShaderGraphData graph)
        {
            var visited = new HashSet<long>();
            var sorted = new List<BaseNodeData>();
            foreach (var root in FindRootNodes(graph))
            {
                Visit(root, graph, visited, sorted);
            }
            return sorted;
        }

        private IEnumerable<BaseNodeData> FindRootNodes(ShaderGraphData graph)
        {
            var nodes = graph.GetNodes();
            var fromIds = new HashSet<long>(graph.GetConnections().Select(c => c.GetFrom().NodeId));
            return nodes.Where(n => !fromIds.Contains(n.Id));
        }

        private void Visit(BaseNodeData node, ShaderGraphData graph, HashSet<long> visited, List<BaseNodeData> sorted)
        {
            if (visited.Contains(node.Id))
                return;
            visited.Add(node.Id);

            foreach (var inputPin in node.GetInputs())
            {
                var conn = graph.GetConnections().FirstOrDefault(
                    c => c.GetTo().NodeId == node.Id && c.GetTo().Pin == inputPin);
                if (conn != null)
                {
                    var upstream = graph.GetNodeById(conn.GetFrom().NodeId);
                    if (upstream != null)
                        Visit(upstream, graph, visited, sorted);
                }
            }

            sorted.Add(node);
        }

        private bool IsConstantNode(BaseNodeData node)
        {
            return node.GetNodeType() == "Float"
                && node.GetInputs().Count == 1
                && node.GetOutputs().Count == 1;
        }

        private string GenerateConstantCode(BaseNodeData node, ShaderGeneratorContext ctx)
        {
            var input = node.GetInputs().First();
            var defaultVal = input.GetDefaultValue();
            var val = defaultVal.AsSingle();
            var lit = val.ToString(CultureInfo.InvariantCulture);
            var varName = ctx.GetVariableName(node);
            return $"float {varName} = {lit};";
        }

        private string GenerateTemplateCode(BaseNodeData node, ShaderGraphData graph, ShaderGeneratorContext ctx, ShaderStage stage)
        {
            // Construct template path relative to test output directory
            var baseDir = AppContext.BaseDirectory;
            var templateFileName = $"{node.GetNodeType()}Node.yaml";
            var templatePath = Path.Combine(baseDir, "Core", "Logic", templateFileName);

            var registry = new TemplateRegistry();
            var entries = registry.GetTemplateEntries(templatePath);
            if (entries.Count == 0)
                return string.Empty;

            var entry = entries.FirstOrDefault(e => e.Engine == ShaderLanguage.Godot && e.Stage == stage)
                        ?? entries.FirstOrDefault(e => e.Engine == ShaderLanguage.Godot && e.Stage == ShaderStage.All);
            if (entry == null)
                return string.Empty;

            // Build placeholders
            var values = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var param in entry.Parameters)
            {
                if (param == "result")
                {
                    values[param] = ctx.GetVariableName(node);
                }
                else
                {
                    var pin = node.GetInputs().FirstOrDefault(p => p.GetName() == param);
                    if (pin != null)
                    {
                        var conn = graph.GetConnections().FirstOrDefault(
                            c => c.GetTo().NodeId == node.Id && c.GetTo().Pin == pin);
                        if (conn != null)
                        {
                            var up = graph.GetNodeById(conn.GetFrom().NodeId);
                            if (up != null)
                                values[param] = ctx.GetVariableName(up);
                            else
                                values[param] = pin.GetDefaultValue().AsSingle().ToString(CultureInfo.InvariantCulture);
                        }
                        else
                        {
                            values[param] = pin.GetDefaultValue().AsSingle().ToString(CultureInfo.InvariantCulture);
                        }
                    }
                }
            }

            var code = PlaceholderReplacer.Replace(entry.Template, values);
            return code.TrimEnd();
        }
    }
}