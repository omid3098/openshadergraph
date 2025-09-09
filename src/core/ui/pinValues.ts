export const toNumericArray = (val?: number[] | number | string): number[] | undefined => {
  if (Array.isArray(val)) return val as number[];
  if (typeof val === "number") return [val];
  if (typeof val === "string") {
    const nums = val
      .split(/[\s,]+/)
      .map((v) => Number.parseFloat(v))
      .filter((n) => !Number.isNaN(n));
    return nums.length ? nums : undefined;
  }
  return undefined;
};

export const fromNumericArray = (arr: number[]): number | number[] => {
  return arr.length === 1 ? arr[0] : arr;
};
