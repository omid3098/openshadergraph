import type { AssetItem } from "@/core/schema/types";
import { persistGet, persistSet } from "@/lib/storage";

export const USER_ASSETS_STORAGE_KEY = "assets.user";
export const USER_ASSETS_CHANGED_EVENT = "osg:user-assets:changed";

function notifyUserAssetsChanged(list: AssetItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(USER_ASSETS_CHANGED_EVENT, { detail: list }));
  } catch {
    // ignore
  }
}

function isAssetCandidate(value: unknown): value is AssetItem {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AssetItem>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.source === "string"
  );
}

function normalizeUserAsset(asset: AssetItem): AssetItem {
  return {
    ...asset,
    builtin: false,
  };
}

function sanitizeUserAssetList(list: unknown): AssetItem[] {
  if (!Array.isArray(list)) return [];
  const normalized: AssetItem[] = [];
  for (const item of list) {
    if (!isAssetCandidate(item)) continue;
    const type = item.type === "model" ? "model" : "texture";
    const label = item.label.trim().length > 0 ? item.label.trim() : item.source;
    normalized.push(
      normalizeUserAsset({
        ...item,
        type,
        label,
        description:
          item.description ??
          (type === "texture" ? "User provided texture asset." : "User provided model asset."),
        tags: Array.isArray(item.tags) && item.tags.length ? item.tags : ["user", type],
      })
    );
  }
  return normalized;
}

export async function loadUserAssets(): Promise<AssetItem[]> {
  const stored = await persistGet<AssetItem[] | null>(USER_ASSETS_STORAGE_KEY).catch(() => null);
  return sanitizeUserAssetList(stored ?? []);
}

export async function saveUserAssets(assets: AssetItem[]): Promise<void> {
  const sanitized = sanitizeUserAssetList(assets);
  await persistSet(USER_ASSETS_STORAGE_KEY, sanitized);
  notifyUserAssetsChanged(sanitized);
}

export function createUserAssetId(): string {
  const random = Math.random().toString(16).slice(2, 10);
  return `user-${Date.now()}-${random}`;
}

export function appendUserAsset(list: AssetItem[], asset: AssetItem): AssetItem[] {
  return [...list, normalizeUserAsset(asset)];
}

export function removeUserAssetById(list: AssetItem[], id: string): AssetItem[] {
  return list.filter((asset) => asset.id !== id);
}

export type { AssetItem };
