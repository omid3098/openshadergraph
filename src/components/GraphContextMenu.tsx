import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import type { NodePalette, NodePaletteItem } from "@/core/schema/types";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  expandAllCategories?: boolean;
};

export function GraphContextMenu(props: GraphContextMenuProps) {
  const { open, kind, x, y, palette, targetId, onClose, onAddNode, onDeleteNode, onGroupSelected, selectedCount, canUngroup, onUngroupNode, expandAllCategories } = props;
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [highlightIndex, setHighlightIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  const formatCategory = (name: string): string => {
    if (!name) return name;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
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
    if (!open) return;
    setQuery("");
    setHighlightIndex(0);
    if (kind === "background" && expandAllCategories) {
      // Expand all categories when requested
      const all = new Set<string>();
      if (palette && Array.isArray(palette.categories)) {
        for (const c of palette.categories) all.add(c.name);
      }
      setExpanded(all);
    } else {
      setExpanded(new Set());
    }
  }, [open, kind]);

  type VisibleItem =
    | { kind: "category"; key: string }
    | { kind: "node"; key: string; node: NodePaletteItem; parent?: string };

  const visibleItems: VisibleItem[] = useMemo(() => {
    if (kind !== "background" || !palette) return [];
    const q = query.trim().toLowerCase();
    // When searching, show flat node list with category labels
    if (q) {
      const matches = palette.flat
        .filter((n) => [n.name, n.type, n.category].some((s) => s.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name) || a.category.localeCompare(b.category));
      return matches.map((n) => ({ kind: "node", key: `${n.category}/${n.type}`, node: n }));
    }
    // No query: show categories first; expanded categories reveal nodes
    const items: VisibleItem[] = [];
    for (const c of palette.categories) {
      items.push({ kind: "category", key: c.name });
      if (expanded.has(c.name)) {
        for (const n of [...c.nodes].sort((a, b) => a.name.localeCompare(b.name))) {
          items.push({ kind: "node", key: `${c.name}/${n.type}`, node: n, parent: c.name });
        }
      }
    }
    return items;
  }, [kind, palette, query, expanded]);

  // Keep highlight index in range when list changes
  useEffect(() => {
    if (highlightIndex >= visibleItems.length) {
      setHighlightIndex(visibleItems.length > 0 ? visibleItems.length - 1 : 0);
    }
  }, [visibleItems, highlightIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = itemRefs.current[highlightIndex];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, visibleItems]);

  // Keyboard navigation for the background add-node menu
  useEffect(() => {
    if (!open || kind !== "background") return;
    const onKey = (e: KeyboardEvent) => {
      if (!visibleItems.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % visibleItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + visibleItems.length) % visibleItems.length);
      } else if (e.key === "ArrowRight") {
        const item = visibleItems[highlightIndex];
        if (!item) return;
        if (item.kind === "category") {
          e.preventDefault();
          if (!expanded.has(item.key)) {
            setExpanded((prev) => new Set([...prev, item.key]));
          }
        }
      } else if (e.key === "ArrowLeft") {
        const item = visibleItems[highlightIndex];
        if (!item) return;
        if (item.kind === "category") {
          e.preventDefault();
          if (expanded.has(item.key)) {
            setExpanded((prev) => {
              const next = new Set(prev);
              next.delete(item.key);
              return next;
            });
          }
        } else if (item.kind === "node" && item.parent) {
          e.preventDefault();
          // Move highlight to parent category row
          const parentIndex = visibleItems.findIndex((it) => it.kind === "category" && it.key === item.parent);
          if (parentIndex >= 0) setHighlightIndex(parentIndex);
        }
      } else if (e.key === "Enter") {
        const item = visibleItems[highlightIndex];
        if (!item) return;
        e.preventDefault();
        if (item.kind === "category") {
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(item.key)) next.delete(item.key);
            else next.add(item.key);
            return next;
          });
        } else if (item.kind === "node") {
          if (onAddNode) onAddNode(item.node);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, kind, visibleItems, highlightIndex, expanded, onAddNode]);

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
        {kind !== "background" && (
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">
              {kind === "selection" && `Selection • ${selectedCount ?? 0} nodes`}
              {kind === "node" && `Node • ${targetId ?? "(unknown)"}`}
              {kind === "edge" && `Connection • ${targetId ?? "(unknown)"}`}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex flex-col gap-1 p-3">
          {kind === "background" ? (
            <>
              <Input
                placeholder="Search nodes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="h-8 text-sm"
              />
              <div className="flex flex-col gap-1">
                {visibleItems.length === 0 && (
                  <div className="text-muted-foreground text-sm">No nodes found</div>
                )}
                <ul className="flex flex-col">
                  {visibleItems.map((it, idx) => {
                    if (it.kind === "category") {
                      const isOpen = expanded.has(it.key);
                      return (
                        <li
                          key={`cat:${it.key}`}
                          ref={(el) => { itemRefs.current[idx] = el; }}
                          className={cn(
                            "px-2 py-1 rounded-md cursor-pointer select-none flex items-center justify-between",
                            idx === highlightIndex && "bg-accent text-accent-foreground"
                          )}
                          role="menuitem"
                          aria-selected={idx === highlightIndex}
                          onMouseEnter={() => setHighlightIndex(idx)}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(it.key)) next.delete(it.key);
                              else next.add(it.key);
                              return next;
                            });
                          }}
                        >
                          <span className="text-sm font-semibold">{formatCategory(it.key)}</span>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 opacity-70" />
                          ) : (
                            <ChevronRight className="h-4 w-4 opacity-70" />
                          )}
                        </li>
                      );
                    }
                    // node item
                    return (
                      <li
                        key={`node:${it.key}`}
                        ref={(el) => { itemRefs.current[idx] = el; }}
                        className={cn(
                          "pl-6 pr-2 py-1 rounded-md cursor-pointer hover:bg-accent/80 hover:text-accent-foreground select-none",
                          idx === highlightIndex && "bg-accent text-accent-foreground"
                        )}
                        role="menuitem"
                        aria-selected={idx === highlightIndex}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onAddNode) onAddNode(it.node);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{it.node.name}</span>
                          <span className="text-xs text-muted-foreground">{formatCategory(it.node.category)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
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
