import { beforeAll } from "vitest";

// Mock window.location for tests
beforeAll(() => {
  // Set up a base URL for fetch calls in tests
  if (typeof global !== "undefined") {
    Object.defineProperty(global, "location", {
      value: {
        origin: "http://localhost:3000",
        href: "http://localhost:3000/",
        protocol: "http:",
        host: "localhost:3000",
        hostname: "localhost",
        port: "3000",
        pathname: "/",
        search: "",
        hash: "",
      },
      writable: true,
      configurable: true,
    });
  }
});

// Optionally mock fetch for tests that don't need real network calls
// This can be removed if tests properly mock fetch individually

// Polyfill HTMLIFrameElement in jsdom to avoid `instanceof` RHS errors
// ReactDOM may perform `element instanceof containerInfo.HTMLIFrameElement`.
// In some test environments HTMLIFrameElement may be undefined which causes
// a TypeError: Right-hand side of 'instanceof' is not an object. Provide a
// minimal class so `instanceof` checks work safely.
if (typeof (globalThis as any).HTMLIFrameElement === "undefined") {
  if (typeof (globalThis as any).HTMLElement === "undefined") {
    (globalThis as any).HTMLElement = class HTMLElement {};
  }
  (globalThis as any).HTMLIFrameElement = class HTMLIFrameElement extends (globalThis as any).HTMLElement {};
}

