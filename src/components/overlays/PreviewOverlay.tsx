import React from "react";
import FloatingOverlay from "../FloatingOverlay";
import { useGraphState } from "@/core/ui/GraphStateContext";

const LazyPreviewPanel = React.lazy(() => import("../PreviewPanel").then((mod) => ({ default: mod.PreviewPanel })));

export function PreviewOverlay() {
  const { graph } = useGraphState();
  return (
    <FloatingOverlay id="preview" title="Preview" contentClassName="p-0">
      <React.Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading preview…</div>}>
        <LazyPreviewPanel variant="overlay" graph={graph} />
      </React.Suspense>
    </FloatingOverlay>
  );
}

export default PreviewOverlay;
