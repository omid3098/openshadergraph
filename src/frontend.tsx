/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { App } from "./App";

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
    {/* Ensure the ReactFlow parent has explicit size */}
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>
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
