/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { DockLayout } from "@/ui/layout/DockLayout";

describe("DockLayout fallback", () => {
  it("renders tabs and switches active content", () => {
    const items = [
      { id: "a", name: "A", render: () => <div data-testid="panel-a">A</div> },
      { id: "b", name: "B", render: () => <div data-testid="panel-b">B</div> },
    ];
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<DockLayout items={items} forceTabsFallback />);
    });
    const buttons = container.querySelectorAll("button[data-tab-id]");
    expect(buttons.length).toBe(2);
    expect(container.querySelector("[data-testid='panel-a']")).toBeTruthy();
    const hiddenWrapper = (container.querySelector("[data-testid='panel-b']") as HTMLElement).parentElement as HTMLElement;
    expect(hiddenWrapper.style.display).toBe("none");
    act(() => {
      (buttons[1] as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const shownWrapper = (container.querySelector("[data-testid='panel-b']") as HTMLElement).parentElement as HTMLElement;
    expect(shownWrapper.style.display).toBe("block");
    const hiddenAWrapper = (container.querySelector("[data-testid='panel-a']") as HTMLElement).parentElement as HTMLElement;
    expect(hiddenAWrapper.style.display).toBe("none");
  });

  it("invokes header context menu callback", () => {
    const items = [
      { id: "a", name: "A", render: () => <div /> },
    ];
    let called = false;
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<DockLayout items={items} forceTabsFallback onHeaderContextMenu={() => { called = true; }} />);
    });
    const header = container.querySelector("[data-testid='dock-fallback'] > div") as HTMLElement;
    act(() => {
      header.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, button: 2 }));
    });
    expect(called).toBe(true);
  });
});
