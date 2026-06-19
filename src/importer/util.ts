const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
const asNumber = (value: any, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback
const getAverage = (array: number[]) => {
    return array.reduce((a, b) => a + b) / array.length
}

const safeDiv = (num: number, den: number, fallback = 0): number => {
        if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return fallback
        return num / den
}

export {
    clamp, asNumber, getAverage, safeDiv
}