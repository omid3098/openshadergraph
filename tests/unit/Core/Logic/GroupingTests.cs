using NUnit.Framework;
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Utils;
using System.Collections.Generic;
using System.Linq;

namespace OpenShaderGraph.Tests.Core.Logic
{
    [TestFixture]
    public class GroupingTests
    {
        private GraphManager _graphManager;
        private BaseGraphData _graph;

        [SetUp]
        public void SetUp()
        {
            // Register the real grouping service
            Services.Register(new GroupingService());
            _graphManager = new GraphManager();
            _graph = _graphManager.CreateNewGraph();
        }

        [Test]
        public void NestedGroupingScenario_CreatesCorrectStructure()
        {
            // Step 1: Create two float constants and one Add node, connect them
            var float1Out = new PinData("value", PinDataType.Float, DirectionType.Output);
            var float2Out = new PinData("value", PinDataType.Float, DirectionType.Output);
            var add1InA = new PinData("a", PinDataType.Float, DirectionType.Input);
            var add1InB = new PinData("b", PinDataType.Float, DirectionType.Input);
            var add1Out = new PinData("out", PinDataType.Float, DirectionType.Output);

            var float1 = new BaseNodeData("Float1", "Float", Vector2.Zero, null, new List<PinData> { float1Out });
            var float2 = new BaseNodeData("Float2", "Float", new Vector2(100, 0), null, new List<PinData> { float2Out });
            var add1 = new BaseNodeData("Add1", "Add", new Vector2(200, 0), new List<PinData> { add1InA, add1InB }, new List<PinData> { add1Out });

            _graph.AddNode(float1);
            _graph.AddNode(float2);
            _graph.AddNode(add1);
            _graph.AddConnection(new ConnectionData(float1.Id, float1Out, add1.Id, add1InA));
            _graph.AddConnection(new ConnectionData(float2.Id, float2Out, add1.Id, add1InB));

            // Step 2: Create two other floats and another Add node, connect them
            var float3Out = new PinData("value", PinDataType.Float, DirectionType.Output);
            var float4Out = new PinData("value", PinDataType.Float, DirectionType.Output);
            var add2InA = new PinData("a", PinDataType.Float, DirectionType.Input);
            var add2InB = new PinData("b", PinDataType.Float, DirectionType.Input);
            var add2Out = new PinData("out", PinDataType.Float, DirectionType.Output);

            var float3 = new BaseNodeData("Float3", "Float", new Vector2(0, 100), null, new List<PinData> { float3Out });
            var float4 = new BaseNodeData("Float4", "Float", new Vector2(100, 100), null, new List<PinData> { float4Out });
            var add2 = new BaseNodeData("Add2", "Add", new Vector2(200, 100), new List<PinData> { add2InA, add2InB }, new List<PinData> { add2Out });

            _graph.AddNode(float3);
            _graph.AddNode(float4);
            _graph.AddNode(add2);
            _graph.AddConnection(new ConnectionData(float3.Id, float3Out, add2.Id, add2InA));
            _graph.AddConnection(new ConnectionData(float4.Id, float4Out, add2.Id, add2InB));

            // Step 3: Create third Add node and connect previous Add outputs
            var add3InA = new PinData("a", PinDataType.Float, DirectionType.Input);
            var add3InB = new PinData("b", PinDataType.Float, DirectionType.Input);
            var add3Out = new PinData("out", PinDataType.Float, DirectionType.Output);
            var add3 = new BaseNodeData("Add3", "Add", new Vector2(100, 200), new List<PinData> { add3InA, add3InB }, new List<PinData> { add3Out });

            _graph.AddNode(add3);
            _graph.AddConnection(new ConnectionData(add1.Id, add1Out, add3.Id, add3InA));
            _graph.AddConnection(new ConnectionData(add2.Id, add2Out, add3.Id, add3InB));

            // Validate initial structure
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(7));
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(6));

            // Group first set: Float1, Float2, Add1
            _graphManager.GroupNodes(new List<BaseNodeData> { float1, float2, add1 });
            var group1 = _graph.GetNodes().OfType<GroupNodeData>().First();

            // Validate group1 external pins
            Assert.That(group1.GetInputs().Count, Is.EqualTo(0));
            Assert.That(group1.GetOutputs().Count, Is.EqualTo(1));
            var g1Out = group1.GetOutputs()[0];
            Assert.That(g1Out.GetName(), Is.EqualTo(add1Out.GetName()));
            Assert.That(g1Out.GetDataType(), Is.EqualTo(PinDataType.Float));
            Assert.That(g1Out.GetDirection(), Is.EqualTo(DirectionType.Output));

