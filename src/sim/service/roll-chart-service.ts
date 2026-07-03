import Big from 'big.js'

import { ContactProfile, ContactTypeRollInput, FielderChanceRollInput,  HitterChange, HittingRatings,  PitchEnvironmentTarget, PitcherChange, PitchRatings, PowerRollInput, RollChart, ShallowDeepRollInput } from "./interfaces.js"
import { Contact, PlayResult, Position, ShallowDeep } from './enums.js'
import { PlayerChange } from './sim-service.js'

class RollChartService {

    constructor(
    ) { }

    public getPowerRollChart(input: PowerRollInput): RollChart {

        let chart: RollChart = {}
        chart.entries = new Map<number, string>()

        let outCount = 0
        let singleCount = 0
        let doubleCount = 0
        let tripleCount = 0

        for (let i = 0; i < 1000; i++) {

            if (outCount < input.out) {
                chart.entries.set(i, PlayResult.OUT)
                outCount++
                continue
            }

            if (singleCount < input.singles) {
                chart.entries.set(i, PlayResult.SINGLE)
                singleCount++
                continue
            }

            if (doubleCount < input.doubles) {
                chart.entries.set(i, PlayResult.DOUBLE)
                doubleCount++
                continue
            }

            if (tripleCount < input.triples) {
                chart.entries.set(i, PlayResult.TRIPLE)
                tripleCount++
                continue
            }

            chart.entries.set(i, PlayResult.HR)

        }

        return chart

    }

    public getContactTypeRollChart(input: ContactTypeRollInput): RollChart {

        let chart: RollChart = {}
        chart.entries = new Map<number, string>()

        let gbCount = 0
        let fbCount = 0
        let ldCount = 0

        for (let i = 0; i < 1000; i++) {

            if (gbCount < input.groundball) {
                chart.entries.set(i, Contact.GROUNDBALL)
                gbCount++
                continue
            }

            if (fbCount < input.flyBall) {
                chart.entries.set(i, Contact.FLY_BALL)
                fbCount++
                continue
            }

            if (ldCount < input.lineDrive) {
                chart.entries.set(i, Contact.LINE_DRIVE)
                ldCount++
                continue
            }

        }

        return chart

    }

    public getFielderChanceRollChart(input: FielderChanceRollInput): RollChart {

        let chart: RollChart = {}
        chart.entries = new Map<number, string>()

        let firstCount = 0
        let secondCount = 0
        let thirdCount = 0
        let catcherCount = 0
        let shortstopCount = 0
        let leftFieldCount = 0
        let centerFieldCount = 0
        let rightFieldCount = 0
        let pitcherCount = 0

        for (let i = 0; i < 100; i++) {

            if (firstCount < input.first) {
                chart.entries.set(i, Position.FIRST_BASE)
                firstCount++
                continue
            }

            if (secondCount < input.second) {
                chart.entries.set(i, Position.SECOND_BASE)
                secondCount++
                continue
            }

            if (thirdCount < input.third) {
                chart.entries.set(i, Position.THIRD_BASE)
                thirdCount++
                continue
            }

            if (catcherCount < input.catcher) {
                chart.entries.set(i, Position.CATCHER)
                catcherCount++
                continue
            }

            if (shortstopCount < input.shortstop) {
                chart.entries.set(i, Position.SHORTSTOP)
                shortstopCount++
                continue
            }

            if (leftFieldCount < input.leftField) {
                chart.entries.set(i, Position.LEFT_FIELD)
                leftFieldCount++
                continue
            }

            if (rightFieldCount < input.rightField) {
                chart.entries.set(i, Position.RIGHT_FIELD)
                rightFieldCount++
                continue
            }

            if (centerFieldCount < input.centerField) {
                chart.entries.set(i, Position.CENTER_FIELD)
                centerFieldCount++
                continue
            }

            if (pitcherCount < input.pitcher) {
                chart.entries.set(i, Position.PITCHER)
                pitcherCount++
                continue
            }

        }

        return chart

    }

