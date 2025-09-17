import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import type { NodePalette, NodePaletteItem } from "@/core/schema/types";

export type ContextKind = "background" | "node" | "edge" | "selection";

export type GraphContextMenuProps = {
  open: boolean;
  kind: ContextKind;
  x: number;
  y: number;
  palette?: NodePalette;
  targetId?: string; // node/edge id when kind !== background
  onAddNode?: (item: NodePaletteItem) => void;
  onDeleteNode?: (id: string) => void;
  onGroupSelected?: () => void;
  selectedCount?: number;
  canUngroup?: boolean;
  onUngroupNode?: (id: string) => void;
  onClose: () => void;
};

export function GraphContextMenu(props: GraphContextMenuProps) {
  const { open, kind, x, y, palette, targetId, onClose, onAddNode, onDeleteNode, onGroupSelected, selectedCount, canUngroup, onUngroupNode } = props;
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
            {kind === "selection" && `Selection • ${selectedCount ?? 0} nodes`}
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
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onAddNode) onAddNode(n);
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
          ) : kind === "selection" ? (
            <div className="flex flex-col gap-2">
              <button
                className={cn(
                  "px-2 py-1.5 rounded-md text-sm",
                  selectedCount && selectedCount > 0
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                disabled={!selectedCount || selectedCount <= 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (selectedCount && selectedCount > 0 && onGroupSelected) onGroupSelected();
                }}
              >
                Group Selected{selectedCount ? ` (${selectedCount})` : ""}
              </button>
            </div>
          ) : kind === "node" ? (
            <div className="flex flex-col gap-2">
              <button
                className={cn(
                  "px-2 py-1.5 rounded-md text-sm",
                  canUngroup
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                disabled={!canUngroup}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canUngroup && targetId && onUngroupNode) onUngroupNode(targetId);
                }}
              >
                Ungroup
              </button>
              <button
                className={cn(
                  "px-2 py-1.5 rounded-md text-sm",
                  selectedCount && selectedCount > 0
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                disabled={!selectedCount || selectedCount <= 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (selectedCount && selectedCount > 0 && onGroupSelected) onGroupSelected();
                }}
              >
                Group Selected{selectedCount ? ` (${selectedCount})` : ""}
              </button>
              <button
                className="px-2 py-1.5 rounded-md bg-destructive/10 text-destructive text-sm hover:bg-destructive/20"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (targetId && onDeleteNode) onDeleteNode(targetId);
                }}
              >
                Delete Node
              </button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Actions coming soon…</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
