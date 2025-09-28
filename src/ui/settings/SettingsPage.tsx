import { useCallback, useEffect, useMemo, useRef } from "react";
import { Position, ReactFlow, ReactFlowProvider, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import ColoredEdge from "@/components/ColoredEdge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CurveMode, ThemeName } from "@/ui/state/SettingsContext";

type SettingsPageProps = {
  curveMode: CurveMode;
  onCurveModeChange: (value: CurveMode) => void;
  theme: ThemeName;
  onThemeChange: (value: ThemeName) => void;
};

const curveModeOptions: Array<{ value: CurveMode; label: string }> = [
  { value: "default", label: "Bezier" },
  { value: "smoothstep", label: "Smooth Step" },
  { value: "step", label: "Step" },
  { value: "straight", label: "Straight" },
  { value: "simplebezier", label: "Simple Bezier" },
];

const themeOptions: Array<{ value: ThemeName; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export function SettingsPage({ curveMode, onCurveModeChange, theme, onThemeChange }: SettingsPageProps) {
  return (
    <div className="w-full h-full overflow-auto p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Curve Mode</CardTitle>
            <CardDescription>Choose how connections render between nodes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2 md:max-w-xs">
                <Label htmlFor="curve-mode">Line style</Label>
                <Select value={curveMode} onValueChange={(val) => onCurveModeChange(val as CurveMode)}>
                  <SelectTrigger id="curve-mode" className="max-w-xs">
                    <SelectValue placeholder="Select curve mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {curveModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <CurveModePreview curveMode={curveMode} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default Theme</CardTitle>
            <CardDescription>Set the preferred appearance for the editor shell.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="default-theme">Theme</Label>
            <Select value={theme} onValueChange={(val) => onThemeChange(val as ThemeName)}>
              <SelectTrigger id="default-theme" className="max-w-xs">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                {themeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CurveModePreview({ curveMode }: { curveMode: CurveMode }) {
  const nodes = useMemo<Node[]>(() => [
    {
      id: "n1",
      position: { x: 0, y: 80 },
      data: { label: "Input" },
      sourcePosition: Position.Right,
      style: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "hsl(var(--border))",
        background: "hsl(var(--card))",
        color: "hsl(var(--card-foreground))",
        padding: "6px 10px",
        fontSize: 12,
      },
    },
    {
      id: "n2",
      position: { x: 200, y: 20 },
      data: { label: "Mix" },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "hsl(var(--accent))",
        background: "hsl(var(--accent))",
        color: "hsl(var(--accent-foreground))",
        padding: "6px 10px",
        fontSize: 12,
        boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
      },
    },
    {
      id: "n3",
      position: { x: 360, y: 110 },
      data: { label: "Output" },
      targetPosition: Position.Left,
      style: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "hsl(var(--border))",
        background: "hsl(var(--card))",
        color: "hsl(var(--card-foreground))",
        padding: "6px 10px",
        fontSize: 12,
      },
    },
  ], []);

  const edges = useMemo<Edge[]>(() => [
    {
      id: "e1-2",
      source: "n1",
      target: "n2",
      type: "colored",
      data: { sourceType: "float3", targetType: "float3" },
    },
    {
      id: "e2-3",
      source: "n2",
      target: "n3",
      type: "colored",
      data: { sourceType: "float4", targetType: "float3" },
    },
  ], []);

  const edgeTypes = useMemo(() => ({ colored: ColoredEdge as any }), []);
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    instanceRef.current = instance;
    instance.fitView({ padding: 32, duration: 0 });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inst = instanceRef.current;
    if (!inst) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        inst.fitView({ padding: 32, duration: 200 });
      } catch (_err) {
        // ignore resize exceptions
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [curveMode]);

  return (
    <div className="w-full md:max-w-[420px]">
      <div className="h-40 w-full rounded-lg border bg-muted/30 pointer-events-none">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: "colored" as any }}
            connectionLineType={curveMode}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: true }}
            onInit={handleInit}
            fitView
            style={{ width: "100%", height: "100%" }}
            className="[&_.react-flow__background]:hidden"
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
