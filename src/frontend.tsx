import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./index.css";
import { App } from "@/app/App";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Surface runtime errors but mute noisy resource errors that provide no `error` object
window.addEventListener(
  "error",
  (e) => {
    const { message, filename, lineno, colno, error, target } = e;
    const detail: Record<string, unknown> = { message, filename, lineno, colno, error };
    if (target && target !== window && target instanceof HTMLElement) {
      detail.target = {
        tag: target.tagName,
        id: target.id,
        class: target.className,
        src: (target as HTMLImageElement).src || (target as HTMLLinkElement).href || null,
      };
    }
    if (error == null) {
      console.warn("Resource error", detail);
      // Stop Bun's dev runtime from displaying a null-error overlay
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    console.error("Uncaught error", detail);
  },
  true,
);

window.addEventListener(
  "unhandledrejection",
  (e) => {
    console.error("Unhandled rejection", e.reason);
    e.preventDefault();
  },
  true,
);

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
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
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
