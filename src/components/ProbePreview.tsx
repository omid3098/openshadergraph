import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  extractPreviewShaders,
  parseUniformsAndSanitize,
  toThreeUniforms,
  defaultVertexShader,
} from "@/core/preview/shaderUtils";
import { buildProbeGraph } from "@/core/preview/probeGraph";
import {
  collectTextureUniforms,
  collectSamplerSettings,
  cloneTextureForUniform,
  type SamplerPreviewSettings,
} from "@/core/preview/graphAssets";
import { observeElementSize } from "./preview/resizeObserver";
import * as THREE from "three";

const reasonMessages: Record<string, string> = {
  "graph-empty": "Graph data unavailable.",
  "probe-missing": "Probe node not found in graph.",
  "input-missing": "Connect a value to preview it.",
  "surface-missing": "Surface container missing for probe.",
  "fragment-pass-missing": "Fragment pass missing for probe.",
  "source-missing": "Source node for preview is missing.",
  "cross-pass": "Preview only supports values within the same fragment pass.",
};

function stableHash(value: unknown): string {
  const stableStringify = (v: any): string => {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map((item) => stableStringify(item)).join(",")}]`;
    const keys = Object.keys(v).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(v[key])}`).join(",")}}`;
  };
  try {
    const s = stableStringify(value);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  } catch {
    return String(Date.now());
  }
}

function disposeMaterial(material: any, preserve?: Set<any>) {
  if (!material) return;
  try {
    const uniforms = material.uniforms ?? {};
    for (const key of Object.keys(uniforms)) {
      const val = uniforms[key]?.value;
      if (
        val &&
        typeof val === "object" &&
        (val as any).isTexture &&
        typeof val.dispose === "function" &&
        (!preserve || !preserve.has(val))
      ) {
        (val as any).dispose();
      }
    }
  } finally {
    material.dispose?.();
  }
}

function formatReason(reason: string): string {
  return reasonMessages[reason] ?? "Preview unavailable.";
}

type ProbePreviewProps = {
  nodeId: string;
  graph: unknown;
  className?: string;
  pinId?: number;
};

export function ProbePreview({ nodeId, graph, className, pinId = 0 }: ProbePreviewProps) {
  const probeIdNum = Number(nodeId);
  const probeGraph = useMemo(() => {
    if (!Number.isFinite(probeIdNum)) return { kind: "idle", reason: "probe-missing" } as const;
    return buildProbeGraph(graph as any, probeIdNum, { pinId });
  }, [graph, probeIdNum, pinId]);

  const compileGraph = probeGraph.kind === "ready" ? probeGraph.graph : null;
  const graphHash = useMemo(() => (compileGraph ? stableHash(compileGraph) : ""), [compileGraph]);
  const textureAssignments = useMemo(
    () => (compileGraph ? collectTextureUniforms(compileGraph) : new Map<string, string>()),
    [compileGraph]
  );
  const samplerSettings = useMemo(
    () => (compileGraph ? collectSamplerSettings(compileGraph) : new Map<string, SamplerPreviewSettings>()),
    [compileGraph]
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const threeRef = useRef<{ renderer: any; scene: any; camera: any; mesh: any } | null>(null);
  const materialRef = useRef<any | null>(null);
  const geometryRef = useRef<any | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const samplerFallbackRef = useRef<{ sampler2D?: any; samplerCube?: any; sampler3D?: any; sampler2DArray?: any }>({});
  const textureCacheRef = useRef<Map<string, any>>(new Map());
  const pendingTextureLoadsRef = useRef<Set<string>>(new Set());

  const [status, setStatus] = useState<"idle" | "compiling" | "ready" | "error">("idle");
  const [compileError, setCompileError] = useState<string | null>(null);
  const [fragCode, setFragCode] = useState<string>("");
  const [vertexChunk, setVertexChunk] = useState<string>("");

  const ensureSamplerFallback = useCallback((samplerType: string): any => {
    const store = samplerFallbackRef.current;
    if (samplerType === "samplerCube") {
      if (!store.samplerCube) {
        const data = new Uint8Array([255, 255, 255, 255]);
        const image = { data, width: 1, height: 1 };
        const cube = new (THREE as any).CubeTexture([image, image, image, image, image, image]);
        cube.name = "ProbeFallbackCubeTexture";
        cube.colorSpace = (THREE as any).SRGBColorSpace;
        cube.magFilter = (THREE as any).LinearFilter;
        cube.minFilter = (THREE as any).LinearFilter;
        cube.generateMipmaps = false;
        cube.needsUpdate = true;
        store.samplerCube = cube;
      }
      return store.samplerCube;
    }
    if (samplerType === "sampler3D") {
      if (!store.sampler3D) {
        const data = new Uint8Array([255, 255, 255, 255]);
        const tex = new (THREE as any).DataTexture3D(data, 1, 1, 1);
        tex.name = "ProbeFallbackTexture3D";
        tex.format = (THREE as any).RGBAFormat;
        tex.type = (THREE as any).UnsignedByteType;
        tex.colorSpace = (THREE as any).SRGBColorSpace;
        tex.wrapS = (THREE as any).ClampToEdgeWrapping;
        tex.wrapT = (THREE as any).ClampToEdgeWrapping;
        tex.wrapR = (THREE as any).ClampToEdgeWrapping;
        tex.magFilter = (THREE as any).LinearFilter;
        tex.minFilter = (THREE as any).LinearFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        store.sampler3D = tex;
      }
      return store.sampler3D;
    }
    if (samplerType === "sampler2DArray") {
      if (!store.sampler2DArray) {
        const data = new Uint8Array([255, 255, 255, 255]);
        const tex = new (THREE as any).DataTexture2DArray(data, 1, 1, 1);
        tex.name = "ProbeFallbackTextureArray";
        tex.format = (THREE as any).RGBAFormat;
        tex.type = (THREE as any).UnsignedByteType;
        tex.colorSpace = (THREE as any).SRGBColorSpace;
        tex.wrapS = (THREE as any).ClampToEdgeWrapping;
        tex.wrapT = (THREE as any).ClampToEdgeWrapping;
        tex.wrapR = (THREE as any).ClampToEdgeWrapping;
        tex.magFilter = (THREE as any).LinearFilter;
        tex.minFilter = (THREE as any).LinearMipmapLinearFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        store.sampler2DArray = tex;
      }
      return store.sampler2DArray;
    }
    if (!store.sampler2D) {
      const data = new Uint8Array([255, 255, 255, 255]);
      const tex = new (THREE as any).DataTexture(data, 1, 1, (THREE as any).RGBAFormat, (THREE as any).UnsignedByteType);
      tex.name = "ProbeFallbackTexture";
      tex.colorSpace = (THREE as any).SRGBColorSpace;
      tex.magFilter = (THREE as any).LinearFilter;
      tex.minFilter = (THREE as any).LinearMipmapLinearFilter;
      tex.generateMipmaps = false;
      tex.wrapS = (THREE as any).ClampToEdgeWrapping;
      tex.wrapT = (THREE as any).ClampToEdgeWrapping;
      tex.needsUpdate = true;
      tex.flipY = false;
      store.sampler2D = tex;
    }
    return store.sampler2D;
  }, []);

  useEffect(() => {
    if (!compileGraph) {
      setStatus("idle");
      setCompileError(null);
      setFragCode("");
      setVertexChunk("");
      return;
    }
    let cancelled = false;
    const abort = new AbortController();
    setStatus("compiling");
    setCompileError(null);
    (async () => {
      try {
        const res = await fetch("/api/compile", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-graph-hash": graphHash },
          signal: abort.signal,
          body: JSON.stringify({ graph: compileGraph, language: "ThreeJS_GLSL", engine: "preview" }),
        });
        if (!res.ok) throw new Error(`Compile failed: ${res.status}`);
        const data = await res.json();
        const code: string = String(data.code ?? "");
        if (cancelled) return;
        const { fragment, vertexChunk: chunk } = extractPreviewShaders(code);
        if (process.env.NODE_ENV !== "production") {
          console.debug("[probe-preview] fragment", fragment);
        }
        setFragCode(fragment);
        setVertexChunk(chunk);
        setStatus("ready");
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "AbortError") return;
        setCompileError(typeof err?.message === "string" ? err.message : "Compile failed");
        setFragCode("");
        setVertexChunk("");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [compileGraph, graphHash]);

  const updateRendererSize = useCallback(() => {
    const three = threeRef.current;
    const container = containerRef.current;
    if (!three || !container) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    three.renderer.setSize(width, height, false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const renderer = new (THREE as any).WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min((window as any).devicePixelRatio ?? 1, 2));
    renderer.setSize(1, 1, false);
    renderer.outputColorSpace = (THREE as any).SRGBColorSpace;
    renderer.toneMapping = (THREE as any).ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new (THREE as any).Scene();
    const camera = new (THREE as any).OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1.0;

    const geometry = new (THREE as any).PlaneGeometry(2, 2);
    geometryRef.current = geometry;
    const fallbackMat = new (THREE as any).ShaderMaterial({
      vertexShader: defaultVertexShader(),
      fragmentShader: "void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }",
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    materialRef.current = fallbackMat;
    const mesh = new (THREE as any).Mesh(geometry, fallbackMat);
    mesh.frustumCulled = false;
    scene.add(mesh);

    threeRef.current = { renderer, scene, camera, mesh };
    updateRendererSize();

    const render = (now: number) => {
      rafRef.current = window.requestAnimationFrame(render);
      if (startTimeRef.current == null) startTimeRef.current = now;
      const seconds = (now - startTimeRef.current) / 1000;
      const material = materialRef.current;
      if (material?.uniforms?.uTime) {
        material.uniforms.uTime.value = seconds;
      }
      renderer.render(scene, camera);
    };
    rafRef.current = window.requestAnimationFrame(render);

    const cleanup = observeElementSize(container, updateRendererSize);

    return () => {
      if (cleanup) cleanup();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (geometryRef.current) {
        geometryRef.current.dispose?.();
        geometryRef.current = null;
      }
      if (materialRef.current) {
        disposeMaterial(materialRef.current);
        materialRef.current = null;
      }
      renderer.dispose();
      threeRef.current = null;
    };
  }, [updateRendererSize]);

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    if (!fragCode) return;
    const parsed = parseUniformsAndSanitize(fragCode);
    const uniformsRaw = toThreeUniforms(parsed.uniforms);
    const uniforms: Record<string, { value: any }> = {};
    for (const [key, u] of Object.entries(uniformsRaw)) {
      const val = (u as any).value;
      if (Array.isArray(val)) {
        if (val.length === 2) uniforms[key] = { value: new (THREE as any).Vector2(val[0], val[1]) };
        else if (val.length === 3) uniforms[key] = { value: new (THREE as any).Vector3(val[0], val[1], val[2]) };
        else if (val.length === 4) uniforms[key] = { value: new (THREE as any).Vector4(val[0], val[1], val[2], val[3]) };
        else uniforms[key] = { value: val.slice() };
      } else {
        uniforms[key] = { value: val };
      }
    }

    const missingTextures: Array<{ name: string; url: string; type: string }> = [];
    if (parsed.samplers.length) {
      for (const sampler of parsed.samplers) {
        const name = sampler.name;
        const type = sampler.type;
        if (!name || !type) continue;
        const assetUrl = textureAssignments.get(name);
        const fallbackTexture = ensureSamplerFallback(type);
        if (assetUrl) {
          const cached = textureCacheRef.current.get(assetUrl);
          if (cached) {
            uniforms[name] = { value: cloneTextureForUniform(THREE, cached, samplerSettings.get(name)) };
          } else {
            uniforms[name] = { value: fallbackTexture };
            if (type === "sampler2D" && !pendingTextureLoadsRef.current.has(assetUrl)) {
              missingTextures.push({ name, url: assetUrl, type });
            }
          }
        } else {
          const current = uniforms[name];
          if (!current || current.value == null) uniforms[name] = { value: fallbackTexture };
        }
      }
    }

    const cam = three.camera;
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const view = cam.matrixWorldInverse;
    const keyDir = new (THREE as any).Vector3(-0.35, 0.8, 0.6).normalize().applyMatrix3(new (THREE as any).Matrix3().setFromMatrix4(view));
    const fillDir = new (THREE as any).Vector3(0.6, 0.2, 0.2).normalize().applyMatrix3(new (THREE as any).Matrix3().setFromMatrix4(view));
    const rimDir = new (THREE as any).Vector3(-0.2, 0.3, -0.9).normalize().applyMatrix3(new (THREE as any).Matrix3().setFromMatrix4(view));
    if (!uniforms.uKeyDir) uniforms.uKeyDir = { value: new (THREE as any).Vector3(keyDir.x, keyDir.y, keyDir.z) };
    if (!uniforms.uFillDir) uniforms.uFillDir = { value: new (THREE as any).Vector3(fillDir.x, fillDir.y, fillDir.z) };
    if (!uniforms.uRimDir) uniforms.uRimDir = { value: new (THREE as any).Vector3(rimDir.x, rimDir.y, rimDir.z) };
    if (!uniforms.uKeyColor) uniforms.uKeyColor = { value: new (THREE as any).Vector3(1.0, 1.0, 1.0) };
    if (!uniforms.uFillColor) uniforms.uFillColor = { value: new (THREE as any).Vector3(0.6, 0.6, 0.6) };
    if (!uniforms.uRimColor) uniforms.uRimColor = { value: new (THREE as any).Vector3(0.8, 0.8, 0.8) };
    if (!uniforms.uAmbient) uniforms.uAmbient = { value: new (THREE as any).Vector3(0.0, 0.0, 0.0) };
    if (!uniforms.uExposure) uniforms.uExposure = { value: 1.0 };
    if (!uniforms.uTime) uniforms.uTime = { value: 0 };

    const material = new (THREE as any).ShaderMaterial({
      vertexShader: defaultVertexShader(vertexChunk, parsed),
      fragmentShader: parsed.fragment,
      uniforms,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
      side: (THREE as any).DoubleSide,
    });

    if (materialRef.current) {
      const fallbackValues = Object.values(samplerFallbackRef.current ?? {}).filter(Boolean);
      const preserve = fallbackValues.length ? new Set(fallbackValues) : undefined;
      disposeMaterial(materialRef.current, preserve);
    }
    materialRef.current = material;
    startTimeRef.current = null;
    if (three.mesh) three.mesh.material = material;

    if (missingTextures.length) {
      const loader = new (THREE as any).TextureLoader();
      if ((loader as any).setCrossOrigin) (loader as any).setCrossOrigin("anonymous");
      else (loader as any).crossOrigin = "anonymous";
      for (const { url } of missingTextures) {
        if (pendingTextureLoadsRef.current.has(url)) continue;
        pendingTextureLoadsRef.current.add(url);
        loader.load(
          url,
          (texture: any) => {
            pendingTextureLoadsRef.current.delete(url);
            texture.colorSpace = (THREE as any).SRGBColorSpace;
            texture.flipY = true;
            texture.needsUpdate = true;
            texture.wrapS = (THREE as any).RepeatWrapping;
            texture.wrapT = (THREE as any).RepeatWrapping;
            texture.magFilter = (THREE as any).LinearFilter;
            texture.minFilter = (THREE as any).LinearMipmapLinearFilter;
            texture.generateMipmaps = true;
            textureCacheRef.current.set(url, texture);
            for (const [uniformName, assignedUrl] of textureAssignments) {
              if (assignedUrl !== url) continue;
              const uniform = materialRef.current?.uniforms?.[uniformName];
              if (uniform) {
                uniform.value = cloneTextureForUniform(THREE, texture, samplerSettings.get(uniformName));
              }
            }
            if (materialRef.current) materialRef.current.needsUpdate = true;
          },
          undefined,
          () => {
            pendingTextureLoadsRef.current.delete(url);
          }
        );
      }
    }
  }, [fragCode, vertexChunk, textureAssignments, samplerSettings, ensureSamplerFallback]);

  useEffect(() => () => {
    const pending = pendingTextureLoadsRef.current;
    pending.clear();
    const cache = textureCacheRef.current;
    for (const tex of cache.values()) tex.dispose?.();
    cache.clear();
  }, []);

  const overlayMessage = useMemo(() => {
    if (compileError) return compileError;
    if (status === "compiling") return "Compiling preview…";
    if (status === "error") return compileError ?? "Preview failed.";
    if (probeGraph.kind === "idle") return formatReason(probeGraph.reason);
    if (!fragCode) return "Preview not ready.";
    return null;
  }, [compileError, status, probeGraph, fragCode]);

  return (
    <div ref={containerRef} className={cn("relative h-full", className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        data-node-interactive
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        style={{ touchAction: "none" }}
      />
      {overlayMessage ? (
        <div className="absolute inset-0 flex items-center justify-center px-3 text-xs text-muted-foreground text-center bg-background/70 backdrop-blur-sm">
          {overlayMessage}
        </div>
      ) : null}
    </div>
  );
}
