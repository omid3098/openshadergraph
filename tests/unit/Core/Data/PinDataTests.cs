using NUnit.Framework;
using Godot;
using OpenShaderGraph.Core.Data;
using static OpenShaderGraph.Core.Data.PinType;
using System.Collections.Generic;

namespace OpenShaderGraph.Tests.Core.Data
{
    [TestFixture]
    public class PinDataTests
    {
        private PinData _testPin;

        [SetUp]
        public void SetUp()
        {
            _testPin = new PinData("test_pin", "float", PinType.Input, new Variant(5.0f));
        }

        [TearDown]
        public void TearDown()
        {
            _testPin = null;
        }

        #region Basic Creation Tests
        [Test]
        public void Constructor_ValidParameters_CreatesPin()
        {
            // Arrange & Act
            var pin = new PinData("input", "float", PinType.Input, new Variant(1.0f));

            // Assert
            Assert.That(pin.GetName(), Is.EqualTo("input"));
            Assert.That(pin.GetDataType(), Is.EqualTo("float"));
            Assert.That(pin.GetDirection(), Is.EqualTo(PinType.Input));
            Assert.That(pin.GetValue().AsSingle(), Is.EqualTo(1.0f));
        }

        [Test]
        public void Constructor_OutputPin_CreatesCorrectly()
        {
            // Arrange & Act
            var pin = new PinData("output", "vector3", PinType.Output, new Variant(Vector3.Zero));

            // Assert
            Assert.That(pin.GetDirection(), Is.EqualTo(PinType.Output));
            Assert.That(pin.GetDataType(), Is.EqualTo("vector3"));
        }
        #endregion

        #region Setter Tests
        [Test]
        public void SetName_ValidName_UpdatesName()
        {
            // Act
            _testPin.SetName("new_name");

            // Assert
            Assert.That(_testPin.GetName(), Is.EqualTo("new_name"));
        }

        [Test]
        public void SetDataType_ValidType_UpdatesDataType()
        {
            // Act
            _testPin.SetDataType("vector2");

            // Assert
            Assert.That(_testPin.GetDataType(), Is.EqualTo("vector2"));
        }

        [Test]
        public void SetDirection_ValidDirection_UpdatesDirection()
        {
            // Act
            _testPin.SetDirection(PinType.Output);

            // Assert
            Assert.That(_testPin.GetDirection(), Is.EqualTo(PinType.Output));
        }

        [Test]
        public void SetValue_ValidValue_UpdatesValue()
        {
            // Act
            _testPin.SetValue(new Variant(10.0f));

            // Assert
            Assert.That(_testPin.GetValue().AsSingle(), Is.EqualTo(10.0f));
        }
        #endregion

        #region Value Type Tests
        [Test]
        public void SetValue_IntValue_StoresCorrectly()
        {
            // Arrange
            var pin = new PinData("test", "int", PinType.Input, new Variant(0));

            // Act
            pin.SetValue(new Variant(42));

            // Assert
            Assert.That(pin.GetValue().AsInt32(), Is.EqualTo(42));
        }

        [Test]
        public void SetValue_FloatValue_StoresCorrectly()
        {
            // Arrange
            var pin = new PinData("test", "float", PinType.Input, new Variant(0.0f));

            // Act
            pin.SetValue(new Variant(3.14f));

            // Assert
            Assert.That(pin.GetValue().AsSingle(), Is.EqualTo(3.14f));
        }

        [Test]
        public void SetValue_StringValue_StoresCorrectly()
        {
            // Arrange
            var pin = new PinData("test", "string", PinType.Input, new Variant(""));

            // Act
            pin.SetValue(new Variant("hello"));

            // Assert
            Assert.That(pin.GetValue().AsString(), Is.EqualTo("hello"));
        }

        [Test]
        public void SetValue_BoolValue_StoresCorrectly()
        {
            // Arrange
            var pin = new PinData("test", "bool", PinType.Input, new Variant(false));

            // Act
            pin.SetValue(new Variant(true));

            // Assert
            Assert.That(pin.GetValue().AsBool(), Is.EqualTo(true));
        }

        [Test]
        public void SetValue_Vector2Value_StoresCorrectly()
        {
            // Arrange
            var pin = new PinData("test", "vector2", PinType.Input, new Variant(Vector2.Zero));

            // Act
            pin.SetValue(new Variant(new Vector2(1, 2)));

            // Assert
            Assert.That(pin.GetValue().AsVector2(), Is.EqualTo(new Vector2(1, 2)));
        }

