// Utilities for preparing Three.js shaders from generated GLSL
// - Extracts uniform initializers from shader code
// - Sanitizes uniform declarations to be WebGL-compliant (no initializers)
// - Provides helpers to build default vertex shader and uniforms map

export type ParsedUniform = {
  name: string;
  type: string; // e.g., float, vec2, vec3, vec4
  value: number | number[];
};

export type ParsedShader = {
  fragment: string;
  uniforms: ParsedUniform[];
  samplerUniforms: string[];
};

// Match lines like: "uniform vec4 color_3 = vec4(1.0, 0.0, 0.0, 1.0);"
const UNIFORM_INIT_RE = /(^|\n)\s*uniform\s+(?<type>float|vec2|vec3|vec4)\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<init>[^;]+);/g;

function parseInitToValue(type: string, init: string): number | number[] {
  const t = type.trim();
  const src = init.trim();
  if (t === "float") {
    const n = Number(src);
    if (Number.isFinite(n)) return n;
    // handle float() wrapper or expressions like 1.0
    const m = src.match(/^float\((.+)\)$/);
    if (m) {
      const n2 = Number(m[1]);
      if (Number.isFinite(n2)) return n2;
    }
    // Fallback: attempt to parse first number in expression
    const mNum = src.match(/-?\d+(?:\.\d+)?/);
    return mNum ? Number(mNum[0]) : 0;
  }
  const vecMatch = src.match(/^vec(2|3|4)\((.*)\)$/);
  if (vecMatch) {
    const inner = vecMatch[2];
    const parts = inner.split(",").map((s) => Number(s.trim()));
    return parts.filter((x) => Number.isFinite(x));
  }
  // Fallback: split by comma
  const parts = src.split(",").map((s) => Number(s.trim()));
  return parts.filter((x) => Number.isFinite(x));
}

export function parseUniformsAndSanitize(fragmentSource: string): ParsedShader {
  const uniforms: ParsedUniform[] = [];
  let out = fragmentSource;
  out = out.replaceAll(UNIFORM_INIT_RE, (_m, p1, _p2, _p3, _p4, _p5, _p6, groups?: any) => {
    const type = String(groups?.type ?? "float");
    const name = String(groups?.name ?? "");
    const init = String(groups?.init ?? "0.0");
    const value = parseInitToValue(type, init);
    uniforms.push({ name, type, value });
    const leading = typeof p1 === "string" ? p1 : "\n";
    return `${leading}uniform ${type} ${name};`;
  });
  const samplerUniforms = Array.from(
    new Set(
      [...out.matchAll(/uniform\s+sampler2D\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)].map((m) => m[1])
    )
  );
  return { fragment: out, uniforms, samplerUniforms };
}

export function defaultVertexShader(): string {
  return `
precision highp float;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
void main() {
  vUv = uv;
  // normal in view space
  vNormal = normalize(normalMatrix * normal);
  // view position (camera space)
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}`.trim();
}

// Convert parsed uniforms to Three.js compatible uniforms map without importing three types here
export function toThreeUniforms(parsed: ParsedUniform[]): Record<string, { value: any }> {
  const map: Record<string, { value: any }> = {};
  for (const u of parsed) {
    if (u.type === "float") {
      map[u.name] = { value: typeof u.value === "number" ? u.value : Number((u.value as number[])[0] ?? 0) };
      continue;
    }
    const arr = Array.isArray(u.value) ? u.value : [Number(u.value)];
    map[u.name] = { value: arr.slice() };
  }
  return map;
}
