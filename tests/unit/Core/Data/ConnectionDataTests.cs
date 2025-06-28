using NUnit.Framework;
using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Tests.Core.Data
{
    [TestFixture]
    public class ConnectionDataTests
    {
        private NodeData _fromNode;
        private NodeData _toNode;
        private PinData _outputPin;
        private PinData _inputPin;
        private ConnectionData _connection;

        [SetUp]
        public void SetUp()
        {
            _outputPin = new PinData("output", PinDataType.Float, DirectionType.Output, new Variant(1.0f));
            _inputPin = new PinData("input", PinDataType.Float, DirectionType.Input, new Variant(0.0f));

            var outputPins = new List<PinData> { _outputPin };
            var inputPins = new List<PinData> { _inputPin };

            _fromNode = new NodeData("FromNode", "TestNode", new Vector2(0, 0), new List<PinData>(), outputPins);
            _fromNode.Id = 1;
            _toNode = new NodeData("ToNode", "TestNode", new Vector2(100, 0), inputPins, new List<PinData>());
            _toNode.Id = 2;

            _connection = new ConnectionData(_fromNode.Id, _outputPin, _toNode.Id, _inputPin);
        }

        [Test]
        public void Constructor_SetsConnectionEndpointsCorrectly()
        {
            // Act
            var from = _connection.GetFrom();
            var to = _connection.GetTo();

            // Assert
            Assert.That(from.NodeId, Is.EqualTo(_fromNode.Id));
            Assert.That(from.Pin, Is.EqualTo(_outputPin));
            Assert.That(to.NodeId, Is.EqualTo(_toNode.Id));
            Assert.That(to.Pin, Is.EqualTo(_inputPin));
        }

        [Test]
        public void GetFrom_ReturnsCorrectConnectionEndpoint()
        {
            // Act
            var from = _connection.GetFrom();

            // Assert
            Assert.That(from.NodeId, Is.EqualTo(1));
            Assert.That(from.Pin.GetName(), Is.EqualTo("output"));
            Assert.That(from.Pin.GetDirection(), Is.EqualTo(DirectionType.Output));
        }

        [Test]
        public void GetTo_ReturnsCorrectConnectionEndpoint()
        {
            // Act
            var to = _connection.GetTo();

            // Assert
            Assert.That(to.NodeId, Is.EqualTo(2));
            Assert.That(to.Pin.GetName(), Is.EqualTo("input"));
            Assert.That(to.Pin.GetDirection(), Is.EqualTo(DirectionType.Input));
        }

        [Test]
        public void ConnectionEndpoint_StructProperties_WorkCorrectly()
        {
            // Arrange
            var endpoint = new ConnectionEndpoint(_fromNode.Id, _outputPin);

            // Assert
            Assert.That(endpoint.NodeId, Is.EqualTo(_fromNode.Id));
            Assert.That(endpoint.Pin, Is.EqualTo(_outputPin));
        }

        [Test]
        public void ConnectionEndpoint_CanBeModified()
        {
            // Arrange
            var endpoint = new ConnectionEndpoint(_fromNode.Id, _outputPin);
            var newPin = new PinData("newPin", PinDataType.Int, DirectionType.Output, new Variant(42));

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
            var intOutputPin = new PinData("intOutput", PinDataType.Int, DirectionType.Output, new Variant(100));
            var intInputPin = new PinData("intInput", PinDataType.Int, DirectionType.Input, new Variant(0));

            // Act
            var intConnection = new ConnectionData(_fromNode.Id, intOutputPin, _toNode.Id, intInputPin);

            // Assert
            var from = intConnection.GetFrom();
            var to = intConnection.GetTo();
            Assert.That(from.Pin.GetDataType(), Is.EqualTo(PinDataType.Int));
            Assert.That(to.Pin.GetDataType(), Is.EqualTo(PinDataType.Int));
        }
    }
}