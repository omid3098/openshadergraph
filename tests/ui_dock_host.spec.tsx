/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

const captured: any[] = [];
vi.mock("@/ui/layout/DockLayout", () => ({
  DockLayout: (props: any) => {
    captured.push(props.items);
    return null;
  }
}));

import { DockHost } from "@/app/layout/DockHost";

describe("DockHost", () => {
  it("wires NodeEditor as the first dock item", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<DockHost />);
    });
    const items = captured[0];
    expect(items[0].id).toBe("editor");
    expect(items.slice(1).map((i: any) => i.id)).toEqual([
      "properties",
      "compile",
      "graphdata",
      "preview"
    ]);
  });
});
