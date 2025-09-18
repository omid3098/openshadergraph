import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ComponentProps } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { fetchAssetLibrary } from "@/core/schema/assets";
import { inferAssetKind, MODEL_EXTENSIONS, TEXTURE_EXTENSIONS, ASSET_DRAG_MIME } from "@/core/assets/kind";
import type { AssetCategory, AssetItem, AssetLibrary } from "@/core/schema/types";
import { cn } from "@/lib/utils";
import { persistGet, persistSet } from "@/lib/storage";
import { Check, Copy, Box, Image as ImageIcon, Trash2 } from "lucide-react";
import { buildAssetHaystack, type AssetWithCategory } from "@/core/assets/search";

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

export function AssetsPanel({ className, variant = "docked" }: AssetsPanelProps) {
  const [library, setLibrary] = useState<AssetLibrary | null>(null);
  const [userAssets, setUserAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const deferredQuery = useDeferredValue(normalizedQuery);
  const textureHint = useMemo(() => TEXTURE_EXTENSIONS.map((ext) => `.${ext}`).slice(0, 6).join(", "), []);
  const modelHint = useMemo(() => MODEL_EXTENSIONS.map((ext) => `.${ext}`).slice(0, 6).join(", "), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchAssetLibrary(ctrl.signal)
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
  }, []);

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
    if (userAssets.length) {
      categories.push({
        id: "user",
        label: "My Assets",
        items: userAssets.map((asset) => ({ ...asset, builtin: false })),
      });
    }
    return categories;
  }, [library, userAssets]);

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
    if (!deferredQuery) return allAssets;
    return assetSearchIndex
      .filter((entry) => entry.haystack.includes(deferredQuery))
      .map((entry) => entry.asset);
  }, [allAssets, assetSearchIndex, deferredQuery]);

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

  const body = (
    <div className="flex flex-col gap-3 h-full nodrag nowheel" data-node-interactive>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground">Search assets</label>
        <Input
          placeholder="Filter by name, tag, or type"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
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
          <div className="flex-1 overflow-auto p-3" onWheel={(event) => event.stopPropagation()} data-node-interactive>
            {loading ? (
              <div className="p-4 text-xs text-muted-foreground">Loading assets…</div>
            ) : error ? (
              <div className="p-4 text-xs text-destructive" role="alert">
                {error}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No assets match the current filter.</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-3">
                {filteredAssets.map((asset) => {
                  const isTexture = asset.type === "texture";
                  const draggable = asset.type === "texture" || asset.type === "model";
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
                        {isTexture ? (
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
                            {asset.category.label}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <TypeBadge type={asset.type} />
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
                })}
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
