using NUnit.Framework;
using System.IO;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using OpenShaderGraph.Core.View.NodeViews;
using OpenShaderGraph.Core.Data;
using System;

namespace OpenShaderGraph.Tests.Core.Data
{
    [TestFixture]
    public class NodeYamlDefinitionTests
    {
        private IDeserializer _deserializer;
        private string _yamlRootDir;

        [SetUp]
        public void SetUp()
        {
            _deserializer = new DeserializerBuilder()
                .WithNamingConvention(CamelCaseNamingConvention.Instance)
                .IgnoreUnmatchedProperties()
                .Build();

            // Locate the node_definitions directory relative to the test output
            var nodeDefinitionsDir = "addons/open_shader_graph/scripts/core/data/node_definitions";
            var godotProjectDir = Path.GetFullPath(Path.Combine(TestContext.CurrentContext.TestDirectory, "..", "..", "..", "..", ".."));
            _yamlRootDir = Path.Combine(godotProjectDir, nodeDefinitionsDir);
            Console.WriteLine($"YAML directory: {_yamlRootDir}");
        }

        [Test]
        public void FloatConstantNodeYaml_DeserializesCorrectly()
        {
            var yamlPath = Path.Combine(_yamlRootDir, "constants", "Float.yaml");
            Assert.IsTrue(File.Exists(yamlPath), $"YAML file not found at {yamlPath}");
            var yaml = File.ReadAllText(yamlPath);

            var def = _deserializer.Deserialize<BaseNodeData>(yaml);
            Assert.IsNotNull(def);
            Assert.That(def.Name, Is.EqualTo("Float"));
            Assert.That(def.Type, Is.EqualTo("Float"));
            Assert.That(def.Category, Is.EqualTo("Constants"));

            Assert.That(def.Inputs, Has.Count.EqualTo(1));
            var input = def.Inputs[0];
            Assert.That(input.Name, Is.EqualTo("value"));
            Assert.That(input.DataType, Is.EqualTo(PinDataType.Float));
            Assert.That(input.Direction, Is.EqualTo(DirectionType.Input));
            // todo: fix this -> Assert.AreEqual(0.0, input.DefaultValue, 1e-6);

            Assert.That(def.Outputs, Has.Count.EqualTo(1));
            var output = def.Outputs[0];
            Assert.That(output.Name, Is.EqualTo("out"));
            Assert.That(output.DataType, Is.EqualTo(PinDataType.Float));
            Assert.That(output.Direction, Is.EqualTo(DirectionType.Output));

            Assert.That(def.CodeGenerations, Has.Count.EqualTo(1));
            var codeGen = def.CodeGenerations[0];
            Assert.That(codeGen.Language, Is.EqualTo(ShaderLanguage.Godot));
            Assert.That(codeGen.Stages, Is.EqualTo(new[] { ShaderStage.All }));
            StringAssert.Contains("float {out} = {value};", codeGen.Code);
        }

        [Test]
        public void AddNodeYaml_DeserializesCorrectly()
        {
            var yamlPath = Path.Combine(_yamlRootDir, "math", "Add.yaml");
            Assert.IsTrue(File.Exists(yamlPath), $"YAML file not found at {yamlPath}");
            var yaml = File.ReadAllText(yamlPath);

            var def = _deserializer.Deserialize<BaseNodeData>(yaml);
            Assert.IsNotNull(def);
            Assert.That(def.Name, Is.EqualTo("Add"));
            Assert.That(def.Type, Is.EqualTo("Add"));
            Assert.That(def.Category, Is.EqualTo("Math"));

            Assert.That(def.Inputs, Has.Count.EqualTo(2));
            var a = def.Inputs.Find(p => p.Name == "a");
            Assert.IsNotNull(a);
            Assert.That(a.DataType, Is.EqualTo(PinDataType.Float));
            Assert.That(a.Direction, Is.EqualTo(DirectionType.Input));
            var b = def.Inputs.Find(p => p.Name == "b");
            Assert.IsNotNull(b);
            Assert.That(b.DataType, Is.EqualTo(PinDataType.Float));
            Assert.That(b.Direction, Is.EqualTo(DirectionType.Input));

            Assert.That(def.Outputs, Has.Count.EqualTo(1));
            var output = def.Outputs[0];
            Assert.That(output.Name, Is.EqualTo("out"));
            Assert.That(output.DataType, Is.EqualTo(PinDataType.Float));
            Assert.That(output.Direction, Is.EqualTo(DirectionType.Output));

            Assert.That(def.CodeGenerations, Has.Count.EqualTo(1));
            var codeGen = def.CodeGenerations[0];
            Assert.That(codeGen.Language, Is.EqualTo(ShaderLanguage.Godot));
            Assert.That(codeGen.Stages, Is.EqualTo(new[] { ShaderStage.All }));
            StringAssert.Contains("float {out} = {a} + {b};", codeGen.Code);
        }
    }
}