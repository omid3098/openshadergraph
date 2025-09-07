import React, { useEffect, useMemo, useState } from "react";
import { persistGet, persistSet } from "@/lib/storage";

type DockItem = {
  id: string;
  name: string;
  render: () => React.ReactNode;
};

type DockLayoutProps = {
  items: DockItem[];
  /** fixed width in px of the dock container (external) */
  className?: string | undefined;
  /**
   * Force simple tabs fallback (disables dynamic import of flexlayout-react).
   * Useful for tests where the dependency is unavailable.
   */
  forceTabsFallback?: boolean | undefined;
  /**
   * Called when user right-clicks the tab header area (for context menu).
   */
  onHeaderContextMenu?: ((e: React.MouseEvent) => void) | undefined;
};

/**
 * DockLayout attempts to load `flexlayout-react` at runtime. If available,
 * it renders a full docking Layout inside the given container. Otherwise it
 * falls back to a lightweight tabstrip implementation to keep the UI usable.
 */
export function DockLayout({ items, className, forceTabsFallback, onHeaderContextMenu }: DockLayoutProps) {
  const [flexMod, setFlexMod] = useState<any | null>(null);
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  // Load/save active tab via IndexedDB (fallbacks internally if unavailable)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await persistGet<string>("dock.activeTab");
      if (!mounted) return;
      if (saved && items.some((it) => it.id === saved)) setActive(saved);
    })();
    return () => { mounted = false; };
  }, [items]);

  useEffect(() => {
    void persistSet("dock.activeTab", active);
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

function FlexDock({ className, mod, items, onHeaderContextMenu }: { className?: string | undefined; mod: any; items: DockItem[]; onHeaderContextMenu?: ((e: React.MouseEvent) => void) | undefined }) {
  const { Layout, Model } = mod as { Layout: any; Model: any };
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
  const [model, setModel] = useState<any>(() => Model.fromJson(defaultModel));
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Load persisted layout model
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await persistGet<any>("dock.model");
        if (cancelled) return;
        if (json) setModel(Model.fromJson(json));
      } catch {
        // ignore; use default
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on changes (only after initial hydration to avoid overwriting saved state)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const json = model.toJson();
      void persistSet("dock.model", json);
    } catch {
      // ignore
    }
  }, [model, hydrated]);

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
        onModelChange={(m: any) => {
          setModel(m);
          if (hydrated) {
            try { const json = m.toJson(); void persistSet("dock.model", json); } catch { /* ignore */ }
          }
        }}
      />
    </div>
  );
}

export default DockLayout;
