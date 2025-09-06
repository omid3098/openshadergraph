import React, { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import { RgbaColorPicker } from "react-colorful";
import { createPortal } from "react-dom";

const to255 = (v?: number) => Math.max(0, Math.min(255, Math.round((v ?? 1) * 255)));
const to01 = (v?: number) => Math.max(0, Math.min(1, (v ?? 255) / 255));

type Size = "normal" | "mini";

export function ColorInput({ value, onCommit, disabled, size = "normal" }: { value: number[]; onCommit: (rgba: number[]) => void; disabled?: boolean; size?: Size }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pickerColor, setPickerColor] = useState<{ r: number; g: number; b: number; a: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const openPickerAt = useCallback((x: number, y: number, init?: { r: number; g: number; b: number; a: number }) => {
    if (init) setPickerColor(init);
    setPickerPos({ x, y });
    setPickerOpen(true);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pickerColor) {
          const next: number[] = [to01(pickerColor.r), to01(pickerColor.g), to01(pickerColor.b), typeof pickerColor.a === "number" ? Math.round(pickerColor.a * 100) / 100 : 1];
          onCommit(next);
        }
        setPickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, pickerColor, onCommit]);

  const rgba = [value?.[0] ?? 1, value?.[1] ?? 1, value?.[2] ?? 1, value?.[3] ?? 1];
  const btnCls = size === "mini" ? "h-5 w-8" : "h-6 w-12";
  return (
    <>
      <Input
        type="button"
        disabled={disabled}
        className={`${btnCls} shrink-0`}
        style={{ backgroundColor: `rgba(${to255(rgba[0])}, ${to255(rgba[1])}, ${to255(rgba[2])}, ${rgba[3] ?? 1})`, cursor: disabled ? "not-allowed" : "pointer" }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          openPickerAt(rect.left, rect.bottom + 6, { r: to255(rgba[0]), g: to255(rgba[1]), b: to255(rgba[2]), a: typeof rgba[3] === "number" ? Math.round(rgba[3] * 100) / 100 : 1 });
        }}
      />
      {pickerOpen && createPortal(
        <div
          role="dialog"
          aria-modal
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 z-[1000]"
            style={{ background: "transparent" }}
            onClick={(e) => {
              e.stopPropagation();
              if (pickerColor) {
                const next: number[] = [to01(pickerColor.r), to01(pickerColor.g), to01(pickerColor.b), typeof pickerColor.a === "number" ? Math.round(pickerColor.a * 100) / 100 : 1];
                onCommit(next);
              }
              setPickerOpen(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <div
            ref={pickerRef}
            className="fixed z-[1001] rounded-md border bg-card p-2 shadow-lg"
            style={{ left: pickerPos.x, top: pickerPos.y }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <RgbaColorPicker
              color={pickerColor ?? { r: to255(rgba[0]), g: to255(rgba[1]), b: to255(rgba[2]), a: typeof rgba[3] === "number" ? Math.round(rgba[3] * 100) / 100 : 1 }}
              onChange={(c) => {
                setPickerColor({ r: c.r, g: c.g, b: c.b, a: typeof c.a === "number" ? Math.round(c.a * 100) / 100 : 1 });
              }}
              style={{ width: 180, height: 180 }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default ColorInput;
