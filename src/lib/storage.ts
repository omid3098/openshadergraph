/**
 * Simple async key-value persistence using IndexedDB with a localStorage fallback.
 *
 * Keys are strings. Values are stored via structured clone in IndexedDB,
 * and JSON-serialized when falling back to localStorage.
 */

const DB_NAME = "openshadergraph";
const STORE_NAME = "kv";

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

export async function persistSet<T>(key: string, value: T): Promise<void> {
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
        // fallback to localStorage
        try {
            if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // ignore
        }
    }
}

export async function persistGet<T>(key: string): Promise<T | null> {
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
        // migrate from localStorage if key exists there
        try {
            if (typeof localStorage === "undefined") return null;
            const raw = localStorage.getItem(key);
            if (raw == null) return null;
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    } catch {
        // fallback to localStorage
        try {
            if (typeof localStorage === "undefined") return null;
            const raw = localStorage.getItem(key);
            if (raw == null) return null;
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }
}

export async function persistRemove(key: string): Promise<void> {
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
        try {
            if (typeof localStorage !== "undefined") localStorage.removeItem(key);
        } catch {
            // ignore
        }
    }
}


