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
window.addEventListener(
  "error",
  (event) => {
    if (
      event.message ===
      "ResizeObserver loop completed with undelivered notifications."
    ) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement | null;
    const info = {
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      error: event.error,
      resource:
        target && target !== window
          ? {
              tag: target.tagName,
              id: target.id,
              className: target.className,
              src: (target as HTMLImageElement).src,
              href: (target as HTMLLinkElement).href,
              outerHTML: target.outerHTML?.slice(0, 200),
            }
          : undefined,
    } as const;
    const payload = JSON.stringify(info, null, 2);
    if (event.error == null) {
      // Resource errors (e.g. extension issues) often surface with a null error.
      // Prevent the dev overlay from showing "error null" while still logging context.
      console.error("Resource error:\n", payload);
      console.error("Resource error event:", event);
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }
    console.error("Uncaught error:\n", payload);
    console.error("Uncaught error event:", event);
  },
  true
);

// Bun's dev overlay listens to `window.onerror` and will display a red runtime
// banner even when the error object is `null` (common for failed resource
// loads from extensions). Swallow those to avoid the unhelpful `err: null`
// overlay while still surfacing context in the console.
window.onerror = (
  message,
  source,
  lineno,
  colno,
  error,
) => {
  if (
    error == null &&
    typeof message === "string" &&
    message.includes("ResizeObserver loop completed")
  ) {
    // Ignore benign ResizeObserver loops entirely
    return true;
  }
  if (error == null) {
    const payload = JSON.stringify(
      { message, source, lineno, colno },
      null,
      2,
    );
    console.warn("window.onerror (null error):\n", payload);
    // Returning true prevents the default handler which triggers Bun's overlay
    return true;
  }
  return false;
};

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason as any;
  const payload = JSON.stringify({ reason, stack: reason?.stack }, null, 2);
  console.error("Unhandled rejection:\n", payload);
  console.error("Unhandled rejection event:", event);
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