    public getShallowDeepRollChart(input: ShallowDeepRollInput): RollChart {

        let chart: RollChart = {}
        chart.entries = new Map<number, string>()

        let shallowCount = 0
        let normalCount = 0
        let deepCount = 0

        for (let i = 0; i < 100; i++) {

            if (shallowCount < input.shallow) {
                chart.entries.set(i, ShallowDeep.SHALLOW)
                shallowCount++
                continue
            }

            if (normalCount < input.normal) {
                chart.entries.set(i, ShallowDeep.NORMAL)
                normalCount++
                continue
            }

            if (deepCount < input.deep) {
                chart.entries.set(i, ShallowDeep.DEEP)
                deepCount++
                continue
            }

        }

        return chart

    }

    public sortRollChart(rollChart: RollChart) {

        let values = Array.from(rollChart.entries.values())

        let item_order = ["K", "O", "H", "BB", "1B", "2B", "3B", "HR"]

        values.sort((a, b) => item_order.indexOf(a) - item_order.indexOf(b))

        for (let i = 0; i < 100; i++) {
            rollChart.entries.set(i, values[i])
        }
    }

    diffRollChart(average: RollChart, override: RollChart): RollChart {

        let result: RollChart = {}
        result.entries = new Map<number, string>()

        for (let i = 0; i < average.entries.size; i++) {
            if (override.entries.get(i) != average.entries.get(i)) {
                result.entries.set(i, override.entries.get(i))
            }
        }

        return result

    }

    public applyChartDiffs(hitterDiff: RollChart, pitcherDiff: RollChart, average: RollChart): RollChart {
        for (let i = 0; i < average.entries.size; i++) {
            let hitterValue = hitterDiff.entries.get(i)
            let pitcherValue = pitcherDiff.entries.get(i)

            if (hitterValue && !pitcherValue) {
                average.entries.set(i, hitterValue)
            }

            if (pitcherValue && !hitterValue) {
                average.entries.set(i, pitcherValue)
            }
        }

        return average
    }

