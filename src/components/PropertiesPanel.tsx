import React, { useEffect, useMemo, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";

type PropertiesPanelProps = {
  className?: string;
  variant?: "overlay" | "docked";
};

type LanguagePack = {
  name: string;
  version: string;
  file_extensions: string[];
  nodes: Record<string, { template: string; properties?: Record<string, Record<string, { template: string }>> }>;
  meta?: Record<string, { template: string }>;
};

export function PropertiesPanel({ className, variant = "docked" }: PropertiesPanelProps) {
  const rf = useReactFlow();
  const nodes = useStore((s) => s.nodes);
  const selected = useMemo(() => nodes.find((n: any) => n.selected), [nodes]);
  const [langKey, setLangKey] = useState<string>(() => {
    if (typeof localStorage !== "undefined") return localStorage.getItem("compilePanel.language") ?? "ThreeJS_GLSL";
    return "ThreeJS_GLSL";
  });
  const [langPack, setLangPack] = useState<LanguagePack | null>(null);
  const [metaToAdd, setMetaToAdd] = useState<string>("");
  const [nameDraft, setNameDraft] = useState<string>("");
  const properties = useMemo(() => {
    const tpl = (selected?.data as any)?.template;
    return Array.isArray(tpl?.properties) ? (tpl.properties as any[]) : [];
  }, [selected?.data]);

  useEffect(() => {
    // Keep in sync with CompilePanel selection via localStorage
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("compilePanel.language") : null;
    if (stored && stored !== langKey) setLangKey(stored);
  }, [langKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = new URL("/api/language", location.origin);
        url.searchParams.set("name", langKey);
        const res = await fetch(url.toString());
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

  useEffect(() => {
    const label = (selected?.data as any)?.label ?? (selected?.data as any)?.template?.name ?? "";
    setNameDraft(String(label ?? ""));
  }, [selected]);

  const availableMetas = useMemo(() => Object.keys(langPack?.meta ?? {}).sort((a, b) => a.localeCompare(b)), [langPack]);
  const currentMetas: string[] = useMemo(() => {
    const tpl = (selected?.data as any)?.template;
    return Array.isArray(tpl?.meta) ? (tpl.meta as string[]) : [];
  }, [selected?.data]);

  const updateNodeName = (next: string) => {
    if (!selected) return;
    const external = (selected.data as any)?.updateNodeLabel as ((id: string, label: string) => void) | undefined;
    if (typeof external === "function") {
      external(selected.id, next);
      return;
    }
    // Fallback: update via ReactFlow store (may lose parentId when using filtered nodes)
    rf.setNodes((prev) =>
      prev.map((n: any) => {
        if (n.id !== selected.id) return n;
        const tpl = (n.data as any)?.template;
        const nextTpl = tpl ? { ...tpl, name: next } : tpl;
        return { ...n, data: { ...(n.data as any), label: next, template: nextTpl } };
      })
    );
  };

  const updateProperty = (propId: string, next: unknown) => {
    if (!selected || !propId) return;
    const external = (selected.data as any)?.updatePropertyValue as ((id: string, propId: string, val: unknown) => void) | undefined;
    if (typeof external === "function") {
      external(selected.id, propId, next);
      return;
    }
    rf.setNodes((prev) =>
      prev.map((n: any) => {
        if (n.id !== selected.id) return n;
        const tpl = (n.data as any)?.template ?? {};
        const props: any[] = Array.isArray((tpl as any).properties) ? ([...(tpl as any).properties] as any[]) : [];
        const nextProps = props.map((prop) =>
          prop && typeof prop === "object" && prop.id === propId ? { ...prop, value: next } : prop
        );
        return { ...n, data: { ...(n.data as any), template: { ...tpl, properties: nextProps } } };
      })
    );
  };

  const addMeta = (key: string) => {
    if (!selected || !key) return;
    const external = (selected.data as any)?.addNodeMeta as ((id: string, k: string) => void) | undefined;
    if (typeof external === "function") return external(selected.id, key);
    rf.setNodes((prev) =>
      prev.map((n: any) => {
        if (n.id !== selected.id) return n;
        const tpl = (n.data as any)?.template ?? {};
        const meta: string[] = Array.isArray((tpl as any).meta) ? ([...(tpl as any).meta] as string[]) : [];
        if (!meta.includes(key)) meta.push(key);
        return { ...n, data: { ...(n.data as any), template: { ...tpl, meta } } };
      })
    );
  };

  const removeMeta = (key: string) => {
    if (!selected) return;
    const external = (selected.data as any)?.removeNodeMeta as ((id: string, k: string) => void) | undefined;
    if (typeof external === "function") return external(selected.id, key);
    rf.setNodes((prev) =>
      prev.map((n: any) => {
        if (n.id !== selected.id) return n;
        const tpl = (n.data as any)?.template ?? {};
        const meta: string[] = (Array.isArray((tpl as any).meta) ? (tpl as any).meta : []).filter((m: any) => m !== key);
        return { ...n, data: { ...(n.data as any), template: { ...tpl, meta } } };
      })
    );
  };

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
              onChange={(e) => setNameDraft(e.target.value)}
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
              {currentMetas.length === 0 ? (
                <span className="text-xs text-muted-foreground">No metas</span>
              ) : (
                currentMetas
                  .filter((m) => typeof m === "string")
                  .map((m) => (
                    <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-muted border inline-flex items-center gap-1">
                      {m}
                      <button className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${m}`} onClick={() => removeMeta(m)}>
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
                      <div key={prop.id} className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">{prop.label ?? prop.id}</label>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={boolValue ? "default" : "outline"}
                            onClick={() => updateProperty(prop.id, !boolValue)}
                          >
                            {boolValue ? "Enabled" : "Disabled"}
                          </Button>
                        </div>
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
                    return (
                      <div key={prop.id} className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">{prop.label ?? prop.id}</label>
                        <div className="flex items-center gap-2">
                          <Input value={value ?? ""} placeholder="Drop asset here" readOnly />
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
