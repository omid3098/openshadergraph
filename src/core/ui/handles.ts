export const parseHandleId = (handle?: string): number => {
  if (!handle) return 0;
  const m = String(handle).match(/(in|input|out|output)-(\d+)/);
  if (m) return Number(m[2]);
  return 0;
};

export const makeInHandle = (id: number) => `in-${id}`;
export const makeOutHandle = (id: number) => `out-${id}`;

