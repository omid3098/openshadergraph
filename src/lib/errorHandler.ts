export function installGlobalErrorHandlers() {
  window.onerror = (message, source, lineno, colno, error) => {
    const detail: Record<string, unknown> = { message, source, lineno, colno, error };
    if (error == null) {
      console.warn("frontend error", detail);
      // returning true prevents Bun's runtime overlay for null errors
      return true;
    }
    console.error("frontend error", detail);
    return false;
  };

  // Capture resource errors and enrich with target details
  window.addEventListener(
    "error",
    (e) => {
      if (e.error != null) return;
      const target = e.target as HTMLElement | null;
      const detail: Record<string, unknown> = {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      };
      if (target && target !== window) {
        detail.target = {
          tag: target.tagName,
          id: target.id,
          class: target.className,
          src:
            (target as HTMLImageElement).src ||
            (target as HTMLLinkElement).href ||
            null,
        };
      }
      console.warn("Resource error", detail);
      e.preventDefault();
      e.stopImmediatePropagation();
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
}
