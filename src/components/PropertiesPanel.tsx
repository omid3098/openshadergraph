import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@xyflow/react";
import { shallow } from "zustand/shallow";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useGraphState } from "@/core/ui/GraphStateContext";
import { resolveInspectorNodeId, type InspectorNodeLike } from "@/core/ui/inspector";
import { ASSET_DRAG_MIME } from "@/core/assets/kind";

type PropertiesPanelProps = {
  className?: string;
  variant?: "overlay" | "docked" | "node";
};

type LanguagePack = {
  name: string;
  version: string;
  file_extensions: string[];
  nodes: Record<string, { template: string; properties?: Record<string, Record<string, { template: string }>> }>;
  meta?: Record<string, { template: string }>;
};

export function PropertiesPanel({ className, variant = "docked" }: PropertiesPanelProps) {
  const selectedNodeIds = useStore(
    (s) => {
      const ids: string[] = [];
      for (const node of s.nodes) {
        if (node.selected) ids.push(node.id);
      }
      return ids;
    },
    shallow
  );
  const { nodesById, nodeUpdaterApi } = useGraphState();
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  useEffect(() => {
    const selectedNodes = selectedNodeIds
      .map((id) => nodesById.get(id) as InspectorNodeLike | undefined)
      .filter((node): node is InspectorNodeLike => Boolean(node));
    setInspectedNodeId((prev) => {
      const next = resolveInspectorNodeId({ previous: prev, selectedNodes, nodesById });
      return next === prev ? prev : next;
    });
  }, [selectedNodeIds, nodesById]);
  const selected = inspectedNodeId ? (nodesById.get(inspectedNodeId) as any) : undefined;
  const [langKey, setLangKey] = useState<string>(() => {
    if (typeof localStorage !== "undefined") return localStorage.getItem("compilePanel.language") ?? "ThreeJS_GLSL";
    return "ThreeJS_GLSL";
  });
  const [langPack, setLangPack] = useState<LanguagePack | null>(null);
  const [metaToAdd, setMetaToAdd] = useState<string>("");
  const [nameDraft, setNameDraft] = useState<string>("");
  const selectedData = selected?.data as any;
  const properties = useMemo(() => {
    const tpl = selectedData?.template;
    return Array.isArray(tpl?.properties) ? (tpl.properties as any[]) : [];
  }, [selectedData]);

  useEffect(() => {
    // Keep in sync with CompilePanel selection via localStorage
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("compilePanel.language") : null;
    if (stored && stored !== langKey) setLangKey(stored);
  }, [langKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ name: langKey });
        const res = await apiFetch(`/api/language?${params.toString()}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as LanguagePack;
        if (!cancelled) setLangPack(data);
      } catch (err) {
        console.warn("Failed to load language pack for properties", err);
        if (!cancelled) setLangPack(null);
      }
    })();
    return () => { cancelled = true; };
  }, [langKey]);

  const selectedLabel = selectedData?.label ?? selectedData?.template?.name ?? "";

  useEffect(() => {
    setNameDraft(String(selectedLabel ?? ""));
  }, [selectedLabel, inspectedNodeId]);

  const availableMetas = useMemo(() => Object.keys(langPack?.meta ?? {}).sort((a, b) => a.localeCompare(b)), [langPack]);
  const currentMetas: string[] = useMemo(() => {
    const tpl = selectedData?.template;
    return Array.isArray(tpl?.meta) ? (tpl.meta as string[]) : [];
  }, [selectedData]);

  const measuredWidth = useMemo(() => {
    if (!selected) return undefined;
    const nodeAny = selected as any;
    const width = nodeAny?.measured?.width ?? nodeAny?.width ?? nodeAny?.style?.width;
    if (typeof width === "number" && Number.isFinite(width)) return Math.round(width);
    if (typeof width === "string") {
      const parsed = Number.parseFloat(width);
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    return undefined;
  }, [selected]);

  const measuredHeight = useMemo(() => {
    if (!selected) return undefined;
    const nodeAny = selected as any;
    const height = nodeAny?.measured?.height ?? nodeAny?.height ?? nodeAny?.style?.height;
    if (typeof height === "number" && Number.isFinite(height)) return Math.round(height);
    if (typeof height === "string") {
      const parsed = Number.parseFloat(height);
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    return undefined;
  }, [selected]);

  const metaDisplay = useMemo(() => {
    return currentMetas.map((meta) => {
      if (
        typeof meta === "string" &&
        meta.startsWith("editor_size:") &&
        Number.isFinite(measuredWidth) &&
        Number.isFinite(measuredHeight)
      ) {
        return {
          raw: meta,
          display: `editor_size:${measuredWidth}x${measuredHeight}`,
        };
      }
      return { raw: meta, display: meta };
    });
  }, [currentMetas, measuredWidth, measuredHeight]);

  const updateNodeName = useCallback((next: string) => {
    if (!inspectedNodeId) return;
    nodeUpdaterApi.updateNodeLabel(inspectedNodeId, next);
  }, [nodeUpdaterApi, inspectedNodeId]);

  const updateProperty = useCallback((propId: string, next: unknown) => {
    if (!inspectedNodeId || !propId) return;
    nodeUpdaterApi.updatePropertyValue(inspectedNodeId, propId, next);
  }, [nodeUpdaterApi, inspectedNodeId]);

  const addMeta = useCallback((key: string) => {
    if (!inspectedNodeId || !key) return;
    nodeUpdaterApi.addNodeMeta(inspectedNodeId, key);
  }, [nodeUpdaterApi, inspectedNodeId]);

  const removeMeta = useCallback((key: string) => {
    if (!inspectedNodeId) return;
    nodeUpdaterApi.removeNodeMeta(inspectedNodeId, key);
  }, [nodeUpdaterApi, inspectedNodeId]);

  const body = (
    <div className="flex flex-col gap-3 h-full">
      {!selected ? (
        <div className="text-sm text-muted-foreground">Select a node to edit properties.</div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input
              value={nameDraft}
              onChange={(e) => {
                const next = e.target.value;
                setNameDraft(next);
                updateNodeName(next);
              }}
              onBlur={() => updateNodeName(nameDraft)}
              placeholder="Node name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Metas</label>
            <div className="flex items-center gap-2">
              <div className="min-w-[180px]">
                <Select value={metaToAdd} onValueChange={setMetaToAdd}>
                  <SelectTrigger aria-label="Add Meta">
                    <SelectValue placeholder="Select meta" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMetas.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => { addMeta(metaToAdd); setMetaToAdd(""); }} disabled={!metaToAdd}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {metaDisplay.length === 0 ? (
                <span className="text-xs text-muted-foreground">No metas</span>
              ) : (
                metaDisplay
                  .filter((entry) => typeof entry.display === "string")
                  .map(({ raw, display }) => (
                    <span key={raw} className="text-xs px-2 py-0.5 rounded-full bg-muted border inline-flex items-center gap-1">
                      {display}
                      <button className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${display}`} onClick={() => removeMeta(raw)}>
                        ×
                      </button>
                    </span>
                  ))
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Properties</label>
            {properties.length === 0 ? (
              <span className="text-xs text-muted-foreground">No properties</span>
            ) : (
              <div className="flex flex-col gap-2">
                {properties.map((prop: any) => {
                  const value = prop?.value ?? prop?.default ?? "";
                  if (!prop || typeof prop !== "object" || !prop.id) return null;
                  if (prop.type === "enum") {
                    const options: Array<{ value: string; label: string }> = Array.isArray(prop.options)
                      ? prop.options.map((opt: any) => ({ value: String(opt.value), label: String(opt.label ?? opt.value) }))
                      : [];
                    const normalizedValue = options.some((opt) => opt.value === String(value))
                      ? String(value)
                      : options[0]?.value ?? "";
                    return (
                      <div key={prop.id} className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">{prop.label ?? prop.id}</label>
                        <Select value={normalizedValue} onValueChange={(next) => updateProperty(prop.id, next)}>
                          <SelectTrigger aria-label={prop.label ?? prop.id}>
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }
                  if (prop.type === "boolean") {
                    const boolValue = Boolean(value);
                    return (
                      <div key={prop.id} className="flex items-center gap-2">
                        <input
                          id={`prop-${prop.id}`}
                          type="checkbox"
                          checked={boolValue}
                          onChange={(e) => updateProperty(prop.id, e.currentTarget.checked)}
                        />
                        <label htmlFor={`prop-${prop.id}`} className="text-xs text-muted-foreground select-none">
                          {prop.label ?? prop.id}
                        </label>
                      </div>
                    );
                  }
                  if (prop.type === "number") {
                    return (
                      <div key={prop.id} className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">{prop.label ?? prop.id}</label>
                    <Input
                      type="number"
                      value={value ?? ""}
                      onChange={(event) => {
                        const nextVal = event.target.value;
                        updateProperty(prop.id, nextVal === "" ? undefined : Number(nextVal));
                      }}
                    />
                  </div>
                );
              }
                  if (prop.type === "asset") {
                    const placeholder = prop.assetKind === "texture" ? "Enter texture URL" : "Enter asset URL";
                    return (
                      <div key={prop.id} className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">{prop.label ?? prop.id}</label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={value ?? ""}
                            placeholder={placeholder}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(event) => updateProperty(prop.id, event.target.value)}
                            onDrop={(event) => {
                              if (event.dataTransfer?.types.includes(ASSET_DRAG_MIME)) {
                                event.preventDefault();
                                event.stopPropagation();
                              }
                            }}
                            onDragOver={(event) => {
                              if (event.dataTransfer?.types.includes(ASSET_DRAG_MIME)) {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = "none";
                              }
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={() => updateProperty(prop.id, undefined)}>Clear</Button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={prop.id} className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">{prop.label ?? prop.id}</label>
                      <Input value={value ?? ""} onChange={(event) => updateProperty(prop.id, event.target.value)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (variant === "docked") {
    return (
      <Card className={cn("h-full flex flex-col", className)}>
        <CardContent className="px-4 pb-4 flex-1 overflow-auto">{body}</CardContent>
      </Card>
    );
  }

  if (variant === "node") {
    return (
      <div className={cn("h-full overflow-auto px-4 pb-4", className)}>
        {body}
      </div>
    );
  }

  return (
    <div className={cn("fixed bottom-2 right-2 z-40 pointer-events-none", className)}>
      <Card className="pointer-events-auto">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">{body}</CardContent>
      </Card>
    </div>
  );
}

export default PropertiesPanel;
