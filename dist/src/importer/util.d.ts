declare const clamp: (value: number, min: number, max: number) => number;
declare const asNumber: (value: any, fallback?: number) => number;
declare const getAverage: (array: number[]) => number;
declare const safeDiv: (num: number, den: number, fallback?: number) => number;
export { clamp, asNumber, getAverage, safeDiv };
