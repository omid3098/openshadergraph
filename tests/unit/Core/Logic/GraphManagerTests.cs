using NUnit.Framework;
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using static OpenShaderGraph.Core.Data.GraphType;
using System.Collections.Generic;
using Moq;
using OpenShaderGraph.Core.Utils;
using System.Linq;

namespace OpenShaderGraph.Tests.Core.Logic
{
    [TestFixture]
    public class GraphManagerTests
    {
        private GraphManager _graphManager;
        private Mock<GroupingService> _mockGroupingService;

        [SetUp]
        public void SetUp()
        {
            _mockGroupingService = new Mock<GroupingService>();
            _graphManager = new GraphManager(_mockGroupingService.Object);
        }

        [Test]
        public void CreateNewGraph_ReturnsNewGraph()
        {
            var graph = _graphManager.CreateNewGraph();
            Assert.That(graph, Is.Not.Null);
            Assert.That(_graphManager.GetAllGraphs(), Contains.Item(graph));
        }

        [Test]
        public void SelectGraph_ChangesCurrentGraph()
        {
            var graph = _graphManager.CreateNewGraph();
            _graphManager.SelectGraph(graph);
            Assert.That(_graphManager.GetCurrentGraph(), Is.SameAs(graph));
        }

        [Test]
        public void DeleteGraph_RemovesGraph()
        {
            var graph = _graphManager.CreateNewGraph();
            _graphManager.DeleteGraph(graph);
            Assert.That(_graphManager.GetAllGraphs(), Does.Not.Contain(graph));
        }

        [Test]
        public void DeleteGraph_NoGraphs_CurrentGraphIsNull()
        {
            var graph = _graphManager.CreateNewGraph();
            _graphManager.DeleteGraph(graph);
            Assert.That(_graphManager.GetCurrentGraph(), Is.Null);
        }

        [Test]
        public void GroupNodes_WhenGroupingTwoNodes_ReplacesNodesWithGroupNodeAndReconnectsOutgoing()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();
            _graphManager.SelectGraph(graph);

            var pinA_out = new PinData("outA", PinDataType.Float, DirectionType.Output);
            var pinB_in = new PinData("inB", PinDataType.Float, DirectionType.Input);
            var pinB_out = new PinData("outB", PinDataType.Float, DirectionType.Output);
            var pinC_in = new PinData("inC", PinDataType.Float, DirectionType.Input);

            var nodeA = new BaseNodeData("NodeA", "A", Vector2.Zero, null, new List<PinData> { pinA_out });
            var nodeB = new BaseNodeData("NodeB", "B", Vector2.Zero, new List<PinData> { pinB_in }, new List<PinData> { pinB_out });
            var nodeC = new BaseNodeData("NodeC", "C", Vector2.Zero, new List<PinData> { pinC_in }, null);
            graph.AddNode(nodeA);
            graph.AddNode(nodeB);
            graph.AddNode(nodeC);

            // A -> B (internal), B -> C (outgoing)
            graph.AddConnection(new ConnectionData(nodeA.Id, pinA_out, nodeB.Id, pinB_in));
            graph.AddConnection(new ConnectionData(nodeB.Id, pinB_out, nodeC.Id, pinC_in));

            var nodesToGroup = new List<BaseNodeData> { nodeA, nodeB };

            var groupGraphData = new BaseGroupGraphData("New Group", GraphType.GroupGraph);

            // Based on GroupingService logic for an outgoing connection B->C:
            // It creates an input on the group's OutputNode that mirrors B's output pin.
            var groupOutputMirrorPin = pinB_out.Clone();
            groupOutputMirrorPin.SetDirection(DirectionType.Input);
            groupGraphData.OutputNode.AddInput(groupOutputMirrorPin);

            _mockGroupingService.Setup(s => s.Group(It.IsAny<string>(), It.IsAny<GraphType>(), graph, nodesToGroup)).Returns(groupGraphData);

            // Act
            _graphManager.GroupNodes(nodesToGroup);

            // Assert
            var groupNode = graph.GetNodes().OfType<GroupNodeData>().FirstOrDefault();
            Assert.That(groupNode, Is.Not.Null, "Group node was not created.");
            Assert.That(graph.GetNodes().Count(n => n is not GroupNodeData), Is.EqualTo(1), "Nodes to be grouped were not removed or extra nodes were added");

            Assert.That(graph.GetNodes().Any(n => n.Id == nodeA.Id), Is.False, "Node A was not removed.");
            Assert.That(graph.GetNodes().Any(n => n.Id == nodeB.Id), Is.False, "Node B was not removed.");
            Assert.That(graph.GetNodes().Any(n => n.Id == nodeC.Id), Is.True, "Node C was removed, but it shouldn't have been.");

            var connections = graph.GetConnections();
            Assert.That(connections.Count, Is.EqualTo(1), "Should only be one connection left.");
            var newConnection = connections.First();
            Assert.That(newConnection.GetFrom().NodeId, Is.EqualTo(groupNode.Id), "Connection is not from group node.");
            Assert.That(newConnection.GetFrom().Pin.GetName(), Is.EqualTo(pinB_out.GetName()));
            Assert.That(newConnection.GetTo().NodeId, Is.EqualTo(nodeC.Id), "Connection is not to node C.");
            Assert.That(newConnection.GetTo().Pin.GetName(), Is.EqualTo(pinC_in.GetName()));
        }

