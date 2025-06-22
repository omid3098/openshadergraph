using NUnit.Framework;
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using static OpenShaderGraph.Core.Data.PinDataType;

namespace OpenShaderGraph.Tests.Core.Data
{
  [TestFixture]
  public class YamlGraphLoaderTests
  {
    [Test]
    public void RoundTrip_MinimalGraph_ShouldMatch()
    {
      // Arrange: create a minimal shader graph
      var graph = new ShaderGraphData("TestGraph", ShaderLanguage.Godot, ShaderStage.Fragment);
      var constNode = new BaseNodeData("Const", "ConstantNode", new Vector2(0, 0));
      constNode.AddOutput(new PinData("out", Float, DirectionType.Output, new Variant(0.0f)));
      graph.AddNode(constNode);

      var loader = new YamlGraphSerializer();

      // Act: serialize to YAML and back
      var yaml = loader.SaveShaderGraph(graph);
      var loaded = loader.LoadShaderGraph(yaml);

      // Assert: properties preserved
      Assert.That(loaded.GetName(), Is.EqualTo(graph.GetName()));
      Assert.That(loaded.Language, Is.EqualTo(graph.Language));
      Assert.That(loaded.Stage, Is.EqualTo(graph.Stage));
      var nodes = loaded.GetNodes();
      Assert.That(nodes.Count, Is.EqualTo(1));
      var node = nodes[0];
      Assert.That(node.GetName(), Is.EqualTo(constNode.GetName()));
      Assert.That(node.GetNodeType(), Is.EqualTo(constNode.GetNodeType()));
      var outputs = node.GetOutputs();
      Assert.That(outputs.Count, Is.EqualTo(1));
      Assert.That(outputs[0].GetName(), Is.EqualTo("out"));
      Assert.That(outputs[0].GetDataType(), Is.EqualTo(Float));
      Assert.That(outputs[0].GetValue().AsSingle(), Is.EqualTo(0.0f));
    }

    [Test]
    public void Load_HandWrittenYaml_ShouldProduceCorrectGraph()
    {
      // A simple YAML describing one node with an output
      var yaml = @"metadata:
  name: MyGraph
  version: 1.0
  type: SHADER_GRAPH
  properties:
    shader_language: 0
    shader_stage: 1
nodes:
  - id: 5
    name: NodeA
    type: TestNode
    position: [10, 20]
    inputs: []
    outputs:
      - name: out1
        type: FLOAT
        value: 42
connections: []
";
      var loader = new YamlGraphSerializer();

      // Act
      var graph = loader.LoadShaderGraph(yaml);

      // Assert metadata
      Assert.That(graph.GetName(), Is.EqualTo("MyGraph"));
      Assert.That(graph.GetVersion(), Is.EqualTo("1.0"));
      Assert.That(graph.Language, Is.EqualTo(ShaderLanguage.Godot));
      Assert.That(graph.Stage, Is.EqualTo(ShaderStage.Vertex));

      // Assert node
      var nodes = graph.GetNodes();
      Assert.That(nodes.Count, Is.EqualTo(1));
      var node = nodes[0];
      Assert.That(node.Id, Is.EqualTo(5));
      Assert.That(node.GetName(), Is.EqualTo("NodeA"));
      Assert.That(node.GetNodeType(), Is.EqualTo("TestNode"));
      Assert.That(node.GetPosition(), Is.EqualTo(new Vector2(10, 20)));

      var outputs = node.GetOutputs();
      Assert.That(outputs.Count, Is.EqualTo(1));
      Assert.That(outputs[0].GetName(), Is.EqualTo("out1"));
      Assert.That(outputs[0].GetDataType(), Is.EqualTo(Float));
      Assert.That(outputs[0].GetValue().AsSingle(), Is.EqualTo(42));
    }
  }
}