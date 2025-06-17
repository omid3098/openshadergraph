using NUnit.Framework;
using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Data;
using static OpenShaderGraph.Core.Data.PinType;

namespace OpenShaderGraph.Tests.Core.Data
{
    [TestFixture]
    public class ConnectionDataTests
    {
        private BaseNodeData _fromNode;
        private BaseNodeData _toNode;
        private PinData _outputPin;
        private PinData _inputPin;
        private ConnectionData _connection;

        [SetUp]
        public void SetUp()
        {
            _outputPin = new PinData("output", "float", PinType.Output, new Variant(1.0f));
            _inputPin = new PinData("input", "float", PinType.Input, new Variant(0.0f));

            var outputPins = new List<PinData> { _outputPin };
            var inputPins = new List<PinData> { _inputPin };

            _fromNode = new BaseNodeData("FromNode", "TestNode", new Vector2(0, 0), new List<PinData>(), outputPins);
            _toNode = new BaseNodeData("ToNode", "TestNode", new Vector2(100, 0), inputPins, new List<PinData>());

            _connection = new ConnectionData(_fromNode, _outputPin, _toNode, _inputPin);
        }

        [Test]
        public void Constructor_SetsConnectionEndpointsCorrectly()
        {
            // Act
            var from = _connection.GetFrom();
            var to = _connection.GetTo();

            // Assert
            Assert.That(from.Node, Is.EqualTo(_fromNode));
            Assert.That(from.Pin, Is.EqualTo(_outputPin));
            Assert.That(to.Node, Is.EqualTo(_toNode));
            Assert.That(to.Pin, Is.EqualTo(_inputPin));
        }

        [Test]
        public void GetFrom_ReturnsCorrectConnectionEndpoint()
        {
            // Act
            var from = _connection.GetFrom();

            // Assert
            Assert.That(from.Node.GetName(), Is.EqualTo("FromNode"));
            Assert.That(from.Pin.GetName(), Is.EqualTo("output"));
            Assert.That(from.Pin.GetDirection(), Is.EqualTo(PinType.Output));
        }

        [Test]
        public void GetTo_ReturnsCorrectConnectionEndpoint()
        {
            // Act
            var to = _connection.GetTo();

            // Assert
            Assert.That(to.Node.GetName(), Is.EqualTo("ToNode"));
            Assert.That(to.Pin.GetName(), Is.EqualTo("input"));
            Assert.That(to.Pin.GetDirection(), Is.EqualTo(PinType.Input));
        }

        [Test]
        public void ConnectionEndpoint_StructProperties_WorkCorrectly()
        {
            // Arrange
            var endpoint = new ConnectionEndpoint(_fromNode, _outputPin);

            // Assert
            Assert.That(endpoint.Node, Is.EqualTo(_fromNode));
            Assert.That(endpoint.Pin, Is.EqualTo(_outputPin));
        }

        [Test]
        public void ConnectionEndpoint_CanBeModified()
        {
            // Arrange
            var endpoint = new ConnectionEndpoint(_fromNode, _outputPin);
            var newPin = new PinData("newPin", "int", PinType.Output, new Variant(42));

            // Act
            endpoint.Pin = newPin;

            // Assert
            Assert.That(endpoint.Pin, Is.EqualTo(newPin));
            Assert.That(endpoint.Pin.GetName(), Is.EqualTo("newPin"));
        }

        [Test]
        public void Constructor_WithDifferentPinTypes_CreatesValidConnection()
        {
            // Arrange
            var intOutputPin = new PinData("intOutput", "int", PinType.Output, new Variant(100));
            var intInputPin = new PinData("intInput", "int", PinType.Input, new Variant(0));

            // Act
            var intConnection = new ConnectionData(_fromNode, intOutputPin, _toNode, intInputPin);

            // Assert
            var from = intConnection.GetFrom();
            var to = intConnection.GetTo();
            Assert.That(from.Pin.GetDataType(), Is.EqualTo("int"));
            Assert.That(to.Pin.GetDataType(), Is.EqualTo("int"));
        }
    }
}