        [Test]
        public void GroupNodes_WithIncomingAndOutgoingConnections_ReconnectsCorrectly()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();
            _graphManager.SelectGraph(graph);

            var pinIn_out = new PinData("out", PinDataType.Float, DirectionType.Output);
            var pinA_in = new PinData("in", PinDataType.Float, DirectionType.Input);
            var pinA_out = new PinData("out", PinDataType.Float, DirectionType.Output);
            var pinB_in = new PinData("in", PinDataType.Float, DirectionType.Input);
            var pinB_out = new PinData("out", PinDataType.Float, DirectionType.Output);
            var pinOut_in = new PinData("in", PinDataType.Float, DirectionType.Input);

            var inputNode = new BaseNodeData("Input", "Input", Vector2.Zero, null, new List<PinData> { pinIn_out });
            var nodeA = new BaseNodeData("NodeA", "A", Vector2.Zero, new List<PinData> { pinA_in }, new List<PinData> { pinA_out });
            var nodeB = new BaseNodeData("NodeB", "B", Vector2.Zero, new List<PinData> { pinB_in }, new List<PinData> { pinB_out });
            var outputNode = new BaseNodeData("Output", "Output", Vector2.Zero, new List<PinData> { pinOut_in }, null);
            graph.AddNode(inputNode);
            graph.AddNode(nodeA);
            graph.AddNode(nodeB);
            graph.AddNode(outputNode);

            graph.AddConnection(new ConnectionData(inputNode.Id, pinIn_out, nodeA.Id, pinA_in)); // Incoming
            graph.AddConnection(new ConnectionData(nodeA.Id, pinA_out, nodeB.Id, pinB_in));     // Internal
            graph.AddConnection(new ConnectionData(nodeB.Id, pinB_out, outputNode.Id, pinOut_in)); // Outgoing

            var nodesToGroup = new List<BaseNodeData> { nodeA, nodeB };

            var groupGraphData = new BaseGroupGraphData("New Group", GraphType.GroupGraph);

            // Mock GroupingService creating an output on InputNode for the incoming connection
            var groupInputMirrorPin = pinA_in.Clone();
            groupInputMirrorPin.SetDirection(DirectionType.Output);
            groupGraphData.InputNode.AddOutput(groupInputMirrorPin);

            // Mock GroupingService creating an input on OutputNode for the outgoing connection
            var groupOutputMirrorPin = pinB_out.Clone();
            groupOutputMirrorPin.SetDirection(DirectionType.Input);
            groupGraphData.OutputNode.AddInput(groupOutputMirrorPin);

            _mockGroupingService.Setup(s => s.Group(It.IsAny<string>(), It.IsAny<GraphType>(), graph, nodesToGroup)).Returns(groupGraphData);

            // Act
            _graphManager.GroupNodes(nodesToGroup);

            // Assert
            var groupNode = graph.GetNodes().OfType<GroupNodeData>().FirstOrDefault();
            Assert.That(groupNode, Is.Not.Null);
            Assert.That(graph.GetNodes().Count(), Is.EqualTo(3)); // Input, Output, Group

            var connections = graph.GetConnections();
            Assert.That(connections.Count, Is.EqualTo(2));

            var incomingConn = connections.FirstOrDefault(c => c.GetTo().NodeId == groupNode.Id);
            Assert.That(incomingConn, Is.Not.Null, "Incoming connection to group not found.");
            Assert.That(incomingConn.GetFrom().NodeId, Is.EqualTo(inputNode.Id));
            Assert.That(incomingConn.GetTo().Pin.GetName(), Is.EqualTo(pinA_in.GetName()));

            var outgoingConn = connections.FirstOrDefault(c => c.GetFrom().NodeId == groupNode.Id);
            Assert.That(outgoingConn, Is.Not.Null, "Outgoing connection from group not found.");
            Assert.That(outgoingConn.GetTo().NodeId, Is.EqualTo(outputNode.Id));
            Assert.That(outgoingConn.GetFrom().Pin.GetName(), Is.EqualTo(pinB_out.GetName()));
        }

        [Test]
        public void CreateNewGraph_WithCustomEngineAndStage_SetsPropertiesCorrectly()
        {
            var graph = _graphManager.CreateNewGraph("CustomGraph", ShaderGraph, ShaderLanguage.HLSL, ShaderStage.Compute);
            Assert.That(graph, Is.InstanceOf<ShaderGraphData>());
            var sg = (ShaderGraphData)graph;
            Assert.That(sg.Language, Is.EqualTo(ShaderLanguage.HLSL));
            Assert.That(sg.Stage, Is.EqualTo(ShaderStage.Compute));
        }

        [Test]
        public void CreateNewGraph_DefaultsToShaderGraphDataWithGodotAndFragment()
        {
            var graph = _graphManager.CreateNewGraph();
            Assert.That(graph, Is.InstanceOf<ShaderGraphData>());
            var sg = (ShaderGraphData)graph;
            Assert.That(sg.Language, Is.EqualTo(ShaderLanguage.Godot));
            Assert.That(sg.Stage, Is.EqualTo(ShaderStage.Fragment));
        }
    }
}