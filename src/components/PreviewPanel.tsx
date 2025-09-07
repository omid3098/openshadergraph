import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";
import { isAbortError } from "@/lib/errors";
import { defaultVertexShader, parseUniformsAndSanitize, toThreeUniforms } from "@/core/preview/shaderUtils";
import { isCompilableGraph } from "@/core/io/guards";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type PreviewPanelProps = {
  graph: unknown;
  className?: string;
  variant?: "overlay" | "docked";
};

type Primitive = "sphere" | "cube" | "cylinder";

export function PreviewPanel({ graph, className, variant = "overlay" }: PreviewPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    const stored = typeof localStorage !== "undefined" ? Number(localStorage.getItem("previewPanel.width")) : 0;
    return Number.isFinite(stored) && stored > 240 ? stored : 520;
  });
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const [primitive, setPrimitive] = useState<Primitive>(() => {
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

  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.width", String(width)); }, [width]);
  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.primitive", primitive); }, [primitive]);
  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.autoRotate", String(autoRotate)); }, [autoRotate]);
  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.wireframe", String(wireframe)); }, [wireframe]);
  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.useEnv", String(useEnv)); }, [useEnv]);
  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("previewPanel.useEnvBg", String(useEnvBg)); }, [useEnvBg]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const threeRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; mesh: THREE.Mesh | null } | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const rafRef = useRef<number | null>(null);
  const autoRotateRef = useRef<boolean>(false);
  const pmremRef = useRef<THREE.PMREMGenerator | null>(null);
  const envRTRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const _lightDirsViewRef = useRef<{ key: THREE.Vector3; fill: THREE.Vector3; rim: THREE.Vector3 } | null>(null);

  const stableGraph = useMemo(() => {
    try { return JSON.parse(JSON.stringify(graph ?? {})); } catch { return {} as any; }
  }, [graph]);

  const [fragCode, setFragCode] = useState<string>("");
  const [compileError, setCompileError] = useState<string>("");
  const [working, setWorking] = useState<boolean>(false);

  // Compile the graph to ThreeJS GLSL fragment shader
  useEffect(() => {
    const abort = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        setWorking(true);
        setCompileError("");
        if (!isCompilableGraph(stableGraph as any)) {
          setFragCode("");
          return;
        }
        const res = await fetch("/api/compile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({ graph: stableGraph, language: "ThreeJS_GLSL", engine: "preview" }),
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => String(res.status));
          throw new Error(msg || String(res.status));
        }
        const data = await res.json();
        if (!cancelled) setFragCode(String(data.code ?? ""));
      } catch (err: any) {
        if (cancelled) return;
        if (isAbortError(err)) return;
        setCompileError(typeof err?.message === "string" ? err.message : "Compile failed");
        setFragCode("");
      } finally {
        if (!cancelled) setWorking(false);
      }
    })();
    return () => { cancelled = true; abort.abort(); };
  }, [stableGraph]);

  // Keep auto-rotate flag in a ref to avoid re-initializing renderer
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  // Initialize Three.js renderer/scene once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3);
    scene.add(camera);

    threeRef.current = { renderer, scene, camera, mesh: null };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    handleResize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(canvas);

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      if (autoRotateRef.current && threeRef.current?.mesh) {
        threeRef.current.mesh.rotation.y += 0.01;
        threeRef.current.mesh.rotation.x += 0.005;
      }
      // Update view-space light directions every frame (camera may move)
      const threeNow = threeRef.current;
      if (threeNow && materialRef.current) {
        const cam = threeNow.camera;
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();
        const view = cam.matrixWorldInverse;
        const key = new THREE.Vector3(-0.35, 0.8, 0.6).normalize();
        const fill = new THREE.Vector3(0.6, 0.2, 0.2).normalize();
        const rim = new THREE.Vector3(-0.2, 0.3, -0.9).normalize();
        key.transformDirection(view);
        fill.transformDirection(view);
        rim.transformDirection(view);
        const u = (materialRef.current.uniforms as any);
        if (u.uKeyDir?.value?.set) u.uKeyDir.value.set(key.x, key.y, key.z);
        if (u.uFillDir?.value?.set) u.uFillDir.value.set(fill.x, fill.y, fill.z);
        if (u.uRimDir?.value?.set) u.uRimDir.value.set(rim.x, rim.y, rim.z);
      }
      renderer.render(scene, camera);
    };
    render();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      if (materialRef.current) materialRef.current.dispose();
      if (geometryRef.current) geometryRef.current.dispose();
      if (envRTRef.current) { envRTRef.current.dispose(); envRTRef.current = null; }
      if (pmremRef.current) { pmremRef.current.dispose(); pmremRef.current = null; }
      renderer.dispose();
      threeRef.current = null;
    };
  }, []);

  // Toggle default HDRI environment (RoomEnvironment via PMREM)
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    if (useEnv) {
      const pmrem = pmremRef.current ?? new THREE.PMREMGenerator(three.renderer);
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

  // Build or update geometry when primitive changes
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    if (geometryRef.current) { geometryRef.current.dispose(); geometryRef.current = null; }
    let geom: THREE.BufferGeometry;
    if (primitive === "sphere") geom = new THREE.SphereGeometry(0.9, 48, 32);
    else if (primitive === "cube") geom = new THREE.BoxGeometry(1.2, 1.2, 1.2, 2, 2, 2);
    else geom = new THREE.CylinderGeometry(0.8, 0.8, 1.4, 48, 1);
    geometryRef.current = geom;
    // Attach to mesh or create a new one
    if (three.mesh) {
      three.mesh.geometry = geom;
    } else {
      // Reuse compiled shader material if available; otherwise use a simple default
      const fallbackMat = new THREE.ShaderMaterial({ vertexShader: defaultVertexShader(), fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }" });
      const mat = materialRef.current ?? fallbackMat;
      // If we used fallback, remember it so later updates can dispose correctly
      if (!materialRef.current) materialRef.current = mat;
      const mesh = new THREE.Mesh(geom, mat);
      mesh.frustumCulled = false;
      three.mesh = mesh;
      three.scene.add(mesh);
    }
  }, [primitive]);

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
        if (val.length === 2) uniforms[key] = { value: new THREE.Vector2(val[0], val[1]) };
        else if (val.length === 3) uniforms[key] = { value: new THREE.Vector3(val[0], val[1], val[2]) };
        else if (val.length === 4) uniforms[key] = { value: new THREE.Vector4(val[0], val[1], val[2], val[3]) };
        else uniforms[key] = { value: val.slice() };
      } else {
        uniforms[key] = { value: val };
      }
    }
    // Ensure preview-owned environment/lighting uniforms exist with sensible defaults
    // Directions are provided in view space (updated every frame), initialize now to avoid a black first frame
    try {
      const cam = three.camera;
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      const view = cam.matrixWorldInverse;
      const keyDir = new THREE.Vector3(-0.35, 0.8, 0.6).normalize().applyMatrix3(new THREE.Matrix3().setFromMatrix4(view));
      const fillDir = new THREE.Vector3(0.6, 0.2, 0.2).normalize().applyMatrix3(new THREE.Matrix3().setFromMatrix4(view));
      const rimDir = new THREE.Vector3(-0.2, 0.3, -0.9).normalize().applyMatrix3(new THREE.Matrix3().setFromMatrix4(view));
      if (!uniforms.uKeyDir) uniforms.uKeyDir = { value: new THREE.Vector3(keyDir.x, keyDir.y, keyDir.z) };
      if (!uniforms.uFillDir) uniforms.uFillDir = { value: new THREE.Vector3(fillDir.x, fillDir.y, fillDir.z) };
      if (!uniforms.uRimDir) uniforms.uRimDir = { value: new THREE.Vector3(rimDir.x, rimDir.y, rimDir.z) };
    } catch {
      // no-op
    }
    if (!uniforms.uKeyColor) uniforms.uKeyColor = { value: new THREE.Vector3(3.0, 3.0, 3.0) } as any;
    if (!uniforms.uFillColor) uniforms.uFillColor = { value: new THREE.Vector3(1.2, 1.2, 1.2) } as any;
    if (!uniforms.uRimColor) uniforms.uRimColor = { value: new THREE.Vector3(2.0, 2.0, 2.0) } as any;
    if (!uniforms.uAmbient) uniforms.uAmbient = { value: new THREE.Vector3(0.08, 0.08, 0.08) } as any;
    if (!uniforms.uExposure) uniforms.uExposure = { value: 1.3 } as any;
    const mat = new THREE.ShaderMaterial({
      vertexShader: defaultVertexShader(),
      fragmentShader: parsed.fragment,
      uniforms,
      wireframe,
      depthTest: true,
      depthWrite: true,
      transparent: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    } as any);
    if (materialRef.current) materialRef.current.dispose();
    materialRef.current = mat;
    if (three.mesh) three.mesh.material = mat;
  }, [fragCode, wireframe]);

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

  if (variant === "docked") {
    return (
      <Card className={cn("h-full flex flex-col", className)}>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">3D Preview</CardTitle>
          <div className="flex items-center gap-2">
            <div className="min-w-[120px]">
              <Select value={primitive} onValueChange={(v) => setPrimitive(v as Primitive)}>
                <SelectTrigger aria-label="Primitive">
                  <SelectValue placeholder="Primitive" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sphere">Sphere</SelectItem>
                  <SelectItem value="cube">Cube</SelectItem>
                  <SelectItem value="cylinder">Cylinder</SelectItem>
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
          <div className="rounded-md bg-muted overflow-hidden w-full h-full min-h-[240px]">
            <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
          </div>
          {working ? (
            <div className="mt-2 text-[11px] text-muted-foreground">Compiling…</div>
          ) : compileError ? (
            <div className="mt-2 text-[11px] text-red-500">{compileError}</div>
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
              <Select value={primitive} onValueChange={(v) => setPrimitive(v as Primitive)}>
                <SelectTrigger aria-label="Primitive">
                  <SelectValue placeholder="Primitive" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sphere">Sphere</SelectItem>
                  <SelectItem value="cube">Cube</SelectItem>
                  <SelectItem value="cylinder">Cylinder</SelectItem>
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
          <div className="rounded-md bg-muted overflow-hidden" style={{ width: "100%", height: 320 }}>
            <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
          </div>
          {working ? (
            <div className="mt-2 text-[11px] text-muted-foreground">Compiling…</div>
          ) : compileError ? (
            <div className="mt-2 text-[11px] text-red-500">{compileError}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default PreviewPanel;
