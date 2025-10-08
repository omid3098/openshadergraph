/* @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { loadUserAssetsMock, saveUserAssetsMock } = vi.hoisted(() => ({
  loadUserAssetsMock: vi.fn(async () => [] as any[]),
  saveUserAssetsMock: vi.fn(async (_assets: any[]) => {}),
}));

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ReactFlow: () => null,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Position: { Left: "left", Right: "right" },
}));

vi.mock("@/core/assets/userAssets", () => ({
  appendUserAsset: (list: any[], asset: any) => [...list, { ...asset, builtin: false }],
  createUserAssetId: () => "user-created",
  loadUserAssets: loadUserAssetsMock,
  removeUserAssetById: (list: any[], id: string) => list.filter((asset) => asset.id !== id),
  saveUserAssets: saveUserAssetsMock,
  USER_ASSETS_CHANGED_EVENT: "osg:user-assets:changed",
}));

import { SettingsPage } from "../src/ui/settings/SettingsPage";

describe("SettingsPage asset libraries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadUserAssetsMock.mockResolvedValue([]);
    saveUserAssetsMock.mockResolvedValue();
  });

  function renderSettingsPage() {
    render(
      <SettingsPage
        curveMode="default"
        onCurveModeChange={vi.fn()}
        theme="dark"
        onThemeChange={vi.fn()}
        quickHotkeys={[]}
        onQuickHotkeysChange={vi.fn()}
        palette={null}
        assetLibraries={{ ambientcg: { enabled: true } }}
        onAssetLibrariesChange={vi.fn()}
      />
    );
  }

  it("allows users to add manual asset URLs", async () => {
    renderSettingsPage();

    await waitFor(() => expect(loadUserAssetsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /add manual asset/i }));

    fireEvent.change(screen.getByLabelText(/asset url/i), {
      target: { value: "https://example.com/diffuse.png" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Diffuse" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save asset/i }));

    await waitFor(() => expect(saveUserAssetsMock).toHaveBeenCalledTimes(1));
    const payload = saveUserAssetsMock.mock.calls[0][0];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0]).toMatchObject({
      label: "Diffuse",
      type: "texture",
      source: "https://example.com/diffuse.png",
      builtin: false,
    });
    expect(screen.getByText("Diffuse")).toBeTruthy();
  });

  it("lets users remove saved manual assets", async () => {
    loadUserAssetsMock.mockResolvedValueOnce([
      {
        id: "user-existing",
        label: "Wood",
        type: "texture",
        source: "https://assets.example.com/wood.png",
        builtin: false,
      },
    ]);

    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText("Wood")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /remove wood/i }));

    await waitFor(() => expect(saveUserAssetsMock).toHaveBeenCalledWith([]));
    await waitFor(() => {
      expect(screen.queryByText("Wood")).toBeNull();
    });
  });
});
