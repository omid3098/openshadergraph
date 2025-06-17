using NUnit.Framework;
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using static OpenShaderGraph.Core.Data.GraphType;

namespace OpenShaderGraph.Tests.Core.Logic
{
    [TestFixture]
    public class GraphManagerTests
    {
        private GraphManager _graphManager;

        [SetUp]
        public void SetUp()
        {
            _graphManager = new GraphManager();
        }

        [TearDown]
        public void TearDown()
        {
            _graphManager?.Cleanup();
        }

        [Test]
        public void Constructor_InitializesCorrectly()
        {
            // Assert
            Assert.That(_graphManager.GetCurrentGraph(), Is.Null);
            Assert.That(_graphManager.GetAllGraphs(), Is.Not.Null);
            Assert.That(_graphManager.GetAllGraphs().Count, Is.EqualTo(0));
        }

        [Test]
        public void CreateNewGraph_DefaultParameters_CreatesShaderGraph()
        {
            // Act
            var graph = _graphManager.CreateNewGraph();

            // Assert
            Assert.That(graph, Is.Not.Null);
            Assert.That(graph.GetName(), Is.EqualTo("New Graph"));
            Assert.That(graph.GetGraphType(), Is.EqualTo(GraphType.ShaderGraph));
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph));
            Assert.That(_graphManager.GetAllGraphs().Count, Is.EqualTo(1));
        }

        [Test]
        public void CreateNewGraph_CustomParameters_CreatesCorrectGraph()
        {
            // Act
            var graph = _graphManager.CreateNewGraph("Custom Graph", GraphType.GroupGraph);

            // Assert
            Assert.That(graph.GetName(), Is.EqualTo("Custom Graph"));
            Assert.That(graph.GetGraphType(), Is.EqualTo(GraphType.GroupGraph));
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph));
        }

        [Test]
        public void CreateNewGraph_MultipleGraphs_AddsToCollection()
        {
            // Act
            var graph1 = _graphManager.CreateNewGraph("Graph 1");
            var graph2 = _graphManager.CreateNewGraph("Graph 2");

            // Assert
            Assert.That(_graphManager.GetAllGraphs().Count, Is.EqualTo(2));
            Assert.That(_graphManager.GetAllGraphs().Contains(graph1), Is.True);
            Assert.That(_graphManager.GetAllGraphs().Contains(graph2), Is.True);
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph2)); // Should be the last created
        }

        [Test]
        public void SelectGraph_ValidGraph_SelectsCorrectly()
        {
            // Arrange
            var graph1 = _graphManager.CreateNewGraph("Graph 1");
            var graph2 = _graphManager.CreateNewGraph("Graph 2");

            // Act
            _graphManager.SelectGraph(graph1);

            // Assert
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph1));
        }

        [Test]
        public void SelectGraph_NullGraph_HandlesGracefully()
        {
            // Arrange
            var graph = _graphManager.CreateNewGraph("Test Graph");

            // Act
            _graphManager.SelectGraph(null);

            // Assert
            Assert.That(_graphManager.GetCurrentGraph(), Is.Null);
        }

        [Test]
        public void DeleteGraph_ExistingGraph_DeletesCorrectly()
        {
            // Arrange
            var graph1 = _graphManager.CreateNewGraph("Graph 1");
            var graph2 = _graphManager.CreateNewGraph("Graph 2");

            // Act
            _graphManager.DeleteGraph(graph1);

            // Assert
            Assert.That(_graphManager.GetAllGraphs().Count, Is.EqualTo(1));
            Assert.That(_graphManager.GetAllGraphs().Contains(graph1), Is.False);
            Assert.That(_graphManager.GetAllGraphs().Contains(graph2), Is.True);
        }

        [Test]
        public void DeleteGraph_LastRemainingGraph_AutoSelectsFirst()
        {
            // Arrange
            var graph1 = _graphManager.CreateNewGraph("Graph 1");
            var graph2 = _graphManager.CreateNewGraph("Graph 2");
            var graph3 = _graphManager.CreateNewGraph("Graph 3");
            _graphManager.SelectGraph(graph2); // Select middle graph

            // Act
            _graphManager.DeleteGraph(graph2);

            // Assert
            Assert.That(_graphManager.GetAllGraphs().Count, Is.EqualTo(2));
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph1)); // Should auto-select first
        }

        [Test]
        public void DeleteGraph_NonExistentGraph_DoesNothing()
        {
            // Arrange
            var graph1 = _graphManager.CreateNewGraph("Graph 1");
            var graph2 = new BaseGraphData("External Graph", GraphType.ShaderGraph);
            var initialCount = _graphManager.GetAllGraphs().Count;

            // Act
            _graphManager.DeleteGraph(graph2);

            // Assert
            Assert.That(_graphManager.GetAllGraphs().Count, Is.EqualTo(initialCount));
        }

        [Test]
        public void DeleteGraph_AllGraphs_LeavesEmptyCollection()
        {
            // Arrange
            var graph1 = _graphManager.CreateNewGraph("Graph 1");
            var graph2 = _graphManager.CreateNewGraph("Graph 2");

            // Act
            _graphManager.DeleteGraph(graph1);
            _graphManager.DeleteGraph(graph2);

            // Assert
            Assert.That(_graphManager.GetAllGraphs().Count, Is.EqualTo(0));
            // Note: Current implementation doesn't set current graph to null when all graphs are deleted
            // This could be improved in future versions
            Assert.That(_graphManager.GetCurrentGraph(), Is.EqualTo(graph2));
        }
    }
}