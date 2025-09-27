/* @vitest-environment jsdom */
import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const getNodeMock = vi.fn();

vi.mock("@xyflow/react", () => ({
  getBezierPath: () => ["M0,0 C50,0 50,100 100,100"],
  useReactFlow: () => ({
    getNode: getNodeMock,
  }),
}));

vi.mock("@/core/ui/compat", () => ({
  normalizePinType: (t: any) => (t ?? "unknown"),
}));

vi.mock("@/styles/theme", () => ({
  THEME: {
    selectionColor: "#0ff",
    pinColors: {
      unknown: "#0ff",
      sampler: "#0ff",
      scalar: "#0ff",
      vec2: "#0ff",
      vec3: "#0ff",
      vec4: "#0ff",
      texture2D: "#0ff",
      texture3D: "#0ff",
      textureCube: "#0ff",
      int: "#0ff",
      bool: "#0ff",
      mat3: "#0ff",
      mat4: "#0ff",
    },
  },
}));

import ColoredEdge from "@/components/ColoredEdge";

function renderIntoSvg(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<svg>{element}</svg>);
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

describe("ColoredEdge hit area", () => {
  it("renders an invisible wide stroke to make selection easier", () => {
    const { container, cleanup } = renderIntoSvg(
      <ColoredEdge
        id="edge-1"
        source="node-1"
        target="node-2"
        selected={false}
        markerEnd={undefined}
        style={undefined}
        data={{}}
        sourceHandle={null}
        targetHandle={null}
        sourcePosition={"right" as any}
        targetPosition={"left" as any}
        sourceX={0}
        sourceY={0}
        targetX={100}
        targetY={100}
      />
    );

    const paths = Array.from(container.querySelectorAll("path"));
    const hitPath = paths.find((p) => p.getAttribute("stroke") === "transparent");

    expect(hitPath).toBeTruthy();
    expect(hitPath?.getAttribute("stroke-width")).toBe("24");
    expect(hitPath?.getAttribute("pointer-events")).toBe("stroke");

    cleanup();
  });
});

