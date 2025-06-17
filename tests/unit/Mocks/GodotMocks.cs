using System;
using System.Collections.Generic;

// Mock implementations of Godot types to enable testing without Godot dependencies
namespace Godot
{

    // Mock implementation of Godot's Variant type
    public struct Variant
    {
        private readonly object? _value;

        public enum Type
        {
            Nil,
            Bool,
            Int,
            Float,
            String,
            Vector2,
            Vector3,
            Vector4,
            Object
        }

        public Type VariantType
        {
            get
            {
                return _value switch
                {
                    null => Type.Nil,
                    bool => Type.Bool,
                    int => Type.Int,
                    float => Type.Float,
                    string => Type.String,
                    Vector2 => Type.Vector2,
                    Vector3 => Type.Vector3,
                    Vector4 => Type.Vector4,
                    _ => Type.Object
                };
            }
        }

        public Variant(object? value)
        {
            _value = value;
        }

        public int AsInt32() => _value is int i ? i : 0;
        public float AsSingle() => _value is float f ? f : 0f;
        public string AsString() => _value?.ToString() ?? "";
        public bool AsBool() => _value is bool b && b;
        public Vector2 AsVector2() => _value is Vector2 v ? v : new Vector2(0, 0);
        public Vector3 AsVector3() => _value is Vector3 v ? v : new Vector3(0, 0, 0);
        public Vector4 AsVector4() => _value is Vector4 v ? v : new Vector4(0, 0, 0, 0);
        public object? AsGodotObject() => _value;

        public static implicit operator Variant(int value) => new(value);
        public static implicit operator Variant(float value) => new(value);
        public static implicit operator Variant(string value) => new(value);
        public static implicit operator Variant(bool value) => new(value);
        public static implicit operator Variant(Vector2 value) => new(value);
        public static implicit operator Variant(Vector3 value) => new(value);
        public static implicit operator Variant(Vector4 value) => new(value);
        public static implicit operator Variant(Color value) => new(value);

        public override bool Equals(object? obj) => obj is Variant other && Equals(_value, other._value);
        public override int GetHashCode() => _value?.GetHashCode() ?? 0;
    }

    // Mock implementation of Godot's Vector2
    public struct Vector2 : IEquatable<Vector2>
    {
        public float X { get; set; }
        public float Y { get; set; }

        public static Vector2 Zero => new Vector2(0, 0);
        public static Vector2 One => new Vector2(1, 1);

        public Vector2(float x, float y)
        {
            X = x;
            Y = y;
        }

        public bool Equals(Vector2 other) => X.Equals(other.X) && Y.Equals(other.Y);
        public override bool Equals(object? obj) => obj is Vector2 other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(X, Y);
        public static bool operator ==(Vector2 left, Vector2 right) => left.Equals(right);
        public static bool operator !=(Vector2 left, Vector2 right) => !left.Equals(right);
        public override string ToString() => $"({X}, {Y})";
    }

    // Mock implementation of Godot's Vector3
    public struct Vector3 : IEquatable<Vector3>
    {
        public float X { get; set; }
        public float Y { get; set; }
        public float Z { get; set; }

        public static Vector3 Zero => new Vector3(0, 0, 0);
        public static Vector3 One => new Vector3(1, 1, 1);

        public Vector3(float x, float y, float z)
        {
            X = x;
            Y = y;
            Z = z;
        }

        public bool Equals(Vector3 other) => X.Equals(other.X) && Y.Equals(other.Y) && Z.Equals(other.Z);
        public override bool Equals(object? obj) => obj is Vector3 other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(X, Y, Z);
        public static bool operator ==(Vector3 left, Vector3 right) => left.Equals(right);
        public static bool operator !=(Vector3 left, Vector3 right) => !left.Equals(right);
        public override string ToString() => $"({X}, {Y}, {Z})";
    }

    // Mock implementation of Godot's Vector4
    public struct Vector4 : IEquatable<Vector4>
    {
        public float X { get; set; }
        public float Y { get; set; }
        public float Z { get; set; }
        public float W { get; set; }

        public static Vector4 Zero => new Vector4(0, 0, 0, 0);
        public static Vector4 One => new Vector4(1, 1, 1, 1);

        public Vector4(float x, float y, float z, float w)
        {
            X = x;
            Y = y;
            Z = z;
            W = w;
        }

        public bool Equals(Vector4 other) => X.Equals(other.X) && Y.Equals(other.Y) && Z.Equals(other.Z) && W.Equals(other.W);
        public override bool Equals(object? obj) => obj is Vector4 other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(X, Y, Z, W);
        public static bool operator ==(Vector4 left, Vector4 right) => left.Equals(right);
        public static bool operator !=(Vector4 left, Vector4 right) => !left.Equals(right);
        public override string ToString() => $"({X}, {Y}, {Z}, {W})";
    }

    // Mock implementation of Godot's Color
    public struct Color : IEquatable<Color>
    {
        public float R { get; set; }
        public float G { get; set; }
        public float B { get; set; }
        public float A { get; set; }

        public static Color Red => new Color(1, 0, 0, 1);
        public static Color Green => new Color(0, 1, 0, 1);
        public static Color Blue => new Color(0, 0, 1, 1);
        public static Color White => new Color(1, 1, 1, 1);
        public static Color Black => new Color(0, 0, 0, 1);

        public Color(float r, float g, float b, float a = 1.0f)
        {
            R = r;
            G = g;
            B = b;
            A = a;
        }

        public bool Equals(Color other) => R.Equals(other.R) && G.Equals(other.G) && B.Equals(other.B) && A.Equals(other.A);
        public override bool Equals(object? obj) => obj is Color other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(R, G, B, A);
        public static bool operator ==(Color left, Color right) => left.Equals(right);
        public static bool operator !=(Color left, Color right) => !left.Equals(right);
        public override string ToString() => $"({R}, {G}, {B}, {A})";
    }

    // Mock base classes for Godot nodes
    public class RefCounted { }
    public class Node
    {
        public virtual void Cleanup() { }

        // Mock signal functionality
        protected void EmitSignal(StringName signal, params object[] args) { }
        protected void EmitSignal(string signal, params object[] args) { }
    }
    public class Control : Node { }
    public class GraphNode : Control { }
    public class GraphEdit : Control { }
    public class PanelContainer : Control { }
    public class TabContainer : Control { }
    public class FileDialog : Control { }
    public class PopupMenu : Control { }
    public class Button : Control { }
    public class HBoxContainer : Control { }

    // Mock StringName
    public struct StringName
    {
        private readonly string _value;
        public StringName(string value) => _value = value;
        public static implicit operator StringName(string value) => new(value);
        public override string ToString() => _value ?? "";
    }

    // Mock SignalName class for signal names
    public static class SignalName
    {
        public static StringName GraphCreated => "graph_created";
        public static StringName GraphSelected => "graph_selected";
        public static StringName GraphDeleted => "graph_deleted";
    }

    // Mock Signal attribute
    [AttributeUsage(AttributeTargets.Delegate | AttributeTargets.Event)]
    public class SignalAttribute : Attribute { }

    // Mock GD class for logging
    public static class GD
    {
        public static void Print(object message) => Console.WriteLine(message);
        public static void PrintErr(object message) => Console.Error.WriteLine(message);
        public static void PushWarning(object message) => Console.WriteLine($"WARNING: {message}");
    }
}