using System.Collections.Generic;
using Godot;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.View.Utils
{
    public static class PinTypeColors
    {
        private static readonly Dictionary<PinDataType, Color> ColorMap = new()
        {
            { PinDataType.Float, new Color("#4CAF50") },   // Green 500
            { PinDataType.Int, new Color("#F44336") },     // Red 500
            { PinDataType.Vector2, new Color("#2196F3") }, // Blue 500
            { PinDataType.Vector3, new Color("#FF9800") }, // Orange 500
            { PinDataType.Vector4, new Color("#9C27B0") }, // Purple 500
            { PinDataType.Bool, new Color("#E91E63") },    // Pink 500
            { PinDataType.Execution, Colors.White }
        };

        public static Color GetColorForType(PinDataType type)
        {
            return ColorMap.GetValueOrDefault(type, Colors.White);
        }
    }
}