import React from "react";
import { describe, it, expect, vi } from "vitest";
import ReactDOMServer from "react-dom/server";
import { PanelsOverlay } from "../src/ui/panels/PanelsOverlay";

vi.mock("@/components/PreviewPanel", () => ({ PreviewPanel: () => <div>PREVIEW-STUB</div> }));
vi.mock("@/components/CompilePanel", () => ({ CompilePanel: () => <div /> }));
vi.mock("@/components/GraphDataPanel", () => ({ GraphDataPanel: () => <div /> }));
vi.mock("@/components/PropertiesPanel", () => ({ PropertiesPanel: () => <div /> }));
vi.mock("@/components/AssetsPanel", () => ({ AssetsPanel: () => <div /> }));
vi.mock("../src/ui/layout/DockLayout", () => ({
  DockLayout: ({ items }: any) => <div data-testid="dock-items">{items.map((i: any) => i.name).join(",")}</div>,
}));
vi.mock("@/lib/utils", () => ({ cn: (...c: any[]) => c.filter(Boolean).join(" ") }));
vi.mock("@/lib/storage", () => ({ persistGet: async () => null, persistSet: async () => {} }));

// Ensure dock tabs don't include Preview and Preview panel renders separately

describe("PanelsOverlay", () => {
  it("places preview panel below the dock tabs", () => {
    const html = ReactDOMServer.renderToString(<PanelsOverlay graph={{}} />);
    expect(html).toContain("PREVIEW-STUB");
    // dock-items lists tab names; should not include Preview
    const match = html.match(/data-testid="dock-items">([^<]+)</);
    expect(match?.[1].includes("Preview")).toBe(false);
    expect(match?.[1].includes("Assets")).toBe(true);
    // should render a separator for vertical resizing
    expect(html).toMatch(/aria-orientation="horizontal"/);
  });
});
