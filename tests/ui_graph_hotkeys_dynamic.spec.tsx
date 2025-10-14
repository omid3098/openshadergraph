/* @vitest-environment jsdom */
import React, { act, useMemo } from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { useGraphHotkeys } from "@/components/hooks/useGraphHotkeys";
import { buildQuickHotkeyMap, type QuickNodeHotkey } from "@/core/ui/hotkeys";
import type { NodePaletteItem } from "@/core/schema/types";

type HarnessProps = {
  hotkeys: QuickNodeHotkey[];
  paletteItems?: NodePaletteItem[];
  onAdd: ReturnType<typeof vi.fn>;
  reservedCodes?: string[];
};

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ hotkeys, paletteItems = [], onAdd, reservedCodes = [] }: HarnessProps) {
  const paletteByType = useMemo(() => {
    const map = new Map<string, NodePaletteItem>();
    for (const entry of paletteItems) {
      map.set(entry.type, entry);
    }
    return map;
  }, [paletteItems]);

  useGraphHotkeys({
    getPointerClient: () => ({ x: 10, y: 20 }),
    toggleEditorNode: vi.fn(),
    addNodeAt: onAdd,
    paletteByType,
    quickHotkeys: buildQuickHotkeyMap(hotkeys),
    reservedCodes,
  });

  return null;
}

describe("useGraphHotkeys with custom quick hotkeys", () => {
  function renderHarness(props: HarnessProps) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Harness {...props} />);
    });
    return {
      async flush() {
        await act(async () => {
          await Promise.resolve();
        });
      },
      cleanup: () => {
        act(() => {
          root.unmount();
        });
        container.remove();
      },
    };
  }

  it("invokes addNodeAt when matching quick hotkey triggers", async () => {
    const onAdd = vi.fn();
    const hotkeys: QuickNodeHotkey[] = [{ code: "KeyZ", type: "custom_node", label: "Custom" }];
    const paletteItems: NodePaletteItem[] = [
      { type: "custom_node", name: "Custom Node", path: "custom_node.json", category: "root" },
    ];

    const { cleanup, flush } = renderHarness({ hotkeys, paletteItems, onAdd });

    await flush();

    const evt = new KeyboardEvent("keydown", { code: "KeyZ", metaKey: true, ctrlKey: true, shiftKey: true, bubbles: true });
    window.dispatchEvent(evt);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      item: expect.objectContaining({ type: "custom_node" }),
      x: 10,
      y: 20,
    });

    cleanup();
  });

  it("ignores quick hotkey when palette lacks the node", async () => {
    const onAdd = vi.fn();
    const hotkeys: QuickNodeHotkey[] = [{ code: "KeyY", type: "missing_node", label: "Missing" }];

    const { cleanup, flush } = renderHarness({ hotkeys, paletteItems: [], onAdd });

    await flush();

    const evt = new KeyboardEvent("keydown", { code: "KeyY", metaKey: true, ctrlKey: true, shiftKey: true, bubbles: true });
    window.dispatchEvent(evt);

    expect(onAdd).not.toHaveBeenCalled();
    cleanup();
  });

  it("skips quick node insertion when code is reserved", async () => {
    const onAdd = vi.fn();
    const hotkeys: QuickNodeHotkey[] = [{ code: "KeyX", type: "custom", label: "Custom" }];
    const paletteItems: NodePaletteItem[] = [
      { type: "custom", name: "Custom", path: "custom.json", category: "root" },
    ];

    const { cleanup, flush } = renderHarness({ hotkeys, paletteItems, onAdd, reservedCodes: ["KeyX"] });

    await flush();

    const evt = new KeyboardEvent("keydown", { code: "KeyX", metaKey: true, ctrlKey: true, shiftKey: true, bubbles: true });
    window.dispatchEvent(evt);

    expect(onAdd).not.toHaveBeenCalled();
    cleanup();
  });
});
