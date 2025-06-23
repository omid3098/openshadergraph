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

            var def = _deserializer.Deserialize<NodeYamlDefinition>(yaml);
            Assert.IsNotNull(def);
            Assert.AreEqual("Float", def.Name);
            Assert.AreEqual("Float", def.Type);
            Assert.AreEqual("Constants", def.Category);

            Assert.That(def.Inputs, Has.Count.EqualTo(1));
            var input = def.Inputs[0];
            Assert.AreEqual("value", input.Name);
            Assert.AreEqual(PinDataType.Float, input.DataType);
            Assert.AreEqual(DirectionType.Input, input.Direction);
            Assert.AreEqual(0.0, (double)input.DefaultValue, 1e-6);

            Assert.That(def.Outputs, Has.Count.EqualTo(1));
            var output = def.Outputs[0];
            Assert.AreEqual("out", output.Name);
            Assert.AreEqual(PinDataType.Float, output.DataType);
            Assert.AreEqual(DirectionType.Output, output.Direction);

            Assert.That(def.CodeGenDefinitions, Has.Count.EqualTo(1));
            var codeGen = def.CodeGenDefinitions[0];
            Assert.AreEqual(ShaderLanguage.Godot, codeGen.Language);
            Assert.That(codeGen.Stages, Is.EqualTo(new[] { ShaderStage.All }));
            StringAssert.Contains("float {out} = {value};", codeGen.Code);
        }

        [Test]
        public void AddNodeYaml_DeserializesCorrectly()
        {
            var yamlPath = Path.Combine(_yamlRootDir, "math", "Add.yaml");
            Assert.IsTrue(File.Exists(yamlPath), $"YAML file not found at {yamlPath}");
            var yaml = File.ReadAllText(yamlPath);

            var def = _deserializer.Deserialize<NodeYamlDefinition>(yaml);
            Assert.IsNotNull(def);
            Assert.AreEqual("Add", def.Name);
            Assert.AreEqual("Add", def.Type);
            Assert.AreEqual("Math", def.Category);

            Assert.That(def.Inputs, Has.Count.EqualTo(2));
            var a = def.Inputs.Find(p => p.Name == "a");
            Assert.IsNotNull(a);
            Assert.AreEqual(PinDataType.Float, a.DataType);
            Assert.AreEqual(DirectionType.Input, a.Direction);
            var b = def.Inputs.Find(p => p.Name == "b");
            Assert.IsNotNull(b);
            Assert.AreEqual(PinDataType.Float, b.DataType);
            Assert.AreEqual(DirectionType.Input, b.Direction);

            Assert.That(def.Outputs, Has.Count.EqualTo(1));
            var output = def.Outputs[0];
            Assert.AreEqual("out", output.Name);
            Assert.AreEqual(PinDataType.Float, output.DataType);
            Assert.AreEqual(DirectionType.Output, output.Direction);

            Assert.That(def.CodeGenDefinitions, Has.Count.EqualTo(1));
            var codeGen = def.CodeGenDefinitions[0];
            Assert.AreEqual(ShaderLanguage.Godot, codeGen.Language);
            Assert.That(codeGen.Stages, Is.EqualTo(new[] { ShaderStage.All }));
            StringAssert.Contains("float {out} = {a} + {b};", codeGen.Code);
        }
    }
}