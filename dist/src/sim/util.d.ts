declare const clamp: (value: number, min: number, max: number) => number;
declare const asNumber: (value: any, fallback?: number) => number;
declare const getStdDev: (stat: {
    count: number;
    total: number;
    totalSquared: number;
    avg: number;
}) => number;
declare const getAverage: (array: number[]) => number;
export { clamp, asNumber, getStdDev, getAverage };
