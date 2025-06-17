using NUnit.Framework;
using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Data;
using static OpenShaderGraph.Core.Data.PinType;

namespace OpenShaderGraph.Tests.Core.Data
{
    [TestFixture]
    public class BaseNodeDataTests
    {
        private BaseNodeData _node;
        private List<PinData> _inputPins;
        private List<PinData> _outputPins;

        [SetUp]
        public void SetUp()
        {
            _inputPins = new List<PinData>
            {
                new PinData("input1", "float", PinType.Input, new Variant(0.0f)),
                new PinData("input2", "int", PinType.Input, new Variant(0))
            };

            _outputPins = new List<PinData>
            {
                new PinData("output1", "float", PinType.Output, new Variant(1.0f))
            };

            _node = new BaseNodeData("TestNode", "MathNode", new Vector2(100, 200), _inputPins, _outputPins);
        }

        [Test]
        public void Constructor_SetsPropertiesCorrectly()
        {
            // Act & Assert
            Assert.That(_node.GetName(), Is.EqualTo("TestNode"));
            Assert.That(_node.GetType(), Is.EqualTo("MathNode"));
            Assert.That(_node.GetPosition(), Is.EqualTo(new Vector2(100, 200)));
            Assert.That(_node.GetInputs().Count, Is.EqualTo(2));
            Assert.That(_node.GetOutputs().Count, Is.EqualTo(1));
        }

        [Test]
        public void Constructor_WithNullPins_CreatesEmptyLists()
        {
            // Act
            var node = new BaseNodeData("TestNode", "MathNode", new Vector2(0, 0));

            // Assert
            Assert.That(node.GetInputs(), Is.Not.Null);
            Assert.That(node.GetOutputs(), Is.Not.Null);
            Assert.That(node.GetInputs().Count, Is.EqualTo(0));
            Assert.That(node.GetOutputs().Count, Is.EqualTo(0));
        }

        [Test]
        public void SetPosition_UpdatesPositionCorrectly()
        {
            // Arrange
            var newPosition = new Vector2(300, 400);

            // Act
            _node.SetPosition(newPosition);

            // Assert
            Assert.That(_node.GetPosition(), Is.EqualTo(newPosition));
        }

        [Test]
        public void SetName_UpdatesNameCorrectly()
        {
            // Act
            _node.SetName("NewNodeName");

            // Assert
            Assert.That(_node.GetName(), Is.EqualTo("NewNodeName"));
        }

        [Test]
        public void SetType_UpdatesTypeCorrectly()
        {
            // Act
            _node.SetType("NewNodeType");

            // Assert
            Assert.That(_node.GetType(), Is.EqualTo("NewNodeType"));
        }

        [Test]
        public void SetInputs_UpdatesInputPinsCorrectly()
        {
            // Arrange
            var newInputs = new List<PinData>
            {
                new PinData("newInput", "string", PinType.Input, new Variant("test"))
            };

            // Act
            _node.SetInputs(newInputs);

            // Assert
            Assert.That(_node.GetInputs(), Is.EqualTo(newInputs));
            Assert.That(_node.GetInputs().Count, Is.EqualTo(1));
            Assert.That(_node.GetInputs()[0].GetName(), Is.EqualTo("newInput"));
        }

        [Test]
        public void SetOutputs_UpdatesOutputPinsCorrectly()
        {
            // Arrange
            var newOutputs = new List<PinData>
            {
                new PinData("newOutput1", "bool", PinType.Output, new Variant(true)),
                new PinData("newOutput2", "float", PinType.Output, new Variant(2.0f))
            };

            // Act
            _node.SetOutputs(newOutputs);

            // Assert
            Assert.That(_node.GetOutputs(), Is.EqualTo(newOutputs));
            Assert.That(_node.GetOutputs().Count, Is.EqualTo(2));
            Assert.That(_node.GetOutputs()[0].GetName(), Is.EqualTo("newOutput1"));
            Assert.That(_node.GetOutputs()[1].GetName(), Is.EqualTo("newOutput2"));
        }

        [Test]
        public void GetInputs_ReturnsOriginalInputPins()
        {
            // Act & Assert
            Assert.That(_node.GetInputs(), Is.EqualTo(_inputPins));
            Assert.That(_node.GetInputs()[0].GetName(), Is.EqualTo("input1"));
            Assert.That(_node.GetInputs()[1].GetName(), Is.EqualTo("input2"));
        }

        [Test]
        public void GetOutputs_ReturnsOriginalOutputPins()
        {
            // Act & Assert
            Assert.That(_node.GetOutputs(), Is.EqualTo(_outputPins));
            Assert.That(_node.GetOutputs()[0].GetName(), Is.EqualTo("output1"));
        }
    }
}