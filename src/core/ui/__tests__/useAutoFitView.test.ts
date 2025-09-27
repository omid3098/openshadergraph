import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AutoFitOnViewPathChangeOptions, useAutoFitOnViewPathChange } from "../useAutoFitView";

const runAllTimers = () => {
  act(() => {
    vi.runAllTimers();
  });
};

describe("useAutoFitOnViewPathChange", () => {
  let originalRaf: typeof window.requestAnimationFrame | undefined;
  let originalCancelRaf: typeof window.cancelAnimationFrame | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    originalRaf = window.requestAnimationFrame;
    originalCancelRaf = window.cancelAnimationFrame;
    (window as any).requestAnimationFrame = undefined;
    (window as any).cancelAnimationFrame = undefined;
  });

  afterEach(() => {
    runAllTimers();
    vi.useRealTimers();
    if (originalRaf) {
      (window as any).requestAnimationFrame = originalRaf;
    } else {
      delete (window as any).requestAnimationFrame;
    }
    if (originalCancelRaf) {
      (window as any).cancelAnimationFrame = originalCancelRaf;
    } else {
      delete (window as any).cancelAnimationFrame;
    }
    vi.restoreAllMocks();
  });

  it("fires fitView when the view path changes", () => {
    const fitView = vi.fn();
    const { rerender } = renderHook((props: AutoFitOnViewPathChangeOptions) => useAutoFitOnViewPathChange(props), {
      initialProps: { viewPath: [], visibleNodeIds: [], disabled: false, fitView },
    });

    rerender({ viewPath: ["10"], visibleNodeIds: ["a", "b"], disabled: false, fitView });
    runAllTimers();

    expect(fitView).toHaveBeenCalledTimes(1);
    expect(fitView).toHaveBeenCalledWith(["a", "b"]);
  });

  it("does not trigger when disabled", () => {
    const fitView = vi.fn();
    const { rerender } = renderHook((props: AutoFitOnViewPathChangeOptions) => useAutoFitOnViewPathChange(props), {
      initialProps: { viewPath: [], visibleNodeIds: [], disabled: false, fitView },
    });

    rerender({ viewPath: ["20"], visibleNodeIds: ["c"], disabled: true, fitView });
    runAllTimers();

    expect(fitView).not.toHaveBeenCalled();
  });

  it("ignores updates when the view path stays the same", () => {
    const fitView = vi.fn();
    const { rerender } = renderHook((props: AutoFitOnViewPathChangeOptions) => useAutoFitOnViewPathChange(props), {
      initialProps: { viewPath: ["30"], visibleNodeIds: ["n1"], disabled: false, fitView },
    });

    rerender({ viewPath: ["30"], visibleNodeIds: ["n2"], disabled: false, fitView });
    runAllTimers();

    expect(fitView).not.toHaveBeenCalled();
  });

  it("waits until nodes are available after the path changes", () => {
    const fitView = vi.fn();
    const { rerender } = renderHook((props: AutoFitOnViewPathChangeOptions) => useAutoFitOnViewPathChange(props), {
      initialProps: { viewPath: [], visibleNodeIds: [], disabled: false, fitView },
    });

    rerender({ viewPath: ["50"], visibleNodeIds: [], disabled: false, fitView });
    runAllTimers();
    expect(fitView).not.toHaveBeenCalled();

    rerender({ viewPath: ["50"], visibleNodeIds: ["ready"], disabled: false, fitView });
    runAllTimers();
    expect(fitView).toHaveBeenCalledTimes(1);
    expect(fitView).toHaveBeenCalledWith(["ready"]);
  });

  it("updates internal state when disabled so later renders do not refit unnecessarily", () => {
    const fitView = vi.fn();
    const { rerender } = renderHook((props: AutoFitOnViewPathChangeOptions) => useAutoFitOnViewPathChange(props), {
      initialProps: { viewPath: [], visibleNodeIds: [], disabled: false, fitView },
    });

    rerender({ viewPath: ["40"], visibleNodeIds: ["group"], disabled: true, fitView });
    runAllTimers();
    expect(fitView).not.toHaveBeenCalled();

    rerender({ viewPath: ["40"], visibleNodeIds: ["group"], disabled: false, fitView });
    runAllTimers();
    expect(fitView).not.toHaveBeenCalled();

    rerender({ viewPath: ["40", "401"], visibleNodeIds: ["child"], disabled: false, fitView });
    runAllTimers();
    expect(fitView).toHaveBeenCalledTimes(1);
    expect(fitView).toHaveBeenLastCalledWith(["child"]);
  });
});
