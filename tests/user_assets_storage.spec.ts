/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { persistGetMock, persistSetMock } = vi.hoisted(() => ({
  persistGetMock: vi.fn(),
  persistSetMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  persistGet: persistGetMock,
  persistSet: persistSetMock,
}));

import {
  appendUserAsset,
  loadUserAssets,
  removeUserAssetById,
  saveUserAssets,
  USER_ASSETS_CHANGED_EVENT,
  USER_ASSETS_STORAGE_KEY,
} from "../src/core/assets/userAssets";

describe("user asset storage", () => {
  beforeEach(() => {
    persistGetMock.mockReset();
    persistSetMock.mockReset();
  });

  it("loads and sanitizes stored assets", async () => {
    persistGetMock.mockResolvedValue([
      { id: "a", label: " Albedo ", type: "texture", source: "https://example.com/a.png" },
      { id: "b", label: "", type: "model", source: "https://example.com/model.glb", tags: [] },
      null,
    ]);

    const assets = await loadUserAssets();
    expect(assets).toHaveLength(2);
    expect(assets[0]).toMatchObject({ label: "Albedo", builtin: false, type: "texture" });
    expect(assets[1]).toMatchObject({ label: "https://example.com/model.glb", type: "model", tags: ["user", "model"] });
  });

  it("persists normalized assets and dispatches change events", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    persistSetMock.mockResolvedValue(undefined);

    await saveUserAssets([
      { id: "a", label: "Asset", type: "texture", source: "https://example.com/a.png", builtin: true } as any,
    ]);

    expect(persistSetMock).toHaveBeenCalledWith(
      USER_ASSETS_STORAGE_KEY,
      expect.arrayContaining([expect.objectContaining({ builtin: false, type: "texture" })])
    );
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(USER_ASSETS_CHANGED_EVENT);
    dispatchSpy.mockRestore();
  });

  it("appends and removes entries immutably", () => {
    const base: any[] = [];
    const appended = appendUserAsset(base, {
      id: "x",
      label: "Custom",
      type: "texture",
      source: "https://example.com/custom.png",
    } as any);
    expect(appended).toHaveLength(1);
    expect(appended[0].builtin).toBe(false);
    const removed = removeUserAssetById(appended, "x");
    expect(removed).toHaveLength(0);
    expect(base).toHaveLength(0);
  });
});
