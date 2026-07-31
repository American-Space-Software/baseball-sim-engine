import {
    ContactProfile,
    ContactTypeRollInput,
    FielderChanceRollInput,
    HitterChange,
    PitchEnvironmentTarget,
    PitcherChange,
    PowerRollInput,
    RollChart,
    ShallowDeepRollInput
} from "./interfaces.js"
import { Contact, PlayResult, Position, ShallowDeep } from "./enums.js"
import { PlayerChange } from "./sim-service.js"
import { getAverage } from "../util.js"

class RollChartService {

    constructor() { }

    public getMatchupPowerRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange): RollChart {
        const input = PowerModel.getInput(pitchEnvironmentTarget, hitterChange, pitcherChange)

        return this.getRollChart([
            [PlayResult.OUT, input.out],
            [PlayResult.SINGLE, input.singles],
            [PlayResult.DOUBLE, input.doubles],
            [PlayResult.TRIPLE, input.triples],
            [PlayResult.HR, input.hr]
        ])
    }

    public getMatchupContactRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterContactProfile: ContactProfile, pitcherContactProfile: ContactProfile): RollChart {
        const input = ContactTypeModel.getInput(pitchEnvironmentTarget, hitterContactProfile, pitcherContactProfile)

        return this.getRollChart([
            [Contact.GROUNDBALL, input.groundball],
            [Contact.FLY_BALL, input.flyBall],
            [Contact.LINE_DRIVE, input.lineDrive]
        ])
    }

    public getFielderChanceRollChart(input: FielderChanceRollInput): RollChart {
        return this.getRollChart([
            [Position.FIRST_BASE, input.first],
            [Position.SECOND_BASE, input.second],
            [Position.THIRD_BASE, input.third],
            [Position.CATCHER, input.catcher],
            [Position.SHORTSTOP, input.shortstop],
            [Position.LEFT_FIELD, input.leftField],
            [Position.CENTER_FIELD, input.centerField],
            [Position.RIGHT_FIELD, input.rightField],
            [Position.PITCHER, input.pitcher]
        ])
    }

    public getShallowDeepRollChart(input: ShallowDeepRollInput): RollChart {
        return this.getRollChart([
            [ShallowDeep.SHALLOW, input.shallow],
            [ShallowDeep.NORMAL, input.normal],
            [ShallowDeep.DEEP, input.deep]
        ])
    }

    private getRollChart(entries: [string, number][]): RollChart {
        const chart: RollChart = {
            entries: new Map<number, string>()
        }

        let index = 0

        for (const [value, count] of entries) {
            for (let i = 0; i < count; i++) {
                chart.entries.set(index++, value)
            }
        }

        return chart
    }

}

class PowerModel {

