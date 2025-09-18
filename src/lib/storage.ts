/**
 * Simple async key-value persistence using IndexedDB with a localStorage fallback.
 *
 * Keys are strings. Values are stored via structured clone in IndexedDB,
 * and JSON-serialized when falling back to localStorage.
 */

const DB_NAME = "openshadergraph";
const STORE_NAME = "kv";

type PersistOptions = {
  /**
   * When false, the operation will try IndexedDB only and skip any localStorage
   * fallback. Useful for values (like FileSystem handles) that cannot be
   * JSON-serialized.
   */
  allowLocalStorageFallback?: boolean;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBAvailable(): boolean {
    try {
        return typeof indexedDB !== "undefined" && typeof window !== "undefined";
    } catch {
        return false;
    }
}

function openDb(): Promise<IDBDatabase> {
    if (!isIndexedDBAvailable()) {
        return Promise.reject(new Error("IndexedDB not available"));
    }
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
        });
    }
    return dbPromise;
}

export async function persistSet<T>(key: string, value: T, options?: PersistOptions): Promise<void> {
  const allowFallback = options?.allowLocalStorageFallback ?? true;
  // Try IndexedDB first
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value as any, key as IDBValidKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("IndexedDB put failed"));
    });
    return;
  } catch {
    if (!allowFallback) return;
    // fallback to localStorage
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }
}

const readFromLocalStorage = <T>(key: string): T | null => {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export async function persistGet<T>(key: string, options?: PersistOptions): Promise<T | null> {
  const allowFallback = options?.allowLocalStorageFallback ?? true;
  // Try IndexedDB first
  try {
    const db = await openDb();
    const res = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
    });
    if (res != null) return res as T;
    if (!allowFallback) return null;
    return readFromLocalStorage<T>(key);
  } catch {
    if (!allowFallback) return null;
    return readFromLocalStorage<T>(key);
  }
}

export async function persistRemove(key: string, options?: PersistOptions): Promise<void> {
  const allowFallback = options?.allowLocalStorageFallback ?? true;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("IndexedDB delete failed"));
    });
    return;
  } catch {
    if (!allowFallback) return;
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

