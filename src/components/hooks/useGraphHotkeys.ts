import { useEffect } from "react";
import { VIEW_HOTKEY_MAP, isEditableHotkeyTarget, type QuickNodeHotkey } from "@/core/ui/hotkeys";
import type { EditorPanelKey } from "@/core/ui/editorNodes";
import type { NodePaletteItem } from "@/core/schema/types";

type GraphHotkeyContext = {
  getPointerClient: () => { x: number; y: number };
  toggleEditorNode: (
    panel: EditorPanelKey,
    origin?: { kind: "hotkey"; client: { x: number; y: number } }
  ) => void | Promise<void>;
  addNodeAt: (opts: { item: NodePaletteItem; x: number; y: number }) => void | Promise<void>;
  paletteByType: Map<string, NodePaletteItem>;
  quickHotkeys: Record<string, QuickNodeHotkey>;
};

export function useGraphHotkeys({ getPointerClient, toggleEditorNode, addNodeAt, paletteByType, quickHotkeys }: GraphHotkeyContext) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.metaKey || event.altKey || event.shiftKey || event.ctrlKey) return;
      if (event.repeat) return;
      if (isEditableHotkeyTarget(event.target)) return;

      let digit = event.key;
      if (!VIEW_HOTKEY_MAP[digit] && typeof event.code === "string" && event.code.startsWith("Digit")) {
        digit = event.code.slice(-1);
      }

      const panel = VIEW_HOTKEY_MAP[digit];
      if (!panel) return;

      event.preventDefault();
      const pointer = getPointerClient();
      void toggleEditorNode(panel, { kind: "hotkey", client: pointer });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [getPointerClient, toggleEditorNode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || !event.shiftKey || event.altKey) return;
      if (event.repeat) return;
      if (isEditableHotkeyTarget(event.target)) return;

      const quick = quickHotkeys[event.code];
      if (!quick) return;

      const item = paletteByType.get(quick.type);
      if (!item) return;

      event.preventDefault();
      const pointer = getPointerClient();
      void addNodeAt({ item, x: pointer.x, y: pointer.y });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addNodeAt, getPointerClient, paletteByType, quickHotkeys]);
}
