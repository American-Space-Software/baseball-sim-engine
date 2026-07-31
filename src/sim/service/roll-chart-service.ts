import {
    ContactProfile,
    ContactTypeRollInput,
    FielderChanceRollInput,
    HitterChange,
    PitchCount,
    PitchEnvironmentTarget,
    PitcherChange,
    PowerRollInput,
    RollChart,
    ShallowDeepRollInput,
    SwingTakeRollInput,
    ContactMissRollInput,
    FairFoulRollInput,
    DefenseOutRollInput,
    DefenseHitRollInput,
    ContactQuality
} from "./interfaces.js"
import { Contact, ContactMiss, PlayResult, Position, ShallowDeep, SwingTake, FairFoul, DefenseOutResult, DefenseHitResult } from "./enums.js"
import { PlayerChange } from "./sim-service.js"
import { clamp, getAverage } from "../util.js"

const AVG_PITCH_QUALITY = 50

const AVERAGE_RATING = 100
const MIN_GENERATED_RATING = 30
const MAX_GENERATED_RATING = 170

const GENERATED_FULL_CHANGE = Math.max(
    Math.abs((MIN_GENERATED_RATING / AVERAGE_RATING) - 1),
    Math.abs((MAX_GENERATED_RATING / AVERAGE_RATING) - 1)
)

const SWING_DECISION_DISCIPLINE_WEIGHT = 1
const SWING_DECISION_CONTACT_WEIGHT = 0

class RollChartService {

    constructor() { }

    public getMatchupSwingTakeRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, inZone: boolean, pitchQuality: number, pitchCount: PitchCount): RollChart {
        const input = SwingTakeModel.getInput(pitchEnvironmentTarget, hitterChange, inZone, pitchQuality, pitchCount)

        return this.getRollChart([
            [SwingTake.SWING, input.swing],
            [SwingTake.TAKE, input.take]
        ])
    }

    public getMatchupContactMissRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange, inZone: boolean, pitchQuality: number, pitchCount: PitchCount): RollChart {
        const input = ContactMissModel.getInput(pitchEnvironmentTarget, hitterChange, pitcherChange, inZone, pitchQuality, pitchCount)

        return this.getRollChart([
            [ContactMiss.CONTACT, input.contact],
            [ContactMiss.MISS, input.miss]
        ])
    }

    public getMatchupFairFoulRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange, pitchQuality: number, guessPitch: boolean, pitchCount: PitchCount): RollChart {
        const input: FairFoulRollInput = FairFoulModel.getInput(
            pitchEnvironmentTarget,
            hitterChange,
            pitcherChange,
            pitchQuality,
            guessPitch,
            pitchCount
        )

        return this.getRollChart([
            [FairFoul.FAIR, input.fair],
            [FairFoul.FOUL, input.foul]
        ])
    }

    public getDefenseOutRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, defenseChange: number, contact: Contact, hitQuality: ContactQuality): RollChart {
        const input: DefenseOutRollInput = DefenseOutModel.getInput(pitchEnvironmentTarget, hitterChange, defenseChange, contact, hitQuality)

        return this.getRollChart([
            [DefenseOutResult.OUT, input.out],
            [DefenseOutResult.SINGLE, input.single]
        ])
    }

    public getDefenseHitRollChart(defenseChange: number, contact: Contact, hitQuality: ContactQuality): RollChart {
        const input: DefenseHitRollInput = DefenseHitModel.getInput(defenseChange, contact, hitQuality)

        return this.getRollChart([
            [DefenseHitResult.HIT, input.hit],
            [DefenseHitResult.OUT, input.out]
        ])
    }

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
        const chart: RollChart = { entries: new Map<number, string>() }
        let index = 0

        for (const [value, count] of entries) {
            for (let i = 0; i < count; i++) chart.entries.set(index++, value)
        }

        return chart
    }

}

class SwingTakeModel {

