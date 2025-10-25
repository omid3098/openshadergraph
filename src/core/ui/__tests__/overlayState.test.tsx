/* @vitest-environment jsdom */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { OverlayId } from "../overlayState";

const persistGet = vi.fn(async (..._args: any[]) => null as unknown);
const persistSet = vi.fn(async (..._args: any[]) => {});

vi.mock("@/lib/storage", () => ({
  persistGet: (...args: any[]) => persistGet(...args),
  persistSet: (...args: any[]) => persistSet(...args),
}));

// Re-import after mocks
import { OverlayProvider, useOverlay, useOverlayManager } from "../overlayState";

function renderOverlay(id: OverlayId) {
  const wrapper = ({ children }: { children: React.ReactNode }) => <OverlayProvider>{children}</OverlayProvider>;
  return renderHook(() => useOverlay(id), { wrapper });
}

function renderManager() {
  const wrapper = ({ children }: { children: React.ReactNode }) => <OverlayProvider>{children}</OverlayProvider>;
  return renderHook(() => useOverlayManager(), { wrapper });
}

describe("overlayState", () => {
  beforeEach(() => {
    persistGet.mockReset();
    persistSet.mockReset();
    persistSet.mockImplementation(async () => {});
    persistGet.mockResolvedValue(null);
  });

  afterEach(() => {
    persistSet.mockReset();
    persistGet.mockReset();
  });

  it("hydrates with defaults when no persistence exists", async () => {
    persistGet.mockResolvedValueOnce(null);
    const { result } = renderOverlay("compile");
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.state.visible).toBe(false);
    expect(result.current.state.width).toBeGreaterThan(300);
    expect(result.current.state.id).toBe("compile");
  });

  it("defaults preview overlay to visible", async () => {
    persistGet.mockResolvedValueOnce(null);
    const { result } = renderOverlay("preview");
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.state.visible).toBe(true);
  });

  it("merges persisted state overrides", async () => {
    persistGet.mockResolvedValueOnce({
      preview: { visible: true, x: 200, y: 180, zIndex: 4 },
    });
    const { result } = renderOverlay("preview");
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.state.visible).toBe(true);
    expect(result.current.state.x).toBe(200);
    expect(result.current.state.zIndex).toBe(4);
  });

  it("toggles visibility and persists after debounce", async () => {
    persistGet.mockResolvedValueOnce(null);
    const { result } = renderOverlay("compile");
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    vi.useFakeTimers();
    try {
      const initialCalls = persistSet.mock.calls.length;
      act(() => {
        result.current.toggle(true);
      });
      expect(result.current.state.visible).toBe(true);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(persistSet.mock.calls.length).toBe(initialCalls + 1);
      const call = persistSet.mock.calls.at(-1);
      expect(call).toBeTruthy();
      const stored = (call?.[1] as Record<string, any> | undefined)?.compile;
      expect(stored?.visible).toBe(true);
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it("brings overlays to front in z-order", async () => {
    persistGet.mockResolvedValueOnce(null);
    const manager = renderManager();
    await waitFor(() => expect(manager.result.current.hydrated).toBe(true));
    act(() => {
      manager.result.current.setOverlayVisibility("preview", true);
      manager.result.current.setOverlayVisibility("compile", true);
    });
    await waitFor(() => expect(manager.result.current.overlays.compile.visible).toBe(true));
    act(() => {
      manager.result.current.bringToFront("compile");
    });
    await waitFor(() => expect(manager.result.current.overlays.compile.zIndex).toBeGreaterThan(manager.result.current.overlays.preview.zIndex));
    act(() => {
      manager.result.current.bringToFront("preview");
    });
    await waitFor(() => {
      expect(manager.result.current.overlays.preview.zIndex).toBeGreaterThan(manager.result.current.overlays.compile.zIndex);
    });
  });

  it("preserves runtime visibility toggles when persistence is empty", async () => {
    let resolvePersist: ((value: unknown) => void) | null = null;
    persistGet.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePersist = resolve;
        })
    );
    const { result } = renderOverlay("preview");
    act(() => {
      result.current.toggle(true);
    });
    expect(result.current.state.visible).toBe(true);
    expect(typeof resolvePersist).toBe("function");
    act(() => {
      resolvePersist?.(null);
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.state.visible).toBe(true);
  });
});
