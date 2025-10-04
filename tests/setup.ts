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

// Polyfill DOM constructors in test environment to avoid `instanceof` RHS errors
// ReactDOM may perform `element instanceof containerInfo.HTMLIFrameElement` or
// other instanceof checks. Some Node/jsdom test workers may lack these
// constructors which results in TypeError: Right-hand side of 'instanceof' is
// not an object. Define minimal safe classes only when missing.
if (typeof (globalThis as any).HTMLElement === "undefined") {
  Object.defineProperty(globalThis, "HTMLElement", {
    value: class HTMLElement {},
    configurable: true,
    writable: true,
  });
}

if (typeof (globalThis as any).HTMLIFrameElement === "undefined") {
  Object.defineProperty(globalThis, "HTMLIFrameElement", {
    value: class HTMLIFrameElement extends (globalThis as any).HTMLElement {},
    configurable: true,
    writable: true,
  });
}

// Also ensure Element and Node exist for broader compatibility with libraries
// that rely on these constructors in instanceof checks.
if (typeof (globalThis as any).Element === "undefined") {
  Object.defineProperty(globalThis, "Element", {
    value: class Element {},
    configurable: true,
    writable: true,
  });
}
if (typeof (globalThis as any).Node === "undefined") {
  Object.defineProperty(globalThis, "Node", {
    value: class Node {},
    configurable: true,
    writable: true,
  });
}

