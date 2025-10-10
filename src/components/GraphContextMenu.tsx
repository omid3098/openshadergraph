import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import type { NodePalette, NodePaletteItem } from "@/core/schema/types";
import type { AlignmentKind, DistributionKind } from "@/core/ui/arrange";
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
  onDuplicateSelection?: (targetId?: string) => void;
  onCopySelection?: (targetId?: string) => void;
  onPasteFromClipboard?: () => void;
  canPaste?: boolean;
  selectedCount?: number;
  canUngroup?: boolean;
  onUngroupNode?: (id: string) => void;
  onClose: () => void;
  expandAllCategories?: boolean;
  onAlignSelected?: (alignment: AlignmentKind) => void;
  onDistributeSelected?: (distribution: DistributionKind) => void;
};

const ALIGNMENT_OPTIONS: Array<{ kind: AlignmentKind; label: string }> = [
  { kind: "left", label: "Left" },
  { kind: "center", label: "Center" },
  { kind: "right", label: "Right" },
  { kind: "top", label: "Top" },
  { kind: "middle", label: "Middle" },
  { kind: "bottom", label: "Bottom" },
];

const DISTRIBUTION_OPTIONS: Array<{ kind: DistributionKind; label: string }> = [
  { kind: "horizontal", label: "Horizontal" },
  { kind: "vertical", label: "Vertical" },
  { kind: "vertical-stack", label: "Vertical Stack" },
];

