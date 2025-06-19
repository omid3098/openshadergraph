using NUnit.Framework;
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using static OpenShaderGraph.Core.Data.GraphType;
using System.Collections.Generic;

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
    }
}