    public static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, inZone: boolean, pitchQuality: number, pitchCount: PitchCount): SwingTakeRollInput {
        const behavior = pitchEnvironmentTarget.swing.behaviorByCount.find(value => value.balls === pitchCount.balls && value.strikes === pitchCount.strikes)

        if (!behavior) throw new Error(`Missing swing behavior for count ${pitchCount.balls}-${pitchCount.strikes}`)

        const swingTuning = pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.swing
        const disciplineChaseSwingEffect = Number(swingTuning?.disciplineChaseSwingEffect ?? 0)
        const disciplineZoneSwingEffect = Number(swingTuning?.disciplineZoneSwingEffect ?? 0)
        const pitchQualityZoneSwingEffect = Number(swingTuning?.pitchQualityZoneSwingEffect ?? 0)
        const pitchQualityChaseSwingEffect = Number(swingTuning?.pitchQualityChaseSwingEffect ?? 0)

        if (!Number.isFinite(disciplineChaseSwingEffect)) throw new Error(`Invalid disciplineChaseSwingEffect ${swingTuning?.disciplineChaseSwingEffect}.`)
        if (!Number.isFinite(disciplineZoneSwingEffect)) throw new Error(`Invalid disciplineZoneSwingEffect ${swingTuning?.disciplineZoneSwingEffect}.`)
        if (!Number.isFinite(pitchQualityZoneSwingEffect)) throw new Error(`Invalid pitchQualityZoneSwingEffect ${swingTuning?.pitchQualityZoneSwingEffect}.`)
        if (!Number.isFinite(pitchQualityChaseSwingEffect)) throw new Error(`Invalid pitchQualityChaseSwingEffect ${swingTuning?.pitchQualityChaseSwingEffect}.`)

        const baselineSwingRate = Number(inZone ? behavior.zoneSwingPercent : behavior.chaseSwingPercent)

        if (!Number.isFinite(baselineSwingRate)) throw new Error(`Invalid swing rate for count ${pitchCount.balls}-${pitchCount.strikes}.`)

        const swingDecisionChange = this.getSwingDecisionChange(hitterChange)
        const pitchQualityChange = PlayerChange.getChange(AVG_PITCH_QUALITY, pitchQuality)

        let swingRate = inZone
            ? this.getZoneSwingRate(baselineSwingRate, swingDecisionChange, disciplineZoneSwingEffect)
            : this.getChaseSwingRate(baselineSwingRate, swingDecisionChange, disciplineChaseSwingEffect)

        swingRate += pitchQualityChange * (inZone ? pitchQualityZoneSwingEffect * -1 : pitchQualityChaseSwingEffect)
        swingRate = clamp(swingRate, 0, 100)

        const swing = Math.round(swingRate * 10)

        return {
            swing,
            take: 1000 - swing
        }
    }

    private static getSwingDecisionChange(hitterChange: HitterChange): number {
        return hitterChange.plateDisiplineChange * SWING_DECISION_DISCIPLINE_WEIGHT +
            hitterChange.contactChange * SWING_DECISION_CONTACT_WEIGHT
    }

    private static getZoneSwingRate(baselineSwingRate: number, swingDecisionChange: number, disciplineZoneSwingEffect: number): number {
        if (disciplineZoneSwingEffect === 0) return baselineSwingRate

        return this.getAdjustedSwingRate(
            baselineSwingRate,
            swingDecisionChange * disciplineZoneSwingEffect
        )
    }

    private static getChaseSwingRate(baselineSwingRate: number, swingDecisionChange: number, disciplineChaseSwingEffect: number): number {
        return this.getAdjustedSwingRate(
            baselineSwingRate,
            swingDecisionChange * (1 + disciplineChaseSwingEffect)
        )
    }

    private static getAdjustedSwingRate(baselineSwingRate: number, swingDecisionChange: number): number {
        if (!Number.isFinite(swingDecisionChange)) throw new Error(`Invalid swing decision change ${swingDecisionChange}.`)

        const baselineSwingProbability = clamp(baselineSwingRate / 100, 0, 1)

        if (baselineSwingProbability <= 0 || baselineSwingProbability >= 1) return baselineSwingRate

        const ratingScale = Math.max(0, 1 - swingDecisionChange)
        const baselineSwingOdds = baselineSwingProbability / (1 - baselineSwingProbability)
        const adjustedSwingOdds = baselineSwingOdds * ratingScale
        const adjustedSwingProbability = adjustedSwingOdds / (1 + adjustedSwingOdds)

        return adjustedSwingProbability * 100
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
        const contactSingleChange = hitterChange.contactChange * contactSingleShare * hitShare

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

class ContactMissModel {

    public static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange, inZone: boolean, pitchQuality: number, pitchCount: PitchCount): ContactMissRollInput {
        const behavior = pitchEnvironmentTarget.swing.behaviorByCount.find(value => value.balls === pitchCount.balls && value.strikes === pitchCount.strikes)

        if (!behavior) throw new Error(`Missing swing behavior for count ${pitchCount.balls}-${pitchCount.strikes}`)

        const contactTuning = pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.contact
        const contactSkillEffect = Number(contactTuning?.contactSkillEffect ?? 0)
        const pitchQualityContactEffect = Number(contactTuning?.pitchQualityContactEffect ?? 0)

        if (!Number.isFinite(contactSkillEffect)) throw new Error(`Invalid contactSkillEffect ${contactTuning?.contactSkillEffect}.`)
        if (!Number.isFinite(pitchQualityContactEffect)) throw new Error(`Invalid pitchQualityContactEffect ${contactTuning?.pitchQualityContactEffect}.`)

        const baselineContactRate = Number(inZone ? behavior.zoneContactPercent : behavior.chaseContactPercent)

        if (!Number.isFinite(baselineContactRate)) throw new Error(`Invalid contact rate for count ${pitchCount.balls}-${pitchCount.strikes}.`)

        const pitchQualityChange = PlayerChange.getChange(AVG_PITCH_QUALITY, pitchQuality)
        let contactRate = this.getHitterContactRate(baselineContactRate, hitterChange.contactChange, contactSkillEffect)

        contactRate += pitchQualityChange * (1 + pitchQualityContactEffect) * -1
        contactRate += this.getPitcherPowerContactAdjustment(pitcherChange, pitchEnvironmentTarget)
        contactRate = clamp(contactRate, 0, 100)

        const contact = Math.round(contactRate * 10)

        return {
            contact,
            miss: 1000 - contact
        }
    }

    private static getHitterContactRate(baselineContactRate: number, contactChange: number, contactSkillEffect: number): number {
        if (!Number.isFinite(contactChange)) throw new Error(`Invalid hitter contact change ${contactChange}.`)

        const baselineContactProbability = clamp(baselineContactRate / 100, 0, 1)

        if (baselineContactProbability <= 0 || baselineContactProbability >= 1) return baselineContactRate

        const ratingScale = Math.max(0, 1 + contactChange)
        const skillScale = Math.max(0, 1 + contactSkillEffect)
        const baselineContactOdds = baselineContactProbability / (1 - baselineContactProbability)
        const adjustedContactOdds = baselineContactOdds * ratingScale * skillScale
        const adjustedContactProbability = adjustedContactOdds / (1 + adjustedContactOdds)

        return adjustedContactProbability * 100
    }

    private static getPitcherPowerContactAdjustment(pitcherChange: PitcherChange, pitchEnvironmentTarget: PitchEnvironmentTarget): number {
        return pitcherChange.powerChange *
            this.getPitcherPowerContactPointsPerFullPowerChange(pitchEnvironmentTarget) *
            -1
    }

    private static getPitcherPowerContactPointsPerFullPowerChange(pitchEnvironmentTarget: PitchEnvironmentTarget): number {
        const contactRates = pitchEnvironmentTarget.swing.behaviorByCount.map(behavior =>
            getAverage([
                Number(behavior.zoneContactPercent),
                Number(behavior.chaseContactPercent)
            ])
        )

        return this.getRateStdDev(contactRates, "pitcher power contact calculation") / this.getFullRatingChange()
    }

    private static getRateStdDev(values: number[], label: string): number {
        if (values.length === 0) throw new Error(`Missing swing behavior for ${label}.`)
        if (values.some(value => !Number.isFinite(value))) throw new Error(`Invalid swing behavior for ${label}.`)

        const average = getAverage(values)
        const variance = getAverage(values.map(value => Math.pow(value - average, 2)))
        const standardDeviation = Math.sqrt(variance)

        return !Number.isFinite(standardDeviation) || standardDeviation <= 0
            ? this.getRateRange(values, label)
            : standardDeviation
    }

    private static getRateRange(values: number[], label: string): number {
        if (values.length === 0) throw new Error(`Missing swing behavior for ${label}.`)

        return Math.max(...values) - Math.min(...values)
    }

    private static getFullRatingChange(): number {
        if (!Number.isFinite(GENERATED_FULL_CHANGE) || GENERATED_FULL_CHANGE <= 0) {
            throw new Error("Invalid generated rating change bounds.")
        }

        return GENERATED_FULL_CHANGE
    }

}

