/* @vitest-environment jsdom */
// @ts-nocheck
import React, { act } from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/utils", () => ({ cn: (...c: any[]) => c.filter(Boolean).join(" ") }), { virtual: true });
vi.mock("@/styles/theme", () => ({ THEME: { selectionColor: "#09f" } }), { virtual: true });

const updatePropertyValue = vi.fn();
vi.mock("@/core/ui/GraphStateContext", () => ({
  useGraphState: () => ({
    nodeUpdaterApi: { updateInputValue: vi.fn(), updatePropertyValue },
    graph: {},
    nodesById: new Map(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    peekUndo: null,
    peekRedo: null,
  }),
}), { virtual: true });

vi.mock("@/lib/errors", () => ({
  isAbortError: (err: unknown) => Boolean((err as Error)?.name === "AbortError"),
}), { virtual: true });
vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  NodeResizer: () => null,
  Position: { Left: "left", Right: "right" },
  useNodeId: () => "100",
  useStore: () => [],
}));

// Avoid heavy panels used by other editor nodes
vi.mock("../src/components/PropertiesPanel", () => ({ PropertiesPanel: () => null }));
vi.mock("../src/components/CompilePanel", () => ({ CompilePanel: () => null }));
vi.mock("../src/components/GraphDataPanel", () => ({ GraphDataPanel: () => null }));
vi.mock("../src/components/PreviewPanel", () => ({ PreviewPanel: () => null }));

import GraphNode from "../src/components/GraphNode";

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

describe("Editor Note node", () => {
  it("renders a textarea for the Note panel", async () => {
    const noteNode = {
      template: {
        type: "editor_note",
        name: "Note",
        inputs: [],
        outputs: [],
        properties: [
          { id: "text", label: "Text", type: "string", multiline: true, value: "hello" },
        ],
        meta: ["editor_node", "editor_panel:note", "editor_size:260x160"],
      },
    };

    const { container, cleanup } = renderIntoContainer(
      <GraphNode data={noteNode as any} selected={false} />
    );

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe("hello");

    // poke events to cover handler hookup without asserting external calls
    act(() => {
      textarea.value = "updated";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    });
    cleanup();
  });
});


