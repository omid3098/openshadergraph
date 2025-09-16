import type { NodeTemplate } from "../schema/types";

type InputLike = { id?: number; value?: any };

type RestoreResult = {
  changed: boolean;
  inputs: InputLike[];
};

export function restoreInputsToDefaults(
  current: InputLike[] | undefined,
  defaults: NodeTemplate["inputs"],
  removedIds: Set<string>,
): RestoreResult {
  if (!Array.isArray(current) || current.length === 0) {
    return { changed: false, inputs: current ?? [] };
  }
  const base = new Map<number, any>();
  (defaults ?? []).forEach((pin, index) => {
    const pid = typeof pin?.id === "number" ? pin.id : index;
    const val = pin?.value === undefined ? undefined : JSON.parse(JSON.stringify(pin.value));
    base.set(pid, val);
  });
  let changed = false;
  const next = current.map((pin, index) => {
    if (typeof pin?.value !== "string") return pin;
    const m = pin.value.match(/^\.\.\/(\d+)\/(\d+)$/);
    if (!m) return pin;
    if (!removedIds.has(m[1])) return pin;
    changed = true;
    const pid = typeof pin?.id === "number" ? pin.id! : index;
    const fallback = base.has(pid) ? base.get(pid) : undefined;
    return { ...pin, value: fallback };
  });
  return { changed, inputs: next };
}
