import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";
import { isAbortError } from "@/lib/errors";
import {
  defaultVertexShader,
  parseUniformsAndSanitize,
  toThreeUniforms,
  extractPreviewShaders,
} from "@/core/preview/shaderUtils";
import { isCompilableGraph } from "@/core/io/guards";
import { ASSET_DRAG_MIME, parseAssetDragPayload } from "@/core/assets/kind";
// three types are shimmed for our build; import as any
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { observeElementSize } from "./preview/resizeObserver";
import {
  collectTextureUniforms,
  collectSamplerSettings,
  cloneTextureForUniform,
} from "@/core/preview/graphAssets";
import type { LightingProfile, LightingProfileLight } from "@/core/preview/lightingProfiles";
import { DEFAULT_LIGHTING_PROFILE_ID, getLightingProfile, lightingProfiles } from "@/core/preview/lightingProfiles";

type PreviewAsset = {
  id?: string;
  source?: string;
  label?: string;
  type?: string;
  builtin?: boolean;
};

type PreviewPanelProps = {
  graph: unknown;
  className?: string;
  variant?: "overlay" | "docked" | "node";
  getProperty?: (propId: string) => unknown;
  setProperty?: (propId: string, next: unknown) => void;
  asset?: PreviewAsset | null;
  setAsset?: (asset: PreviewAsset | null) => void;
};

type Primitive = "sphere" | "cube" | "cylinder" | "custom";

type Vec3Tuple = [number, number, number];

const FALLBACK_LIGHT_DIRECTIONS: Vec3Tuple[] = [
  [-0.35, 0.8, 0.6],
  [0.6, 0.2, 0.2],
  [-0.2, 0.3, -0.9],
];

const FALLBACK_LIGHT_COLORS: Vec3Tuple[] = [
  [3.0, 3.0, 3.0],
  [1.2, 1.2, 1.2],
  [2.0, 2.0, 2.0],
];

const FALLBACK_AMBIENT: Vec3Tuple = [0.08, 0.08, 0.08];
const FALLBACK_EXPOSURE = 1.3;

