import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  persistSet: vi.fn(() => Promise.resolve()),
  persistGet: vi.fn(() => Promise.resolve(null)),
  persistRemove: vi.fn(() => Promise.resolve()),
}));

const getStorageMocks = () => import("@/lib/storage");

describe("recentGraphHandles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).window = { indexedDB: {} } as Window & typeof globalThis;
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("persists provided handles via IndexedDB without localStorage fallback", async () => {
    const { saveRecentGraphHandle } = await import("../recentGraphHandles");
    const { persistSet } = await getStorageMocks();

    const handle = { kind: "file" } as unknown as FileSystemFileHandle;
    await saveRecentGraphHandle("foo.osg", handle);

    expect(persistSet).toHaveBeenCalledTimes(1);
    const [key, storedHandle, opts] = (persistSet as any).mock.calls[0];
    expect(key).toContain("foo.osg");
    expect(storedHandle).toBe(handle);
    expect(opts).toEqual({ allowLocalStorageFallback: false });
  });

  it("removes stored handle entries when passed null", async () => {
    const { saveRecentGraphHandle } = await import("../recentGraphHandles");
    const { persistRemove } = await getStorageMocks();

    await saveRecentGraphHandle("foo.osg", null);

    expect(persistRemove).toHaveBeenCalledWith(expect.stringContaining("foo.osg"), {
      allowLocalStorageFallback: false,
    });
  });

  it("loads stored handles when available", async () => {
    const { loadRecentGraphHandle } = await import("../recentGraphHandles");
    const { persistGet } = await getStorageMocks();

    const handle = { kind: "file" } as unknown as FileSystemFileHandle;
    (persistGet as any).mockResolvedValueOnce(handle);

    const result = await loadRecentGraphHandle("foo.osg");
    expect(result).toBe(handle);
    expect(persistGet).toHaveBeenCalledWith(expect.any(String), { allowLocalStorageFallback: false });
  });

  it("no-ops when IndexedDB is unavailable", async () => {
    delete (globalThis as any).window;
    const { saveRecentGraphHandle, loadRecentGraphHandle } = await import("../recentGraphHandles");
    const { persistSet, persistGet } = await getStorageMocks();

    const handle = { kind: "file" } as unknown as FileSystemFileHandle;
    await saveRecentGraphHandle("foo.osg", handle);
    expect(persistSet).not.toHaveBeenCalled();

    const loaded = await loadRecentGraphHandle("foo.osg");
    expect(loaded).toBeNull();
    expect(persistGet).not.toHaveBeenCalled();
  });
});