            // Validate main graph after first grouping
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(5));  // 7 - 3 + 1
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(4));  // 6 - 3 + 1
            Assert.That(_graph.GetConnections().Any(c => c.GetFrom().NodeId == group1.Id && c.GetTo().NodeId == add3.Id && c.GetTo().Pin.GetName() == add3InA.GetName()), Is.True);

            // Validate internal subgraph of group1
            var sub1 = group1.SubGraph;
            Assert.That(sub1.GetNodes().Count, Is.EqualTo(5));  // 3 + Input + Output
            Assert.That(sub1.GetConnections().Count, Is.EqualTo(3)); // internal 2 + outgoing 1

            // Group second set: Float3, Float4, Add2
            _graphManager.GroupNodes(new List<BaseNodeData> { float3, float4, add2 });
            var group2 = _graph.GetNodes().OfType<GroupNodeData>().First(g => g.Id != group1.Id);

            // Validate group2 external pins
            Assert.That(group2.GetInputs().Count, Is.EqualTo(0));
            Assert.That(group2.GetOutputs().Count, Is.EqualTo(1));
            var g2Out = group2.GetOutputs()[0];
            Assert.That(g2Out.GetName(), Is.EqualTo(add2Out.GetName()));
            Assert.That(g2Out.GetDataType(), Is.EqualTo(PinDataType.Float));
            Assert.That(g2Out.GetDirection(), Is.EqualTo(DirectionType.Output));

            // Validate main graph after second grouping
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(3));  // 5 - 3 + 1
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(2));  // 4 - 3 + 1
            Assert.That(_graph.GetConnections().Any(c => c.GetFrom().NodeId == group2.Id && c.GetTo().NodeId == add3.Id && c.GetTo().Pin.GetName() == add3InB.GetName()), Is.True);

            // Validate internal subgraph of group2
            var sub2 = group2.SubGraph;
            Assert.That(sub2.GetNodes().Count, Is.EqualTo(5));
            Assert.That(sub2.GetConnections().Count, Is.EqualTo(3));

            // Nested grouping of both group nodes
            _graphManager.GroupNodes(new List<BaseNodeData> { group1, group2 });
            var nested = _graph.GetNodes().OfType<GroupNodeData>().First();

            // Validate nested group external pins
            Assert.That(nested.GetInputs().Count, Is.EqualTo(0));
            Assert.That(nested.GetOutputs().Count, Is.EqualTo(2));

            // Validate main graph after nested grouping
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(2));  // 3 - 2 + 1
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(2));  // 2 - 2 + 2

            // Validate nested group to Add3 connections
            var finalConns = _graph.GetConnections();
            Assert.That(finalConns.All(c => c.GetFrom().NodeId == nested.Id), Is.True);
            Assert.That(finalConns.Select(c => c.GetTo().NodeId).Distinct().Single(), Is.EqualTo(add3.Id));
            Assert.That(finalConns.Select(c => c.GetTo().Pin.GetName()).OrderBy(x => x), Is.EquivalentTo(new[] { add3InA.GetName(), add3InB.GetName() }));

            // Validate internal subgraph of nested group
            var nestedSub = nested.SubGraph;
            Assert.That(nestedSub.GetNodes().Count, Is.EqualTo(4));  // 2 + Input + Output
            Assert.That(nestedSub.GetConnections().Count, Is.EqualTo(2));
        }

        [Test]
        public void UngroupingSimpleGroup_RestoresOriginalGraph()
        {
            // Simple graph: two floats into one add
            var float1Out = new PinData("value1", PinDataType.Float, DirectionType.Output);
            var float2Out = new PinData("value2", PinDataType.Float, DirectionType.Output);
            var addInA = new PinData("a", PinDataType.Float, DirectionType.Input);
            var addInB = new PinData("b", PinDataType.Float, DirectionType.Input);
            var addOut = new PinData("out", PinDataType.Float, DirectionType.Output);

            var float1 = new BaseNodeData("Float1", "Float", Vector2.Zero, null, new List<PinData> { float1Out });
            var float2 = new BaseNodeData("Float2", "Float", new Vector2(100, 0), null, new List<PinData> { float2Out });
            var add = new BaseNodeData("Add", "Add", new Vector2(200, 0), new List<PinData> { addInA, addInB }, new List<PinData> { addOut });

            _graph.AddNode(float1);
            _graph.AddNode(float2);
            _graph.AddNode(add);
            _graph.AddConnection(new ConnectionData(float1.Id, float1Out, add.Id, addInA));
            _graph.AddConnection(new ConnectionData(float2.Id, float2Out, add.Id, addInB));

            // Verify initial state
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(3));
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(2));

            // Group these nodes
            _graphManager.GroupNodes(new List<BaseNodeData> { float1, float2, add });
            var group = _graph.GetNodes().OfType<GroupNodeData>().First();
            var sub = group.SubGraph;

            // Verify grouping removed 3 nodes, added 1, and all internal connections removed
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(1));
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(0));

            // Perform ungroup
            var service = Services.Get<GroupingService>();
            var (newNodes, newConnections) = service.Ungroup(_graph, group, sub);
            _graph.RemoveNode(group);

            // After ungroup, main graph should have original 3 nodes and 2 connections
            Assert.That(_graph.GetNodes().Count, Is.EqualTo(3));
            Assert.That(_graph.GetConnections().Count, Is.EqualTo(2));

            // The connections should link the restored floats to the restored add
            var restoredAdd = newNodes.First(n => n.GetName() == "Add");
            var restoredFloat1 = newNodes.First(n => n.GetName() == "Float1");
            var restoredFloat2 = newNodes.First(n => n.GetName() == "Float2");

            Assert.That(_graph.GetConnections().Any(c => c.GetFrom().NodeId == restoredFloat1.Id && c.GetTo().NodeId == restoredAdd.Id), Is.True);
            Assert.That(_graph.GetConnections().Any(c => c.GetFrom().NodeId == restoredFloat2.Id && c.GetTo().NodeId == restoredAdd.Id), Is.True);
        }
    }
}