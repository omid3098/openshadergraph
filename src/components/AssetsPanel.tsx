import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { fetchAssetLibrary } from "@/core/schema/assets";
import { inferAssetKind, MODEL_EXTENSIONS, TEXTURE_EXTENSIONS, ASSET_DRAG_MIME } from "@/core/assets/kind";
import type { AssetCategory, AssetItem, AssetLibrary } from "@/core/schema/types";
import { cn } from "@/lib/utils";
import { persistGet, persistSet } from "@/lib/storage";

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
  variant?: "docked" | "overlay";
};

type AssetWithCategory = AssetItem & { category: AssetCategory };

const USER_ASSETS_STORAGE_KEY = "assets.user";

export function AssetsPanel({ className, variant = "docked" }: AssetsPanelProps) {
  const [library, setLibrary] = useState<AssetLibrary | null>(null);
  const [userAssets, setUserAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
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

  const filteredAssets = useMemo(() => {
    if (!normalizedQuery) return allAssets;
    return allAssets.filter((asset) => {
      const haystack = [asset.label, asset.type, asset.source, ...(asset.tags ?? []), asset.description ?? "", asset.category.label]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [allAssets, normalizedQuery]);

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
    <div className="flex flex-col gap-3 h-full">
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
          "flex-1 overflow-auto rounded border border-dashed transition-colors",
          dragActive ? "border-primary bg-primary/10" : "border-muted bg-muted/20"
        )}
      >
        <div className="p-3 text-[11px] leading-5 text-muted-foreground border-b border-dashed border-muted/80">
          Drag textures ({textureHint}, …) or models ({modelHint}, …) here to store them locally. Imported assets stay in your browser and can be removed later.
        </div>
        {loading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading assets…</div>
        ) : error ? (
          <div className="p-4 text-xs text-destructive" role="alert">
            {error}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">No assets match the current filter.</div>
        ) : (
          <ul className="divide-y">
            {filteredAssets.map((asset) => (
              <li
                key={`${asset.category.id}:${asset.id}`}
                className="p-3 hover:bg-background"
                draggable={asset.type === "texture" || asset.type === "model"}
                onDragStart={(event) => startDrag(event, asset)}
              >
                <div className="flex items-start gap-3">
                  {asset.type === "texture" ? (
                    <div className="w-16 h-16 rounded border bg-background overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <img src={asset.source} alt={asset.label} className="max-w-full max-h-full object-cover" loading="lazy" crossOrigin="anonymous" draggable={false} />
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium leading-tight">{asset.label}</div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {asset.category.label} • {asset.type}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!asset.builtin ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                              removeUserAsset(asset.id);
                            }}
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            Remove
                          </Button>
                        ) : null}
                        <CopySourceButton source={asset.source} />
                      </div>
                    </div>
                    {asset.description ? (
                      <p className="mt-2 text-xs text-muted-foreground">{asset.description}</p>
                    ) : null}
                    {asset.tags && asset.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {asset.tags.map((tag) => (
                          <span key={tag} className="text-[10px] uppercase tracking-wide bg-muted px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 text-[11px] text-muted-foreground break-all max-h-[72px] overflow-hidden">
                      {asset.source}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  if (variant === "docked") {
    return (
      <Card className={cn("h-full flex flex-col", className)}>
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
    <Card className={cn("pointer-events-auto", className)}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Assets</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 w-[320px] max-h-[60vh] overflow-hidden">{body}</CardContent>
    </Card>
  );
}

type CopySourceButtonProps = { source: string };

function CopySourceButton({ source }: CopySourceButtonProps) {
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
    <Button size="sm" variant="outline" onClick={copy} disabled={!source}>
      {copied ? "Copied" : "Copy path"}
    </Button>
  );
}

export default AssetsPanel;
