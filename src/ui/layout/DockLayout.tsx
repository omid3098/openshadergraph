import React, { useEffect, useMemo, useState } from "react";

type DockItem = {
  id: string;
  name: string;
  render: () => React.ReactNode;
};

type DockLayoutProps = {
  items: DockItem[];
  /** fixed width in px of the dock container (external) */
  className?: string;
  /**
   * Force simple tabs fallback (disables dynamic import of flexlayout-react).
   * Useful for tests where the dependency is unavailable.
   */
  forceTabsFallback?: boolean;
  /**
   * Called when user right-clicks the tab header area (for context menu).
   */
  onHeaderContextMenu?: (e: React.MouseEvent) => void;
};

/**
 * DockLayout attempts to load `flexlayout-react` at runtime. If available,
 * it renders a full docking Layout inside the given container. Otherwise it
 * falls back to a lightweight tabstrip implementation to keep the UI usable.
 */
export function DockLayout({ items, className, forceTabsFallback, onHeaderContextMenu }: DockLayoutProps) {
  const [flexMod, setFlexMod] = useState<any | null>(null);
  const [active, setActive] = useState<string>(() => {
    if (typeof localStorage !== "undefined") return localStorage.getItem("dock.activeTab") ?? (items[0]?.id ?? "");
    return items[0]?.id ?? "";
  });

  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("dock.activeTab", active);
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (forceTabsFallback) return;
      try {
        const mod = await import("flexlayout-react");
        if (!cancelled) setFlexMod(mod);
      } catch {
        // keep fallback
      }
    })();
    return () => { cancelled = true; };
  }, [forceTabsFallback]);

  if (!flexMod) {
    return (
      <div className={(className ? className + " " : "") + "relative"} data-testid="dock-fallback">
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-background/80 backdrop-blur text-xs" onContextMenu={(e) => { e.preventDefault(); onHeaderContextMenu?.(e); }}>
          {items.map((it) => (
            <button
              key={it.id}
              data-tab-id={it.id}
              onClick={() => setActive(it.id)}
              className={"px-2 py-1 rounded-md " + (active === it.id ? "bg-muted font-medium" : "hover:bg-muted")}
            >
              {it.name}
            </button>
          ))}
        </div>
        <div className="h-[calc(100%-28px)] overflow-hidden">
          {items.map((it) => (
            <div key={it.id} style={{ display: active === it.id ? "block" : "none", height: "100%" }}>
              {it.render()}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <FlexDock className={className} mod={flexMod} items={items} onHeaderContextMenu={onHeaderContextMenu} />;
}

function FlexDock({ className, mod, items, onHeaderContextMenu }: { className?: string; mod: any; items: DockItem[]; onHeaderContextMenu?: (e: React.MouseEvent) => void }) {
  const { Layout, Model, Actions } = mod as { Layout: any; Model: any; Actions: any };
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem("dock.model") : null;
  const defaultModel = useMemo(() => {
    return {
      global: { tabEnableFloat: true },
      layout: {
        type: "row",
        children: [
          {
            type: "tabset",
            weight: 100,
            selected: 0,
            children: items.map((it) => ({ type: "tab", name: it.name, component: it.id })),
          },
        ],
      },
    } as any;
  }, [items]);
  const [model, setModel] = useState<any>(() => Model.fromJson(stored ? JSON.parse(stored) : defaultModel));
  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("dock.model", JSON.stringify(model.toJson()));
  }, [model]);

  // When the set of items changes (enabled/disabled panels), ensure model reflects it
  useEffect(() => {
    try {
      const json = model.toJson();
      const present = new Set<string>();
      const walk = (node: any) => {
        if (!node) return;
        if (node.type === "tab" && node.component) present.add(String(node.component));
        for (const child of node.children ?? []) walk(child);
      };
      walk(json.layout);
      const desired = new Set(items.map((i) => i.id));
      const missing = [...desired].filter((id) => !present.has(id));
      const extra = [...present].filter((id) => !desired.has(id));
      if (missing.length || extra.length) {
        // Simplest approach: rebuild model from desired items
        setModel(Model.fromJson(defaultModel));
      }
    } catch {
      // If anything goes wrong, reset to default
      setModel(Model.fromJson(defaultModel));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  return (
    <div className={(className ? className + " " : "") + "relative"} data-testid="dock-flexlayout" onContextMenu={(e) => {
      // Only trigger when right-clicking the tab header area
      const target = e.target as HTMLElement | null;
      let el: HTMLElement | null = target;
      let isHeader = false;
      while (el) {
        const cls = String((el as any).className ?? "");
        if (cls.includes("flexlayout__tabset_header") || cls.includes("flexlayout__tab_button")) { isHeader = true; break; }
        el = el.parentElement;
      }
      if (isHeader) { e.preventDefault(); onHeaderContextMenu?.(e); }
    }}>
      <Layout
        model={model}
        factory={(node: any) => {
          const id = node.getComponent();
          const found = items.find((it) => it.id === id);
          return found ? <div style={{ height: "100%" }}>{found.render()}</div> : <div />;
        }}
        onModelChange={(m: any) => setModel(m)}
      />
    </div>
  );
}

export default DockLayout;
