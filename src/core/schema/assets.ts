import type { AssetLibrary } from "./types";
import { validateAssetLibrary } from "./validators";

export async function fetchAssetLibrary(signal?: AbortSignal): Promise<AssetLibrary> {
  try {
    const res = await fetch("/api/assets", signal ? { signal } : undefined);
    if (res.ok) {
      const data = await res.json();
      return validateAssetLibrary(data);
    }
  } catch {}
  const res2 = await fetch("/data/assets/library.json", signal ? { signal } : undefined);
  if (!res2.ok) throw new Error(`Failed to load asset library: ${res2.status}`);
  const data2 = await res2.json();
  return validateAssetLibrary(data2);
}
