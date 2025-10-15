/* @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GraphContextMenu } from "@/components/GraphContextMenu";
import type { NodePalette, NodePaletteItem } from "@/core/schema/types";

beforeEach(() => {
  // JSDOM lacks this method which our component calls when scrolling
  Element.prototype.scrollIntoView = vi.fn();
});

describe("GraphContextMenu search", () => {
  const baseNode: NodePaletteItem = {
    type: "separate3",
    name: "Separate 3",
    path: "math/separate3.json",
    category: "math",
    aliases: ["split", "decompose"],
  };

  const palette: NodePalette = {
    categories: [
      {
        name: "math",
        nodes: [baseNode],
      },
    ],
    flat: [baseNode],
  };

  it("matches nodes by alias when searching", () => {
    render(
      <GraphContextMenu
        open
        kind="background"
        x={100}
        y={100}
        palette={palette}
        onClose={() => {}}
      />
    );

    const input = screen.getByPlaceholderText("Search nodes…");
    fireEvent.change(input, { target: { value: "split" } });

    expect(screen.queryByText("Separate 3")).not.toBeNull();
    cleanup();
  });
});
