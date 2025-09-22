export const THEME = {
  // Selection highlight color for nodes, edges, etc.
  selectionColor: "#4F46E5", // Indigo-600
  // Node category header band colors
  categoryColors: {
    editor: "#64748B", // Slate-500
    asset: "#F59E0B", // Amber-500
    input: "#10B981", // Emerald-500
    transform: "#3B82F6", // Blue-500
    output: "#8B5CF6", // Violet-500
  } as Record<string, string>,
  // Pin type colors (source edge color later phases)
  pinColors: {
    scalar: "#2563EB", // Blue-600
    unknown: "#6B7280", // Gray-500 (neutral for unknown)
    vec2: "#7C3AED", // Purple-600
    vec3: "#7C3AED",
    vec4: "#7C3AED",
    color: "#DB2777", // Rose-600
    int: "#1E3A8A", // Navy-ish
    bool: "#0D9488", // Teal-600
    mat3: "#6B7280", // Gray-500
    mat4: "#6B7280",
    texture2D: "#EA580C", // Orange-600
    texture3D: "#C2410C", // Deeper orange
    textureCube: "#EA580C",
    sampler: "#92400E", // Brown-ish
    uv: "#7C3AED",
    normal: "#7C3AED",
    position: "#7C3AED",
  } as Record<string, string>,
};

