export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  const anyErr: any = err as any;
  const name = anyErr?.name;
  const msg = String(anyErr?.message ?? "");
  // DOMException name 'AbortError' in browsers; Bun/Fetch often emits a message containing 'aborted'
  return name === "AbortError" || /aborted/i.test(msg);
}