export function GraphContextMenu(props: GraphContextMenuProps) {
  const {
    open,
    kind,
    x,
    y,
    palette,
    targetId,
    onClose,
    onAddNode,
    onDeleteNode,
    onGroupSelected,
    onDuplicateSelection,
    onCopySelection,
    onPasteFromClipboard,
    canPaste = false,
    selectedCount,
    canUngroup,
    onUngroupNode,
    expandAllCategories,
    onAlignSelected,
    onDistributeSelected,
  } = props;
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [highlightIndex, setHighlightIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const selectionSize = selectedCount ?? 0;
  const canAlign = selectionSize >= 2 && Boolean(onAlignSelected);
  const canDistribute = selectionSize >= 3 && Boolean(onDistributeSelected);
  const [arrangementOpen, setArrangementOpen] = useState(false);
  const [activeArrangementSubmenu, setActiveArrangementSubmenu] = useState<"align" | "distribute" | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const hasArrangementActions = Boolean(onAlignSelected || onDistributeSelected);
  const arrangementButtonRef = useRef<HTMLButtonElement | null>(null);
  const arrangementPortalRef = useRef<HTMLDivElement | null>(null);
  const [menuWidth, setMenuWidth] = useState<number | null>(null);

  const baseMenuButtonClasses =
    "w-full px-2 py-1 text-sm rounded-md text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

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
      const target = e.target as Node | null;
      // Ignore clicks inside the portaled arrangement submenu or the anchor button
      if (arrangementPortalRef.current && target && arrangementPortalRef.current.contains(target)) return;
      if (arrangementButtonRef.current && target && arrangementButtonRef.current.contains(target)) return;
      if (!ref.current.contains(target as Node)) onClose();
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
    setArrangementOpen(false);
    setActiveArrangementSubmenu(null);
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
  }, [open, kind, expandAllCategories, palette]);

  useEffect(() => {
    if (!open) return;
    if (!hasArrangementActions) return;
    if (!canAlign && !canDistribute) {
      setArrangementOpen(false);
      setActiveArrangementSubmenu(null);
    }
  }, [open, hasArrangementActions, canAlign, canDistribute]);

  const closeArrangementMenus = useCallback(() => {
    setArrangementOpen(false);
    setActiveArrangementSubmenu(null);
  }, []);

  const closeArrangementIfFocusMoves = useCallback(() => {
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      const container = arrangementPortalRef.current;
      const anchor = arrangementButtonRef.current;
      const active = document.activeElement;
      if (container && active && container.contains(active)) return;
      if (anchor && active && anchor.contains(active)) return;
      closeArrangementMenus();
    });
  }, [closeArrangementMenus]);

  useEffect(() => {
    if (!arrangementOpen) return;
    const handlePointer = (event: MouseEvent | PointerEvent | FocusEvent) => {
      const container = arrangementPortalRef.current;
      const anchor = arrangementButtonRef.current;
      const target = event.target as Node | null;
      if (container && target && container.contains(target)) return;
      if (anchor && target && anchor.contains(target)) return;
      closeArrangementMenus();
    };
    const handleResize = () => closeArrangementMenus();
    document.addEventListener("mousedown", handlePointer, true);
    document.addEventListener("pointerdown", handlePointer, true);
    document.addEventListener("focusin", handlePointer, true);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      document.removeEventListener("mousedown", handlePointer, true);
      document.removeEventListener("pointerdown", handlePointer, true);
      document.removeEventListener("focusin", handlePointer, true);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [arrangementOpen, closeArrangementMenus]);

  useEffect(() => {
    if (!open) {
      setMenuWidth(null);
    }
  }, [open]);

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

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const card = ref.current;
    const previousWidth = card.style.width;
    card.style.width = "auto";
    const items = Array.from(card.querySelectorAll<HTMLElement>("[data-menu-item=\"true\"]"));
    const widest = items.reduce((max, el) => Math.max(max, el.offsetWidth), 0);
    const viewportMax = Math.min(260, window.innerWidth - 16);
    if (widest > 0) {
      setMenuWidth(Math.min(Math.ceil(widest * 1.15), viewportMax));
    } else {
      setMenuWidth(Math.min(180, viewportMax));
    }
    card.style.width = previousWidth;
  }, [open, kind, visibleItems, selectionSize, canPaste, canUngroup, canAlign, canDistribute, hasArrangementActions]);

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

  const updateArrangementPosition = useCallback(() => {
    if (!arrangementButtonRef.current) return;
    const rect = arrangementButtonRef.current.getBoundingClientRect();
    const approxHeight = 220;
    const approxWidth = 190;
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - approxHeight));
    const left = Math.min(rect.right + 6, window.innerWidth - approxWidth);
    setSubmenuPosition({ left, top });
  }, []);

  const renderArrangementSection = () => {
    if (!hasArrangementActions) return null;
    const allowAlign = canAlign && Boolean(onAlignSelected);
    const allowDistribute = canDistribute && Boolean(onDistributeSelected);
    if (!allowAlign && !allowDistribute) return null;
    const firstSubmenu: "align" | "distribute" | null = !allowAlign && allowDistribute ? "distribute" : allowAlign ? "align" : null;

    const openMenu = (autoSubmenu: boolean) => {
      updateArrangementPosition();
      setArrangementOpen(true);
      setActiveArrangementSubmenu(autoSubmenu ? firstSubmenu : null);
    };
    return (
      <button
        ref={arrangementButtonRef}
        className={cn(baseMenuButtonClasses, "flex items-center justify-between")}
        data-menu-item="true"
        aria-haspopup="true"
        aria-expanded={arrangementOpen}
        onMouseEnter={() => openMenu(false)}
        onFocus={() => openMenu(true)}
        onBlur={closeArrangementIfFocusMoves}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (arrangementOpen) {
            closeArrangementMenus();
          } else {
            openMenu(false);
          }
        }}
      >
        <span>Arrangement</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  };

  const arrangementPortal = arrangementOpen && hasArrangementActions && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={arrangementPortalRef}
          className="pointer-events-auto"
          style={{ position: "fixed", left: submenuPosition.left, top: submenuPosition.top, zIndex: 60 }}
        >
          <div className="rounded-md border bg-popover text-popover-foreground shadow-lg py-1 min-w-[170px]">
            {canAlign && onAlignSelected && (
              <div
                className="relative"
                onMouseEnter={() => { if (canAlign) setActiveArrangementSubmenu("align"); }}
                onFocusCapture={() => { if (canAlign) setActiveArrangementSubmenu("align"); }}
              >
                <button
                  className={cn(
                    "w-full px-3 py-1 text-sm flex items-center justify-between rounded-md transition-colors hover:bg-muted",
                    activeArrangementSubmenu === "align" && "bg-muted"
                  )}
                  onMouseEnter={() => { if (canAlign) setActiveArrangementSubmenu("align"); }}
                  onFocus={() => { if (canAlign) setActiveArrangementSubmenu("align"); }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveArrangementSubmenu("align");
                  }}
                >
                  <span>Align</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                {activeArrangementSubmenu === "align" && (
                  <div className="absolute left-full top-0 ml-1 rounded-md border bg-popover text-popover-foreground shadow-lg py-1 min-w-[150px]">
                    {ALIGNMENT_OPTIONS.map((option) => (
                      <button
                        key={`align:${option.kind}`}
                        className="w-full px-3 py-1 text-sm text-left rounded-md transition-colors hover:bg-muted"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onAlignSelected(option.kind);
                          closeArrangementMenus();
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {canDistribute && onDistributeSelected && (
              <div
                className="relative"
                onMouseEnter={() => { if (canDistribute) setActiveArrangementSubmenu("distribute"); }}
                onFocusCapture={() => { if (canDistribute) setActiveArrangementSubmenu("distribute"); }}
              >
                <button
                  className={cn(
                    "w-full px-3 py-1 text-sm flex items-center justify-between rounded-md transition-colors hover:bg-muted",
                    activeArrangementSubmenu === "distribute" && "bg-muted"
                  )}
                  onMouseEnter={() => { if (canDistribute) setActiveArrangementSubmenu("distribute"); }}
                  onFocus={() => { if (canDistribute) setActiveArrangementSubmenu("distribute"); }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveArrangementSubmenu("distribute");
                  }}
                >
                  <span>Distribute</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                {activeArrangementSubmenu === "distribute" && (
                  <div className="absolute left-full top-0 ml-1 rounded-md border bg-popover text-popover-foreground shadow-lg py-1 min-w-[150px]">
                    {DISTRIBUTION_OPTIONS.map((option) => (
                      <button
                        key={`distribute:${option.kind}`}
                        className="w-full px-3 py-1 text-sm text-left rounded-md transition-colors hover:bg-muted"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDistributeSelected(option.kind);
                          closeArrangementMenus();
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  const selectionActions: Array<{ key: string; label: string; onSelect: () => void }> = [];
  if (selectionSize > 0 && onCopySelection) {
    selectionActions.push({
      key: "copy-selection",
      label: `Copy Selection${selectionSize ? ` (${selectionSize})` : ""}`,
      onSelect: () => onCopySelection(),
    });
  }
  if (canPaste && onPasteFromClipboard) {
    selectionActions.push({
      key: "paste",
      label: "Paste",
      onSelect: () => onPasteFromClipboard(),
    });
  }
  if (selectionSize > 0 && onDuplicateSelection) {
    selectionActions.push({
      key: "duplicate-selection",
      label: `Duplicate Selection${selectionSize ? ` (${selectionSize})` : ""}`,
      onSelect: () => onDuplicateSelection(),
    });
  }
  if (selectionSize > 0 && onGroupSelected) {
    selectionActions.push({
      key: "group-selection",
      label: `Group Selected${selectionSize ? ` (${selectionSize})` : ""}`,
      onSelect: () => onGroupSelected(),
    });
  }

  const nodeActions: Array<{ key: string; label: string; onSelect: () => void }> = [];
  if (targetId && onCopySelection) {
    nodeActions.push({
      key: "copy-node",
      label: "Copy Node",
      onSelect: () => onCopySelection(targetId),
    });
  }
  if (targetId && onDuplicateSelection) {
    nodeActions.push({
      key: "duplicate-node",
      label: "Duplicate Node",
      onSelect: () => onDuplicateSelection(targetId),
    });
  }
  if (targetId && canUngroup && onUngroupNode) {
    nodeActions.push({
      key: "ungroup-node",
      label: "Ungroup",
      onSelect: () => onUngroupNode(targetId),
    });
  }
  if (selectionSize > 0 && onGroupSelected) {
    nodeActions.push({
      key: "group-from-node",
      label: `Group Selected${selectionSize ? ` (${selectionSize})` : ""}`,
      onSelect: () => onGroupSelected(),
    });
  }
  if (canPaste && onPasteFromClipboard) {
    nodeActions.push({
      key: "paste-node",
      label: "Paste",
      onSelect: () => onPasteFromClipboard(),
    });
  }
  if (targetId && onDeleteNode) {
    nodeActions.push({
      key: "delete-node",
      label: "Delete Node",
      onSelect: () => onDeleteNode(targetId),
    });
  }

  const edgeActions: Array<{ key: string; label: string; onSelect: () => void }> = [];
  if (canPaste && onPasteFromClipboard) {
    edgeActions.push({
      key: "paste-edge",
      label: "Paste",
      onSelect: () => onPasteFromClipboard(),
    });
  }

  const renderActionButtons = (actions: Array<{ key: string; label: string; onSelect: () => void }>) =>
    actions.map((action) => (
      <button
        key={action.key}
        className={baseMenuButtonClasses}
        data-menu-item="true"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          action.onSelect();
        }}
      >
        {action.label}
      </button>
    ));

  const arrangementContent = renderArrangementSection();

  if (!open) return null;

  // Basic size & placement logic; clamp within viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.min(260, vw - 16);
  const maxH = Math.min(420, vh - 16);
  const desiredWidth = menuWidth ? Math.min(menuWidth, maxW) : Math.min(220, maxW);
  const posX = Math.min(x, vw - desiredWidth - 8);
  const posY = Math.min(y, vh - maxH - 8);

  return (
    <>
      <div
        className="fixed inset-0 z-50 pointer-events-none"
        aria-hidden={!open}
      >
        <Card
          ref={ref}
          className="pointer-events-auto shadow-lg border bg-popover text-popover-foreground"
          style={{ position: "fixed", left: posX, top: posY, width: desiredWidth, maxHeight: maxH, overflow: "auto" }}
          role="menu"
          aria-label="Graph context menu"
        >
          {kind !== "background" && (
            <CardHeader className="py-1.5 px-2">
              <CardTitle className="text-sm">
                {kind === "selection" && `Selection • ${selectedCount ?? 0} nodes`}
                {kind === "node" && `Node • ${targetId ?? "(unknown)"}`}
                {kind === "edge" && `Connection • ${targetId ?? "(unknown)"}`}
              </CardTitle>
            </CardHeader>
          )}
          <CardContent className="flex flex-col gap-2 p-2">
            {kind === "background" ? (
              <>
                <Input
                  placeholder="Search nodes…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  className="h-8 w-full text-sm"
                />
                <div className="flex flex-col gap-1">
                  {visibleItems.length === 0 && (
                    <div className="text-muted-foreground text-sm">No nodes found</div>
                  )}
                  <ul className="flex flex-col gap-0.5">
                    {visibleItems.map((it, idx) => {
                    if (it.kind === "category") {
                      const isOpen = expanded.has(it.key);
                      return (
                        <li
                          key={`cat:${it.key}`}
                          ref={(el) => { itemRefs.current[idx] = el; }}
                          className={cn(
                            "px-2 py-1 rounded-md cursor-pointer select-none flex items-center justify-between transition-colors hover:bg-muted",
                            idx === highlightIndex && "bg-muted"
                          )}
                          role="menuitem"
                          aria-selected={idx === highlightIndex}
                          data-menu-item="true"
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
                          <span className="text-sm font-medium">{formatCategory(it.key)}</span>
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
                          "pl-6 pr-2 py-1 rounded-md cursor-pointer select-none transition-colors hover:bg-muted",
                          idx === highlightIndex && "bg-muted"
                        )}
                        role="menuitem"
                        aria-selected={idx === highlightIndex}
                        data-menu-item="true"
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
              <div className="flex flex-col gap-1">
                {renderActionButtons(selectionActions)}
                {arrangementContent}
                {!selectionActions.length && !arrangementContent && (
                  <div className="text-sm text-muted-foreground">No actions available</div>
                )}
              </div>
            ) : kind === "node" ? (
              <div className="flex flex-col gap-1">
                {renderActionButtons(nodeActions)}
                {arrangementContent}
                {!nodeActions.length && !arrangementContent && (
                  <div className="text-sm text-muted-foreground">No actions available</div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {renderActionButtons(edgeActions)}
                {!edgeActions.length && (
                  <div className="text-sm text-muted-foreground">Select nodes to enable more actions</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {arrangementPortal}
    </>
  );
}
