import type { AssetItem } from "@/core/schema/types";
import { fetchAssetLibrary, type FetchAssetLibraryOptions } from "@/core/schema/assets";
import { persistGet } from "@/lib/storage";

export type AssetRegistryEntry = {
  id: string;
  source: string;
  label?: string;
  type?: string;
  builtin?: boolean;
  preview?: string;
  provider?: AssetItem["provider"];
};

export type AssetRegistry = {
  byId: Map<string, AssetRegistryEntry>;
  bySource: Map<string, AssetRegistryEntry>;
};

const USER_ASSETS_STORAGE_KEY = "assets.user";

export async function loadAssetRegistry(options?: FetchAssetLibraryOptions): Promise<AssetRegistry> {
  const byId = new Map<string, AssetRegistryEntry>();
  const bySource = new Map<string, AssetRegistryEntry>();

  const register = (entry: AssetRegistryEntry) => {
    if (!entry.id || !entry.source) return;
    byId.set(entry.id, entry);
    bySource.set(entry.source, entry);
  };

  try {
    const library = await fetchAssetLibrary(options);
    for (const category of library.categories ?? []) {
      for (const item of category.items ?? []) {
        if (!item || typeof item.id !== "string" || typeof item.source !== "string") continue;
        register({
          id: item.id,
          source: item.source,
          label: item.label,
          type: item.type,
          builtin: item.builtin !== false,
          preview: item.preview,
          provider: item.provider,
        });
      }
    }
  } catch (err) {
    console.warn("Failed to load asset library while building registry", err);
  }

  try {
    const stored = await persistGet<AssetItem[]>(USER_ASSETS_STORAGE_KEY);
    for (const item of stored ?? []) {
      if (!item || typeof item.id !== "string" || typeof item.source !== "string") continue;
        register({
          id: item.id,
          source: item.source,
          label: item.label,
          type: item.type,
          builtin: false,
          preview: item.preview,
          provider: item.provider,
        });
      }
  } catch (err) {
    console.warn("Failed to load user assets while building registry", err);
  }

  return { byId, bySource };
}
