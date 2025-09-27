import { useEffect, useRef } from "react";

export type AutoFitOnViewPathChangeOptions = {
  viewPath: string[];
  visibleNodeIds: string[];
  disabled?: boolean;
  fitView: (nodeIds: string[]) => void;
};

function pathsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function clonePath(path: string[]): string[] {
  return path.slice();
}

export function useAutoFitOnViewPathChange({
  viewPath,
  visibleNodeIds,
  disabled = false,
  fitView,
}: AutoFitOnViewPathChangeOptions) {
  const prevPathRef = useRef<string[]>(clonePath(viewPath));
  const pendingPathRef = useRef<string[] | null>(null);
  const latestNodeIdsRef = useRef<string[]>(visibleNodeIds);
  const fitViewRef = useRef(fitView);
  const disabledRef = useRef(disabled);
  const frameRef = useRef<number | null>(null);
  const frame2Ref = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeout2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);

  const cancelScheduled = () => {
    if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      if (frame2Ref.current !== null) window.cancelAnimationFrame(frame2Ref.current);
    }
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    if (timeout2Ref.current !== null) clearTimeout(timeout2Ref.current);
    frameRef.current = frame2Ref.current = null;
    timeoutRef.current = timeout2Ref.current = null;
    tokenRef.current += 1;
  };

  useEffect(() => () => {
    cancelScheduled();
  }, []);

  useEffect(() => {
    latestNodeIdsRef.current = visibleNodeIds;
  }, [visibleNodeIds]);

  useEffect(() => {
    fitViewRef.current = fitView;
  }, [fitView]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    const prev = prevPathRef.current;
    if (pathsEqual(prev, viewPath)) return;
    prevPathRef.current = clonePath(viewPath);
    cancelScheduled();
    pendingPathRef.current = clonePath(viewPath);
  }, [viewPath]);

  useEffect(() => {
    const pending = pendingPathRef.current;
    if (!pending) return;
    if (!pathsEqual(pending, viewPath)) return;
    if (disabledRef.current) return;
    if (!latestNodeIdsRef.current.length) return;

    const pathSnapshot = clonePath(pending);
    pendingPathRef.current = null;
    cancelScheduled();
    const token = tokenRef.current;

    const run = () => {
      if (token !== tokenRef.current) return;
      if (disabledRef.current) {
        pendingPathRef.current = pathSnapshot;
        return;
      }
      const ids = latestNodeIdsRef.current;
      if (!ids.length) {
        pendingPathRef.current = pathSnapshot;
        return;
      }
      fitViewRef.current(ids);
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      frameRef.current = window.requestAnimationFrame(() => {
        if (token !== tokenRef.current) return;
        frame2Ref.current = window.requestAnimationFrame(() => {
          if (token !== tokenRef.current) return;
          run();
        });
      });
    } else {
      timeoutRef.current = setTimeout(() => {
        if (token !== tokenRef.current) return;
        timeout2Ref.current = setTimeout(() => {
          if (token !== tokenRef.current) return;
          run();
        }, 0);
      }, 0);
    }
  }, [viewPath, visibleNodeIds, disabled]);
}
