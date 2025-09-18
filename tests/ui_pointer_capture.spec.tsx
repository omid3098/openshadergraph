/* @vitest-environment jsdom */
import React, { act } from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/utils", () => ({ cn: (...c: any[]) => c.filter(Boolean).join(" ") }), { virtual: true });
vi.mock("@/styles/theme", () => ({ THEME: { selectionColor: "#09f" } }), { virtual: true });
vi.mock("@/core/ui/GraphStateContext", () => ({
  useGraphState: () => ({
    nodeUpdaterApi: { updateInputValue: vi.fn() },
    graph: {},
  }),
}), { virtual: true });
vi.mock("@/lib/errors", () => ({
  isAbortError: (err: unknown) => Boolean((err as Error)?.name === "AbortError"),
}), { virtual: true });
vi.mock("@/core/io/guards", () => ({
  isCompilableGraph: () => true,
}), { virtual: true });
vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  NodeResizer: () => null,
  Position: { Left: "left", Right: "right" },
  useNodeId: () => "42",
  useStore: () => [],
}));

const assetLibraryMock = {
  categories: [
    {
      id: "textures",
      label: "Textures",
      items: [
        {
          id: "tex-1",
          label: "Checker",
          type: "texture",
          source: "data:image/png;base64,AAA",
        },
      ],
    },
  ],
};

vi.mock("@/core/schema/assets", () => ({
  fetchAssetLibrary: vi.fn(() => Promise.resolve(assetLibraryMock)),
}), { virtual: true });
vi.mock("@/core/assets/kind", () => ({
  inferAssetKind: vi.fn((name: string) => (name.endsWith(".png") ? "texture" : null)),
  MODEL_EXTENSIONS: ["fbx"],
  TEXTURE_EXTENSIONS: ["png"],
  ASSET_DRAG_MIME: "application/x-asset",
}), { virtual: true });
vi.mock("@/lib/storage", () => ({
  persistGet: vi.fn(() => Promise.resolve(null)),
  persistSet: vi.fn(() => Promise.resolve()),
}), { virtual: true });
vi.mock("@/core/assets/search", () => ({
  buildAssetHaystack: (asset: any) => `${asset.label}|${asset.type}`.toLowerCase(),
}), { virtual: true });
vi.mock("../src/components/PropertiesPanel", () => ({ PropertiesPanel: () => null }));
vi.mock("../src/components/CompilePanel", () => ({ CompilePanel: () => null }));
vi.mock("../src/components/GraphDataPanel", () => ({ GraphDataPanel: (props: any) => <div {...props} /> }));
vi.mock("../src/components/PreviewPanel", () => ({ PreviewPanel: () => null }));

import GraphNode from "../src/components/GraphNode";
import CodeBlock from "../src/components/CodeBlock";
import { AssetsPanel } from "../src/components/AssetsPanel";

function renderIntoContainer(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flushPromises(times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const baseNode = {
  template: {
    type: "color",
    inputs: [],
    outputs: [],
    properties: [],
    meta: [],
  },
};

const editorNode = {
  template: {
    type: "editor_graphdata",
    inputs: [],
    outputs: [],
    properties: [],
    meta: ["editor_node", "editor_panel:graphdata"],
  },
};

describe("Graph node pointer capture", () => {
  it("applies drag handle class to standard node headers", () => {
    const { container, cleanup } = renderIntoContainer(
      <GraphNode data={baseNode as any} selected={false} />
    );
    const header = container.querySelector(".node-drag-handle");
    expect(header).toBeTruthy();
    expect(header?.className).toContain("cursor-grab");
    cleanup();
  });

  it("applies drag handle class to editor node headers", () => {
    const { container, cleanup } = renderIntoContainer(
      <GraphNode data={editorNode as any} selected={false} />
    );
    const header = container.querySelector(".node-drag-handle");
    expect(header).toBeTruthy();
    expect(header?.className).toContain("cursor-grab");
    cleanup();
  });
});

describe("In-node widgets keep focus", () => {
  it("stops pointer and wheel events inside CodeBlock", () => {
    const pointerSpy = vi.fn();
    const wheelSpy = vi.fn();
    const { container, cleanup } = renderIntoContainer(
      <div onPointerDown={pointerSpy} onWheel={wheelSpy}>
        <CodeBlock code="const value = 1;" language="js" />
      </div>
    );
    const pre = container.querySelector("pre") as HTMLElement;
    act(() => {
      pre.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      pre.dispatchEvent(new Event("wheel", { bubbles: true }));
    });
    expect(pointerSpy).not.toHaveBeenCalled();
    expect(wheelSpy).not.toHaveBeenCalled();
    cleanup();
  });

  it("stops propagation when interacting with asset cards", async () => {
    const pointerSpy = vi.fn();
    const wheelSpy = vi.fn();
    const { container, cleanup } = renderIntoContainer(
      <div onPointerDown={pointerSpy} onWheel={wheelSpy}>
        <AssetsPanel variant="node" />
      </div>
    );

    await flushPromises(3);

    const card = container.querySelector('[draggable="true"]') as HTMLElement;
    expect(card).toBeTruthy();
    act(() => {
      card.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      card.dispatchEvent(new Event("wheel", { bubbles: true }));
    });
    expect(pointerSpy).not.toHaveBeenCalled();
    expect(wheelSpy).not.toHaveBeenCalled();
    cleanup();
  });
});
