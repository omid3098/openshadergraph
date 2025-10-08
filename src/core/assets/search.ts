import type { AssetCategory, AssetItem } from "../schema/types";

export type AssetWithCategory = AssetItem & { category: AssetCategory };

export function buildAssetHaystack(asset: AssetWithCategory): string {
  return [
    asset.label ?? "",
    asset.type ?? "",
    asset.source ?? "",
    ...(asset.tags ?? []),
    asset.description ?? "",
    asset.category?.label ?? "",
    asset.provider?.name ?? "",
    asset.provider?.assetId ?? "",
  ]
    .join(" ")
    .toLowerCase();
}