class FairFoulModel {

    public static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange, pitchQuality: number, guessPitch: boolean, pitchCount: PitchCount): FairFoulRollInput {
        const behavior = pitchEnvironmentTarget.swing.behaviorByCount.find(
            value => value.balls === pitchCount.balls && value.strikes === pitchCount.strikes
        )

        if (!behavior) throw new Error(`Missing swing behavior for count ${pitchCount.balls}-${pitchCount.strikes}`)

        let foulRate = Number(behavior.foulContactPercent)

        if (!Number.isFinite(foulRate)) {
            throw new Error(`Invalid foul contact rate for count ${pitchCount.balls}-${pitchCount.strikes}.`)
        }

        const pitchQualityChange = PlayerChange.getChange(AVG_PITCH_QUALITY, pitchQuality)

        foulRate += this.getPitchQualityFoulAdjustment(pitchQualityChange, pitchEnvironmentTarget)
        foulRate += this.getPitcherPowerFoulAdjustment(pitcherChange, pitchEnvironmentTarget)
        foulRate += this.getHitterContactFoulAdjustment(hitterChange, pitchEnvironmentTarget)

        if (guessPitch) {
            foulRate -= Math.max(0, pitchQualityChange) * this.getContactPointsPerFullContactChange(pitchEnvironmentTarget)
        }

        foulRate = clamp(foulRate, 0, 100)

        const foul = Math.round(foulRate * 10)

        return {
            fair: 1000 - foul,
            foul
        }
    }

    private static getPitchQualityFoulAdjustment(pitchQualityChange: number, pitchEnvironmentTarget: PitchEnvironmentTarget): number {
        return pitchQualityChange * this.getContactPointsPerFullContactChange(pitchEnvironmentTarget)
    }

    private static getPitcherPowerFoulAdjustment(pitcherChange: PitcherChange, pitchEnvironmentTarget: PitchEnvironmentTarget): number {
        return pitcherChange.powerChange * this.getPitcherPowerContactPointsPerFullPowerChange(pitchEnvironmentTarget)
    }

    private static getHitterContactFoulAdjustment(hitterChange: HitterChange, pitchEnvironmentTarget: PitchEnvironmentTarget): number {
        return hitterChange.contactChange * this.getContactPointsPerFullContactChange(pitchEnvironmentTarget) * -1
    }

    private static getContactPointsPerFullContactChange(pitchEnvironmentTarget: PitchEnvironmentTarget): number {
        const contactRates = pitchEnvironmentTarget.swing.behaviorByCount.map(behavior =>
            getAverage([
                Number(behavior.zoneContactPercent),
                Number(behavior.chaseContactPercent)
            ])
        )

        return this.getRateStdDev(contactRates, "hitter contact calculation") / this.getFullRatingChange()
    }

    private static getPitcherPowerContactPointsPerFullPowerChange(pitchEnvironmentTarget: PitchEnvironmentTarget): number {
        const contactRates = pitchEnvironmentTarget.swing.behaviorByCount.map(behavior =>
            getAverage([
                Number(behavior.zoneContactPercent),
                Number(behavior.chaseContactPercent)
            ])
        )

        return this.getRateStdDev(contactRates, "pitcher power contact calculation") / this.getFullRatingChange()
    }

    private static getRateStdDev(values: number[], label: string): number {
        if (values.length === 0) throw new Error(`Missing swing behavior for ${label}.`)
        if (values.some(value => !Number.isFinite(value))) throw new Error(`Invalid swing behavior for ${label}.`)

        const average = getAverage(values)
        const variance = getAverage(values.map(value => Math.pow(value - average, 2)))
        const standardDeviation = Math.sqrt(variance)

        return !Number.isFinite(standardDeviation) || standardDeviation <= 0
            ? this.getRateRange(values, label)
            : standardDeviation
    }

    private static getRateRange(values: number[], label: string): number {
        if (values.length === 0) throw new Error(`Missing swing behavior for ${label}.`)

        return Math.max(...values) - Math.min(...values)
    }

    private static getFullRatingChange(): number {
        if (!Number.isFinite(GENERATED_FULL_CHANGE) || GENERATED_FULL_CHANGE <= 0) {
            throw new Error("Invalid generated rating change bounds.")
        }

        return GENERATED_FULL_CHANGE
    }

}

