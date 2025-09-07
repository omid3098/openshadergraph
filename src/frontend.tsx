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
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Capture uncaught errors and unhandled promise rejections with rich context
window.addEventListener("error", (event) => {
  const info = {
    message: event.message,
    source: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
    error: event.error,
    target: (event.target as HTMLElement | null)?.tagName,
  } as const;
  if (event.error == null) {
    // Resource errors (e.g. extension issues) often surface with a null error.
    // Prevent the dev overlay from showing "error null" while still logging context.
    console.error("Resource error", info);
    event.preventDefault();
    return;
  }
  console.error("Uncaught error", info);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason as any;
  console.error("Unhandled rejection", {
    reason,
    stack: reason?.stack,
  });
});

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    {/* Ensure the ReactFlow parent has explicit size */}
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlowProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
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