        [Test]
        public void SetValue_Vector3Value_StoresCorrectly()
        {
            // Arrange
            var pin = new PinData("test", "vector3", PinType.Input, new Variant(Vector3.Zero));

            // Act
            pin.SetValue(new Variant(new Vector3(1, 2, 3)));

            // Assert
            Assert.That(pin.GetValue().AsVector3(), Is.EqualTo(new Vector3(1, 2, 3)));
        }

        [Test]
        public void SetValue_Vector4Value_StoresCorrectly()
        {
            // Arrange
            var pin = new PinData("test", "vector4", PinType.Input, new Variant(Vector4.Zero));

            // Act
            pin.SetValue(new Variant(new Vector4(1, 2, 3, 4)));

            // Assert
            Assert.That(pin.GetValue().AsVector4(), Is.EqualTo(new Vector4(1, 2, 3, 4)));
        }

        [Test]
        public void SetValue_ColorValue_StoresCorrectly()
        {
            // Arrange
            var pin = new PinData("test", "color", PinType.Input, new Variant(Color.White));

            // Act
            pin.SetValue(new Variant(Color.Red));

            // Assert
            Assert.That(pin.GetValue().AsGodotObject(), Is.EqualTo(Color.Red));
        }
        #endregion

        #region Edge Cases
        [Test]
        public void SetValue_NullValue_HandlesGracefully()
        {
            // Arrange
            var pin = new PinData("test", "variant", PinType.Input, new Variant());

            // Act & Assert
            Assert.That(() => pin.SetValue(new Variant()), Throws.Nothing);
            Assert.That(pin.GetValue().VariantType, Is.EqualTo(Variant.Type.Nil));
        }

        [Test]
        public void SetValue_EmptyString_StoresCorrectly()
        {
            // Arrange
            var pin = new PinData("test", "string", PinType.Input, new Variant("test"));

            // Act
            pin.SetValue(new Variant(""));

            // Assert
            Assert.That(pin.GetValue().AsString(), Is.EqualTo(""));
        }

        [Test]
        public void SetValue_ZeroValues_StoreCorrectly()
        {
            // Test zero int
            var intPin = new PinData("int", "int", PinType.Input, new Variant(1));
            intPin.SetValue(new Variant(0));
            Assert.That(intPin.GetValue().AsInt32(), Is.EqualTo(0));

            // Test zero float
            var floatPin = new PinData("float", "float", PinType.Input, new Variant(1.0f));
            floatPin.SetValue(new Variant(0.0f));
            Assert.That(floatPin.GetValue().AsSingle(), Is.EqualTo(0.0f));
        }

        [Test]
        public void SetValue_NegativeValues_StoreCorrectly()
        {
            // Test negative int
            var intPin = new PinData("int", "int", PinType.Input, new Variant(1));
            intPin.SetValue(new Variant(-42));
            Assert.That(intPin.GetValue().AsInt32(), Is.EqualTo(-42));

            // Test negative float
            var floatPin = new PinData("float", "float", PinType.Input, new Variant(1.0f));
            floatPin.SetValue(new Variant(-3.14f));
            Assert.That(floatPin.GetValue().AsSingle(), Is.EqualTo(-3.14f));
        }

        [Test]
        public void SetValue_LargeValues_StoreCorrectly()
        {
            // Test large int
            var intPin = new PinData("int", "int", PinType.Input, new Variant(0));
            intPin.SetValue(new Variant(int.MaxValue));
            Assert.That(intPin.GetValue().AsInt32(), Is.EqualTo(int.MaxValue));

            // Test large float
            var floatPin = new PinData("float", "float", PinType.Input, new Variant(0.0f));
            floatPin.SetValue(new Variant(float.MaxValue));
            Assert.That(floatPin.GetValue().AsSingle(), Is.EqualTo(float.MaxValue));
        }

        [Test]
        public void SetValue_SpecialFloatValues_StoreCorrectly()
        {
            var pin = new PinData("float", "float", PinType.Input, new Variant(0.0f));

            // Test infinity
            pin.SetValue(new Variant(float.PositiveInfinity));
            Assert.That(pin.GetValue().AsSingle(), Is.EqualTo(float.PositiveInfinity));

            // Test negative infinity
            pin.SetValue(new Variant(float.NegativeInfinity));
            Assert.That(pin.GetValue().AsSingle(), Is.EqualTo(float.NegativeInfinity));

            // Test NaN
            pin.SetValue(new Variant(float.NaN));
            Assert.That(float.IsNaN(pin.GetValue().AsSingle()), Is.True);
        }