class DefenseHitModel {

    public static getInput(defenseChange: number, contact: Contact, hitQuality: ContactQuality): DefenseHitRollInput {
        const baseCatchProbability = this.getBattedBallCatchProbability(contact, hitQuality)
        const positiveDefensePressure = clamp(Math.max(0, defenseChange), 0, 1)
        const preventableHitPressure = clamp(1 - baseCatchProbability, 0, 1)
        const hitToOutProbability = clamp(positiveDefensePressure * preventableHitPressure, 0, preventableHitPressure)
        const out = Math.round(hitToOutProbability * 1000)

        return {
            hit: 1000 - out,
            out
        }
    }

    private static getBattedBallCatchProbability(contact: Contact, hitQuality: ContactQuality): number {
        const exitVelocity = Number(hitQuality.exitVelocity)
        const launchAngle = Number(hitQuality.launchAngle)
        const distance = Number(hitQuality.distance)

        if (!Number.isFinite(exitVelocity)) {
            throw new Error(`Invalid contact exit velocity ${hitQuality.exitVelocity}.`)
        }

        if (!Number.isFinite(launchAngle)) {
            throw new Error(`Invalid contact launch angle ${hitQuality.launchAngle}.`)
        }

        if (!Number.isFinite(distance)) {
            throw new Error(`Invalid contact distance ${hitQuality.distance}.`)
        }

        if (contact === Contact.LINE_DRIVE) {
            const hardContact = clamp((exitVelocity - 82) / 24, 0, 1)
            const carriedContact = clamp((distance - 120) / 220, 0, 1)
            const lowLineDrive = launchAngle < 8 ? 0.12 : 0

            return clamp(0.58 - (hardContact * 0.28) - (carriedContact * 0.18) - lowLineDrive, 0.12, 0.72)
        }

        if (contact === Contact.FLY_BALL) {
            const deepContact = clamp((distance - 250) / 160, 0, 1)
            const hardContact = clamp((exitVelocity - 92) / 30, 0, 1)
            const popupBonus = launchAngle > 45 ? 0.12 : 0

            return clamp(0.78 - (deepContact * 0.50) - (hardContact * 0.12) + popupBonus, 0.10, 0.94)
        }

        if (contact === Contact.GROUNDBALL) {
            const hardContact = clamp((exitVelocity - 78) / 32, 0, 1)
            const toppedBall = launchAngle < -10 ? 0.10 : 0

            return clamp(0.76 - (hardContact * 0.34) + toppedBall, 0.35, 0.90)
        }

        return 0.70
    }

}

