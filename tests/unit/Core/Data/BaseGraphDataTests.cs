using NUnit.Framework;
using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Data;
using static OpenShaderGraph.Core.Data.GraphType;
using static OpenShaderGraph.Core.Data.PinType;

namespace OpenShaderGraph.Tests.Core.Data
{
    [TestFixture]
    public class BaseGraphDataTests
    {
        private BaseGraphData _graph;
        private BaseNodeData _node1;
        private BaseNodeData _node2;
        private PinData _outputPin;
        private PinData _inputPin;

        [SetUp]
        public void SetUp()
        {
            _graph = new BaseGraphData("Test Graph", GraphType.ShaderGraph);

            // Create test nodes with pins
            _outputPin = new PinData("output", "float", PinType.Output, new Variant(1.0f));
            _inputPin = new PinData("input", "float", PinType.Input, new Variant(0.0f));

            var outputPins = new List<PinData> { _outputPin };
            var inputPins = new List<PinData> { _inputPin };

            _node1 = new BaseNodeData("Node1", "TestNode", new Vector2(0, 0), new List<PinData>(), outputPins);
            _node2 = new BaseNodeData("Node2", "TestNode", new Vector2(100, 0), inputPins, new List<PinData>());
        }

        [Test]
        public void Constructor_SetsPropertiesCorrectly()
        {
            // Act & Assert
            Assert.That(_graph.GetName(), Is.EqualTo("Test Graph"));
            Assert.That(_graph.GetGraphType(), Is.EqualTo(GraphType.ShaderGraph));
            Assert.That(_graph.GetNodes(), Is.Not.Null);
            Assert.That(_graph.GetConnections(), Is.Not.Null);
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(0));
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(0));
            Assert.That(_graph.GetVersion(), Is.EqualTo("1.0"));
            Assert.That(_graph.GetFilePath(), Is.EqualTo(""));
            Assert.That(_graph.GetProperties(), Is.Not.Null);
        }

        [Test]
        public void Constructor_WithNodesAndConnections_SetsThemCorrectly()
        {
            // Arrange
            var nodes = new List<BaseNodeData> { _node1, _node2 };
            var connections = new List<ConnectionData>();

            // Act
            var graph = new BaseGraphData("Test", GraphType.GroupGraph, nodes, connections);

            // Assert
            Assert.That(graph.GetNodes().Count, Is.EqualTo(2));
            Assert.That(graph.GetConnections().Count, Is.EqualTo(0));
        }

        [Test]
        public void AddNode_ValidNode_AddsSuccessfully()
        {
            // Act
            _graph.AddNode(_node1);

            // Assert
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(1));
            Assert.That(_graph.GetNodes()[0], Is.EqualTo(_node1));
        }

        [Test]
        public void AddNode_NullNode_IgnoresGracefully()
        {
            // Act
            _graph.AddNode(null);

            // Assert
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(0));
        }

        [Test]
        public void AddConnection_ValidConnection_AddsSuccessfully()
        {
            // Arrange
            _graph.AddNode(_node1);
            _graph.AddNode(_node2);
            var connection = new ConnectionData(_node1, _outputPin, _node2, _inputPin);

            // Act
            _graph.AddConnection(connection);

            // Assert
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(1));
            Assert.That(_graph.GetConnections()[0], Is.EqualTo(connection));
        }

        [Test]
        public void AddConnection_NullConnection_IgnoresGracefully()
        {
            // Act
            _graph.AddConnection(null);

            // Assert
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(0));
        }

        [Test]
        public void ValidateConnection_NullConnection_ReturnsFalse()
        {
            // Act & Assert
            Assert.That(_graph.ValidateConnection(null), Is.False);
        }

        [Test]
        public void ValidateConnection_SameNode_ReturnsFalse()
        {
            // Arrange
            _graph.AddNode(_node1);
            var connection = new ConnectionData(_node1, _outputPin, _node1, _inputPin);

            // Act & Assert
            Assert.That(_graph.ValidateConnection(connection), Is.False);
        }

        [Test]
        public void ValidateConnection_SamePinDirection_ReturnsFalse()
        {
            // Arrange
            _graph.AddNode(_node1);
            _graph.AddNode(_node2);
            var connection = new ConnectionData(_node1, _outputPin, _node2, _outputPin);

            // Act & Assert
            Assert.That(_graph.ValidateConnection(connection), Is.False);
        }

        [Test]
        public void ValidateConnection_NodeNotInGraph_ReturnsFalse()
        {
            // Arrange
            var connection = new ConnectionData(_node1, _outputPin, _node2, _inputPin);

            // Act & Assert
            Assert.That(_graph.ValidateConnection(connection), Is.False);
        }

        [Test]
        public void ValidateConnection_TypeMismatch_ReturnsFalse()
        {
            // Arrange
            _graph.AddNode(_node1);
            _graph.AddNode(_node2);
            var intPin = new PinData("input", "int", PinType.Input, new Variant(0));
            var connection = new ConnectionData(_node1, _outputPin, _node2, intPin);

            // Act & Assert
            Assert.That(_graph.ValidateConnection(connection), Is.False);
        }

        [Test]
        public void ValidateConnection_ValidConnection_ReturnsTrue()
        {
            // Arrange
            _graph.AddNode(_node1);
            _graph.AddNode(_node2);
            var connection = new ConnectionData(_node1, _outputPin, _node2, _inputPin);

            // Act & Assert
            Assert.That(_graph.ValidateConnection(connection), Is.True);
        }

        [Test]
        public void SetVersion_UpdatesVersionCorrectly()
        {
            // Act
            _graph.SetVersion("2.0");

            // Assert
            Assert.That(_graph.GetVersion(), Is.EqualTo("2.0"));
        }

        [Test]
        public void SetFilePath_UpdatesFilePathCorrectly()
        {
            // Act
            _graph.SetFilePath("res://test.json");

            // Assert
            Assert.That(_graph.GetFilePath(), Is.EqualTo("res://test.json"));
        }

        [Test]
        public void SetProperties_UpdatesPropertiesCorrectly()
        {
            // Arrange
            var properties = new Dictionary<string, Variant>
            {
                ["test_prop"] = new Variant("test_value")
            };

            // Act
            _graph.SetProperties(properties);

            // Assert
            Assert.That(_graph.GetProperties(), Is.EqualTo(properties));
            Assert.That(_graph.GetProperties()["test_prop"].AsString(), Is.EqualTo("test_value"));
        }
    }
}