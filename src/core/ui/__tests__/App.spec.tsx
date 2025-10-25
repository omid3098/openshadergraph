/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { OverlayProvider } from "@/core/ui/overlayState";

vi.mock("@/core/schema/nodes", () => ({
  fetchNodePalette: vi.fn(async () => ({ categories: [], flat: [] })),
  fetchNodeTemplate: vi.fn(async () => ({ type: "mock", inputs: [], outputs: [], properties: [] })),
}));

vi.mock("@/core/assets/registry", () => ({
  loadAssetRegistry: vi.fn(async () => ({ byId: new Map(), bySource: new Map() })),
}));

vi.mock("@/core/ui/recentGraphs", () => ({
  loadRecentGraphs: vi.fn(() => []),
  saveRecentGraph: vi.fn(() => []),
  removeRecentGraph: vi.fn(() => []),
  clearRecentGraphs: vi.fn(() => []),
}));

vi.mock("@/core/ui/recentGraphHandles", () => ({
  loadRecentGraphHandle: vi.fn(async () => null),
  saveRecentGraphHandle: vi.fn(async () => undefined),
  removeRecentGraphHandle: vi.fn(async () => undefined),
}));

let originalFetchDescriptor: PropertyDescriptor | undefined;
let originalLocalStorage: Storage | undefined;
let resizeObserverStubbed = false;

const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as { url?: string }).url ?? "";
  const json = async () => {
    if (url.includes("/api/nodes")) return { categories: [], flat: [] };
    if (url.includes("/api/example-graphs")) return { examples: [] };
    if (url.includes("/api/assets")) return { categories: [] };
    if (url.includes("/api/node-template")) return { type: "mock", inputs: [], outputs: [], properties: [] };
    return {};
  };
  return { ok: true, json } as unknown as Response;
});

beforeEach(() => {
  originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  Object.defineProperty(globalThis, "fetch", {
    value: mockFetch,
    configurable: true,
    writable: true,
  });

  resizeObserverStubbed = false;
  if (!("ResizeObserver" in globalThis)) {
    resizeObserverStubbed = true;
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  originalLocalStorage = (globalThis as any).localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    configurable: true,
  });

});

afterEach(() => {
  mockFetch.mockReset();
  if (originalFetchDescriptor) {
    Object.defineProperty(globalThis, "fetch", originalFetchDescriptor);
  } else {
    delete (globalThis as any).fetch;
  }
  originalFetchDescriptor = undefined;
  if (resizeObserverStubbed) {
    delete (globalThis as any).ResizeObserver;
  }
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
    });
  } else {
    delete (globalThis as any).localStorage;
  }
  originalLocalStorage = undefined;
});

describe("App", () => {
  // Increase timeout for this test because importing and mounting <App />
  // exercises a number of async effects (template loads, fetches, ResizeObserver)
  // which can occasionally exceed the default 5s in slower CI/workers.
  it(
    "renders without commitGraphMutation initialization errors",
    async () => {
    const { default: App } = await import("../../../App");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const renderApp = () =>
      render(
        <ReactFlowProvider>
          <OverlayProvider>
            <App />
          </OverlayProvider>
        </ReactFlowProvider>
      );

    let rendered: ReturnType<typeof render> | undefined;

    try {
      expect(() => {
        rendered = renderApp();
      }).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();
      expect(
        warnSpy.mock.calls.some((call) => String(call[0]).includes("commitGraphMutation")) ||
          errorSpy.mock.calls.some((call) => String(call[0]).includes("commitGraphMutation"))
      ).toBe(false);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      rendered?.unmount();
    }
    },
    20000
  );
});
