export function observeElementSize(element: Element | null, callback: () => void): () => void {
  if (!element || typeof callback !== "function") {
    return () => {};
  }

  const ResizeObserverCtor =
    typeof globalThis !== "undefined"
      ? ((globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ?? undefined)
      : undefined;

  if (typeof ResizeObserverCtor === "function") {
    const observer = new ResizeObserverCtor(() => callback());
    observer.observe(element);
    return () => observer.disconnect();
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    const handler = () => callback();
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
    };
  }

  return () => {};
}
