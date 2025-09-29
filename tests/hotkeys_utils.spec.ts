import { describe, it, expect } from "vitest";
import {
  buildQuickHotkeyMap,
  formatQuickHotkeyDisplay,
  normalizeQuickHotkeyList,
  type QuickNodeHotkey,
} from "@/core/ui/hotkeys";

describe("normalizeQuickHotkeyList", () => {
  it("trims blanks, removes invalid entries, and keeps latest duplicate", () => {
    const list = normalizeQuickHotkeyList([
      { code: " KeyA ", type: "alpha", label: "Alpha" },
      { code: "KeyB", type: "", label: "" },
      { code: "KeyA", type: "omega", label: "Omega" },
      { code: "Digit1", type: "one", label: "One" },
    ] as unknown as QuickNodeHotkey[]);

    expect(list).toEqual([
      { code: "KeyA", type: "omega", label: "Omega" },
      { code: "Digit1", type: "one", label: "One" },
    ]);
  });
});

describe("buildQuickHotkeyMap", () => {
  it("returns a lookup keyed by code with later entries winning", () => {
    const list: QuickNodeHotkey[] = [
      { code: "KeyA", type: "alpha", label: "Alpha" },
      { code: "KeyB", type: "beta", label: "Beta" },
      { code: "KeyA", type: "omega", label: "Omega" },
    ];

    const map = buildQuickHotkeyMap(list);

    expect(Object.keys(map)).toEqual(["KeyA", "KeyB"]);
    expect(map.KeyA.type).toBe("omega");
    expect(map.KeyB.label).toBe("Beta");
  });

  it("filters entries missing code or type", () => {
    const list = [
      { code: "", type: "missing", label: "Invalid" },
      { code: "KeyC", type: "valid", label: "Valid" },
      { code: "KeyD", type: "", label: "NoType" },
    ] as unknown as QuickNodeHotkey[];

    const map = buildQuickHotkeyMap(list);

    expect(Object.keys(map)).toEqual(["KeyC"]);
    expect(map.KeyC.label).toBe("Valid");
  });
});

describe("formatQuickHotkeyDisplay", () => {
  it("formats letter keys", () => {
    expect(formatQuickHotkeyDisplay("KeyF")).toBe("⌘⇧F");
  });

  it("formats digit keys", () => {
    expect(formatQuickHotkeyDisplay("Digit2")).toBe("⌘⇧2");
  });

  it("falls back to code when pattern unknown", () => {
    expect(formatQuickHotkeyDisplay("F13")).toBe("⌘⇧F13");
  });
});
