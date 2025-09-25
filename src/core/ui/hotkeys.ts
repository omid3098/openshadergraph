import type { EditorPanelKey } from "./editorNodes";

export type ViewMenuItem = {
  key: EditorPanelKey;
  label: string;
  digit: "1" | "2" | "3" | "4" | "5";
  hotkey: string;
};

export const VIEW_MENU_ITEMS: ViewMenuItem[] = [
  { key: "properties", label: "Properties", digit: "1", hotkey: "⌘1" },
  { key: "compile", label: "Compile", digit: "2", hotkey: "⌘2" },
  { key: "graphdata", label: "Graph Data", digit: "3", hotkey: "⌘3" },
  { key: "assets", label: "Assets", digit: "4", hotkey: "⌘4" },
  { key: "preview", label: "Preview", digit: "5", hotkey: "⌘5" },
];

export const VIEW_HOTKEY_MAP: Record<string, EditorPanelKey> = VIEW_MENU_ITEMS.reduce<Record<string, EditorPanelKey>>(
  (acc, item) => {
    acc[item.digit] = item.key;
    return acc;
  },
  {}
);

export type QuickNodeHotkey = {
  code: string;
  type: string;
  label: string;
};

export const QUICK_NODE_HOTKEYS: Record<string, QuickNodeHotkey> = {
  KeyF: { code: "KeyF", type: "float", label: "Float" },
  KeyC: { code: "KeyC", type: "color", label: "Color" },
  KeyA: { code: "KeyA", type: "add", label: "Add" },
  KeyM: { code: "KeyM", type: "multiply", label: "Multiply" },
};

export function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
