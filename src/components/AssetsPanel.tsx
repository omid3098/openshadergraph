import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { fetchAssetLibrary, fetchAmbientcgCatalog } from "@/core/schema/assets";
import { inferAssetKind, MODEL_EXTENSIONS, TEXTURE_EXTENSIONS, ASSET_DRAG_MIME } from "@/core/assets/kind";
import type { AssetCategory, AssetItem, AssetLibrary } from "@/core/schema/types";
import { cn } from "@/lib/utils";
import { persistGet, persistSet } from "@/lib/storage";
import { Check, Copy, Box, Image as ImageIcon, Trash2, ExternalLink } from "lucide-react";
import { buildAssetHaystack, type AssetWithCategory } from "@/core/assets/search";
import { useSettings } from "@/ui/state/SettingsContext";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

export type AssetsPanelProps = {
  className?: string;
  variant?: "docked" | "overlay" | "node";
};

const USER_ASSETS_STORAGE_KEY = "assets.user";

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "texture", label: "Textures" },
  { value: "model", label: "Models" },
] as const;

type TypeFilterValue = (typeof TYPE_FILTER_OPTIONS)[number]["value"];

const CARD_MIN_WIDTH = 136;
const CARD_GAP_PX = 12;
const CARD_ESTIMATED_HEIGHT = 236;
const FALLBACK_RENDER_LIMIT = 48;