class DefenseOutModel {

    public static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, defenseChange: number, contact: Contact, hitQuality: ContactQuality): DefenseOutRollInput {
        const baseCatchProbability = this.getBattedBallCatchProbability(contact, hitQuality)
        const missedCatchPressure = clamp(1 - baseCatchProbability, 0, 1)
        const lowDefensePressure = clamp(Math.max(0, defenseChange * -1), 0, 1)
        const fullChange = this.getFullRatingChange()
        const contactPressure = clamp(Math.max(0, hitterChange.contactChange) / fullChange, 0, 1)
        const qualityOfContactPressure = clamp(Math.max(0, PlayerChange.getQualityOfContactChange(hitterChange)) / fullChange, 0, 1)
        const leagueBabipPressure = clamp(pitchEnvironmentTarget.outcome.babip, 0, 1)

        const hitterPressure = getAverage([
            contactPressure,
            qualityOfContactPressure
        ]) * leagueBabipPressure

        const outToSingleProbability = clamp(
            missedCatchPressure * getAverage([
                lowDefensePressure,
                hitterPressure
            ]),
            0,
            missedCatchPressure
        )

        const single = Math.round(outToSingleProbability * 1000)

        return {
            out: 1000 - single,
            single
        }
    }

    private static getBattedBallCatchProbability(contact: Contact, hitQuality: ContactQuality): number {
        const exitVelocity = Number(hitQuality.exitVelocity)
        const launchAngle = Number(hitQuality.launchAngle)
        const distance = Number(hitQuality.distance)

        if (!Number.isFinite(exitVelocity)) {
            throw new Error(`Invalid contact exit velocity ${hitQuality.exitVelocity}.`)
        }

        if (!Number.isFinite(launchAngle)) {
            throw new Error(`Invalid contact launch angle ${hitQuality.launchAngle}.`)
        }

        if (!Number.isFinite(distance)) {
            throw new Error(`Invalid contact distance ${hitQuality.distance}.`)
        }

        if (contact === Contact.LINE_DRIVE) {
            const hardContact = clamp((exitVelocity - 82) / 24, 0, 1)
            const carriedContact = clamp((distance - 120) / 220, 0, 1)
            const lowLineDrive = launchAngle < 8 ? 0.12 : 0

            return clamp(0.58 - (hardContact * 0.28) - (carriedContact * 0.18) - lowLineDrive, 0.12, 0.72)
        }

        if (contact === Contact.FLY_BALL) {
            const deepContact = clamp((distance - 250) / 160, 0, 1)
            const hardContact = clamp((exitVelocity - 92) / 30, 0, 1)
            const popupBonus = launchAngle > 45 ? 0.12 : 0

            return clamp(0.78 - (deepContact * 0.50) - (hardContact * 0.12) + popupBonus, 0.10, 0.94)
        }

        if (contact === Contact.GROUNDBALL) {
            const hardContact = clamp((exitVelocity - 78) / 32, 0, 1)
            const toppedBall = launchAngle < -10 ? 0.10 : 0

            return clamp(0.76 - (hardContact * 0.34) + toppedBall, 0.35, 0.90)
        }

        return 0.70
    }

    private static getFullRatingChange(): number {
        if (!Number.isFinite(GENERATED_FULL_CHANGE) || GENERATED_FULL_CHANGE <= 0) {
            throw new Error("Invalid generated rating change bounds.")
        }

        return GENERATED_FULL_CHANGE
    }

}

export { DefenseHitModel, DefenseOutModel, RollChartService, PowerModel, ContactTypeModel, SwingTakeModel, ContactMissModel, FairFoulModel }