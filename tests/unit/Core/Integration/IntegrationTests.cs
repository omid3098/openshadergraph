using NUnit.Framework;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using Godot;
using System.Collections.Generic;
using System.Linq;

namespace OpenShaderGraph.Tests.Core.Integration
{
    [TestFixture]
    public class IntegrationTests
    {
        private GraphManager _graphManager = null!;
        private List<string> _receivedSignals = null!;

        [SetUp]
        public void SetUp()
        {
            // Inject a default grouping service instance
            _graphManager = new GraphManager(new GroupingService());
            _receivedSignals = new List<string>();
        }

        [TearDown]
        public void TearDown()
        {
            // No cleanup method available
        }

        #region Complete Workflow Tests
        [Test]
        public void CompleteShaderGraphWorkflow_CreatesValidGraph()
        {
            var graph = _graphManager.CreateNewGraph();
            Assert.That(graph, Is.Not.Null);
            Assert.That(graph.GetName(), Is.EqualTo("New Graph"));

            var colorPin = new PinData("color", PinDataType.Vector3, DirectionType.Output, new Variant(Vector3.Zero));
            var valuePin = new PinData("value", PinDataType.Float, DirectionType.Output, new Variant(0.0f));
            var input1Pin = new PinData("input1", PinDataType.Vector3, DirectionType.Input, new Variant(Vector3.Zero));
            var input2Pin = new PinData("input2", PinDataType.Float, DirectionType.Input, new Variant(0.0f));
            var resultPin = new PinData("result", PinDataType.Vector3, DirectionType.Output, new Variant(Vector3.Zero));
            var albedoPin = new PinData("albedo", PinDataType.Vector3, DirectionType.Input, new Variant(Vector3.Zero));

            var colorNode = new NodeData("ColorConstant", "ConstantNode", new Vector2(0, 0), new List<PinData>(), new List<PinData> { colorPin });
            var valueNode = new NodeData("FloatConstant", "ConstantNode", new Vector2(0, 100), new List<PinData>(), new List<PinData> { valuePin });
            var addNode = new NodeData("Add", "MathNode", new Vector2(200, 50), new List<PinData> { input1Pin, input2Pin }, new List<PinData> { resultPin });
            var outputNode = new NodeData("Output", "OutputNode", new Vector2(400, 50), new List<PinData> { albedoPin }, new List<PinData>());

            graph.AddNode(colorNode);
            graph.AddNode(valueNode);
            graph.AddNode(addNode);
            graph.AddNode(outputNode);

            Assert.That(graph.GetNodes().Count, Is.EqualTo(4));

            var connection1 = new ConnectionData(colorNode.Id, colorPin, addNode.Id, input1Pin);
            var connection2 = new ConnectionData(valueNode.Id, valuePin, addNode.Id, input2Pin); // This is valid float -> vec3 is not checked in this test
            var connection3 = new ConnectionData(addNode.Id, resultPin, outputNode.Id, albedoPin);

            graph.AddConnection(connection1);
            graph.AddConnection(connection2);
            graph.AddConnection(connection3);

            // All connections are now valid.
            Assert.That(graph.GetConnections().Count, Is.EqualTo(3));
        }

        [Test]
        public void MultiGraphWorkflow_ManagesMultipleGraphsCorrectly()
        {
            // Act - Create multiple graphs
            var graph1 = _graphManager.CreateNewGraph("Shader Graph 1");
            var graph2 = _graphManager.CreateNewGraph("Shader Graph 2");
            var graph3 = _graphManager.CreateNewGraph("Shader Graph 3");

            // Assert - Should have 3 graphs
            Assert.That(_graphManager.GetAllGraphs().Count, Is.EqualTo(3));
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph3)); // Current should be last created

