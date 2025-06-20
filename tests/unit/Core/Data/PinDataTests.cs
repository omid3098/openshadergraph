using NUnit.Framework;
using Godot;
using OpenShaderGraph.Core.Data;
using System.Collections.Generic;

namespace OpenShaderGraph.Tests.Core.Data
{
    [TestFixture]
    public class PinDataTests
    {
        private PinData _testPin = null!;

        [SetUp]
        public void SetUp()
        {
            _testPin = new PinData("test_pin", PinDataType.Float, DirectionType.Input, new Variant(5.0f));
        }

        [TearDown]
        public void TearDown()
        {
            _testPin = null!;
        }

        #region Basic Creation Tests
        [Test]
        public void Constructor_ValidParameters_CreatesPin()
        {
            var pin = new PinData("input", PinDataType.Float, DirectionType.Input, new Variant(1.0f));
            Assert.That(pin.GetName(), Is.EqualTo("input"));
            Assert.That(pin.GetDataType(), Is.EqualTo(PinDataType.Float));
            Assert.That(pin.GetDirection(), Is.EqualTo(DirectionType.Input));
            Assert.That(pin.GetValue().AsSingle(), Is.EqualTo(1.0f));
        }

        [Test]
        public void Constructor_OutputPin_CreatesCorrectly()
        {
            var pin = new PinData("output", PinDataType.Vector3, DirectionType.Output, new Variant(Vector3.Zero));
            Assert.That(pin.GetDirection(), Is.EqualTo(DirectionType.Output));
            Assert.That(pin.GetDataType(), Is.EqualTo(PinDataType.Vector3));
        }
        #endregion

        #region Setter Tests
        [Test]
        public void SetName_ValidName_UpdatesName()
        {
            _testPin.SetName("new_name");
            Assert.That(_testPin?.GetName(), Is.EqualTo("new_name"));
        }

        [Test]
        public void SetDataType_ValidType_UpdatesDataType()
        {
            _testPin.SetDataType(PinDataType.Vector2);
            Assert.That(_testPin?.GetDataType(), Is.EqualTo(PinDataType.Vector2));
        }

        [Test]
        public void SetDirection_ValidDirection_UpdatesDirection()
        {
            _testPin.SetDirection(DirectionType.Output);
            Assert.That(_testPin?.GetDirection(), Is.EqualTo(DirectionType.Output));
        }

        [Test]
        public void SetValue_ValidValue_UpdatesValue()
        {
            _testPin.SetValue(new Variant(10.0f));
            Assert.That(_testPin?.GetValue().AsSingle(), Is.EqualTo(10.0f));
        }
        #endregion

        #region Value Type Tests
        [Test]
        public void SetValue_IntValue_StoresCorrectly()
        {
            var pin = new PinData("test", PinDataType.Int, DirectionType.Input, new Variant(0));
            pin.SetValue(new Variant(42));
            Assert.That(pin.GetValue().AsInt32(), Is.EqualTo(42));
        }

        [Test]
        public void SetValue_FloatValue_StoresCorrectly()
        {
            var pin = new PinData("test", PinDataType.Float, DirectionType.Input, new Variant(0.0f));
            pin.SetValue(new Variant(3.14f));
            Assert.That(pin.GetValue().AsSingle(), Is.EqualTo(3.14f));
        }

        [Test]
        public void SetValue_BoolValue_StoresCorrectly()
        {
            var pin = new PinData("test", PinDataType.Bool, DirectionType.Input, new Variant(false));
            pin.SetValue(new Variant(true));
            Assert.That(pin.GetValue().AsBool(), Is.EqualTo(true));
        }

        [Test]
        public void SetValue_Vector2Value_StoresCorrectly()
        {
            var pin = new PinData("test", PinDataType.Vector2, DirectionType.Input, new Variant(Vector2.Zero));
            pin.SetValue(new Variant(new Vector2(1, 2)));
            Assert.That(pin.GetValue().AsVector2(), Is.EqualTo(new Vector2(1, 2)));
        }

