using NUnit.Framework;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using System.Collections.Generic;
using Godot;

namespace OpenShaderGraph.Tests.Core.Logic
{
    [TestFixture]
    public class GraphManagerNodeTests
    {
        private GraphManager _graphManager;
        private GraphData _graphData;

        [SetUp]
        public void SetUp()
        {
            // Inject a default grouping service instance
            _graphManager = new GraphManager(new GroupingService());
            _graphData = _graphManager.CreateNewGraph();
            _graphManager.SelectGraph(_graphData);
        }

        [Test]
        public void RemoveNode_NodeExists_RemovesNodeAndConnections()
        {
            // Arrange
            var node1 = new BaseNodeData("Node1", "Type1", Vector2.Zero, outputs: new List<PinData> { new PinData("out", PinDataType.Float, DirectionType.Output) });
            var node2 = new BaseNodeData("Node2", "Type2", Vector2.Zero, inputs: new List<PinData> { new PinData("in", PinDataType.Float, DirectionType.Input) });
            _graphData.AddNode(node1);
            _graphData.AddNode(node2);
            // todo: node1.GetOutputByIndex(0) and node2.GetInputByIndex(0) are nullable
            // make sure constructor also accept nullable
            var connection = new ConnectionData(node1.Id, node1.GetOutputByIndex(0), node2.Id, node2.GetInputByIndex(0));
            _graphData.AddConnection(connection);

            bool nodeRemovedFired = false;
            BaseNodeData removedNode = null;
            _graphData.NodeRemoved += (node) =>
            {
                nodeRemovedFired = true;
                removedNode = node;
            };

            // Act
            _graphManager.RemoveNode(node1);

            // Assert
            Assert.IsFalse(_graphData.GetNodes().Contains(node1));
            Assert.That(_graphData.GetConnections().Count, Is.EqualTo(0));
            Assert.IsTrue(nodeRemovedFired);
            Assert.That(node1, Is.EqualTo(removedNode));
        }

        [Test]
        public void RemoveNode_NodeDoesNotExist_DoesNothing()
        {
            // Arrange
            var node1 = new BaseNodeData("Node1", "Type1", Vector2.Zero);
            var nonExistentNode = new BaseNodeData("NonExistent", "Type", Vector2.Zero);
            _graphData.AddNode(node1);
            int initialNodeCount = _graphData.GetNodes().Count;

            // Act
            _graphManager.RemoveNode(nonExistentNode);

            // Assert
            Assert.That(initialNodeCount, Is.EqualTo(_graphData.GetNodes().Count));
        }

        [Test]
        public void DuplicateNode_NodeExists_AddsClonedNode()
        {
            // Arrange
            var node1 = new BaseNodeData("Node1", "Type1", new Vector2(100, 100), outputs: new List<PinData> { new PinData("out", PinDataType.Float, DirectionType.Output) });
            _graphData.AddNode(node1);
            int initialNodeCount = _graphData.GetNodes().Count;
            BaseNodeData addedNode = null;
            _graphData.NodeAdded += (node) =>
            {
                addedNode = node;
            };

            // Act
            _graphManager.DuplicateNode(node1);

            // Assert
            Assert.That(initialNodeCount + 1, Is.EqualTo(_graphData.GetNodes().Count));
            Assert.IsNotNull(addedNode);
            Assert.That(node1, Is.Not.SameAs(addedNode));
            Assert.That(node1.GetName(), Is.EqualTo(addedNode.GetName()));
            Assert.That(new Vector2(130, 130), Is.EqualTo(addedNode.GetPosition()));
        }
    }
}