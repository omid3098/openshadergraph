import { beforeAll, vi } from "vitest";

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

