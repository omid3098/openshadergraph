using NUnit.Framework;
using OpenShaderGraph.Core.View.Utils;
using System.Reflection;

namespace OpenShaderGraph.Tests.Core.View.Utils
{
    [ShaderCode("Foo.yaml")]
    public class DummyNodeForAttributeTest { }


    [TestFixture]
    public class ShaderCodeAttributeTests
    {
        [Test]
        public void ShaderCodeAttribute_ShouldStoreTemplateFileName()
        {
            // Arrange
            var type = typeof(DummyNodeForAttributeTest);

            // Act
            var attribute = type.GetCustomAttribute<ShaderCodeAttribute>();

            // Assert
            Assert.IsNotNull(attribute, "ShaderCodeAttribute should be found on DummyNodeForAttributeTest");
            Assert.AreEqual("Foo.yaml", attribute.TemplateFile, "The TemplateFile property should match the value passed to the attribute.");
        }
    }
}