        [Test]
        public void SetValue_LongStrings_StoreCorrectly()
        {
            var pin = new PinData("string", "string", PinType.Input, new Variant(""));
            var longString = new string('a', 10000);

            pin.SetValue(new Variant(longString));
            Assert.That(pin.GetValue().AsString(), Is.EqualTo(longString));
        }

        [Test]
        public void SetValue_UnicodeStrings_StoreCorrectly()
        {
            var pin = new PinData("string", "string", PinType.Input, new Variant(""));
            var unicodeString = "Hello 世界 🌍 مرحبا";

            pin.SetValue(new Variant(unicodeString));
            Assert.That(pin.GetValue().AsString(), Is.EqualTo(unicodeString));
        }
        #endregion

        #region Immutability Tests
        [Test]
        public void PinData_DefaultValues_RemainConstant()
        {
            // Arrange
            var pin = new PinData("test", "float", PinType.Input, new Variant(5.0f));

            // Act - Get initial values
            var initialName = pin.GetName();
            var initialType = pin.GetDataType();
            var initialDirection = pin.GetDirection();
            var initialValue = pin.GetValue();

            // Assert - Values should remain unchanged unless explicitly set
            Assert.That(pin.GetName(), Is.EqualTo(initialName));
            Assert.That(pin.GetDataType(), Is.EqualTo(initialType));
            Assert.That(pin.GetDirection(), Is.EqualTo(initialDirection));
            Assert.That(pin.GetValue(), Is.EqualTo(initialValue));
        }

        [Test]
        public void PinData_MultipleOperations_MaintainConsistency()
        {
            // Arrange
            var pin = new PinData("original", "float", PinType.Input, new Variant(1.0f));

            // Act - Perform multiple operations
            pin.SetName("modified");
            pin.SetDataType("vector2");
            pin.SetDirection(PinType.Output);
            pin.SetValue(new Variant(Vector2.One));

            // Assert - All changes should be reflected
            Assert.That(pin.GetName(), Is.EqualTo("modified"));
            Assert.That(pin.GetDataType(), Is.EqualTo("vector2"));
            Assert.That(pin.GetDirection(), Is.EqualTo(PinType.Output));
            Assert.That(pin.GetValue().AsVector2(), Is.EqualTo(Vector2.One));
        }
        #endregion

        #region Type Conversion Tests
        [Test]
        public void PinData_TypeConversion_HandlesCorrectly()
        {
            // Test changing from float to int
            var pin = new PinData("test", "float", PinType.Input, new Variant(3.14f));
            pin.SetDataType("int");
            pin.SetValue(new Variant(42));

            Assert.That(pin.GetDataType(), Is.EqualTo("int"));
            Assert.That(pin.GetValue().AsInt32(), Is.EqualTo(42));
        }

        [Test]
        public void PinData_DirectionChange_HandlesCorrectly()
        {
            // Test changing from input to output
            var pin = new PinData("test", "float", PinType.Input, new Variant(1.0f));
            pin.SetDirection(PinType.Output);

            Assert.That(pin.GetDirection(), Is.EqualTo(PinType.Output));
        }
        #endregion

        #region Output Pin Tests
        [Test]
        public void OutputPin_FloatValue_StoresCorrectly()
        {
            // Arrange & Act
            var pin = new PinData("output", "float", PinType.Output, new Variant(1.5f));

            // Assert
            Assert.That(pin.GetValue().AsSingle(), Is.EqualTo(1.5f));
        }

        [Test]
        public void OutputPin_Vector3Value_StoresCorrectly()
        {
            // Arrange & Act
            var pin = new PinData("output", "vector3", PinType.Output, new Variant(new Vector3(1, 2, 3)));

            // Assert
            Assert.That(pin.GetValue().AsVector3(), Is.EqualTo(new Vector3(1, 2, 3)));
        }
        #endregion

        #region Numeric String Tests
        [Test]
        public void Name_NumericString_AcceptsCorrectly()
        {
            // Arrange & Act
            var pin = new PinData("123", "float", PinType.Input, new Variant(1.0f));

            // Assert
            Assert.That(pin.GetName(), Is.EqualTo("123"));
        }

        [Test]
        public void DataType_NumericString_AcceptsCorrectly()
        {
            // Arrange & Act
            var pin = new PinData("test", "456", PinType.Input, new Variant(1.0f));

            // Assert
            Assert.That(pin.GetDataType(), Is.EqualTo("456"));
        }
        #endregion
    }
}