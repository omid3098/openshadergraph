import type { AssetLibrary } from "./types";
import { validateAssetLibrary } from "./validators";

export type FetchAssetLibraryOptions = {
  signal?: AbortSignal;
  providers?: string[];
};

export async function fetchAssetLibrary(options?: FetchAssetLibraryOptions): Promise<AssetLibrary> {
  const signal = options?.signal;
  const rawProviders = Array.isArray(options?.providers) ? options.providers : [];
  const providers = rawProviders
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0);
  const params = new URLSearchParams();
  for (const provider of providers) {
    params.append("provider", provider);
  }
  const query = params.toString();
  const res = await fetch(`/api/assets${query ? `?${query}` : ""}`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Failed to load asset library: ${res.status}`);
  const data = await res.json();
  return validateAssetLibrary(data);
}
