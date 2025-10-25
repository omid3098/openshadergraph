import React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Toaster } from "react-hot-toast";
import { App } from "./App";
import { OverlayProvider } from "./core/ui/overlayState";

export default function AppLazy() {
  return (
    <ReactFlowProvider>
      <OverlayProvider>
        <App />
        <Toaster />
      </OverlayProvider>
    </ReactFlowProvider>
  );
}