        [Test]
        public void SetValue_Vector3Value_StoresCorrectly()
        {
            var pin = new PinData("test", PinDataType.Vector3, DirectionType.Input, new Variant(Vector3.Zero));
            pin.SetValue(new Variant(new Vector3(1, 2, 3)));
            Assert.That(pin.GetValue().AsVector3(), Is.EqualTo(new Vector3(1, 2, 3)));
        }

        [Test]
        public void SetValue_Vector4Value_StoresCorrectly()
        {
            var pin = new PinData("test", PinDataType.Vector4, DirectionType.Input, new Variant(Vector4.Zero));
            pin.SetValue(new Variant(new Vector4(1, 2, 3, 4)));
            Assert.That(pin.GetValue().AsVector4(), Is.EqualTo(new Vector4(1, 2, 3, 4)));
        }
        #endregion

        #region Edge Cases
        [Test]
        public void SetValue_NullValue_HandlesGracefully()
        {
            var pin = new PinData("test", PinDataType.Float, DirectionType.Input, new Variant());
            Assert.DoesNotThrow(() => pin.SetValue(new Variant()));
            Assert.That(pin.GetValue().VariantType, Is.EqualTo(Variant.Type.Nil));
        }

        [Test]
        public void SetValue_ZeroValues_StoreCorrectly()
        {
            var intPin = new PinData("int", PinDataType.Int, DirectionType.Input, new Variant(1));
            intPin.SetValue(new Variant(0));
            Assert.That(intPin.GetValue().AsInt32(), Is.EqualTo(0));

            var floatPin = new PinData("float", PinDataType.Float, DirectionType.Input, new Variant(1.0f));
            floatPin.SetValue(new Variant(0.0f));
            Assert.That(floatPin.GetValue().AsSingle(), Is.EqualTo(0.0f));
        }

        [Test]
        public void SetValue_NegativeValues_StoreCorrectly()
        {
            var intPin = new PinData("int", PinDataType.Int, DirectionType.Input, new Variant(1));
            intPin.SetValue(new Variant(-42));
            Assert.That(intPin.GetValue().AsInt32(), Is.EqualTo(-42));

            var floatPin = new PinData("float", PinDataType.Float, DirectionType.Input, new Variant(1.0f));
            floatPin.SetValue(new Variant(-3.14f));
            Assert.That(floatPin.GetValue().AsSingle(), Is.EqualTo(-3.14f));
        }

        [Test]
        public void PinData_MultipleOperations_MaintainConsistency()
        {
            var pin = new PinData("original", PinDataType.Float, DirectionType.Input, new Variant(1.0f));
            pin.SetName("modified");
            pin.SetDataType(PinDataType.Vector2);
            pin.SetDirection(DirectionType.Output);
            pin.SetValue(new Variant(Vector2.One));

            Assert.That(pin.GetName(), Is.EqualTo("modified"));
            Assert.That(pin.GetDataType(), Is.EqualTo(PinDataType.Vector2));
            Assert.That(pin.GetDirection(), Is.EqualTo(DirectionType.Output));
            Assert.That(pin.GetValue().AsVector2(), Is.EqualTo(Vector2.One));
        }

        [Test]
        public void PinData_TypeConversion_HandlesCorrectly()
        {
            var pin = new PinData("test", PinDataType.Float, DirectionType.Input, new Variant(3.14f));
            pin.SetDataType(PinDataType.Int);
            pin.SetValue(new Variant(42));
            Assert.That(pin.GetDataType(), Is.EqualTo(PinDataType.Int));
            Assert.That(pin.GetValue().AsInt32(), Is.EqualTo(42));
        }

        [Test]
        public void PinData_DirectionChange_HandlesCorrectly()
        {
            var pin = new PinData("test", PinDataType.Float, DirectionType.Input, new Variant(1.0f));
            pin.SetDirection(DirectionType.Output);
            Assert.That(pin.GetDirection(), Is.EqualTo(DirectionType.Output));
        }
        #endregion
    }
}