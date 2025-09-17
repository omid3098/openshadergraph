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
const VERTEX_BEGIN_TOKEN = "// __VERTEX_PASS_BEGIN__";
const VERTEX_END_TOKEN = "// __VERTEX_PASS_END__";

function parseInitToValue(type: string, init: string): number | number[] {
  const t = type.trim();
  const src = init.trim();
  if (t === "float") {
    const n = Number(src);
    if (Number.isFinite(n)) return n;
    const m = src.match(/^float\((.+)\)$/);
    if (m) {
      const n2 = Number(m[1]);
      if (Number.isFinite(n2)) return n2;
    }
    const mNum = src.match(/-?\d+(?:\.\d+)?/);
    return mNum ? Number(mNum[0]) : 0;
  }
  const vecMatch = src.match(/^vec(2|3|4)\((.*)\)$/);
  if (vecMatch) {
    const inner = vecMatch[2];
    const parts = inner.split(",").map((s) => Number(s.trim()));
    return parts.filter((x) => Number.isFinite(x));
  }
  const parts = src.split(",").map((s) => Number(s.trim()));
  return parts.filter((x) => Number.isFinite(x));
}

export function extractPreviewShaders(source: string): { fragment: string; vertexChunk: string } {
  const begin = source.indexOf(VERTEX_BEGIN_TOKEN);
  const end = source.indexOf(VERTEX_END_TOKEN);
  if (begin === -1 || end === -1 || end < begin) {
    return { fragment: source, vertexChunk: "" };
  }
  const chunkStart = begin + VERTEX_BEGIN_TOKEN.length;
  const vertexChunk = source.slice(chunkStart, end).replace(/^[\r\n]+|[\r\n]+$/g, "");
  const fragment = `${source.slice(0, begin)}${source.slice(end + VERTEX_END_TOKEN.length)}`;
  return { fragment, vertexChunk };
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

function formatVertexChunk(chunk: string): string {
  if (!chunk) return "";
  return chunk
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const withoutLeading = line.replace(/^[\t ]+/, "");
      return withoutLeading.startsWith("#") ? withoutLeading : `  ${withoutLeading}`;
    })
    .join("\n") + "\n";
}

function buildUniformDeclarations(parsed?: ParsedShader): string {
  const decls: string[] = [];
  // Preview-owned uniforms that may be referenced in vertex pass
  const previewUniforms = [
    { type: "vec3", name: "uKeyDir" },
    { type: "vec3", name: "uKeyColor" },
    { type: "vec3", name: "uFillDir" },
    { type: "vec3", name: "uFillColor" },
    { type: "vec3", name: "uRimDir" },
    { type: "vec3", name: "uRimColor" },
    { type: "vec3", name: "uAmbient" },
    { type: "float", name: "uExposure" },
    { type: "float", name: "uTime" },
  ];
  const seen = new Set<string>();
  for (const u of previewUniforms) {
    if (seen.has(u.name)) continue;
    seen.add(u.name);
    decls.push(`uniform ${u.type} ${u.name};`);
  }
  if (parsed) {
    for (const u of parsed.uniforms ?? []) {
      if (!u?.name || !u?.type) continue;
      if (seen.has(u.name)) continue;
      seen.add(u.name);
      decls.push(`uniform ${u.type} ${u.name};`);
    }
    for (const name of parsed.samplerUniforms ?? []) {
      if (!name || seen.has(name)) continue;
      seen.add(name);
      decls.push(`uniform sampler2D ${name};`);
    }
  }
  return decls.length ? decls.join("\n") + "\n" : "";
}

export function buildPreviewVertexShader(chunk?: string, parsed?: ParsedShader): string {
  const formatted = formatVertexChunk(chunk?.trim() ?? "");
  const uniformDecls = buildUniformDeclarations(parsed);
  return `
precision highp float;
${uniformDecls}varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
void main() {
  vUv = uv;
  vec3 osg_InputPosition = position;
  vec3 osg_InputNormal = normal;
  vec4 osg_InputColor = vec4(1.0);
  vec3 osg_VertexPosition = osg_InputPosition;
  vec3 osg_VertexNormal = osg_InputNormal;
  vec4 osg_VertexColor = osg_InputColor;
#define VERTEX osg_VertexPosition
#define NORMAL osg_VertexNormal
#define COLOR osg_VertexColor
${formatted}#undef COLOR
#undef NORMAL
#undef VERTEX
  vec3 transformedNormal = normalize(normalMatrix * osg_VertexNormal);
  vNormal = transformedNormal;
  vec4 mvPos = modelViewMatrix * vec4(osg_VertexPosition, 1.0);
  vViewPosition = -mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}`.trim();
}

export function defaultVertexShader(chunk?: string, parsed?: ParsedShader): string {
  return buildPreviewVertexShader(chunk, parsed);
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
