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
};

/**
 * DockLayout attempts to load `flexlayout-react` at runtime. If available,
 * it renders a full docking Layout inside the given container. Otherwise it
 * falls back to a lightweight tabstrip implementation to keep the UI usable.
 */
export function DockLayout({ items, className, forceTabsFallback }: DockLayoutProps) {
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
      <div className={className} data-testid="dock-fallback">
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-background/80 backdrop-blur text-xs">
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

  return <FlexDock className={className} mod={flexMod} items={items} />;
}

function FlexDock({ className, mod, items }: { className?: string; mod: any; items: DockItem[] }) {
  const { Layout, Model } = mod as { Layout: any; Model: any };
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
  return (
    <div className={className} data-testid="dock-flexlayout">
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