    public buildHitterPowerRollInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange): PowerRollInput {
        const base = pitchEnvironmentTarget.battedBall.powerRollInput

        const total = Math.max(1, base.out + base.singles + base.doubles + base.triples + base.hr)
        const hitTotal = Math.max(1, base.singles + base.doubles + base.triples + base.hr)
        const hitShare = hitTotal / total

        const outSingleTotal = Math.max(1, base.out + base.singles)
        const contactSingleShare = base.singles / outSingleTotal
        const contactSingleChange = hitterChange.contactChange * contactSingleShare * hitShare * hitShare

        let out = Math.max(0, Math.round(PlayerChange.applyNegativeChange(base.out, contactSingleChange)))
        let singles = Math.max(0, Math.round(PlayerChange.applyChange(base.singles, contactSingleChange)))
        let doubles = Math.max(0, Math.round(base.doubles))
        let triples = Math.max(0, Math.round(base.triples))
        let hr = Math.max(0, Math.round(base.hr))

        const gapPowerChange = Number(hitterChange.gapPowerChange)
        const hrPowerChange = Number(hitterChange.hrPowerChange)

        if (!Number.isFinite(gapPowerChange)) throw new Error(`Invalid hitter gap power change ${hitterChange.gapPowerChange}.`)
        if (!Number.isFinite(hrPowerChange)) throw new Error(`Invalid hitter home run power change ${hitterChange.hrPowerChange}.`)

        const move = (from: "out" | "singles" | "doubles" | "triples" | "hr", to: "out" | "singles" | "doubles" | "triples" | "hr", amount: number): void => {
            const rounded = Math.max(0, Math.round(amount))
            if (rounded <= 0) return

            const available =
                from === "out" ? out :
                from === "singles" ? singles :
                from === "doubles" ? doubles :
                from === "triples" ? triples :
                hr

            const actual = Math.min(available, rounded)
            if (actual <= 0) return

            if (from === "out") out -= actual
            if (from === "singles") singles -= actual
            if (from === "doubles") doubles -= actual
            if (from === "triples") triples -= actual
            if (from === "hr") hr -= actual

            if (to === "out") out += actual
            if (to === "singles") singles += actual
            if (to === "doubles") doubles += actual
            if (to === "triples") triples += actual
            if (to === "hr") hr += actual
        }

        if (gapPowerChange > 0) {
            move("singles", "doubles", (base.doubles + base.triples) * gapPowerChange)
            move("doubles", "triples", base.triples * gapPowerChange)
        } else if (gapPowerChange < 0) {
            move("triples", "doubles", base.triples * Math.abs(gapPowerChange))
            move("doubles", "singles", (base.doubles + base.triples) * Math.abs(gapPowerChange))
        }

        if (hrPowerChange > 0) {
            const maxRating = 170
            const maxHrCount = 100
            const maxHrPowerChange = PlayerChange.getChange(pitchEnvironmentTarget.avgRating, maxRating)
            const hrPowerScale = maxHrPowerChange > 0 ? Math.max(1, (maxHrCount - base.hr) / (base.hr * maxHrPowerChange)) : 1

            move("singles", "hr", base.hr * hrPowerChange * hrPowerScale)
        } else if (hrPowerChange < 0) {
            const minRating = 30
            const minHrCount = 8
            const minHrPowerChange = Math.abs(PlayerChange.getChange(pitchEnvironmentTarget.avgRating, minRating))
            const hrPowerScale = minHrPowerChange > 0 ? Math.max(1, (base.hr - minHrCount) / (base.hr * minHrPowerChange)) : 1

            move("hr", "singles", base.hr * Math.abs(hrPowerChange) * hrPowerScale)
        }

        return this.normalizePowerRollInput({
            out,
            singles,
            doubles,
            triples,
            hr
        })
    }

    public buildPitcherPowerRollInput(pitchEnvironmentTarget: PitchEnvironmentTarget, pitcherChange: PitcherChange): PowerRollInput {
        const base = pitchEnvironmentTarget.battedBall.powerRollInput

        const powerChange = Number(pitcherChange.powerChange)
        const controlChange = Number(pitcherChange.controlChange)
        const movementChange = Number(pitcherChange.movementChange)

        if (!Number.isFinite(powerChange)) {
            throw new Error(`Invalid pitcher power change ${pitcherChange.powerChange}.`)
        }

        if (!Number.isFinite(controlChange)) {
            throw new Error(`Invalid pitcher control change ${pitcherChange.controlChange}.`)
        }

        if (!Number.isFinite(movementChange)) {
            throw new Error(`Invalid pitcher movement change ${pitcherChange.movementChange}.`)
        }

        const outSingleTotal = Math.max(1, base.out + base.singles)
        const contactSingleShare = base.singles / outSingleTotal

        const outSingleChange = this._getAverage([
            powerChange,
            controlChange,
            controlChange
        ]) * contactSingleShare

        let out = Math.max(0, Math.round(PlayerChange.applyChange(base.out, outSingleChange)))
        let singles = Math.max(0, Math.round(PlayerChange.applyNegativeChange(base.singles, outSingleChange)))
        let doubles = Math.max(0, Math.round(base.doubles))
        let triples = Math.max(0, Math.round(base.triples))
        let hr = Math.max(0, Math.round(base.hr))

        const move = (from: "singles" | "doubles" | "triples" | "hr", to: "singles" | "doubles" | "triples" | "hr", amount: number): void => {
            const rounded = Math.max(0, Math.round(amount))

            if (rounded <= 0) return

            const available =
                from === "singles" ? singles :
                from === "doubles" ? doubles :
                from === "triples" ? triples :
                hr

            const actual = Math.min(available, rounded)

            if (actual <= 0) return

            if (from === "singles") singles -= actual
            if (from === "doubles") doubles -= actual
            if (from === "triples") triples -= actual
            if (from === "hr") hr -= actual

            if (to === "singles") singles += actual
            if (to === "doubles") doubles += actual
            if (to === "triples") triples += actual
            if (to === "hr") hr += actual
        }

        if (movementChange > 0) {
            move("hr", "singles", base.hr * movementChange)
            move("doubles", "singles", base.doubles * movementChange)
            move("triples", "singles", base.triples * this._getAverage([movementChange, Math.max(0, powerChange)]))
        } else if (movementChange < 0) {
            move("singles", "hr", base.hr * Math.abs(movementChange))
            move("singles", "doubles", base.doubles * Math.abs(movementChange))
            move("singles", "triples", base.triples * Math.abs(movementChange))
        }

        return this.normalizePowerRollInput({
            out,
            singles,
            doubles,
            triples,
            hr
        })
    }

    private normalizePowerRollInput(input: PowerRollInput): PowerRollInput {
        const total = input.out + input.singles + input.doubles + input.triples + input.hr

        if (total <= 0) {
            throw new Error("Power roll input total must be greater than zero.")
        }

        let normalized: PowerRollInput = {
            out: Math.max(0, Math.round((input.out / total) * 1000)),
            singles: Math.max(0, Math.round((input.singles / total) * 1000)),
            doubles: Math.max(0, Math.round((input.doubles / total) * 1000)),
            triples: Math.max(0, Math.round((input.triples / total) * 1000)),
            hr: Math.max(0, Math.round((input.hr / total) * 1000))
        }

        let diff = 1000 - (normalized.out + normalized.singles + normalized.doubles + normalized.triples + normalized.hr)

        while (diff !== 0) {
            if (diff > 0) {
                normalized.out++
                diff--
            } else {
                const fields: (keyof PowerRollInput)[] = ["out", "singles", "doubles", "triples", "hr"]
                const field = fields.sort((a, b) => normalized[b] - normalized[a])[0]

                if (normalized[field] <= 0) {
                    throw new Error("Could not normalize power roll input.")
                }

                normalized[field]--
                diff++
            }
        }

        return normalized
    }

    getMatchupPowerRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange): RollChart {
        const matchupInput = this.buildMatchupPowerRollInput(pitchEnvironmentTarget, hitterChange, pitcherChange)

        return this.getPowerRollChart(matchupInput)
    }

    private buildMatchupPowerRollInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange): PowerRollInput {
        const base = pitchEnvironmentTarget.battedBall.powerRollInput
        const hitter = this.buildHitterPowerRollInput(pitchEnvironmentTarget, hitterChange)
        const pitcher = this.buildPitcherPowerRollInput(pitchEnvironmentTarget, pitcherChange)

        return this.normalizePowerRollInput({
            out: Math.max(0, base.out + (hitter.out - base.out) + (pitcher.out - base.out)),
            singles: Math.max(0, base.singles + (hitter.singles - base.singles) + (pitcher.singles - base.singles)),
            doubles: Math.max(0, base.doubles + (hitter.doubles - base.doubles) + (pitcher.doubles - base.doubles)),
            triples: Math.max(0, base.triples + (hitter.triples - base.triples) + (pitcher.triples - base.triples)),
            hr: Math.max(0, base.hr + (hitter.hr - base.hr) + (pitcher.hr - base.hr))
        })
    }

    getMatchupContactRollChart(pitchEnvironmentTarget:PitchEnvironmentTarget, hitterContactProfile:ContactProfile, pitcherContactProfile:ContactProfile): RollChart {

        let leagueAvgChart: RollChart = this.getContactTypeRollChart(pitchEnvironmentTarget.battedBall.contactRollInput)

        let hitter:RollChart = this.getContactTypeRollChart(hitterContactProfile)
        let pitcher:RollChart = this.getContactTypeRollChart(pitcherContactProfile)

        let hitterDiffChart: RollChart = this.diffRollChart(leagueAvgChart, hitter)
        let pitcherDiffChart: RollChart = this.diffRollChart(leagueAvgChart, pitcher)

        return this.applyChartDiffs(hitterDiffChart, pitcherDiffChart, leagueAvgChart)

    }

    getFirstRollIndex(chart: RollChart, result: string): number {
        for (let i = 0; i < 1000; i++) {
            if (chart.entries.get(i) === result) return i
        }
        return 999
    }

    private _getAverage(array: number[]) {
        if (array.length == 0) return 0
        return array.reduce((a, b) => a + b) / array.length
    }

}

export { RollChartService }