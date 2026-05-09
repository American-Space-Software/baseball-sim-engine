const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
const asNumber = (value: any, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback

export {
    clamp, asNumber
}