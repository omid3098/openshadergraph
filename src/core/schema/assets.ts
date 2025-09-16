import type { AssetLibrary } from "./types";
import { validateAssetLibrary } from "./validators";

export async function fetchAssetLibrary(signal?: AbortSignal): Promise<AssetLibrary> {
  const res = await fetch("/api/assets", { signal });
  if (!res.ok) throw new Error(`Failed to load asset library: ${res.status}`);
  const data = await res.json();
  return validateAssetLibrary(data);
}
