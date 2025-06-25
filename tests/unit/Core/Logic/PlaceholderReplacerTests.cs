using NUnit.Framework;
using OpenShaderGraph.Core.Logic;
using System;
using System.Collections.Generic;

namespace OpenShaderGraph.Tests.Core.Logic
{
    [TestFixture]
    public class PlaceholderReplacerTests
    {
        [Test]
        public void Replace_ShouldReplaceSingleLineTemplate()
        {
            var template = "float {var} = {val};";
            var values = new Dictionary<string, string> { { "var", "x" }, { "val", "3.0" } };
            var result = PlaceholderReplacer.Replace(template, values);
            Assert.That(result, Is.EqualTo("float x = 3.0;"));
        }

        [Test]
        public void Replace_ShouldPreserveMultilineAndIndentation()
        {
            var template = @"void fragment() {
    float {var} = {val};
}";
            var values = new Dictionary<string, string> { { "var", "y" }, { "val", "1.0" } };
            var result = PlaceholderReplacer.Replace(template, values);
            var expected = @"void fragment() {
    float y = 1.0;
}";
            Assert.That(expected, Is.EqualTo(result));
        }

        [Test]
        public void Replace_ShouldThrowIfPlaceholderMissing()
        {
            var template = "float {var} = {val};";
            var values = new Dictionary<string, string> { { "var", "x" } };
            Assert.Throws<ArgumentException>(() => PlaceholderReplacer.Replace(template, values));
        }
    }
}