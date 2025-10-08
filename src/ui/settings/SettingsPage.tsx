import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Position, ReactFlow, ReactFlowProvider, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import ColoredEdge from "@/components/ColoredEdge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQuickHotkeyDisplay, type QuickNodeHotkey } from "@/core/ui/hotkeys";
import type { AssetItem, NodePalette, NodePaletteItem } from "@/core/schema/types";
import type { AssetLibrariesSettings, CurveMode, ThemeName } from "@/ui/state/SettingsContext";
import { Plus, Trash2 } from "lucide-react";
import {
  appendUserAsset,
  createUserAssetId,
  loadUserAssets,
  removeUserAssetById,
  saveUserAssets,
  USER_ASSETS_CHANGED_EVENT,
} from "@/core/assets/userAssets";

type SettingsPageProps = {
  curveMode: CurveMode;
  onCurveModeChange: (value: CurveMode) => void;
  theme: ThemeName;
  onThemeChange: (value: ThemeName) => void;
  quickHotkeys: QuickNodeHotkey[];
  onQuickHotkeysChange: (next: QuickNodeHotkey[]) => void;
  palette: NodePalette | null;
  assetLibraries: AssetLibrariesSettings;
  onAssetLibrariesChange: (
    next: AssetLibrariesSettings | ((prev: AssetLibrariesSettings) => AssetLibrariesSettings)
  ) => void;
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
  assetLibraries,
  onAssetLibrariesChange,
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

        <AssetLibrariesCard assetLibraries={assetLibraries} onChange={onAssetLibrariesChange} />

        <HotkeySettingsCard hotkeys={quickHotkeys} onChange={onQuickHotkeysChange} palette={palette} />

        <Card>
          <CardHeader>
            <CardTitle>About Me</CardTitle>
            <CardDescription>
              I&apos;m Omid Saadat - Trying to make bridges.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li>
                <a
                  className="transition-colors hover:text-foreground"
                  href="https://omid-saadat.com"
                  rel="noreferrer"
                  target="_blank"
                >
                  omid-saadat.com
                </a>
              </li>
              <li>
                <a
                  className="transition-colors hover:text-foreground"
                  href="https://x.com/omid3098"
                  rel="noreferrer"
                  target="_blank"
                >
                  @omid3098 on X
                </a>
              </li>
              <li>
                <a
                  className="transition-colors hover:text-foreground"
                  href="https://github.com/omid3098"
                  rel="noreferrer"
                  target="_blank"
                >
                  @omid3098 on GitHub
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type AssetLibrariesCardProps = {
  assetLibraries: AssetLibrariesSettings;
  onChange: (
    next: AssetLibrariesSettings | ((prev: AssetLibrariesSettings) => AssetLibrariesSettings)
  ) => void;
};

function AssetLibrariesCard({ assetLibraries, onChange }: AssetLibrariesCardProps) {
  const ambientEnabled = assetLibraries?.ambientcg?.enabled ?? false;
  const [manualAssets, setManualAssets] = useState<AssetItem[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [manualType, setManualType] = useState<"texture" | "model">("texture");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadUserAssets();
        if (cancelled) return;
        setManualAssets(stored);
      } catch (err) {
        console.warn("Failed to load saved assets", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<AssetItem[]>).detail;
      if (!Array.isArray(detail)) return;
      setManualAssets(detail);
    };
    window.addEventListener(USER_ASSETS_CHANGED_EVENT, listener as EventListener);
    return () => {
      window.removeEventListener(USER_ASSETS_CHANGED_EVENT, listener as EventListener);
    };
  }, []);

  const persistManualAssets = useCallback((updater: (prev: AssetItem[]) => AssetItem[]) => {
    setManualAssets((prev) => {
      const next = updater(prev);
      void saveUserAssets(next).catch((err) => {
        console.warn("Failed to persist manual assets", err);
      });
      return next;
    });
  }, []);

  const toggleManualForm = useCallback(() => {
    setShowManualForm((prev) => {
      const next = !prev;
      if (!next) {
        setManualUrl("");
        setManualLabel("");
        setManualType("texture");
        setManualError(null);
      }
      return next;
    });
  }, []);

  const handleManualSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedUrl = manualUrl.trim();
      if (!trimmedUrl) {
        setManualError("Enter a valid URL.");
        return;
      }
      let normalizedUrl: string;
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("Unsupported protocol");
        }
        normalizedUrl = parsed.toString();
      } catch {
        setManualError("Enter a valid HTTP or HTTPS URL.");
        return;
      }
      const label = manualLabel.trim() || normalizedUrl;
      const type = manualType === "model" ? "model" : "texture";
      const description =
        type === "texture" ? "Manually added texture asset." : "Manually added model asset.";
      const tags = ["user", type, "manual"];
      const asset: AssetItem = {
        id: createUserAssetId(),
        label,
        type,
        source: normalizedUrl,
        description,
        tags,
        builtin: false,
        preview: type === "texture" ? normalizedUrl : undefined,
      };
      persistManualAssets((prev) => appendUserAsset(prev, asset));
      setManualUrl("");
      setManualLabel("");
      setManualType("texture");
      setManualError(null);
    },
    [manualLabel, manualType, manualUrl, persistManualAssets]
  );

  const handleManualRemove = useCallback(
    (id: string) => {
      persistManualAssets((prev) => removeUserAssetById(prev, id));
    },
    [persistManualAssets]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Libraries</CardTitle>
        <CardDescription>Connect external providers and save your own asset URLs for quick access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">ambientCG</div>
            <p className="text-xs text-muted-foreground">
              Browse thousands of free PBR materials and HDRI textures from ambientCG directly inside the Assets panel.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={ambientEnabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                onChange((prev) => ({ ...prev, ambientcg: { enabled } }));
              }}
              className="h-4 w-4 accent-primary"
            />
            <span>{ambientEnabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>
        <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="text-sm font-medium">Manual Asset URLs</div>
              <p className="text-xs text-muted-foreground">
                Store direct links to textures or models so they stay available in the My Assets section.
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={toggleManualForm}
              aria-label={showManualForm ? "Hide manual asset form" : "Add manual asset"}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {showManualForm ? (
            <form className="space-y-3" onSubmit={handleManualSubmit}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="manual-asset-url">Asset URL</Label>
                  <Input
                    id="manual-asset-url"
                    type="url"
                    value={manualUrl}
                    onChange={(event) => setManualUrl(event.target.value)}
                    placeholder="https://example.com/diffuse.png"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-asset-type">Type</Label>
                  <select
                    id="manual-asset-type"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={manualType}
                    onChange={(event) => setManualType(event.target.value === "model" ? "model" : "texture")}
                  >
                    <option value="texture">Texture</option>
                    <option value="model">Model</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="manual-asset-label">Display name (optional)</Label>
                <Input
                  id="manual-asset-label"
                  value={manualLabel}
                  onChange={(event) => setManualLabel(event.target.value)}
                  placeholder="Wood Floor Albedo"
                />
              </div>
              {manualError ? <p className="text-xs text-destructive">{manualError}</p> : null}
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  Save Asset
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={toggleManualForm}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
          {manualAssets.length > 0 ? (
            <ul className="space-y-2">
              {manualAssets.map((asset) => (
                <li
                  key={asset.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{asset.label}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {asset.type === "model" ? "Model" : "Texture"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => handleManualRemove(asset.id)}
                    aria-label={`Remove ${asset.label}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] leading-5 text-muted-foreground">
              Saved assets appear in the Assets panel under My Assets for quick drag-and-drop access.
            </p>
          )}
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          ambientCG assets respect your search and type filters, and manual URLs stay synced with the My Assets collection.
        </p>
      </CardContent>
    </Card>
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
