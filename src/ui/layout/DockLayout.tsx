import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { persistGet, persistSet } from "@/lib/storage";
import { cn } from "@/lib/utils";

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
   * Called when user right-clicks the tab header area (for context menu).
   */
  onHeaderContextMenu?: ((e: React.MouseEvent) => void) | undefined;
};

/**
 * DockLayout renders a simple tabstrip using shadcn Tabs. The active tab is
 * persisted so the selection survives reloads.
 */
export function DockLayout({ items, className, onHeaderContextMenu }: DockLayoutProps) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  // Load saved active tab
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await persistGet<string>("dock.activeTab");
      if (!mounted) return;
      if (saved && items.some((it) => it.id === saved)) setActive(saved);
    })();
    return () => {
      mounted = false;
    };
  }, [items]);

  // Persist active tab on change
  useEffect(() => {
    void persistSet("dock.activeTab", active);
  }, [active]);

  return (
    <Tabs
      value={active}
      onValueChange={setActive}
      className={cn("flex h-full flex-col", className)}
      data-testid="dock-tabs"
    >
      <TabsList
      className="flex-shrink-0 border-b bg-background/80 px-2 py-1 text-xs backdrop-blur"
      onContextMenu={(e) => {
        e.preventDefault();
        onHeaderContextMenu?.(e);
      }}
      >
        {items.map((it) => (
          <TabsTrigger key={it.id} value={it.id} className="px-2 py-1">
            {it.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((it) => (
        <TabsContent key={it.id} value={it.id} className="flex-1 overflow-hidden p-0">
          {it.render()}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default DockLayout;

