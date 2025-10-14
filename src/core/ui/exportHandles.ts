import { persistGet, persistRemove, persistSet } from "@/lib/storage";

const HANDLE_KEY_PREFIX = "exportHandle/";
const LAST_LANGUAGE_KEY_PREFIX = "exportHandleLastLanguage/";

const encodeKeyPart = (value: string): string => encodeURIComponent(value.trim());

const makeHandleKey = (graphLabel: string, languageKey: string): string =>
  `${HANDLE_KEY_PREFIX}${encodeKeyPart(graphLabel)}/${encodeKeyPart(languageKey)}`;

const makeLastLanguageKey = (graphLabel: string): string =>
  `${LAST_LANGUAGE_KEY_PREFIX}${encodeKeyPart(graphLabel)}`;

const supportsHandlePersistence = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.indexedDB !== "undefined";
  } catch {
    return false;
  }
};

export async function saveExportHandle(
  graphLabel: string,
  languageKey: string,
  handle: FileSystemFileHandle
): Promise<void> {
  if (!supportsHandlePersistence()) return;
  try {
    await persistSet<FileSystemFileHandle>(makeHandleKey(graphLabel, languageKey), handle, {
      allowLocalStorageFallback: false,
    });
  } catch (err) {
    console.warn("Failed to persist export handle", graphLabel, languageKey, err);
  }
}

export async function loadExportHandle(
  graphLabel: string,
  languageKey: string
): Promise<FileSystemFileHandle | null> {
  if (!supportsHandlePersistence()) return null;
  try {
    const handle = await persistGet<FileSystemFileHandle>(makeHandleKey(graphLabel, languageKey), {
      allowLocalStorageFallback: false,
    });
    if (handle && typeof handle === "object" && "kind" in handle) {
      return handle as FileSystemFileHandle;
    }
  } catch (err) {
    console.warn("Failed to load export handle", graphLabel, languageKey, err);
  }
  return null;
}

export async function removeExportHandle(graphLabel: string, languageKey: string): Promise<void> {
  if (!supportsHandlePersistence()) return;
  try {
    await persistRemove(makeHandleKey(graphLabel, languageKey), { allowLocalStorageFallback: false });
  } catch (err) {
    console.warn("Failed to remove export handle", graphLabel, languageKey, err);
  }
}

export async function setLastExportLanguage(graphLabel: string, languageKey: string): Promise<void> {
  const trimmedGraph = graphLabel.trim();
  if (!trimmedGraph) return;
  const key = makeLastLanguageKey(trimmedGraph);
  const trimmedLanguage = languageKey.trim();
  if (!trimmedLanguage) {
    try {
      await persistRemove(key);
    } catch (err) {
      console.warn("Failed to clear last export language", graphLabel, err);
    }
    return;
  }
  try {
    await persistSet<string>(key, trimmedLanguage);
  } catch (err) {
    console.warn("Failed to persist last export language", graphLabel, trimmedLanguage, err);
  }
}

export async function getLastExportLanguage(graphLabel: string): Promise<string | null> {
  const trimmedGraph = graphLabel.trim();
  if (!trimmedGraph) return null;
  try {
    const value = await persistGet<string>(makeLastLanguageKey(trimmedGraph));
    if (typeof value === "string" && value.trim().length) {
      return value.trim();
    }
  } catch (err) {
    console.warn("Failed to read last export language", graphLabel, err);
  }
  return null;
}