    public static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange): PowerRollInput {
        const base = pitchEnvironmentTarget.battedBall.powerRollInput
        const hitter = this.getHitterInput(pitchEnvironmentTarget, hitterChange)
        const pitcher = this.getPitcherInput(pitchEnvironmentTarget, pitcherChange)

        return this.normalize({
            out: Math.max(0, base.out + (hitter.out - base.out) + (pitcher.out - base.out)),
            singles: Math.max(0, base.singles + (hitter.singles - base.singles) + (pitcher.singles - base.singles)),
            doubles: Math.max(0, base.doubles + (hitter.doubles - base.doubles) + (pitcher.doubles - base.doubles)),
            triples: Math.max(0, base.triples + (hitter.triples - base.triples) + (pitcher.triples - base.triples)),
            hr: Math.max(0, base.hr + (hitter.hr - base.hr) + (pitcher.hr - base.hr))
        })
    }

    private static getHitterInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange): PowerRollInput {
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

        if (!Number.isFinite(gapPowerChange)) {
            throw new Error(`Invalid hitter gap power change ${hitterChange.gapPowerChange}.`)
        }

        if (!Number.isFinite(hrPowerChange)) {
            throw new Error(`Invalid hitter home run power change ${hitterChange.hrPowerChange}.`)
        }

        const move = (from: keyof PowerRollInput, to: keyof PowerRollInput, amount: number): void => {
            const rounded = Math.max(0, Math.round(amount))

            if (rounded <= 0) {
                return
            }

            const values: PowerRollInput = {
                out,
                singles,
                doubles,
                triples,
                hr
            }

            const actual = Math.min(values[from], rounded)

            if (actual <= 0) {
                return
            }

            values[from] -= actual
            values[to] += actual

            out = values.out
            singles = values.singles
            doubles = values.doubles
            triples = values.triples
            hr = values.hr
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

        return this.normalize({
            out,
            singles,
            doubles,
            triples,
            hr
        })
    }

    private static getPitcherInput(pitchEnvironmentTarget: PitchEnvironmentTarget, pitcherChange: PitcherChange): PowerRollInput {
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
        const outSingleChange = getAverage([
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

            if (rounded <= 0) {
                return
            }

            const values = {
                singles,
                doubles,
                triples,
                hr
            }

            const actual = Math.min(values[from], rounded)

            if (actual <= 0) {
                return
            }

            values[from] -= actual
            values[to] += actual

            singles = values.singles
            doubles = values.doubles
            triples = values.triples
            hr = values.hr
        }

        if (movementChange > 0) {
            move("hr", "singles", base.hr * movementChange)
            move("doubles", "singles", base.doubles * movementChange)
            move("triples", "singles", base.triples * getAverage([movementChange, Math.max(0, powerChange)]))
        } else if (movementChange < 0) {
            move("singles", "hr", base.hr * Math.abs(movementChange))
            move("singles", "doubles", base.doubles * Math.abs(movementChange))
            move("singles", "triples", base.triples * Math.abs(movementChange))
        }

        return this.normalize({
            out,
            singles,
            doubles,
            triples,
            hr
        })
    }

    private static normalize(input: PowerRollInput): PowerRollInput {
        const total = input.out + input.singles + input.doubles + input.triples + input.hr

        if (total <= 0) {
            throw new Error("Power roll input total must be greater than zero.")
        }

        const normalized: PowerRollInput = {
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
                continue
            }

            const fields: (keyof PowerRollInput)[] = [
                "out",
                "singles",
                "doubles",
                "triples",
                "hr"
            ]

            const field = fields.sort((a, b) => normalized[b] - normalized[a])[0]

            if (normalized[field] <= 0) {
                throw new Error("Could not normalize power roll input.")
            }

            normalized[field]--
            diff++
        }

        return normalized
    }

}

class ContactTypeModel {

    public static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterContactProfile: ContactProfile, pitcherContactProfile: ContactProfile): ContactTypeRollInput {
        const base = pitchEnvironmentTarget.battedBall.contactRollInput

        return this.normalize({
            groundball: Math.max(0, base.groundball + (hitterContactProfile.groundball - base.groundball) + (pitcherContactProfile.groundball - base.groundball)),
            flyBall: Math.max(0, base.flyBall + (hitterContactProfile.flyBall - base.flyBall) + (pitcherContactProfile.flyBall - base.flyBall)),
            lineDrive: Math.max(0, base.lineDrive + (hitterContactProfile.lineDrive - base.lineDrive) + (pitcherContactProfile.lineDrive - base.lineDrive))
        })
    }

    private static normalize(input: ContactTypeRollInput): ContactTypeRollInput {
        const total = input.groundball + input.flyBall + input.lineDrive

        if (total <= 0) {
            throw new Error("Contact type roll input total must be greater than zero.")
        }

        const normalized: ContactTypeRollInput = {
            groundball: Math.max(0, Math.round((input.groundball / total) * 1000)),
            flyBall: Math.max(0, Math.round((input.flyBall / total) * 1000)),
            lineDrive: Math.max(0, Math.round((input.lineDrive / total) * 1000))
        }

        let diff = 1000 - (normalized.groundball + normalized.flyBall + normalized.lineDrive)

        while (diff !== 0) {
            if (diff > 0) {
                normalized.groundball++
                diff--
                continue
            }

            const fields: (keyof ContactTypeRollInput)[] = [
                "groundball",
                "flyBall",
                "lineDrive"
            ]

            const field = fields.sort((a, b) => normalized[b] - normalized[a])[0]

            if (normalized[field] <= 0) {
                throw new Error("Could not normalize contact type roll input.")
            }

            normalized[field]--
            diff++
        }

        return normalized
    }

}

export { RollChartService, PowerModel, ContactTypeModel }