function normalizeTuple(vec: Vec3Tuple): Vec3Tuple {
  const [x, y, z] = vec;
  const len = Math.hypot(x, y, z);
  if (!Number.isFinite(len) || len === 0) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

function resolveDirection(light: LightingProfileLight | undefined, fallback: Vec3Tuple): Vec3Tuple {
  let dir: Vec3Tuple | undefined;
  if (light) {
    if (light.direction) {
      dir = light.direction;
    } else if (light.position) {
      dir = [-light.position[0], -light.position[1], -light.position[2]];
    }
  }
  if (!dir) dir = fallback;
  return normalizeTuple(dir);
}

function resolveColor(light: LightingProfileLight | undefined, fallback: Vec3Tuple): Vec3Tuple {
  if (!light) return fallback;
  const [r, g, b] = light.color;
  const intensity = Number.isFinite(light.intensity) ? light.intensity : 1;
  return [r * intensity, g * intensity, b * intensity];
}

function disposeMaterial(
  mat: any | null | undefined,
  preserve?: Set<any>
) {
  if (!mat) return;
  try {
    const uniforms = mat.uniforms ?? {};
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
    mat.dispose();
  }
}

export function PreviewPanel({ graph, className, variant = "overlay", getProperty, setProperty, asset, setAsset }: PreviewPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    const stored = typeof localStorage !== "undefined" ? Number(localStorage.getItem("previewPanel.width")) : 0;
    return Number.isFinite(stored) && stored > 240 ? stored : 520;
  });
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const [primitive, setPrimitive] = useState<Primitive>(() => {
    const prop = getProperty?.("primitive");
    if (prop === "sphere" || prop === "cube" || prop === "cylinder" || prop === "custom") return prop;
    const v = typeof localStorage !== "undefined" ? (localStorage.getItem("previewPanel.primitive") as Primitive | null) : null;
    return (v ?? "sphere");
  });
  const [autoRotate, setAutoRotate] = useState<boolean>(() => {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem("previewPanel.autoRotate") : null;
    return v === "true";
  });
  const [wireframe, setWireframe] = useState<boolean>(() => {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem("previewPanel.wireframe") : null;
    return v === "true";
  });
  const [useEnv, setUseEnv] = useState<boolean>(() => {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem("previewPanel.useEnv") : null;
    return v === "true";
  });
  const [useEnvBg, setUseEnvBg] = useState<boolean>(() => {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem("previewPanel.useEnvBg") : null;
    return v === "true";
  });
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [modelDropActive, setModelDropActive] = useState(false);
  const [customModel, setCustomModel] = useState<{ source: string; label: string } | null>(null);
  const [lightingProfileId, setLightingProfileId] = useState<string>(() => {
    const prop = getProperty?.("lighting_profile");
    if (typeof prop === "string" && lightingProfiles.some((profile) => profile.id === prop)) return prop;
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("previewPanel.lightingProfile") : null;
    if (stored && lightingProfiles.some((profile) => profile.id === stored)) return stored;
    return DEFAULT_LIGHTING_PROFILE_ID;
  });

  const lightingProfile = useMemo(() => getLightingProfile(lightingProfileId), [lightingProfileId]);
  const lightingDescription = lightingProfile.description.trim();
  const hasLightingDescription = lightingDescription.length > 0;

  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.width", String(width)); }, [width]);
  // Keep latest setProperty in a ref to avoid effect dependency loops
  const setPropertyRef = useRef<typeof setProperty>(setProperty);
  useEffect(() => { setPropertyRef.current = setProperty; }, [setProperty]);
  const setAssetRef = useRef<typeof setAsset>(setAsset);
  useEffect(() => { setAssetRef.current = setAsset; }, [setAsset]);
  const lightingProfileRef = useRef<LightingProfile | null>(lightingProfile);
  useEffect(() => { lightingProfileRef.current = lightingProfile; }, [lightingProfile]);

  useEffect(() => {
    const id = lightingProfile.id;
    if (setPropertyRef.current) setPropertyRef.current("lighting_profile", id);
    if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.lightingProfile", id);
  }, [lightingProfile]);

  useEffect(() => {
    // Persist primitive to node property when available; otherwise use localStorage fallback
    if (setPropertyRef.current) {
      setPropertyRef.current("primitive", primitive);
      return;
    }
    if (typeof localStorage === "undefined") return;
    if (primitive === "custom" && !customModel) {
      localStorage.setItem("previewPanel.primitive", "sphere");
    } else {
      localStorage.setItem("previewPanel.primitive", primitive);
    }
  }, [primitive, customModel]);

  // Initialize from persisted model when provided by node properties (run once)
  const hydratedRef = useRef(false);
  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.autoRotate", String(autoRotate)); }, [autoRotate]);
  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.wireframe", String(wireframe)); }, [wireframe]);
  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.useEnv", String(useEnv)); }, [useEnv]);
  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.useEnvBg", String(useEnvBg)); }, [useEnvBg]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const threeRef = useRef<{ renderer: any; scene: any; camera: any; mesh: any | null } | null>(null);
  const orbitControlsRef = useRef<any | null>(null);
  const materialRef = useRef<any | null>(null);
  const geometryRef = useRef<any | null>(null);
  const customGeometryRef = useRef<any | null>(null);
  const [customGeometryVersion, setCustomGeometryVersion] = useState(0);
  const gltfLoaderRef = useRef<any>(null);
  const textureCacheRef = useRef<Map<string, any>>(new Map());
  const pendingTextureLoadsRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const autoRotateRef = useRef<boolean>(false);
  const pmremRef = useRef<any | null>(null);
  const envRTRef = useRef<any | null>(null);
  const _lightDirsViewRef = useRef<{ key: any; fill: any; rim: any } | null>(null);
  const samplerFallbackRef = useRef<{ sampler2D?: any; samplerCube?: any; sampler3D?: any; sampler2DArray?: any }>({});
  const startTimeRef = useRef<number | null>(null);
  const stableGraph = useMemo(() => {
    try { return JSON.parse(JSON.stringify(graph ?? {})); } catch { return {} as any; }
  }, [graph]);
  const textureAssignments = useMemo(() => collectTextureUniforms(stableGraph), [stableGraph]);
  const samplerSettings = useMemo(() => collectSamplerSettings(stableGraph), [stableGraph]);

  // Compute stable content hash of the serialized graph to avoid redundant compiles
  const graphHash = useMemo(() => {
    try {
      // Stable stringify by sorting object keys; arrays keep order
      const stableStringify = (value: any): string => {
        if (value === null || typeof value !== "object") return JSON.stringify(value);
        if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
        const keys = Object.keys(value).sort();
        return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(",")}}`;
      };
      const s = stableStringify(stableGraph);
      let h = 2166136261 >>> 0; // FNV-1a 32-bit
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(16);
    } catch {
      return String(Date.now());
    }
  }, [stableGraph]);

  const [fragCode, setFragCode] = useState<string>("");
  const [vertexChunk, setVertexChunk] = useState<string>("");
  const [compileError, setCompileError] = useState<string>("");
  const [working, setWorking] = useState<boolean>(false);

  const ensureSamplerFallback = useCallback((samplerType: string): any => {
    const store = samplerFallbackRef.current;
    if (samplerType === "samplerCube") {
      if (!store.samplerCube) {
        const data = new Uint8Array([255, 255, 255, 255]);
        const image = { data, width: 1, height: 1 };
        const cube = new (THREE as any).CubeTexture([image, image, image, image, image, image]);
        cube.name = "PreviewFallbackCubeTexture";
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
        tex.name = "PreviewFallbackTexture3D";
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
        tex.name = "PreviewFallbackTextureArray";
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
        store.sampler2DArray = tex;
      }
      return store.sampler2DArray;
    }
    if (!store.sampler2D) {
      const data = new Uint8Array([255, 255, 255, 255]);
      const tex = new (THREE as any).DataTexture(data, 1, 1, (THREE as any).RGBAFormat, (THREE as any).UnsignedByteType);
      tex.name = "PreviewFallbackTexture";
      tex.colorSpace = (THREE as any).SRGBColorSpace;
      tex.magFilter = (THREE as any).LinearFilter;
      tex.minFilter = (THREE as any).LinearFilter;
      tex.generateMipmaps = false;
      tex.wrapS = (THREE as any).ClampToEdgeWrapping;
      tex.wrapT = (THREE as any).ClampToEdgeWrapping;
      tex.needsUpdate = true;
      tex.flipY = false;
      store.sampler2D = tex;
    }
    return store.sampler2D;
  }, []);

  // Compile the graph to ThreeJS GLSL fragment shader with debounce + cancellation
  const compileDebounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (compileDebounceRef.current) {
      clearTimeout(compileDebounceRef.current);
      compileDebounceRef.current = null;
    }
    const abort = new AbortController();
    let cancelled = false;
    if (typeof performance !== "undefined" && performance.mark) performance.mark("preview-compile-start");
    compileDebounceRef.current = window.setTimeout(() => {
      (async () => {
        try {
          setWorking(true);
          setCompileError("");
          if (!isCompilableGraph(stableGraph as any)) {
            setFragCode("");
            setVertexChunk("");
            return;
          }
          const res = await fetch("/api/compile", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-graph-hash": graphHash },
            signal: abort.signal,
            body: JSON.stringify({ graph: stableGraph, language: "ThreeJS_GLSL", engine: "preview" }),
          });
          if (!res.ok) throw new Error(`Compile failed: ${res.status}`);
          const data = await res.json();
          const code: string = String(data.code ?? "");
          if (!cancelled) {
            const { fragment, vertexChunk } = extractPreviewShaders(String(code ?? ""));
            setFragCode(fragment);
            setVertexChunk(vertexChunk);
            if (typeof performance !== "undefined" && performance.mark && performance.measure) {
              performance.mark("preview-compile-end");
              performance.measure("preview-ready", "preview-compile-start", "preview-compile-end");
            }
          }
        } catch (err: any) {
          if (cancelled) return;
          if (isAbortError(err)) return;
          console.error("[preview-panel] compile error", err);
          setCompileError(typeof err?.message === "string" ? err.message : "Compile failed");
          setFragCode("");
          setVertexChunk("");
        } finally {
          if (!cancelled) setWorking(false);
        }
      })();
    }, 180);
    return () => {
      cancelled = true;
      abort.abort();
      if (compileDebounceRef.current) clearTimeout(compileDebounceRef.current);
      compileDebounceRef.current = null;
    };
  }, [stableGraph, graphHash]);

  // Keep auto-rotate flag in a ref to avoid re-initializing renderer
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  const updateRendererSize = useCallback(() => {
    const three = threeRef.current;
    const canvas = canvasRef.current;
    if (!three || !canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width ?? canvas.clientWidth;
    const height = rect?.height ?? canvas.clientHeight;
    if (!width || !height) return;
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    three.renderer.setSize(w, h, false);
    three.camera.aspect = w / h;
    three.camera.updateProjectionMatrix();
    if (orbitControlsRef.current) orbitControlsRef.current.update();
  }, []);

  // Initialize Three.js renderer/scene once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new (THREE as any).WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min((window as any).devicePixelRatio ?? 1, 2));
    renderer.toneMapping = (THREE as any).ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = (THREE as any).SRGBColorSpace;
    const scene = new (THREE as any).Scene();
    const camera = new (THREE as any).PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3);
    scene.add(camera);

    const controls = new (OrbitControls as any)(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 12;
    controls.target.set(0, 0, 0);
    controls.update();
    orbitControlsRef.current = controls;

    threeRef.current = { renderer, scene, camera, mesh: null };
    updateRendererSize();

    const render = (now: number) => {
      rafRef.current = requestAnimationFrame(render);
      if (startTimeRef.current == null) startTimeRef.current = now;
      const seconds = (now - startTimeRef.current) / 1000;
      if (materialRef.current) {
        const u = materialRef.current.uniforms as any;
        if (u?.uTime) u.uTime.value = seconds;
      }
      const threeNow = threeRef.current;
      if (autoRotateRef.current && threeNow?.mesh) {
        threeNow.mesh.rotation.y += 0.01;
        threeNow.mesh.rotation.x += 0.005;
      }
      if (orbitControlsRef.current) {
        orbitControlsRef.current.update();
      }
      // Update view-space light directions every frame (camera may move)
      if (threeNow && materialRef.current) {
        const cam = threeNow.camera;
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();
        const view = cam.matrixWorldInverse;
        const viewMatrix = new (THREE as any).Matrix3().setFromMatrix4(view);
        const profile = lightingProfileRef.current;
        const lights = profile?.lights ?? [];
        const dirTuples = FALLBACK_LIGHT_DIRECTIONS.map((fallback, index) => resolveDirection(lights[index], fallback));
        const vectors = dirTuples.map((tuple) =>
          new (THREE as any).Vector3(tuple[0], tuple[1], tuple[2]).applyMatrix3(viewMatrix).normalize()
        );
        const u = materialRef.current.uniforms as any;
        const entries: Array<[string, any]> = [
          ["uKeyDir", vectors[0]],
          ["uFillDir", vectors[1]],
          ["uRimDir", vectors[2]],
        ];
        for (const [name, vec] of entries) {
          const uniform = u?.[name];
          if (uniform?.value?.set && vec) uniform.value.set(vec.x, vec.y, vec.z);
        }
      }
      try {
        renderer.render(scene, camera);
      } catch (err) {
        console.error("[preview-render-error]", err);
        throw err;
      }
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (materialRef.current) {
        const fallbackValues = Object.values(samplerFallbackRef.current ?? {}).filter(Boolean);
        const preserve = fallbackValues.length ? new Set(fallbackValues) : undefined;
        disposeMaterial(materialRef.current, preserve);
      }
      if (geometryRef.current && geometryRef.current !== customGeometryRef.current) geometryRef.current.dispose();
      if (envRTRef.current) { envRTRef.current.dispose(); envRTRef.current = null; }
      if (pmremRef.current) { pmremRef.current.dispose(); pmremRef.current = null; }
      const fallbackDisposables = Object.values(samplerFallbackRef.current ?? {}).filter(Boolean);
      for (const tex of fallbackDisposables) {
        if (tex && typeof tex.dispose === "function") tex.dispose();
      }
      samplerFallbackRef.current = {};
      startTimeRef.current = null;
      if (customGeometryRef.current) { customGeometryRef.current.dispose(); customGeometryRef.current = null; }
      if (orbitControlsRef.current) {
        orbitControlsRef.current.dispose();
        orbitControlsRef.current = null;
      }
      renderer.dispose();
      threeRef.current = null;
    };
  }, [updateRendererSize]);

  const loadModelAsset = useCallback(
    async (source: string, label: string, options?: { persist?: boolean; asset?: PreviewAsset | null }) => {
      const persist = options?.persist ?? true;
      const assetDetails = options?.asset ?? null;
      setModelStatus(`Loading ${label}…`);
      try {
        if (!gltfLoaderRef.current) {
          const mod = await import("three/examples/jsm/loaders/GLTFLoader.js");
          gltfLoaderRef.current = new (mod as any).GLTFLoader();
        }
        const loader = gltfLoaderRef.current as any;
        if (loader?.setCrossOrigin) loader.setCrossOrigin("anonymous");
        const gltf = await loader.loadAsync(source);
        let mesh: any | null = null;
        gltf.scene.traverse((obj: any) => {
          if (mesh) return;
          if (obj && obj.isMesh) mesh = obj as any;
        });
        if (!mesh) throw new Error("Model has no mesh to preview");
        const geom = mesh.geometry.clone();
        geom.applyMatrix4(mesh.matrixWorld);
        geom.computeBoundingBox();
        geom.computeBoundingSphere();
        const center = geom.boundingBox?.getCenter(new (THREE as any).Vector3()) ?? new (THREE as any).Vector3();
        geom.translate(-center.x, -center.y, -center.z);
        const radius = geom.boundingSphere?.radius ?? 1;
        if (radius > 0 && Number.isFinite(radius)) {
          const scale = 1 / radius;
          geom.scale(scale, scale, scale);
        }
        if (customGeometryRef.current) customGeometryRef.current.dispose();
        customGeometryRef.current = geom;
        setCustomGeometryVersion((v) => v + 1);
        setCustomModel({ source, label });
        setPrimitive("custom");
        if (persist && setPropertyRef.current) {
          setPropertyRef.current("model_source", source);
          setPropertyRef.current("model_label", label);
          setPropertyRef.current("primitive", "custom");
        }
        if (setAssetRef.current && assetDetails && assetDetails.id && assetDetails.source) {
          setAssetRef.current({ ...assetDetails, source, label: assetDetails.label ?? label });
        }
        setModelStatus(`Loaded ${label}`);
      } catch (err) {
        console.warn("Failed to load model asset", err);
        setModelStatus(`Failed to load model: ${label}`);
      }
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!container) return;
    updateRendererSize();
    // One-time hydration from node properties after container exists to avoid referencing
    // functions before initialization during initial render.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      try {
        const src = typeof getProperty === "function" ? (getProperty("model_source") as string | undefined) : undefined;
        const label = typeof getProperty === "function" ? (getProperty("model_label") as string | undefined) : undefined;
        const prim = typeof getProperty === "function" ? (getProperty("primitive") as Primitive | undefined) : undefined;
        const profileProp = typeof getProperty === "function" ? (getProperty("lighting_profile") as string | undefined) : undefined;
        if (typeof prim === "string") setPrimitive(prim as Primitive);
        if (typeof profileProp === "string" && lightingProfiles.some((profile) => profile.id === profileProp)) {
          setLightingProfileId(profileProp);
        }
        if (src) {
          void loadModelAsset(src, label || "Model", { persist: false, asset: ((asset as any) ?? null) });
        }
      } catch {
        // ignore hydration errors; graph properties can be unset during initial mount
      }
    }
    return observeElementSize(container, updateRendererSize);
  }, [updateRendererSize, variant, collapsed, getProperty, asset, loadModelAsset]);

  useEffect(() => {
    if (!asset || !asset.source) return;
    setCustomModel({ source: asset.source, label: asset.label ?? asset.id ?? "Model" });
  }, [asset, asset?.source, asset?.label, asset?.id]);

  // Toggle default HDRI environment (RoomEnvironment via PMREM)
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    if (useEnv) {
      const pmrem = pmremRef.current ?? new (THREE as any).PMREMGenerator(three.renderer);
      pmremRef.current = pmrem;
      const envRT = envRTRef.current ?? pmrem.fromScene(new RoomEnvironment(), 0.04);
      envRTRef.current = envRT;
      three.scene.environment = envRT.texture as any;
      three.scene.background = useEnvBg ? (envRT.texture as any) : null;
    } else {
      three.scene.environment = null as any;
      three.scene.background = null as any;
    }
  }, [useEnv, useEnvBg]);

  useEffect(() => {
    if (primitive === "custom" && !customGeometryRef.current) {
      setPrimitive("sphere");
    }
  }, [primitive]);

  // Build or update geometry when primitive changes
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    if (geometryRef.current) {
      if (!customGeometryRef.current || geometryRef.current !== customGeometryRef.current) {
        geometryRef.current.dispose();
      }
      geometryRef.current = null;
    }
    let geom: any | null = null;
    if (primitive === "sphere") geom = new (THREE as any).SphereGeometry(0.9, 48, 32);
    else if (primitive === "cube") geom = new (THREE as any).BoxGeometry(1.2, 1.2, 1.2, 2, 2, 2);
    else if (primitive === "cylinder") geom = new (THREE as any).CylinderGeometry(0.8, 0.8, 1.4, 48, 1);
    else if (primitive === "custom" && customGeometryRef.current) geom = customGeometryRef.current.clone();
    if (!geom) return;
    geometryRef.current = geom;
    if (three.mesh) {
      three.mesh.geometry = geom;
    } else {
      const fallbackMat = new (THREE as any).ShaderMaterial({ vertexShader: defaultVertexShader(), fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }" });
      const mat = materialRef.current ?? fallbackMat;
      if (!materialRef.current) materialRef.current = mat;
      const mesh = new (THREE as any).Mesh(geom, mat);
      mesh.frustumCulled = false;
      three.mesh = mesh;
      three.scene.add(mesh);
    }
  }, [primitive, customGeometryVersion]);

  // Update material when shader code changes or flags change
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    if (!fragCode) return;
    // Extract uniforms with initializers and sanitize code
    const parsed = parseUniformsAndSanitize(fragCode);
    const uniformsRaw = toThreeUniforms(parsed.uniforms);
    // Convert array uniforms to Three vectors
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
    const lights = lightingProfile.lights;
    const worldDirectionTuples = FALLBACK_LIGHT_DIRECTIONS.map((fallback, index) => resolveDirection(lights[index], fallback));
    const colorTuples = FALLBACK_LIGHT_COLORS.map((fallback, index) => resolveColor(lights[index], fallback));
    const ambientTuple = lightingProfile.ambient ?? FALLBACK_AMBIENT;
    const exposure = Number.isFinite(lightingProfile.exposure) ? lightingProfile.exposure : FALLBACK_EXPOSURE;

    // Ensure preview-owned environment/lighting uniforms exist with sensible defaults
    // Directions are provided in view space (updated every frame), initialize now to avoid a black first frame
    try {
      const cam = three.camera;
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      const view = cam.matrixWorldInverse;
      const viewMatrix = new (THREE as any).Matrix3().setFromMatrix4(view);
      const dirVectors = worldDirectionTuples.map((tuple) =>
        new (THREE as any).Vector3(tuple[0], tuple[1], tuple[2]).applyMatrix3(viewMatrix).normalize()
      );
      const [keyDir, fillDir, rimDir] = dirVectors;
      if (!uniforms.uKeyDir) uniforms.uKeyDir = { value: keyDir };
      else if (uniforms.uKeyDir.value?.set) uniforms.uKeyDir.value.set(keyDir.x, keyDir.y, keyDir.z);
      else uniforms.uKeyDir.value = keyDir;
      if (!uniforms.uFillDir) uniforms.uFillDir = { value: fillDir };
      else if (uniforms.uFillDir.value?.set) uniforms.uFillDir.value.set(fillDir.x, fillDir.y, fillDir.z);
      else uniforms.uFillDir.value = fillDir;
      if (!uniforms.uRimDir) uniforms.uRimDir = { value: rimDir };
      else if (uniforms.uRimDir.value?.set) uniforms.uRimDir.value.set(rimDir.x, rimDir.y, rimDir.z);
      else uniforms.uRimDir.value = rimDir;
    } catch {
      const fallbackVectors = worldDirectionTuples.map((tuple) => new (THREE as any).Vector3(tuple[0], tuple[1], tuple[2]));
      const [keyDir, fillDir, rimDir] = fallbackVectors;
      if (!uniforms.uKeyDir) uniforms.uKeyDir = { value: keyDir };
      if (!uniforms.uFillDir) uniforms.uFillDir = { value: fillDir };
      if (!uniforms.uRimDir) uniforms.uRimDir = { value: rimDir };
    }

    const colorVectors = colorTuples.map((tuple) => new (THREE as any).Vector3(tuple[0], tuple[1], tuple[2]));
    const [keyColor, fillColor, rimColor] = colorVectors;
    uniforms.uKeyColor = { value: keyColor } as any;
    uniforms.uFillColor = { value: fillColor } as any;
    uniforms.uRimColor = { value: rimColor } as any;
    uniforms.uAmbient = { value: new (THREE as any).Vector3(ambientTuple[0], ambientTuple[1], ambientTuple[2]) } as any;
    uniforms.uExposure = { value: exposure } as any;
    if (!uniforms.uTime) uniforms.uTime = { value: 0 } as any;
    const mat = new (THREE as any).ShaderMaterial({
      vertexShader: defaultVertexShader(vertexChunk, parsed),
      fragmentShader: parsed.fragment,
      uniforms,
      wireframe,
      depthTest: true,
      depthWrite: true,
      transparent: false,
      side: (THREE as any).DoubleSide,
      toneMapped: false,
      fog: false,
    } as any);
    if (materialRef.current) {
      const fallbackValues = Object.values(samplerFallbackRef.current ?? {}).filter(Boolean);
      const preserve = fallbackValues.length ? new Set(fallbackValues) : undefined;
      disposeMaterial(materialRef.current, preserve);
    }
    materialRef.current = mat;
    startTimeRef.current = null;
    if (three.mesh) three.mesh.material = mat;
    let cancelled = false;
    if (missingTextures.length) {
      const loader = new (THREE as any).TextureLoader();
      if ((loader as any).setCrossOrigin) (loader as any).setCrossOrigin("anonymous");
      else (loader as any).crossOrigin = "anonymous";
      for (const { url } of missingTextures) {
        pendingTextureLoadsRef.current.add(url);
        loader.load(
          url,
          (texture: any) => {
            pendingTextureLoadsRef.current.delete(url);
            if (cancelled) {
              texture.dispose();
              return;
            }
            texture.colorSpace = (THREE as any).SRGBColorSpace;
            // Use Three.js default flipY for image-based textures so v=0 maps to the bottom,
            // avoiding vertical UV inversion in the preview.
            texture.flipY = true;
            texture.needsUpdate = true;
            texture.wrapS = (THREE as any).RepeatWrapping;
            texture.wrapT = (THREE as any).RepeatWrapping;
            texture.magFilter = (THREE as any).LinearFilter;
            texture.minFilter = (THREE as any).LinearMipmapLinearFilter;
            texture.generateMipmaps = true;
            textureCacheRef.current.set(url, texture);
            for (const [uName, uUrl] of textureAssignments) {
              if (uUrl !== url) continue;
              const uniform = materialRef.current?.uniforms?.[uName];
              if (uniform) {
                uniform.value = cloneTextureForUniform(THREE, texture, samplerSettings.get(uName));
              }
            }
            if (materialRef.current) materialRef.current.needsUpdate = true;
          },
          undefined,
          () => {
            pendingTextureLoadsRef.current.delete(url);
            if (!cancelled) console.warn("Failed to load texture asset", url);
          }
        );
      }
    }

    return () => {
      cancelled = true;
    };
  }, [ensureSamplerFallback, fragCode, vertexChunk, wireframe, textureAssignments, samplerSettings, lightingProfile]);

  const handleCanvasDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types.includes(ASSET_DRAG_MIME)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setModelDropActive(true);
  }, []);

  const handleCanvasDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setModelDropActive(false);
    }
  }, []);

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer?.types.includes(ASSET_DRAG_MIME)) return;
      event.preventDefault();
      event.stopPropagation();
      setModelDropActive(false);
      const payload = parseAssetDragPayload(event.dataTransfer.getData(ASSET_DRAG_MIME));
      if (!payload || payload.type !== "model") return;
      const label = payload.label ?? payload.id ?? "Model";
      void loadModelAsset(payload.source, label, {
        persist: true,
        asset: {
          id: String(payload.id ?? payload.source ?? ""),
          source: String(payload.source ?? ""),
          label: String(payload.label ?? payload.id ?? "Asset"),
          type: String(payload.type ?? "model"),
          builtin: Boolean(payload.builtin ?? true),
        },
      });
    },
    [loadModelAsset]
  );

  const canvasDropProps = {
    onDragOver: handleCanvasDragOver,
    onDragEnter: handleCanvasDragOver,
    onDragLeave: handleCanvasDragLeave,
    onDrop: handleCanvasDrop,
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing.current) return;
    const dx = startX.current - e.clientX; // dragging left handle; increasing dx widens panel
    const next = Math.min(Math.max(startW.current + dx, 320), Math.max(window.innerWidth - 120, 320));
    setWidth(next);
  }, []);

  const onMouseUp = useCallback(() => {
    resizing.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = width;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  if (variant === "node") {
    return (
      <div className={cn("h-full flex flex-col", className)}>
        <div className="px-3 py-2 border-b flex flex-row items-center justify-end gap-2">
          <div className="min-w-[120px]">
            <Select value={primitive} onValueChange={(v) => { const next = v as Primitive; setPrimitive(next); setProperty?.("primitive", next); }}>
              <SelectTrigger aria-label="Primitive">
                <SelectValue placeholder="Primitive" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sphere">Sphere</SelectItem>
                <SelectItem value="cube">Cube</SelectItem>
                <SelectItem value="cylinder">Cylinder</SelectItem>
                {customModel ? <SelectItem value="custom">Model ({customModel.label})</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Select value={lightingProfile.id} onValueChange={(value) => { setLightingProfileId(value); setProperty?.("lighting_profile", value); }}>
              <SelectTrigger aria-label="Lighting profile" title={hasLightingDescription ? lightingDescription : undefined}>
                <SelectValue placeholder="Lighting" />
              </SelectTrigger>
              <SelectContent>
                {lightingProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> rotate</label>
          <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} /> wireframe</label>
          <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={useEnv} onChange={(e) => setUseEnv(e.target.checked)} /> env</label>
          <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={useEnvBg} onChange={(e) => setUseEnvBg(e.target.checked)} disabled={!useEnv} /> bg</label>
        </div>
        <div className="px-3 pb-3 flex-1 overflow-hidden">
          <div
            {...canvasDropProps}
            className={cn(
              "osg-three-preview rounded-md overflow-hidden w-full h-full min-h-[240px] transition-colors nodrag nowheel nopan",
              modelDropActive ? "bg-primary/10 border border-dashed border-primary" : "bg-muted"
            )}
            data-node-interactive
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
            style={{ touchAction: "none" }}
          >
            <canvas
              ref={canvasRef}
              className="nodrag nowheel nopan"
              style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}
            />
          </div>
          {working ? (
            <div className="mt-2 text-[11px] text-muted-foreground">Compiling…</div>
          ) : compileError ? (
            <div className="mt-2 text-[11px] text-red-500">{compileError}</div>
          ) : modelStatus ? (
            <div className="mt-2 text-[11px] text-muted-foreground">{modelStatus}</div>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === "docked") {
    return (
      <Card className={cn("h-full flex flex-col", className)}>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-end">
          <div className="flex items-center gap-2">
            <div className="min-w-[120px]">
              <Select value={primitive} onValueChange={(v) => { const next = v as Primitive; setPrimitive(next); setProperty?.("primitive", next); }}>
                <SelectTrigger aria-label="Primitive">
                  <SelectValue placeholder="Primitive" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sphere">Sphere</SelectItem>
                  <SelectItem value="cube">Cube</SelectItem>
                  <SelectItem value="cylinder">Cylinder</SelectItem>
                  {customModel ? <SelectItem value="custom">Model ({customModel.label})</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Select value={lightingProfile.id} onValueChange={(value) => { setLightingProfileId(value); setProperty?.("lighting_profile", value); }}>
                <SelectTrigger aria-label="Lighting profile" title={hasLightingDescription ? lightingDescription : undefined}>
                  <SelectValue placeholder="Lighting" />
                </SelectTrigger>
                <SelectContent>
                  {lightingProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> rotate</label>
            <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} /> wireframe</label>
            <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={useEnv} onChange={(e) => setUseEnv(e.target.checked)} /> env</label>
            <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={useEnvBg} onChange={(e) => setUseEnvBg(e.target.checked)} disabled={!useEnv} /> bg</label>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex-1 overflow-hidden">
          <div
            {...canvasDropProps}
            className={cn(
              "osg-three-preview rounded-md overflow-hidden w-full h-full min-h-[240px] transition-colors nodrag nowheel",
              modelDropActive ? "bg-primary/10 border border-dashed border-primary" : "bg-muted"
            )}
            data-node-interactive
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <canvas
              ref={canvasRef}
              className="nodrag nowheel"
              data-testid="preview-canvas"
              style={{ display: "block", width: "100%", height: "100%" }}
            />
          </div>
          {working ? (
            <div className="mt-2 text-[11px] text-muted-foreground">Compiling…</div>
          ) : compileError ? (
            <div className="mt-2 text-[11px] text-red-500">{compileError}</div>
          ) : modelStatus ? (
            <div className="mt-2 text-[11px] text-muted-foreground">{modelStatus}</div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (collapsed) {
    return (
      <div className={cn("absolute right-2 top-1/2 -translate-y-1/2 z-40", className)}>
        <Button size="sm" variant="outline" onClick={() => setCollapsed(false)} aria-label="Open 3D Preview">
          Preview
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn("fixed top-1/2 right-2 -translate-y-1/2 z-40 pointer-events-none", className)}
      style={{ width: width + 4 /* handle thickness */ }}
    >
      {/* Resize Handle (left edge) */}
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
        onMouseDown={onHandleMouseDown}
        className="absolute left-[-4px] top-0 h-full w-2 cursor-col-resize bg-transparent pointer-events-auto"
      />
      <Card className="pointer-events-auto">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">3D Preview</CardTitle>
          <div className="flex items-center gap-2">
            <div className="min-w-[120px]">
              <Select value={primitive} onValueChange={(v) => { const next = v as Primitive; setPrimitive(next); setProperty?.("primitive", next); }}>
                <SelectTrigger aria-label="Primitive">
                  <SelectValue placeholder="Primitive" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sphere">Sphere</SelectItem>
                  <SelectItem value="cube">Cube</SelectItem>
                  <SelectItem value="cylinder">Cylinder</SelectItem>
                  {customModel ? <SelectItem value="custom">Model ({customModel.label})</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Select value={lightingProfile.id} onValueChange={(value) => { setLightingProfileId(value); setProperty?.("lighting_profile", value); }}>
                <SelectTrigger aria-label="Lighting profile" title={hasLightingDescription ? lightingDescription : undefined}>
                  <SelectValue placeholder="Lighting" />
                </SelectTrigger>
                <SelectContent>
                  {lightingProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> rotate</label>
            <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} /> wireframe</label>
            <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={useEnv} onChange={(e) => setUseEnv(e.target.checked)} /> env</label>
            <label className="text-xs inline-flex items-center gap-1 select-none cursor-pointer"><input type="checkbox" checked={useEnvBg} onChange={(e) => setUseEnvBg(e.target.checked)} disabled={!useEnv} /> bg</label>
            <Button size="icon" variant="ghost" aria-label="Collapse" onClick={() => setCollapsed(true)}>▸</Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div
            {...canvasDropProps}
            className={cn(
              "osg-three-preview rounded-md overflow-hidden transition-colors nodrag nowheel nopan",
              modelDropActive ? "bg-primary/10 border border-dashed border-primary" : "bg-muted"
            )}
            style={{ width: "100%", height: 320, touchAction: "none" }}
            data-node-interactive
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <canvas
              ref={canvasRef}
              className="nodrag nowheel nopan"
              data-testid="preview-canvas"
              style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}
            />
          </div>
          {working ? (
            <div className="mt-2 text-[11px] text-muted-foreground">Compiling…</div>
          ) : compileError ? (
            <div className="mt-2 text-[11px] text-red-500">{compileError}</div>
          ) : modelStatus ? (
            <div className="mt-2 text-[11px] text-muted-foreground">{modelStatus}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default PreviewPanel;
