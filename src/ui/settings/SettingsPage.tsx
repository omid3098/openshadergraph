import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Position, ReactFlow, ReactFlowProvider, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import ColoredEdge from "@/components/ColoredEdge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatQuickHotkeyDisplay, type QuickNodeHotkey } from "@/core/ui/hotkeys";
import type { NodePalette, NodePaletteItem } from "@/core/schema/types";
import type { CurveMode, ThemeName } from "@/ui/state/SettingsContext";

type SettingsPageProps = {
  curveMode: CurveMode;
  onCurveModeChange: (value: CurveMode) => void;
  theme: ThemeName;
  onThemeChange: (value: ThemeName) => void;
  quickHotkeys: QuickNodeHotkey[];
  onQuickHotkeysChange: (next: QuickNodeHotkey[]) => void;
  palette: NodePalette | null;
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

export function SettingsPage({
  curveMode,
  onCurveModeChange,
  theme,
  onThemeChange,
  quickHotkeys,
  onQuickHotkeysChange,
  palette,
}: SettingsPageProps) {
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

        <HotkeySettingsCard hotkeys={quickHotkeys} onChange={onQuickHotkeysChange} palette={palette} />
      </div>
    </div>
  );
}

type HotkeySettingsCardProps = {
  hotkeys: QuickNodeHotkey[];
  onChange: (next: QuickNodeHotkey[]) => void;
  palette: NodePalette | null;
};

function HotkeySettingsCard({ hotkeys, onChange, palette }: HotkeySettingsCardProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [capturedCode, setCapturedCode] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const paletteOptions = useMemo(() => {
    if (!palette) return [] as NodePaletteItem[];
    const flat = Array.isArray(palette.flat) ? palette.flat : [];
    return [...flat].sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
  }, [palette]);

  const sortedHotkeys = useMemo(() => {
    return [...hotkeys].sort((a, b) => {
      const aLabel = (a.label ?? a.type).toLowerCase();
      const bLabel = (b.label ?? b.type).toLowerCase();
      if (aLabel === bLabel) return a.type.localeCompare(b.type);
      return aLabel.localeCompare(bLabel);
    });
  }, [hotkeys]);

  useEffect(() => {
    if (!selectedType) return;
    if (!paletteOptions.some((option) => option.type === selectedType)) {
      setSelectedType("");
    }
  }, [paletteOptions, selectedType]);

  useEffect(() => {
    if (!isCapturing) return;
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (event.key === "Escape") {
        setIsCapturing(false);
        setCaptureError(null);
        return;
      }
      const code = event.code;
      if (!isSupportedQuickHotkeyCode(code)) {
        setCaptureError("Use letter, digit, numpad, arrow, Space, or Enter keys.");
        return;
      }
      setCapturedCode(code);
      setIsCapturing(false);
      setCaptureError(null);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [isCapturing]);

  const existingWithCode = useMemo(
    () => (capturedCode ? hotkeys.find((entry) => entry.code === capturedCode) ?? null : null),
    [capturedCode, hotkeys]
  );

  const startCapture = useCallback(() => {
    if (isCapturing) {
      setIsCapturing(false);
      return;
    }
    setCapturedCode(null);
    setCaptureError(null);
    setIsCapturing(true);
  }, [isCapturing]);

  const handleRemove = useCallback(
    (code: string) => {
      onChange(hotkeys.filter((entry) => entry.code !== code));
    },
    [hotkeys, onChange]
  );

  const handleAdd = useCallback(() => {
    if (!selectedType || !capturedCode) return;
    const paletteItem = paletteOptions.find((item) => item.type === selectedType);
    const label = paletteItem?.name ?? selectedType;
    const next = hotkeys.filter((entry) => entry.code !== capturedCode);
    next.push({ code: capturedCode, type: selectedType, label });
    onChange(next);
    setCapturedCode(null);
  }, [capturedCode, hotkeys, onChange, paletteOptions, selectedType]);

  const canAdd = Boolean(!isCapturing && selectedType && capturedCode);
  const selectDisabled = paletteOptions.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Node Hotkeys</CardTitle>
        <CardDescription>
          Manage shortcuts for spawning nodes with ⌘⇧ (or Ctrl+⇧ on Windows/Linux).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {sortedHotkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quick hotkeys configured yet.</p>
          ) : (
            sortedHotkeys.map((entry) => (
              <div
                key={entry.code}
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium leading-none">{entry.label ?? entry.type}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatQuickHotkeyDisplay(entry.code)} · {entry.type}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(entry.code)}>
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4 border-t pt-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="quick-node-type">Node</Label>
              <Select
                value={selectedType}
                onValueChange={setSelectedType}
                disabled={selectDisabled}
              >
                <SelectTrigger id="quick-node-type" className="w-full">
                  <SelectValue placeholder={selectDisabled ? "Loading nodes..." : "Select node"} />
                </SelectTrigger>
                <SelectContent>
                  {paletteOptions.map((item) => (
                    <SelectItem key={item.type} value={item.type}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-hotkey-code">Key</Label>
              <Button
                id="quick-hotkey-code"
                type="button"
                variant="outline"
                onClick={startCapture}
                aria-pressed={isCapturing}
                className="w-full justify-between"
              >
                <span>{capturedCode ? formatQuickHotkeyDisplay(capturedCode) : isCapturing ? "Press a key" : "Record key"}</span>
                {isCapturing && <span className="text-xs text-muted-foreground">Esc to cancel</span>}
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={handleAdd} disabled={!canAdd}>
                {existingWithCode ? "Replace" : "Add"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Shortcuts trigger while holding ⌘⇧ or Ctrl+⇧. Existing assignments are replaced when reusing a key.
          </p>
          {captureError && <p className="text-xs text-destructive">{captureError}</p>}
          {existingWithCode && !captureError && (
            <p className="text-xs text-muted-foreground">
              {formatQuickHotkeyDisplay(existingWithCode.code)} currently spawns {existingWithCode.label ?? existingWithCode.type}.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function isSupportedQuickHotkeyCode(code: string): boolean {
  if (!code) return false;
  if (/^Key[A-Z]$/i.test(code)) return true;
  if (/^Digit[0-9]$/.test(code)) return true;
  if (/^Numpad[0-9]$/.test(code)) return true;
  if (/^Arrow(Up|Down|Left|Right)$/.test(code)) return true;
  return code === "Space" || code === "Enter";
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
            connectionLineType={curveMode === "default" ? "smoothstep" : curveMode as any}
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
