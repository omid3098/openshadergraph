/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { NodeEditor } from "@/app/editor/NodeEditor";
import { DockLayout } from "@/ui/layout/DockLayout";
import { ReactFlowProvider } from "@xyflow/react";

const wait = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" || input instanceof URL ? new URL(input.toString(), "http://localhost") : new URL((input as Request).url);
    if (url.pathname === "/api/nodes") {
      return new Response(JSON.stringify({ categories: [], flat: [] }), { status: 200 });
    }
    if (url.pathname === "/api/example-graphs" && !url.searchParams.has("name")) {
      return new Response(JSON.stringify({ examples: [{ key: "demo", label: "Demo" }] }), { status: 200 });
    }
    if (url.pathname === "/api/example-graphs" && url.searchParams.has("name")) {
      return new Response(
        JSON.stringify({ graph: { id: 1, type: "graph", nodes: [{ id: 2, type: "fragment_pass", nodes: [] }] } }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as any;

  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as any).clientWidth;
  delete (HTMLElement.prototype as any).clientHeight;
  delete (HTMLElement.prototype as any).getBoundingClientRect;
});

describe("NodeEditor docking", () => {
  it("mounts NodeEditor without window errors", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const errs: any[] = [];
    const handler = (e: ErrorEvent) => errs.push(e.error);
    window.addEventListener("error", handler);

    await act(async () => {
      root.render(
        <ReactFlowProvider>
          <NodeEditor />
        </ReactFlowProvider>,
      );
      await wait();
    });

    expect(errs.filter((e) => e == null).length).toBe(0);

    root.unmount();
    window.removeEventListener("error", handler);
  });

  it("mounts NodeEditor inside DockLayout fallback without errors", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const errs: any[] = [];
    const handler = (e: ErrorEvent) => errs.push(e.error);
    window.addEventListener("error", handler);

    await act(async () => {
      root.render(
        <ReactFlowProvider>
          <DockLayout
            items={[{ id: "editor", name: "Editor", render: () => <NodeEditor /> }]}
            forceTabsFallback
            className="w-full h-full"
          />
        </ReactFlowProvider>,
      );
      await wait();
    });

    expect(errs.filter((e) => e == null).length).toBe(0);

    root.unmount();
    window.removeEventListener("error", handler);
  });
});

