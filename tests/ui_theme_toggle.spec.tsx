/* @vitest-environment jsdom */
import React, { act } from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";

vi.mock("@/lib/utils", () => ({ cn: (...c: any[]) => c.filter(Boolean).join(" ") }), { virtual: true });
vi.mock("@/components/ui/button", () => ({ Button: (props: any) => <button {...props} /> }), { virtual: true });

// Persist mocks with simple in-memory store
const mem = new Map<string, any>();
vi.mock("@/lib/storage", () => ({
  persistGet: vi.fn((k: string) => Promise.resolve(mem.has(k) ? mem.get(k) : null)),
  persistSet: vi.fn((k: string, v: any) => { mem.set(k, v); return Promise.resolve(); }),
}), { virtual: true });

vi.mock("lucide-react", () => ({ PanelLeft: () => null, Home: () => null, Layers: () => null, Settings: () => null, Sun: () => null, Moon: () => null }), { virtual: true });

// icon import
vi.mock("../../src/assets/icon.png", () => ({}), { virtual: true });

import AppShell from "../src/ui/layout/AppShell";

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

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

describe("Sidebar theme toggle", () => {
  it("renders toggle only when sidebar expanded and toggles .dark class", async () => {
    // Start expanded
    mem.set("ui.sidebar.collapsed", false);
    mem.set("ui.theme", "light");

    const { container, cleanup } = renderIntoContainer(
      <AppShell header={<div />}><div>content</div></AppShell>
    );

    await flush();

    // Button should exist when not collapsed
    const btn = container.querySelector('button[aria-label="Toggle theme"]') as HTMLButtonElement | null;
    expect(btn).toBeTruthy();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    act(() => { btn!.click(); });
    await flush();
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    cleanup();
  });

  it("hides toggle when sidebar collapsed", async () => {
    mem.set("ui.sidebar.collapsed", true);
    mem.set("ui.theme", "dark");

    const { container, cleanup } = renderIntoContainer(
      <AppShell header={<div />}><div>content</div></AppShell>
    );

    await flush();
    const btn = container.querySelector('button[aria-label="Toggle theme"]') as HTMLButtonElement | null;
    expect(btn).toBeNull();
    cleanup();
  });
});


