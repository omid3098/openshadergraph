import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import type { NodePalette } from "@/core/schema/nodes";

export type ContextKind = "background" | "node" | "edge";

export type GraphContextMenuProps = {
  open: boolean;
  kind: ContextKind;
  x: number;
  y: number;
  palette?: NodePalette;
  targetId?: string; // node/edge id when kind !== background
  onClose: () => void;
};

export function GraphContextMenu(props: GraphContextMenuProps) {
  const { open, kind, x, y, palette, targetId, onClose } = props;
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open, kind]);

  // Compute filtered list for background menu
  const filtered = useMemo(() => {
    if (kind !== "background" || !palette) return [] as Array<{ heading: string; items: any[] }>;
    const q = query.trim().toLowerCase();
    if (!q) {
      return palette.categories.map((c) => ({ heading: c.name, items: c.nodes }));
    }
    const matches = palette.flat.filter((n) =>
      [n.name, n.type, n.category].some((s) => s.toLowerCase().includes(q)),
    );
    // Group matched by category for display
    const grouped: Record<string, typeof matches> = {};
    for (const m of matches) (grouped[m.category] ??= []).push(m);
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => ({ heading: k, items: grouped[k].sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [kind, palette, query]);

  if (!open) return null;

  // Basic size & placement logic; clamp within viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.min(360, vw - 16);
  const maxH = Math.min(420, vh - 16);
  const posX = Math.min(x, vw - maxW - 8);
  const posY = Math.min(y, vh - maxH - 8);

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      aria-hidden={!open}
    >
      <Card
        ref={ref}
        className="pointer-events-auto shadow-lg border bg-popover text-popover-foreground"
        style={{ position: "fixed", left: posX, top: posY, width: maxW, maxHeight: maxH, overflow: "auto" }}
        role="menu"
        aria-label="Graph context menu"
      >
        <CardHeader>
          <CardTitle className="text-sm">
            {kind === "background" && "Add Node"}
            {kind === "node" && `Node • ${targetId ?? "(unknown)"}`}
            {kind === "edge" && `Connection • ${targetId ?? "(unknown)"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {kind === "background" ? (
            <>
              <Input
                placeholder="Search nodes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <div className="flex flex-col gap-3">
                {filtered.length === 0 && (
                  <div className="text-muted-foreground text-sm">No nodes found</div>
                )}
                {filtered.map((group) => (
                  <div key={group.heading}>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {group.heading}
                    </div>
                    <ul className="flex flex-col">
                      {group.items.map((n) => (
                        <li
                          key={`${n.category}/${n.type}`}
                          className={cn(
                            "px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground",
                          )}
                          // Placeholder: no-op for now. Hook up later to create a node.
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Not adding nodes yet; close menu.
                            onClose();
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{n.name}</span>
                            <span className="text-xs text-muted-foreground">{n.type}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Actions coming soon…</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

