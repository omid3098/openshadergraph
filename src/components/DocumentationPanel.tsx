import React, { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type DocumentationPanelProps = {
  className?: string;
  onLoadExample: (key: string) => void;
};

// This component displays the MkDocs documentation in an iframe
// and sets up a communication channel to handle "Show Example" clicks.
export function DocumentationPanel({ className, onLoadExample }: DocumentationPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    // Only accept messages from the same origin for security
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (data && data.type === "LOAD_EXAMPLE_GRAPH" && typeof data.key === "string") {
      onLoadExample(data.key);
    }
  }, [onLoadExample]);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // The documentation is served from the root /docs/
  return (
    <div className={cn("h-full w-full flex flex-col", className)}>
      <iframe
        ref={iframeRef}
        src="/docs/"
        className="flex-1 border-none"
        title="Documentation"
      />
    </div>
  );
}
