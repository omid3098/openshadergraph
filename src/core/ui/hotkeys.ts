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
  label?: string;
};

export const DEFAULT_QUICK_NODE_HOTKEYS: QuickNodeHotkey[] = [
  { code: "KeyF", type: "float", label: "Float" },
  { code: "KeyC", type: "color", label: "Color" },
  { code: "KeyA", type: "add", label: "Add" },
  { code: "KeyM", type: "multiply", label: "Multiply" },
];

function normalizeLabel(label: unknown): string | undefined {
  if (typeof label !== "string") return undefined;
  const trimmed = label.trim();
  return trimmed ? trimmed : undefined;
}

function coerceString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeQuickHotkeyList(list: QuickNodeHotkey[]): QuickNodeHotkey[] {
  const result: QuickNodeHotkey[] = [];
  const seen = new Map<string, number>();
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const code = coerceString((entry as QuickNodeHotkey).code);
    const type = coerceString((entry as QuickNodeHotkey).type);
    if (!code || !type) continue;
    const label = normalizeLabel((entry as QuickNodeHotkey).label);
    const normalized: QuickNodeHotkey = label ? { code, type, label } : { code, type };
    if (seen.has(code)) {
      const index = seen.get(code)!;
      result[index] = normalized;
    } else {
      seen.set(code, result.length);
      result.push(normalized);
    }
  }
  return result;
}

export function buildQuickHotkeyMap(list: QuickNodeHotkey[]): Record<string, QuickNodeHotkey> {
  const normalized = normalizeQuickHotkeyList(list);
  const map: Record<string, QuickNodeHotkey> = {};
  for (const entry of normalized) {
    map[entry.code] = entry;
  }
  return map;
}

export function formatQuickHotkeyDisplay(code: string): string {
  const raw = typeof code === "string" ? code : "";
  const patterns: Array<[RegExp, (match: RegExpExecArray) => string]> = [
    [/^Key([A-Z])$/i, (match) => match[1].toUpperCase()],
    [/^Digit([0-9])$/, (match) => match[1]],
    [/^Numpad([0-9])$/, (match) => `Num${match[1]}`],
    [/^Arrow(Up|Down|Left|Right)$/, (match) => match[1]],
  ];
  for (const [regex, fn] of patterns) {
    const match = regex.exec(raw);
    if (match) {
      return `⌘⇧${fn(match)}`;
    }
  }
  if (raw === "Space") return "⌘⇧Space";
  if (raw === "Enter") return "⌘⇧Enter";
  if (!raw) return "⌘⇧?";
  return `⌘⇧${raw}`;
}

export function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
