import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { App } from "@/app/App";
import { ErrorBoundary } from "@/components/ErrorBoundary";

window.addEventListener("error", (e) => {
  console.error("Unhandled error", e);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled rejection", e);
});

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
