/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { persistSetMock, persistGetMock, persistRemoveMock } = vi.hoisted(() => ({
  persistSetMock: vi.fn(),
  persistGetMock: vi.fn(),
  persistRemoveMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  persistSet: persistSetMock,
  persistGet: persistGetMock,
  persistRemove: persistRemoveMock,
}));

import {
  saveExportHandle,
  loadExportHandle,
  removeExportHandle,
  setLastExportLanguage,
  getLastExportLanguage,
} from "@/core/ui/exportHandles";

describe("exportHandles persistence helpers", () => {
  beforeEach(() => {
    persistSetMock.mockReset();
    persistGetMock.mockReset();
    persistRemoveMock.mockReset();
    persistSetMock.mockResolvedValue(undefined);
    persistGetMock.mockResolvedValue(null);
    persistRemoveMock.mockResolvedValue(undefined);
    (globalThis as any).window = { indexedDB: {} };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("persists handles with encoded keys", async () => {
    const handle = { kind: "file" } as unknown as FileSystemFileHandle;
    await saveExportHandle("My Graph", "Godot Shader", handle);
    expect(persistSetMock).toHaveBeenCalledWith(
      "exportHandle/My%20Graph/Godot%20Shader",
      handle,
      { allowLocalStorageFallback: false }
    );
  });

  it("loads previously saved handles", async () => {
    const handle = { kind: "file" } as unknown as FileSystemFileHandle;
    persistGetMock.mockResolvedValueOnce(handle);
    const loaded = await loadExportHandle("Example", "Lang");
    expect(loaded).toBe(handle);
    expect(persistGetMock).toHaveBeenCalledWith("exportHandle/Example/Lang", { allowLocalStorageFallback: false });
  });

  it("removes handles when requested", async () => {
    await removeExportHandle("Graph", "Lang");
    expect(persistRemoveMock).toHaveBeenCalledWith("exportHandle/Graph/Lang", { allowLocalStorageFallback: false });
  });

  it("stores and clears last export language", async () => {
    await setLastExportLanguage("Graph", "Lang");
    expect(persistSetMock).toHaveBeenCalledWith("exportHandleLastLanguage/Graph", "Lang");

    persistSetMock.mockClear();
    await setLastExportLanguage("Graph", "");
    expect(persistRemoveMock).toHaveBeenCalledWith("exportHandleLastLanguage/Graph");
  });

  it("reads last export language", async () => {
    persistGetMock.mockResolvedValueOnce("Lang");
    const value = await getLastExportLanguage("Graph");
    expect(value).toBe("Lang");
  });
});
