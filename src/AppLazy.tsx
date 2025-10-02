import React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Toaster } from "react-hot-toast";
import { App } from "./App";

export default function AppLazy() {
  return (
    <ReactFlowProvider>
      <App />
      <Toaster />
    </ReactFlowProvider>
  );
}


