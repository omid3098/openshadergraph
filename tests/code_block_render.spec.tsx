import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import CodeBlock from "../src/components/CodeBlock";

vi.mock("@/lib/utils", () => ({ cn: (...c: any[]) => c.filter(Boolean).join(" ") }));

describe("CodeBlock", () => {
  it("renders code and language class", () => {
    const html = ReactDOMServer.renderToString(
      <CodeBlock code="const x = 1;" language="js" />
    );
    expect(html).toContain("token keyword");
    expect(html).toContain("language-js");
  });
});
