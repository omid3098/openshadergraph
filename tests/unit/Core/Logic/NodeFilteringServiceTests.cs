using NUnit.Framework;
using Godot;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.View.NodeViews;
using System.Collections.Generic;

namespace OpenShaderGraph.Tests.Core.Logic
{
    [TestFixture]
    public class NodeFilteringServiceTests
    {
        private NodeFilteringService _service;
        private ShaderGraphData _graph;

        [SetUp]
        public void SetUp()
        {
            _service = new NodeFilteringService();
            _service.Init();
            _graph = new ShaderGraphData("TestGraph", EngineType.Godot, ShaderStage.Fragment);
        }

        [Test]
        public void IsNodeVisible_NoMetadata_ReturnsTrue()
        {
            var attr = new RegisterNodeAttribute("TestNode", "General");
            var rn = new RegisteredNode(typeof(BaseGraphData), attr);
            Assert.That(_service.IsNodeVisible(rn, _graph), Is.True);
        }

        [Test]
        public void IsNodeVisible_MismatchedGraphType_ReturnsFalse()
        {
            var attr = new RegisterNodeAttribute("TestNode", "General")
            {
                GraphTypes = new[] { GraphType.GroupGraph }
            };
            var rn = new RegisteredNode(typeof(BaseGraphData), attr);
            Assert.That(_service.IsNodeVisible(rn, _graph), Is.False);
        }

        [Test]
        public void IsNodeVisible_MismatchedShaderStage_ReturnsFalse()
        {
            var attr = new RegisterNodeAttribute("TestNode", "General")
            {
                Stages = new[] { ShaderStage.Vertex }
            };
            var rn = new RegisteredNode(typeof(BaseGraphData), attr);
            Assert.That(_service.IsNodeVisible(rn, _graph), Is.False);
        }

        [Test]
        public void IsNodeVisible_MismatchedEngine_ReturnsFalse()
        {
            var attr = new RegisterNodeAttribute("TestNode", "General")
            {
                Engines = new[] { EngineType.HLSL }
            };
            var rn = new RegisteredNode(typeof(BaseGraphData), attr);
            Assert.That(_service.IsNodeVisible(rn, _graph), Is.False);
        }

        [Test]
        public void IsNodeVisible_AllMatching_ReturnsTrue()
        {
            var attr = new RegisterNodeAttribute("TestNode", "General")
            {
                GraphTypes = new[] { GraphType.ShaderGraph },
                Stages = new[] { ShaderStage.Fragment },
                Engines = new[] { EngineType.Godot }
            };
            var rn = new RegisteredNode(typeof(BaseGraphData), attr);
            Assert.That(_service.IsNodeVisible(rn, _graph), Is.True);
        }

        [Test]
        public void IsNodeVisible_OverridesGraphProperties_ReturnsTrue()
        {
            // Override graph to GLSL + Compute stage via strongly-typed properties
            _graph.Engine = EngineType.GLSL;
            _graph.Stage = ShaderStage.Compute;

            var attr = new RegisterNodeAttribute("TestNode", "General")
            {
                GraphTypes = new[] { GraphType.ShaderGraph },
                Stages = new[] { ShaderStage.Compute },
                Engines = new[] { EngineType.GLSL }
            };
            var rn = new RegisteredNode(typeof(BaseGraphData), attr);
            Assert.That(_service.IsNodeVisible(rn, _graph), Is.True);
        }
    }
}