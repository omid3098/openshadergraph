export const RECENT_GRAPHS_STORAGE_KEY = "openshadergraph.recentGraphs";
export const MAX_RECENT_GRAPHS = 5;

export type RecentGraphEntry = {
  name: string;
  contents: string;
};

const FALLBACK_NAME = "UntitledGraph.osg";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const getStorage = (): StorageLike | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch (_err) {
    return null;
  }
};

const persistEntries = (storage: StorageLike, entries: RecentGraphEntry[]): void => {
  try {
    storage.setItem(RECENT_GRAPHS_STORAGE_KEY, JSON.stringify(entries));
  } catch (_err) {
    // Ignore storage write failures (e.g., quota exceeded)
  }
};

const normalizeEntries = (value: unknown): RecentGraphEntry[] => {
  if (!Array.isArray(value)) return [];
  const result: RecentGraphEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const name = typeof (item as any).name === "string" && (item as any).name.trim().length
      ? (item as any).name.trim()
      : FALLBACK_NAME;
    const contents = typeof (item as any).contents === "string" ? (item as any).contents : "";
    result.push({ name, contents });
  }
  return result;
};

export const loadRecentGraphs = (): RecentGraphEntry[] => {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_GRAPHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const normalized = normalizeEntries(parsed);
    if (!normalized.length) {
      storage.removeItem(RECENT_GRAPHS_STORAGE_KEY);
      return [];
    }
    return normalized;
  } catch (_err) {
    storage.removeItem(RECENT_GRAPHS_STORAGE_KEY);
    return [];
  }
};

export const saveRecentGraph = (entry: { name: string; contents: string }): RecentGraphEntry[] => {
  const storage = getStorage();
  if (!storage) return [];
  const name = entry.name && entry.name.trim().length ? entry.name.trim() : FALLBACK_NAME;
  const contents = typeof entry.contents === "string" ? entry.contents : "";
  const existing = loadRecentGraphs();
  const filtered = existing.filter((item) => item.name !== name);
  const next = [{ name, contents }, ...filtered].slice(0, MAX_RECENT_GRAPHS);
  persistEntries(storage, next);
  return next;
};

export const removeRecentGraph = (name: string): RecentGraphEntry[] => {
  const storage = getStorage();
  if (!storage) return [];
  const existing = loadRecentGraphs();
  const next = existing.filter((entry) => entry.name !== name);
  if (!next.length) {
    storage.removeItem(RECENT_GRAPHS_STORAGE_KEY);
    return [];
  }
  persistEntries(storage, next);
  return next;
};

export const clearRecentGraphs = (): RecentGraphEntry[] => {
  const storage = getStorage();
  if (!storage) return [];
  storage.removeItem(RECENT_GRAPHS_STORAGE_KEY);
  return [];
};
