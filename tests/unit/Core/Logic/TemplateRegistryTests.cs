using NUnit.Framework;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace OpenShaderGraph.Tests.Core.Logic
{
    [TestFixture]
    public class TemplateRegistryTests
    {
        private TemplateRegistry _registry;
        private string _testYamlPath;

        [SetUp]
        public void SetUp()
        {
            _registry = new TemplateRegistry();
            // In NUnit, the test execution directory is where the assembly is, so we can reference the YAML file directly.
            _testYamlPath = Path.Combine(TestContext.CurrentContext.TestDirectory, "Core/Logic/AddNode.yaml");
        }

        [Test]
        public void GetTemplateEntries_LoadsAndParsesYaml()
        {
            var entries = _registry.GetTemplateEntries(_testYamlPath);
            Assert.IsNotNull(entries);
            Assert.AreEqual(2, entries.Count);

            var allStageEntry = entries.First(e => e.Stage == ShaderStage.All);
            Assert.AreEqual(ShaderLanguage.Godot, allStageEntry.Engine);
            Assert.AreEqual(3, allStageEntry.Parameters.Length);
            Assert.IsTrue(allStageEntry.Template.Contains("float {result} = {a} + {b};"));
        }

        [Test]
        public void GetTemplateEntries_CachesResults()
        {
            var entries1 = _registry.GetTemplateEntries(_testYamlPath);
            var entries2 = _registry.GetTemplateEntries(_testYamlPath);
            Assert.AreSame(entries1, entries2);
        }

        [Test]
        public void GetTemplateEntries_ReturnsEmptyListForMissingFile()
        {
            var entries = _registry.GetTemplateEntries("nonexistent.yaml");
            Assert.IsNotNull(entries);
            Assert.AreEqual(0, entries.Count);
        }

        private TemplateEntry GetBestTemplate(List<TemplateEntry> entries, ShaderLanguage language, ShaderStage stage)
        {
            var specificEntry = entries.FirstOrDefault(e => e.Engine == language && e.Stage == stage);
            if (specificEntry != null)
            {
                return specificEntry;
            }

            return entries.FirstOrDefault(e => e.Engine == language && e.Stage == ShaderStage.All);
        }

        [Test]
        public void TemplateSelection_FragmentOverridesAll()
        {
            var entries = _registry.GetTemplateEntries(_testYamlPath);
            var bestEntry = GetBestTemplate(entries, ShaderLanguage.Godot, ShaderStage.Fragment);

            Assert.IsNotNull(bestEntry);
            Assert.AreEqual(ShaderStage.Fragment, bestEntry.Stage);
            Assert.IsTrue(bestEntry.Template.Contains("+ 0.1;"));
        }

        [Test]
        public void TemplateSelection_FallsBackToAll()
        {
            var entries = _registry.GetTemplateEntries(_testYamlPath);
            var bestEntry = GetBestTemplate(entries, ShaderLanguage.Godot, ShaderStage.Vertex);

            Assert.IsNotNull(bestEntry);
            Assert.AreEqual(ShaderStage.All, bestEntry.Stage);
            Assert.IsFalse(bestEntry.Template.Contains("+ 0.1;"));
        }
    }
}