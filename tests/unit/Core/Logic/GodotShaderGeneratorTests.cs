using NUnit.Framework;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Data;
using Godot;
using System.Linq;

namespace OpenShaderGraph.Tests.Core.Logic
{
    [TestFixture]
    public class GodotShaderGeneratorTests
    {
        private GodotShaderGenerator _generator;

        [SetUp]
        public void SetUp()
        {
            _generator = new GodotShaderGenerator();
        }

        [Test]
        public void Generate_FragmentGraph_ShouldIncludeHeaderAndNodeCode()
        {
            // Arrange
            var graph = new ShaderGraphData("TestGraph", ShaderLanguage.Godot, ShaderStage.Fragment);

            // Float constant A
            var constA = new BaseNodeData("Float", "Float", new Vector2(0, 0));
            constA.AddInput(new PinData("value", PinDataType.Float, DirectionType.Input, 1f));
            constA.AddOutput(new PinData("out", PinDataType.Float, DirectionType.Output));
            graph.AddNode(constA);

            // Float constant B
            var constB = new BaseNodeData("Float", "Float", new Vector2(0, 0));
            constB.AddInput(new PinData("value", PinDataType.Float, DirectionType.Input, 2f));
            constB.AddOutput(new PinData("out", PinDataType.Float, DirectionType.Output));
            graph.AddNode(constB);

            // Add node
            var addNode = new BaseNodeData("Add", "Add", new Vector2(0, 0));
            addNode.AddInput(new PinData("a", PinDataType.Float, DirectionType.Input));
            addNode.AddInput(new PinData("b", PinDataType.Float, DirectionType.Input));
            addNode.AddOutput(new PinData("out", PinDataType.Float, DirectionType.Output));
            graph.AddNode(addNode);

            // Connect constants to add
            graph.AddConnection(new ConnectionData(constA.Id, constA.GetOutputs().First(), addNode.Id, addNode.GetInputs()[0]));
            graph.AddConnection(new ConnectionData(constB.Id, constB.GetOutputs().First(), addNode.Id, addNode.GetInputs()[1]));

            // Act
            var code = _generator.Generate(ShaderStage.Fragment, graph);

            // Assert header
            StringAssert.StartsWith("shader_type spatial;", code);
            // Assert constant assignments
            StringAssert.Contains("float var0 = 1", code);
            StringAssert.Contains("float var1 = 2", code);
            // Assert add code uses fragment-specific template (+ 0.1)
            StringAssert.Contains("+ 0.1", code);
            // Assert fragment function present
            StringAssert.Contains("void fragment()", code);
            // Assert vertex function not present
            StringAssert.DoesNotContain("void vertex()", code);
        }

        [Test]
        public void Generate_LightingStageEmptyGraph_ShouldNotGenerateLightFunction()
        {
            // Arrange
            var graph = new ShaderGraphData("EmptyGraph", ShaderLanguage.Godot, ShaderStage.Light);
            // Act
            var code = _generator.Generate(ShaderStage.Light, graph);
            // Assert only header, no light function
            StringAssert.StartsWith("shader_type spatial;", code);
            StringAssert.DoesNotContain("void light()", code);
        }
    }
}