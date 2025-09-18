import { describe, it, expect, vi, afterEach } from "vitest";
import { observeElementSize } from "../src/components/preview/resizeObserver";

const originalResizeObserver = (globalThis as any).ResizeObserver;
const originalWindow = (globalThis as any).window;

function restoreGlobals() {
  if (originalResizeObserver === undefined) {
    delete (globalThis as any).ResizeObserver;
  } else {
    (globalThis as any).ResizeObserver = originalResizeObserver;
  }
  if (originalWindow === undefined) {
    delete (globalThis as any).window;
  } else {
    (globalThis as any).window = originalWindow;
  }
}

afterEach(() => {
  restoreGlobals();
  vi.restoreAllMocks();
});

describe("observeElementSize", () => {
  it("uses ResizeObserver when available", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let roCallback: ResizeObserverCallback | null = null;
    class MockRO {
      constructor(callback: ResizeObserverCallback) {
        roCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
    }
    (globalThis as any).ResizeObserver = MockRO;

    const cb = vi.fn();
    const cleanup = observeElementSize({} as Element, cb);

    expect(observe).toHaveBeenCalledTimes(1);
    expect(cb).not.toHaveBeenCalled();

    roCallback?.([], {} as ResizeObserver);
    expect(cb).toHaveBeenCalledTimes(1);

    cleanup();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("falls back to window resize listener when ResizeObserver is missing", () => {
    delete (globalThis as any).ResizeObserver;
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    (globalThis as any).window = { addEventListener, removeEventListener };

    const cb = vi.fn();
    const cleanup = observeElementSize({} as Element, cb);

    expect(addEventListener).toHaveBeenCalledTimes(1);
    const handler = addEventListener.mock.calls[0][1] as () => void;
    handler();
    expect(cb).toHaveBeenCalledTimes(1);

    cleanup();
    expect(removeEventListener).toHaveBeenCalledWith("resize", handler);
  });

  it("returns noop when element is missing", () => {
    const cb = vi.fn();
    const cleanup = observeElementSize(null, cb);
    cleanup();
    expect(cb).not.toHaveBeenCalled();
  });
});
