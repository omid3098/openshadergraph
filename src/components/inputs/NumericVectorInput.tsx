import React from "react";
import { Input } from "../ui/input";

type Size = "normal" | "mini";

export function NumericVectorInput({ value, onChange, disabled, size = "normal" }: { value: number[]; onChange: (next: number[]) => void; disabled?: boolean; size?: Size }) {
  const vals = Array.isArray(value) ? value : [];
  const cls = size === "mini" ? "h-5 w-9 text-[10px] px-1" : "h-6 w-10 text-[11px] px-2";

  // Keep local string drafts to allow intermediate states like "-", "0.", etc.
  const [drafts, setDrafts] = React.useState<string[]>(() => vals.slice(0, 4).map((n) => (Number.isFinite(n) ? String(n) : "0")));

  // Sync drafts when external value changes (e.g., from programmatic updates)
  React.useEffect(() => {
    const nextDrafts = vals.slice(0, 4).map((n) => (Number.isFinite(n) ? String(n) : "0"));
    // Avoid clobbering user typing if arrays are equal
    if (nextDrafts.length !== drafts.length || nextDrafts.some((s, i) => s !== drafts[i])) {
      setDrafts(nextDrafts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals.map((n) => (Number.isFinite(n) ? String(n) : "0")).join("|")]);

  const isParsableNumber = (s: string): boolean => {
    if (s === "" || s === "-" || s === "." || s === "-.") return false;
    const n = Number(s);
    return Number.isFinite(n);
  };

  return (
    <>
      {vals.slice(0, 4).map((n, i) => (
        <Input
          key={i}
          type="number"
          step="0.01"
          className={`${cls} no-spinner shrink-0 nodrag nowheel`}
          value={drafts[i] ?? (Number.isFinite(n) ? String(n) : "0")}
          disabled={disabled}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value;
            setDrafts((prev) => {
              const copy = prev.slice();
              copy[i] = v;
              return copy;
            });
            if (isParsableNumber(v)) {
              const next = vals.slice();
              next[i] = Number(v);
              onChange(next);
            }
          }}
          onBlur={(e) => {
            const v = e.target.value;
            const fallback = Number.isFinite(n) ? String(n) : "0";
            if (!isParsableNumber(v)) {
              setDrafts((prev) => {
                const copy = prev.slice();
                copy[i] = fallback;
                return copy;
              });
              return;
            }
            const parsed = Number(v);
            if (Number.isFinite(parsed) && parsed !== n) {
              const next = vals.slice();
              next[i] = parsed;
              onChange(next);
            }
          }}
          aria-label={`v${i}`}
        />
      ))}
    </>
  );
}

export default NumericVectorInput;