export function AssetsPanel({ className, variant = "docked" }: AssetsPanelProps) {
  const [library, setLibrary] = useState<AssetLibrary | null>(null);
  const [userAssets, setUserAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ambientState, setAmbientState] = useState<{
    items: AssetItem[];
    cursor: string | null;
    loading: boolean;
    error: string | null;
    generation: number;
  }>({ items: [], cursor: null, loading: false, error: null, generation: 0 });
  const ambientEmptyPageAttemptsRef = useRef(0);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>("all");
  const [dragActive, setDragActive] = useState(false);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    setScrollElement(node);
  }, []);
  const normalizedQuery = query.trim().toLowerCase();
  const deferredQuery = useDeferredValue(normalizedQuery);
  const textureHint = useMemo(() => TEXTURE_EXTENSIONS.map((ext) => `.${ext}`).slice(0, 6).join(", "), []);
  const modelHint = useMemo(() => MODEL_EXTENSIONS.map((ext) => `.${ext}`).slice(0, 6).join(", "), []);
  const { assetLibraries } = useSettings();

  const enabledProviders = useMemo(() => {
    const list: string[] = [];
    if (assetLibraries?.ambientcg?.enabled) {
      list.push("ambientcg");
    }
    return list;
  }, [assetLibraries]);

  const ambientEnabled = enabledProviders.includes("ambientcg");
  const providersKey = enabledProviders.join("|");

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchAssetLibrary({ signal: ctrl.signal, providers: enabledProviders })
      .then((data) => {
        const normalized: AssetLibrary = {
          ...data,
          categories: (data.categories ?? []).map((category) => ({
            ...category,
            items: (category.items ?? []).map((item) => ({ ...item, builtin: item.builtin !== false })),
          })),
        };
        setLibrary(normalized);
        setError(null);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.warn("Failed to load asset library", err);
        setError("Unable to load assets.");
        setLibrary(null);
      })
      .finally(() => {
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [providersKey, enabledProviders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await persistGet<AssetItem[]>(USER_ASSETS_STORAGE_KEY);
        if (cancelled || !stored) return;
        const normalized = stored
          .filter((asset): asset is AssetItem => !!asset && typeof asset.id === "string" && typeof asset.source === "string")
          .map((asset) => ({ ...asset, builtin: false }));
        setUserAssets(normalized);
      } catch (err) {
        console.warn("Failed to load user assets", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ambientQueryKey = useMemo(() => {
    const parts = [ambientEnabled ? "on" : "off", typeFilter, deferredQuery];
    return parts.join("|");
  }, [ambientEnabled, typeFilter, deferredQuery]);

  const loadMoreAmbient = useCallback(async () => {
    if (!ambientEnabled) return;
    let cursor: string | null | undefined;
    let generation = 0;
    let prevCount = 0;
    setAmbientState((prev) => {
      generation = prev.generation;
      prevCount = prev.items.length;
      if (prev.loading || !prev.cursor) {
        cursor = null;
        return prev;
      }
      cursor = prev.cursor;
      return { ...prev, loading: true, error: null };
    });
    if (!cursor) return;
    try {
      const result = await fetchAmbientcgCatalog({ cursor, query: deferredQuery, type: typeFilter });
      const shouldQueueMore =
        result.items.length === 0 &&
        !!result.cursor &&
        prevCount === 0 &&
        ambientEmptyPageAttemptsRef.current < 3;
      setAmbientState((prev) => {
        if (prev.generation !== generation) return prev;
        return {
          ...prev,
          items: [...prev.items, ...result.items],
          cursor: result.cursor,
          loading: false,
          error: null,
        };
      });
      if (result.items.length > 0) {
        ambientEmptyPageAttemptsRef.current = 0;
      } else {
        ambientEmptyPageAttemptsRef.current += 1;
      }
      if (shouldQueueMore) {
        Promise.resolve().then(() => {
          void loadMoreAmbient();
        });
      }
    } catch (err) {
      if ((err as any)?.name === "AbortError") return;
      setAmbientState((prev) => {
        if (prev.generation !== generation) return prev;
        return { ...prev, loading: false, error: "Unable to load ambientCG assets." };
      });
    }
  }, [ambientEnabled, deferredQuery, typeFilter]);

  useEffect(() => {
    if (!ambientEnabled) {
      setAmbientState({ items: [], cursor: null, loading: false, error: null, generation: 0 });
      return;
    }
    const ctrl = new AbortController();
    let generation = 0;
    ambientEmptyPageAttemptsRef.current = 0;
    setAmbientState((prev) => {
      const nextGeneration = prev.generation + 1;
      generation = nextGeneration;
      return { items: [], cursor: null, loading: true, error: null, generation: nextGeneration };
    });
    fetchAmbientcgCatalog({
      signal: ctrl.signal,
      query: deferredQuery,
      type: typeFilter,
    })
      .then((result) => {
        setAmbientState((prev) => {
          if (prev.generation !== generation) return prev;
          return { ...prev, items: result.items, cursor: result.cursor, loading: false, error: null };
        });
        if (result.items.length === 0 && result.cursor) {
          Promise.resolve().then(() => {
            void loadMoreAmbient();
          });
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setAmbientState((prev) => {
          if (prev.generation !== generation) return prev;
          return { ...prev, items: [], cursor: null, loading: false, error: "Unable to load ambientCG assets." };
        });
      });
    return () => {
      ctrl.abort();
    };
  }, [ambientEnabled, ambientQueryKey, deferredQuery, typeFilter, loadMoreAmbient]);

  useEffect(() => {
    const element = scrollElement;
    if (!element) return;

    const updateWidth = () => {
      setGridWidth(element.clientWidth);
    };

    updateWidth();

    window.addEventListener("resize", updateWidth);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(() => updateWidth());
      observer.observe(element);
    }

    return () => {
      window.removeEventListener("resize", updateWidth);
      observer?.disconnect();
    };
  }, [scrollElement]);

  const columnCount = useMemo(() => {
    if (!gridWidth) return 1;
    return Math.max(1, Math.floor((gridWidth + CARD_GAP_PX) / (CARD_MIN_WIDTH + CARD_GAP_PX)));
  }, [gridWidth]);

  const combinedCategories = useMemo(() => {
    const categories: AssetCategory[] = [];
    if (library) {
      for (const category of library.categories ?? []) {
        categories.push({
          ...category,
          items: (category.items ?? []).map((item) => ({ ...item, builtin: item.builtin !== false })),
        });
      }
    }
    if (ambientEnabled && ambientState.items.length) {
      categories.push({
        id: "ambientcg",
        label: "ambientCG",
        items: ambientState.items.map((item) => ({ ...item, builtin: item.builtin !== false })),
      });
    }
    if (userAssets.length) {
      categories.push({
        id: "user",
        label: "My Assets",
        items: userAssets.map((asset) => ({ ...asset, builtin: false })),
      });
    }
    return categories;
  }, [library, userAssets, ambientEnabled, ambientState.items]);

  const allAssets = useMemo(() => {
    const list: AssetWithCategory[] = [];
    for (const category of combinedCategories) {
      for (const item of category.items ?? []) {
        list.push({ ...item, category });
      }
    }
    return list;
  }, [combinedCategories]);

  const assetSearchIndex = useMemo(
    () =>
      allAssets.map((asset) => ({
        asset,
        haystack: buildAssetHaystack(asset),
      })),
    [allAssets]
  );

  const filteredAssets = useMemo(() => {
    if (!deferredQuery && typeFilter === "all") return allAssets;
    if (!deferredQuery) {
      return allAssets.filter((asset) => (typeFilter === "all" ? true : asset.type === typeFilter));
    }
    return assetSearchIndex
      .filter((entry) => {
        if (typeFilter !== "all" && entry.asset.type !== typeFilter) return false;
        return entry.haystack.includes(deferredQuery);
      })
      .map((entry) => entry.asset);
  }, [allAssets, assetSearchIndex, deferredQuery, typeFilter]);

  const rowCount = useMemo(() => {
    if (!filteredAssets.length) return 0;
    return Math.ceil(filteredAssets.length / columnCount);
  }, [filteredAssets, columnCount]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => CARD_ESTIMATED_HEIGHT,
    overscan: 6,
    getItemKey: (index) => filteredAssets[index * columnCount]?.id ?? `row-${index}`,
  });

  const virtualizationReady = Boolean(scrollElement && gridWidth > 0 && rowCount > 0);
  const ambientHasMore = ambientEnabled && !!ambientState.cursor;
  const ambientInitialLoading = ambientEnabled && ambientState.loading && ambientState.items.length === 0;
  const combinedLoading = loading || ambientInitialLoading;
  const ambientLoadingMore = ambientEnabled && ambientState.loading && ambientState.items.length > 0;
  const lastVirtualIndex = virtualizationReady
    ? rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.index ?? -1
    : -1;
  const fallbackAssets = virtualizationReady
    ? []
    : filteredAssets.slice(0, Math.min(filteredAssets.length, FALLBACK_RENDER_LIMIT));

  useEffect(() => {
    if (!ambientEnabled) return;
    if (!virtualizationReady) return;
    if (!ambientHasMore) return;
    if (ambientLoadingMore) return;
    if (lastVirtualIndex < 0) return;
    const threshold = filteredAssets.length - columnCount * 2;
    if (threshold <= 0 || lastVirtualIndex >= threshold) {
      void loadMoreAmbient();
    }
  }, [
    ambientEnabled,
    ambientHasMore,
    ambientLoadingMore,
    lastVirtualIndex,
    filteredAssets.length,
    columnCount,
    virtualizationReady,
    loadMoreAmbient,
  ]);

  const updateUserAssets = useCallback((updater: (prev: AssetItem[]) => AssetItem[]) => {
    setUserAssets((prev) => {
      const next = updater(prev).map((asset) => ({ ...asset, builtin: false }));
      void persistSet(USER_ASSETS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const removeUserAsset = useCallback((id: string) => {
    updateUserAssets((prev) => prev.filter((asset) => asset.id !== id));
  }, [updateUserAssets]);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return;

      const additions: AssetItem[] = [];
      for (const file of files) {
        const kind = inferAssetKind(file.name);
        if (!kind) continue;
        const dataUrl = await readFileAsDataUrl(file).catch(() => null);
        if (!dataUrl) continue;
        additions.push({
          id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          label: file.name,
          type: kind,
          source: dataUrl,
          description: kind === "texture" ? "User imported texture asset." : "User imported model asset.",
          tags: ["user", kind],
          builtin: false,
          preview: dataUrl,
        });
      }

      if (!additions.length) return;
      updateUserAssets((prev) => [...prev, ...additions]);
    },
    [updateUserAssets]
  );

  const dragProps = {
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    },
    onDragEnter: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(true);
    },
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        setDragActive(false);
      }
    },
    onDrop: handleDrop,
  };

  const serializeAsset = (asset: AssetWithCategory) =>
    JSON.stringify({ id: asset.id, label: asset.label, type: asset.type, source: asset.source, builtin: asset.builtin ?? false });

  const startDrag = useCallback((event: React.DragEvent, asset: AssetWithCategory) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(ASSET_DRAG_MIME, serializeAsset(asset));
  }, []);

  const renderAssetCard = useCallback(
    (asset: AssetWithCategory) => {
      const isTexture = asset.type === "texture";
      const draggable = asset.type === "texture" || asset.type === "model";
      const previewSrc = asset.preview ?? (isTexture ? asset.source : undefined);
      const providerName = asset.provider?.name ?? null;
      const providerLink = asset.provider?.assetUrl ?? null;
      return (
        <div
          key={`${asset.category.id}:${asset.id}`}
          className="group relative flex h-full flex-col gap-2 rounded-md border border-border/70 bg-background/90 p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,transform] hover:-translate-y-[1px] hover:border-primary/60"
          draggable={draggable}
          data-node-interactive
          onPointerDownCapture={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.stopPropagation();
            startDrag(event, asset);
          }}
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-muted/60 bg-muted">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt={asset.label}
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
                crossOrigin="anonymous"
                draggable={false}
              />
            ) : isTexture ? (
              <img
                src={asset.source}
                alt={asset.label}
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
                crossOrigin="anonymous"
                draggable={false}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <Box className="size-8" strokeWidth={1.5} />
              </div>
            )}
            {!asset.builtin ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 size-7 rounded-full border border-border/50 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeUserAsset(asset.id);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                title="Remove from My Assets"
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium leading-tight">{asset.label}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {providerName ? (
                  <span className="flex items-center gap-1">
                    <span>{providerName}</span>
                    <span>•</span>
                    <span className="truncate">{asset.category.label}</span>
                  </span>
                ) : (
                  asset.category.label
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <TypeBadge type={asset.type} />
              {providerLink ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
                  title="Open provider page"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    try {
                      window.open(providerLink, "_blank", "noopener,noreferrer");
                    } catch (_err) {
                      /* ignore */
                    }
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <ExternalLink className="size-3.5" />
                </Button>
              ) : null}
              <CopySourceButton
                source={asset.source}
                size="icon"
                variant="ghost"
                className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
                title="Copy asset path"
              />
            </div>
          </div>
        </div>
      );
    },
    [removeUserAsset, startDrag]
  );

  const body = (
    <div className="flex flex-col gap-3 h-full nodrag nowheel" data-node-interactive>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-1">
            <label className="text-xs text-muted-foreground">Search assets</label>
            <Input
              placeholder="Filter by name, tag, or provider"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:w-44">
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val as TypeFilterValue)}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {enabledProviders.length ? (
          <p className="text-[11px] leading-4 text-muted-foreground">
            Showing built-in assets{" "}
            {enabledProviders.includes("ambientcg") ? "and ambientCG library" : ""}.
          </p>
        ) : null}
      </div>
      <div
        {...dragProps}
        className={cn(
          "flex-1 overflow-hidden rounded border border-dashed transition-colors",
          dragActive ? "border-primary bg-primary/10" : "border-muted bg-muted/20"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-dashed border-muted/80 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            Drag textures ({textureHint}, …) or models ({modelHint}, …) here to store them locally. Imported assets stay in your browser.
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto p-3"
            onWheel={(event) => event.stopPropagation()}
            data-node-interactive
          >
            {combinedLoading ? (
              <div className="p-4 text-xs text-muted-foreground">Loading assets…</div>
            ) : error ? (
              <div className="p-4 text-xs text-destructive" role="alert">
                {error}
              </div>
            ) : ambientState.error && !ambientState.items.length ? (
              <div className="p-4 text-xs text-destructive" role="alert">
                {ambientState.error}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No assets match the current filter.</div>
            ) : virtualizationReady ? (
              <div className="relative w-full">
                <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const startIndex = virtualRow.index * columnCount;
                    const rowAssets = filteredAssets.slice(startIndex, startIndex + columnCount);
                    if (!rowAssets.length) return null;
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                          height: virtualRow.size,
                          paddingBottom: CARD_GAP_PX,
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          className="grid gap-3"
                          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                        >
                          {rowAssets.map(renderAssetCard)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {ambientLoadingMore ? (
                  <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">Loading more assets…</div>
                ) : null}
                {ambientState.error && ambientState.items.length ? (
                  <div className="px-2 pb-3 text-center text-[11px] text-destructive" role="alert">
                    {ambientState.error}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-3">
                {fallbackAssets.map(renderAssetCard)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === "node") {
    return (
      <div
        className={cn("h-full flex flex-col", className)}
        data-node-interactive
        onPointerDownCapture={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        {body}
      </div>
    );
  }

  if (variant === "docked") {
    return (
      <Card
        className={cn("h-full flex flex-col", className)}
        data-node-interactive
        onPointerDownCapture={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Assets</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex-1 overflow-hidden">
          {body}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("pointer-events-auto", className)}
      data-node-interactive
      onPointerDownCapture={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Assets</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 w-[320px] max-h-[60vh] overflow-hidden">{body}</CardContent>
    </Card>
  );
}

type CopySourceButtonProps = {
  source: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  title?: string;
};

function CopySourceButton({ source, variant = "outline", size = "sm", className, title }: CopySourceButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!source) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(source);
      } else {
        const el = document.createElement("textarea");
        el.value = source;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        copy();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      disabled={!source}
      className={className}
      title={copied ? "Copied" : title ?? "Copy path"}
    >
      {size === "icon" ? (
        copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />
      ) : copied ? (
        "Copied"
      ) : (
        title ?? "Copy path"
      )}
    </Button>
  );
}

function TypeBadge({ type }: { type: string }) {
  const normalized = type.toLowerCase();
  const icon = normalized === "texture" ? <ImageIcon className="size-3.5" /> : <Box className="size-3.5" />;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {normalized}
    </span>
  );
}

export default AssetsPanel;
