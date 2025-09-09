export const toNumericArray = (val?: number[] | number | string): number[] | undefined => {
  if (Array.isArray(val)) return val as number[];
  if (typeof val === "number") return [val];
  return undefined;
};

export const fromNumericArray = (arr: number[]): number | number[] => {
  return arr.length === 1 ? arr[0] : arr;
};
