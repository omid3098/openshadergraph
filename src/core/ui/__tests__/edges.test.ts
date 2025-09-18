import { describe, expect, it } from "vitest";
import type { Connection, Edge } from "@xyflow/react";
import { connectSingleInputEdge } from "../edges";

const makeEdge = (edge: Partial<Edge>): Edge => ({
  id: edge.id ?? "edge-id",
  source: edge.source ?? "1",
  target: edge.target ?? "2",
  sourceHandle: edge.sourceHandle,
  targetHandle: edge.targetHandle,
} as Edge);

const makeConnection = (connection: Partial<Connection>): Connection => ({
  source: connection.source ?? "S",
  target: connection.target ?? "T",
  sourceHandle: connection.sourceHandle,
  targetHandle: connection.targetHandle,
} as Connection);

describe("connectSingleInputEdge", () => {
  it("adds a new edge when no prior connection exists", () => {
    const connection = makeConnection({ source: "10", target: "20", targetHandle: "in-0" });
    const result = connectSingleInputEdge([], connection);

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("10");
    expect(result[0]?.target).toBe("20");
    expect(result[0]?.targetHandle).toBe("in-0");
  });

  it("removes an existing edge to the same input handle", () => {
    const existing = makeEdge({ id: "edge-a", source: "5", target: "7", sourceHandle: "out-1", targetHandle: "in-2" });
    const connection = makeConnection({ source: "8", target: "7", sourceHandle: "out-9", targetHandle: "in-2" });

    const result = connectSingleInputEdge([existing], connection);

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("8");
    expect(result[0]?.target).toBe("7");
    expect(result[0]?.targetHandle).toBe("in-2");
    expect(result.some((edge) => edge.id === "edge-a")).toBe(false);
  });

  it("preserves connections to other input handles", () => {
    const keep = makeEdge({ id: "keep-a", source: "1", target: "2", targetHandle: "in-0" });
    const replace = makeEdge({ id: "replace", source: "3", target: "2", targetHandle: "in-1" });
    const connection = makeConnection({ source: "9", target: "2", targetHandle: "in-1" });

    const result = connectSingleInputEdge([keep, replace], connection);

    expect(result).toHaveLength(2);
    expect(result.some((edge) => edge.id === "keep-a")).toBe(true);
    const replacement = result.find((edge) => edge.targetHandle === "in-1");
    expect(replacement?.source).toBe("9");
  });
});
