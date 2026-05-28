const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
const asNumber = (value: any, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback

const getStdDev = (stat: { count: number, total: number, totalSquared: number, avg: number }): number => {

    if (!stat || stat.count <= 1) return 0

    const mean = stat.avg
    const variance = Math.max(0, (stat.totalSquared / stat.count) - (mean * mean))
    return Math.sqrt(variance)
}

const getAverage = (array: number[]) => {
    return array.reduce((a, b) => a + b) / array.length
}

export {
    clamp, asNumber, getStdDev, getAverage
}