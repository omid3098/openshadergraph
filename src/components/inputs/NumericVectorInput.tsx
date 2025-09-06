import React from "react";
import { Input } from "../ui/input";

export function NumericVectorInput({ value, onChange, disabled }: { value: number[]; onChange: (next: number[]) => void; disabled?: boolean }) {
  const vals = Array.isArray(value) ? value : [];
  return (
    <>
      {vals.slice(0, 4).map((n, i) => (
        <Input
          key={i}
          type="number"
          step="0.01"
          className="h-6 w-10 text-[11px] px-2 no-spinner shrink-0"
          value={typeof n === "number" ? n : 0}
          disabled={disabled}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onChange={(e) => {
            const next = vals.slice();
            next[i] = Number(e.target.value);
            onChange(next);
          }}
          aria-label={`v${i}`}
        />
      ))}
    </>
  );
}

export default NumericVectorInput;

