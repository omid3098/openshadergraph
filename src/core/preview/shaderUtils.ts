/**
 * Extract uniform declarations from a GLSL fragment shader and strip them from
 * the source.
 *
 * Uniforms may optionally provide an initializer e.g.
 * `uniform vec3 uColor = vec3(1.0, 0.0, 0.0);`
 * The function returns a map of uniforms with their parsed default values and
 * the fragment source without the uniform declarations so it can be supplied to
 * `THREE.ShaderMaterial`.
 */
export function parseUniformsAndSanitize(fragmentSource: string): {
  uniforms: Record<string, { type: string; value: any }>;
  fragment: string;
} {
  const uniforms: Record<string, { type: string; value: any }> = {};
  const uniformRe = /uniform\s+(\w+)\s+(\w+)\s*(=\s*([^;]+))?;/g;
  let match: RegExpExecArray | null;
  let sanitized = fragmentSource;
  while ((match = uniformRe.exec(fragmentSource)) !== null) {
    const [, type, name, , init] = match;
    const value = init ? parseInitializer(type, init.trim()) : defaultValue(type);
    uniforms[name] = { type, value };
    sanitized = sanitized.replace(match[0], "");
  }
  return { uniforms, fragment: sanitized.trim() };
}

// Basic parser for GLSL initializers. Handles numeric and vec* constructors.
function parseInitializer(type: string, init: string): any {
  // Match vec* constructors e.g. vec3(1.0, 0.5, 0.0)
  const vecMatch = init.match(/vec\d?\(([^)]*)\)/i);
  if (vecMatch) {
    return vecMatch[1]
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((v) => Number(v));
  }
  if (type === "bool") return init === "true";
  const num = Number(init);
  return Number.isNaN(num) ? 0 : num;
}

function defaultValue(type: string): any {
  if (type === "bool") return false;
  if (type.startsWith("vec")) {
    const n = Number(type.slice(3));
    return Array.from({ length: n }, () => 0);
  }
  return 0;
}

// Simple passthrough vertex shader used for preview rendering. It forwards the
// vertex position and normal and computes clip space position.
export function defaultVertexShader(): string {
  return /* glsl */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      vPosition = position;
      vNormal = normalMatrix * normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
}

// Convert the parsed uniform map into the structure expected by Three.js
// ShaderMaterial: { uniformName: { value: any } }
export function toThreeUniforms(parsed: Record<string, { type: string; value: any }>): Record<string, { value: any }> {
  const res: Record<string, { value: any }> = {};
  for (const [key, info] of Object.entries(parsed ?? {})) {
    res[key] = { value: info.value };
  }
  return res;
}

