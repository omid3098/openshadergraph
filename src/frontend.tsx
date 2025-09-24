/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import React from "react";
const AppLazy = React.lazy(() => import("./AppLazy"));

if (typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event) => {
      const message = event.message ?? String(event.error ?? "");
      if (
        message &&
        (message.includes("ResizeObserver loop completed") || message.includes("ResizeObserver loop limit exceeded"))
      ) {
        event.preventDefault();
        return;
      }
      if (event.error) {
        console.error("[global-error]", event.error, event.error?.stack ?? "<no stack>");
      } else if (message) {
        console.error("[global-error]", message);
      }
    },
    { capture: true }
  );
  window.addEventListener(
    "unhandledrejection",
    (event) => {
      console.error("[unhandled-rejection]", event.reason);
    },
    { capture: true }
  );
}

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <div style={{ width: "100vw", height: "100vh" }}>
      <React.Suspense fallback={<div className="p-3 text-xs text-muted-foreground">Loading…</div>}>
        <AppLazy />
      </React.Suspense>
    </div>
  </StrictMode>
);

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app);
}