            // Act - Switch between graphs
            _graphManager.SelectGraph(graph1);
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph1));

            _graphManager.SelectGraph(graph2);
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph2));

            // Act - Delete middle graph
            _graphManager.DeleteGraph(graph2);

            // Assert - Should have 2 graphs after deletion
            Assert.That(_graphManager.GetAllGraphs().Count, Is.EqualTo(2));
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph1)); // Should remain on graph1
        }

        [Test]
        public void ComplexConnectionValidation_RejectsInvalidConnections()
        {
            var graph = _graphManager.CreateNewGraph();

            var inputOut = new PinData("value", PinDataType.Float, DirectionType.Output, new Variant(0.0f));
            var math1In = new PinData("a", PinDataType.Float, DirectionType.Input, new Variant(0.0f));
            var math1Out = new PinData("result", PinDataType.Float, DirectionType.Output, new Variant(0.0f));
            var math2In = new PinData("b", PinDataType.Float, DirectionType.Input, new Variant(0.0f));
            var math2Out = new PinData("result", PinDataType.Float, DirectionType.Output, new Variant(0.0f));
            var outputIn = new PinData("final", PinDataType.Float, DirectionType.Input, new Variant(0.0f));

            var inputNode = new NodeData("Input", "InputNode", new Vector2(0, 0), new List<PinData>(), new List<PinData> { inputOut });
            var math1Node = new NodeData("Math1", "MathNode", new Vector2(100, 0), new List<PinData> { math1In }, new List<PinData> { math1Out });
            var math2Node = new NodeData("Math2", "MathNode", new Vector2(200, 0), new List<PinData> { math2In }, new List<PinData> { math2Out });
            var outputNode = new NodeData("Output", "OutputNode", new Vector2(300, 0), new List<PinData> { outputIn }, new List<PinData>());

            graph.AddNode(inputNode);
            graph.AddNode(math1Node);
            graph.AddNode(math2Node);
            graph.AddNode(outputNode);

            var conn1 = new ConnectionData(inputNode.Id, inputOut, math1Node.Id, math1In);
            var conn2 = new ConnectionData(math1Node.Id, math1Out, math2Node.Id, math2In);
            var conn3 = new ConnectionData(math2Node.Id, math2Out, outputNode.Id, outputIn);

            graph.AddConnection(conn1);
            graph.AddConnection(conn2);
            graph.AddConnection(conn3);

            Assert.That(graph.GetConnections().Count, Is.EqualTo(3));

            var invalidConn1 = new ConnectionData(inputNode.Id, inputOut, inputNode.Id, inputOut); // Same node
            var invalidConn2 = new ConnectionData(inputNode.Id, inputOut, math1Node.Id, math1Out); // Output to output

            graph.AddConnection(invalidConn1);
            graph.AddConnection(invalidConn2);

            Assert.That(graph.GetConnections().Count, Is.EqualTo(3));
        }

        [Test]
        public void GraphDataIntegrity_PreservesDataDuringOperations()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();

            // Create nodes with specific data
            var node1 = new NodeData("Node1", "Type1", new Vector2(10, 20));
            var node2 = new NodeData("Node2", "Type2", new Vector2(30, 40));

            // Act
            graph.AddNode(node1);
            graph.AddNode(node2);

            // Assert - Verify data integrity
            Assert.That(graph.GetNodes()[0].GetName(), Is.EqualTo("Node1"));
            Assert.That(graph.GetNodes()[0].GetNodeType(), Is.EqualTo("Type1"));
            Assert.That(graph.GetNodes()[0].Position, Is.EqualTo(new Vector2(10, 20)));

            Assert.That(graph.GetNodes()[1].GetName(), Is.EqualTo("Node2"));
            Assert.That(graph.GetNodes()[1].GetNodeType(), Is.EqualTo("Type2"));
            Assert.That(graph.GetNodes()[1].Position, Is.EqualTo(new Vector2(30, 40)));

            // Act - Modify nodes and verify changes persist
            var nodeToModify = graph.GetNodes()[0];
            nodeToModify.SetName("Modified Node1");
            nodeToModify.SetPosition(new Vector2(100, 200));

            // Assert - Changes should persist
            Assert.That(graph.GetNodes()[0].GetName(), Is.EqualTo("Modified Node1"));
            Assert.That(graph.GetNodes()[0].Position, Is.EqualTo(new Vector2(100, 200)));
        }
        #endregion

        #region Advanced Connection Tests
        [Test]
        public void ConnectionValidation_TypeMatching_WorksCorrectly()
        {
            var graph = _graphManager.CreateNewGraph();

            var floatOut = new PinData("float_out", PinDataType.Float, DirectionType.Output, new Variant(1.0f));
            var vec2Out = new PinData("vec2_out", PinDataType.Vector2, DirectionType.Output, new Variant(Vector2.Zero));
            var vec3Out = new PinData("vec3_out", PinDataType.Vector3, DirectionType.Output, new Variant(Vector3.Zero));

            var floatIn = new PinData("float_in", PinDataType.Float, DirectionType.Input, new Variant(0.0f));
            var vec2In = new PinData("vec2_in", PinDataType.Vector2, DirectionType.Input, new Variant(Vector2.Zero));
            var vec3In = new PinData("vec3_in", PinDataType.Vector3, DirectionType.Input, new Variant(Vector3.Zero));

            var sourceNode = new NodeData("Source", "SourceNode", Vector2.Zero,
                new List<PinData>(), new List<PinData> { floatOut, vec2Out, vec3Out });
            var targetNode = new NodeData("Target", "TargetNode", new Vector2(100, 0),
                new List<PinData> { floatIn, vec2In, vec3In }, new List<PinData>());

            graph.AddNode(sourceNode);
            graph.AddNode(targetNode);

            graph.AddConnection(new ConnectionData(sourceNode.Id, floatOut, targetNode.Id, floatIn));
            graph.AddConnection(new ConnectionData(sourceNode.Id, vec2Out, targetNode.Id, vec2In));
            graph.AddConnection(new ConnectionData(sourceNode.Id, vec3Out, targetNode.Id, vec3In));
            Assert.That(graph.GetConnections().Count, Is.EqualTo(3));

            graph.AddConnection(new ConnectionData(sourceNode.Id, floatOut, targetNode.Id, vec2In));
            graph.AddConnection(new ConnectionData(sourceNode.Id, vec2Out, targetNode.Id, vec3In));
            graph.AddConnection(new ConnectionData(sourceNode.Id, vec3Out, targetNode.Id, floatIn));

            Assert.That(graph.GetConnections().Count, Is.EqualTo(3));
        }

        [Test]
        public void ConnectionValidation_PinDirection_WorksCorrectly()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();

            var outputPin1 = new PinData("out1", PinDataType.Float, DirectionType.Output, new Variant(1.0f));
            var outputPin2 = new PinData("out2", PinDataType.Float, DirectionType.Output, new Variant(2.0f));
            var inputPin1 = new PinData("in1", PinDataType.Float, DirectionType.Input, new Variant(0.0f));
            var inputPin2 = new PinData("in2", PinDataType.Float, DirectionType.Input, new Variant(0.0f));

            var node1 = new NodeData("Node1", "Type1", Vector2.Zero, new List<PinData> { inputPin1 }, new List<PinData> { outputPin1 });
            var node2 = new NodeData("Node2", "Type2", new Vector2(100, 0), new List<PinData> { inputPin2 }, new List<PinData> { outputPin2 });

            graph.AddNode(node1);
            graph.AddNode(node2);

            // Act - Valid connection (output to input)
            graph.AddConnection(new ConnectionData(node1.Id, outputPin1, node2.Id, inputPin2));

            // Act - Invalid connections (same direction) - these will be silently rejected
            graph.AddConnection(new ConnectionData(node1.Id, outputPin1, node2.Id, outputPin2)); // Output to output
            graph.AddConnection(new ConnectionData(node1.Id, inputPin1, node2.Id, inputPin2)); // Input to input

            // Assert - Only valid connection should be added
            Assert.That(graph.GetConnections().Count, Is.EqualTo(1)); // Only one valid connection
        }

        [Test]
        public void ConnectionValidation_SameNode_RejectsCorrectly()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();

            var outputPin = new PinData("output", PinDataType.Float, DirectionType.Output, new Variant(1.0f));
            var inputPin = new PinData("input", PinDataType.Float, DirectionType.Input, new Variant(0.0f));

            var node = new NodeData("SelfNode", "TestNode", Vector2.Zero, new List<PinData> { inputPin }, new List<PinData> { outputPin });

            graph.AddNode(node);

            // Act - Same node connection should be rejected
            graph.AddConnection(new ConnectionData(node.Id, outputPin, node.Id, inputPin));

            // Assert - Connection should be rejected
            Assert.That(graph.GetConnections().Count, Is.EqualTo(0));
        }

        [Test]
        public void ConnectionValidation_NonExistentNodes_RejectsCorrectly()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();

            var outputPin = new PinData("output", PinDataType.Float, DirectionType.Output, new Variant(1.0f));
            var inputPin = new PinData("input", PinDataType.Float, DirectionType.Input, new Variant(0.0f));

            var existingNode = new NodeData("Existing", "TestNode", Vector2.Zero, new List<PinData> { inputPin }, new List<PinData> { outputPin });
            var nonExistentNode = new NodeData("NonExistent", "TestNode", new Vector2(100, 0), new List<PinData> { inputPin }, new List<PinData> { outputPin });

            graph.AddNode(existingNode); // Only add one node

            // Act - Connection to non-existent node should be rejected
            graph.AddConnection(new ConnectionData(existingNode.Id, outputPin, nonExistentNode.Id, inputPin));
            graph.AddConnection(new ConnectionData(nonExistentNode.Id, outputPin, existingNode.Id, inputPin));

            // Assert - Connections should be rejected
            Assert.That(graph.GetConnections().Count, Is.EqualTo(0));
        }
        #endregion

        #region Performance and Stress Tests
        [Test]
        public void LargeGraphPerformance_HandlesMultipleNodes()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();

            // Act - Create 100 nodes
            for (int i = 0; i < 100; i++)
            {
                var outputPin = new PinData($"output_{i}", PinDataType.Float, DirectionType.Output, new Variant((float)i));
                var inputPin = new PinData($"input_{i}", PinDataType.Float, DirectionType.Input, new Variant(0.0f));

                var node = new NodeData($"Node_{i}", "TestNode", new Vector2(i * 10, i * 10), new List<PinData> { inputPin }, new List<PinData> { outputPin });

                graph.AddNode(node);
            }

            stopwatch.Stop();

            // Assert - Performance should be reasonable (under 1 second for 100 nodes)
            Assert.That(graph.GetNodes().Count, Is.EqualTo(100));
            Assert.That(stopwatch.ElapsedMilliseconds, Is.LessThan(1000));
        }

        [Test]
        public void MultipleConnections_SameNodePair_HandlesCorrectly()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();

            // Create nodes with multiple pins
            var out1 = new PinData("out1", PinDataType.Float, DirectionType.Output, new Variant(1.0f));
            var out2 = new PinData("out2", PinDataType.Vector2, DirectionType.Output, new Variant(Vector2.Zero));
            var in1 = new PinData("in1", PinDataType.Float, DirectionType.Input, new Variant(0.0f));
            var in2 = new PinData("in2", PinDataType.Vector2, DirectionType.Input, new Variant(Vector2.Zero));

            var sourceNode = new NodeData("Source", "SourceNode", Vector2.Zero, new List<PinData>(), new List<PinData> { out1, out2 });
            var targetNode = new NodeData("Target", "TargetNode", new Vector2(100, 0), new List<PinData> { in1, in2 }, new List<PinData>());

            graph.AddNode(sourceNode);
            graph.AddNode(targetNode);

            // Act - Create multiple connections between same nodes
            var conn1 = new ConnectionData(sourceNode.Id, out1, targetNode.Id, in1);
            var conn2 = new ConnectionData(sourceNode.Id, out2, targetNode.Id, in2);

            // Act - Both connections should be valid
            graph.AddConnection(conn1);
            graph.AddConnection(conn2);

            // Assert - Both connections should be added
            Assert.That(graph.GetConnections().Count, Is.EqualTo(2));
        }
        #endregion

        #region Edge Cases
        [Test]
        public void EmptyGraph_Operations_HandleCorrectly()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();

            // Assert - Empty graph should handle operations gracefully
            Assert.That(graph.GetNodes().Count, Is.EqualTo(0));
            Assert.That(graph.GetConnections().Count, Is.EqualTo(0));
        }

        [Test]
        public void GraphOperations_NullInputs_HandleGracefully()
        {
            // Act & Assert
            Assert.That(() => _graphManager.SelectGraph(null), Throws.Nothing);
            Assert.That(() => _graphManager.DeleteGraph(null!), Throws.Nothing);
        }

        [Test]
        public void PinValues_ComplexTypes_PreserveCorrectly()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph();

            // Create pins with complex values - Using Vector3 as an example of a non-primitive Godot type
            var vec3Pin = new PinData("vec3_val", PinDataType.Vector3, DirectionType.Output, new Variant(new Vector3(1, 2, 3)));

            var node = new NodeData("ComplexNode", "TestNode", Vector2.Zero, new List<PinData>(), new List<PinData> { vec3Pin });

            // Act
            graph.AddNode(node);

            // Assert - Complex values should be preserved
            var retrievedPin = graph.GetNodes()[0].GetOutputs()[0];
            Assert.That(retrievedPin.GetValue().AsVector3(), Is.EqualTo(new Vector3(1, 2, 3)));
        }
        #endregion

        #region Graph Type Tests
        [Test]
        public void GraphTypes_AllTypes_CreateCorrectly()
        {
            // Act & Assert - Test all graph types
            var shaderGraph = new GraphData("Shader", GraphType.ShaderGraph, new List<NodeData>(), new List<ConnectionData>());
            var groupGraph = new GraphData("Group", GraphType.GroupGraph, new List<NodeData>(), new List<ConnectionData>());
            var localSubgraph = new GraphData("LocalSub", GraphType.LocalSubgraph, new List<NodeData>(), new List<ConnectionData>());
            var globalSubgraph = new GraphData("GlobalSub", GraphType.GlobalSubgraph, new List<NodeData>(), new List<ConnectionData>());

            Assert.That(shaderGraph.GetGraphType(), Is.EqualTo(GraphType.ShaderGraph));
            Assert.That(groupGraph.GetGraphType(), Is.EqualTo(GraphType.GroupGraph));
            Assert.That(localSubgraph.GetGraphType(), Is.EqualTo(GraphType.LocalSubgraph));
            Assert.That(globalSubgraph.GetGraphType(), Is.EqualTo(GraphType.GlobalSubgraph));
        }

        [Test]
        public void GraphProperties_Metadata_PreservesCorrectly()
        {
            // Arrange & Act
            var graph = new GraphData("TestGraph", GraphType.ShaderGraph, new List<NodeData>(), new List<ConnectionData>());
            graph.SetFilePath("test/path/shader.graph");
            graph.SetVersion("1.2.3");

            // Assert
            Assert.That(graph.GetName(), Is.EqualTo("TestGraph"));
            Assert.That(graph.GetFilePath(), Is.EqualTo("test/path/shader.graph"));
            Assert.That(graph.GetVersion(), Is.EqualTo("1.2.3"));
        }
        #endregion
    }
}