import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { useOverlay, type OverlayBoundsUpdate, type OverlayId } from "@/core/ui/overlayState";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
}

type FloatingOverlayProps = {
  id: OverlayId;
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function FloatingOverlay({ id, title, children, className, contentClassName }: FloatingOverlayProps) {
  const { state, hydrated, toggle, updateBounds, bringToFront } = useOverlay(id);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const labelledBy = useMemo(() => `overlay-${id}-title`, [id]);

  const handleBounds = (bounds: OverlayBoundsUpdate) => {
    updateBounds(bounds);
  };

  useEffect(() => {
    if (!hydrated) return;
    if (state.visible) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      requestAnimationFrame(() => {
        const focusables = getFocusableElements(containerRef.current);
        if (focusables.length) {
          focusables[0]?.focus();
        } else {
          containerRef.current?.focus();
        }
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [hydrated, state.visible]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Tab") {
        const focusables = getFocusableElements(containerRef.current);
        if (!focusables.length) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey) {
          if (!active || active === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (!active || active === last) {
            event.preventDefault();
            first.focus();
          }
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        toggle(false);
      }
    },
    [toggle]
  );

  if (!hydrated || !state.visible) {
    return null;
  }

  return (
    <Rnd
      key={id}
      size={{ width: state.width, height: state.height }}
      position={{ x: state.x, y: state.y }}
      bounds="parent"
      minWidth={320}
      minHeight={220}
      disableDragging={false}
      enableResizing
      style={{ zIndex: state.zIndex, pointerEvents: "auto" }}
      onDragStart={() => bringToFront()}
      onDragStop={(_, data) => handleBounds({ x: data.x, y: data.y })}
      onResizeStart={() => bringToFront()}
      onResizeStop={(_, __, ref, ___, position) => {
        const width = Number.parseFloat(ref.style.width ?? String(ref.offsetWidth));
        const height = Number.parseFloat(ref.style.height ?? String(ref.offsetHeight));
        handleBounds({ width: width || ref.offsetWidth, height: height || ref.offsetHeight, x: position.x, y: position.y });
      }}
      dragHandleClassName="osg-overlay-drag-handle"
      className={cn("absolute", className)}
      onMouseDownCapture={() => bringToFront()}
    >
      <Card
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby={labelledBy}
        className="h-full flex flex-col shadow-lg border bg-card"
        onKeyDown={handleKeyDown}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-2 py-2 px-3 osg-overlay-drag-handle cursor-move">
          <CardTitle id={labelledBy} className="text-sm font-medium">
            {title}
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Close ${title}`}
            className="h-6 w-6"
            onClick={() => toggle(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className={cn("flex-1 overflow-hidden p-0", contentClassName)}>
          <div className="h-full w-full" data-overlay-content>
            {children}
          </div>
        </CardContent>
      </Card>
    </Rnd>
  );
}

export default FloatingOverlay;
