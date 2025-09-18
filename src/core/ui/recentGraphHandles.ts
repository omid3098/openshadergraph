import { persistGet, persistRemove, persistSet } from "@/lib/storage";

const HANDLE_KEY_PREFIX = "recentGraphHandle/";

const makeKey = (name: string): string => `${HANDLE_KEY_PREFIX}${encodeURIComponent(name.trim())}`;

const supportsHandlePersistence = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.indexedDB !== "undefined";
  } catch {
    return false;
  }
};

export async function saveRecentGraphHandle(name: string, handle: FileSystemFileHandle | null): Promise<void> {
  if (!supportsHandlePersistence()) return;
  const key = makeKey(name);
  if (!handle) {
    try {
      await persistRemove(key, { allowLocalStorageFallback: false });
    } catch {
      // ignore
    }
    return;
  }
  try {
    await persistSet<FileSystemFileHandle>(key, handle, { allowLocalStorageFallback: false });
  } catch (err) {
    console.warn("Failed to persist recent graph handle", name, err);
  }
}

export async function loadRecentGraphHandle(name: string): Promise<FileSystemFileHandle | null> {
  if (!supportsHandlePersistence()) return null;
  try {
    const handle = await persistGet<FileSystemFileHandle>(makeKey(name), { allowLocalStorageFallback: false });
    if (handle && typeof handle === "object" && "kind" in handle) {
      return handle as FileSystemFileHandle;
    }
  } catch {
    // ignore load errors and fall through to null
  }
  return null;
}

export async function removeRecentGraphHandle(name: string): Promise<void> {
  if (!supportsHandlePersistence()) return;
  try {
    await persistRemove(makeKey(name), { allowLocalStorageFallback: false });
  } catch {
    // ignore
  }
}
