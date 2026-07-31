import { strict as assert } from "assert"

import { describe, it } from "mocha"

import { Contact, DefenseHitResult, DefenseOutResult, PlayResult, Position, ShallowDeep, SwingTake } from "../src/sim/service/enums.js"
import {
    ContactMissModel,
    ContactTypeModel,
    DefenseHitModel,
    DefenseOutModel,
    FairFoulModel,
    PowerModel,
    RollChartService,
    SwingTakeModel
} from "../src/sim/service/roll-chart-service.js"

import type {
    ContactMissRollInput,
    ContactProfile,
    ContactQuality,
    DefenseHitRollInput,
    DefenseOutRollInput,
    FairFoulRollInput,
    FielderChanceRollInput,
    HitterChange,
    PitchCount,
    PitchEnvironmentTarget,
    PitcherChange,
    PowerRollInput,
    RollChart,
    ShallowDeepRollInput,
    SwingTakeRollInput
} from "../src/sim/service/interfaces.js"

const AVERAGE_RATING = 100
const MIN_GENERATED_RATING = 30
const MAX_GENERATED_RATING = 170

const GENERATED_FULL_CHANGE = Math.max(
    Math.abs((MIN_GENERATED_RATING / AVERAGE_RATING) - 1),
    Math.abs((MAX_GENERATED_RATING / AVERAGE_RATING) - 1)
)

class RollChartTestHarness {

    public readonly service = new RollChartService()

    public createContactQuality(overrides: Partial<ContactQuality> = {}): ContactQuality {
        return {
            exitVelocity: 94,
            launchAngle: 15,
            distance: 220,
            coordX: 0,
            coordY: 220,
            ...overrides
        }
    }

    public getDefenseOutInput(overrides: {
        pitchEnvironmentTarget?: PitchEnvironmentTarget
        hitterChange?: HitterChange
        defenseChange?: number
        contact?: Contact
        hitQuality?: ContactQuality
    } = {}): DefenseOutRollInput {
        return DefenseOutModel.getInput(
            overrides.pitchEnvironmentTarget ?? this.createPitchEnvironmentTarget(),
            overrides.hitterChange ?? this.createHitterChange(),
            overrides.defenseChange ?? 0,
            overrides.contact ?? Contact.LINE_DRIVE,
            overrides.hitQuality ?? this.createContactQuality()
        )
    }

    public getDefenseOutChart(overrides: {
        pitchEnvironmentTarget?: PitchEnvironmentTarget
        hitterChange?: HitterChange
        defenseChange?: number
        contact?: Contact
        hitQuality?: ContactQuality
    } = {}): RollChart {
        return this.service.getDefenseOutRollChart(
            overrides.pitchEnvironmentTarget ?? this.createPitchEnvironmentTarget(),
            overrides.hitterChange ?? this.createHitterChange(),
            overrides.defenseChange ?? 0,
            overrides.contact ?? Contact.LINE_DRIVE,
            overrides.hitQuality ?? this.createContactQuality()
        )
    }

    public getDefenseHitInput(overrides: {
        defenseChange?: number
        contact?: Contact
        hitQuality?: ContactQuality
    } = {}): DefenseHitRollInput {
        return DefenseHitModel.getInput(
            overrides.defenseChange ?? 0,
            overrides.contact ?? Contact.LINE_DRIVE,
            overrides.hitQuality ?? this.createContactQuality()
        )
    }

    public getDefenseHitChart(overrides: {
        defenseChange?: number
        contact?: Contact
        hitQuality?: ContactQuality
    } = {}): RollChart {
        return this.service.getDefenseHitRollChart(
            overrides.defenseChange ?? 0,
            overrides.contact ?? Contact.LINE_DRIVE,
            overrides.hitQuality ?? this.createContactQuality()
        )
    }

    public getDefenseOutTotal(input: DefenseOutRollInput): number {
        return input.out + input.single
    }

    public getDefenseHitTotal(input: DefenseHitRollInput): number {
        return input.hit + input.out
    }


    public createPitchEnvironmentTarget(powerRollInput: PowerRollInput = {
        out: 700,
        singles: 200,
        doubles: 60,
        triples: 10,
        hr: 30
    }, contactRollInput: ContactProfile = {
        groundball: 450,
        flyBall: 350,
        lineDrive: 200
    }): PitchEnvironmentTarget {
        return {
            avgRating: 100,
            outcome: {
                soPercent: 0.22,
                babip: 0.3
            },
            battedBall: {
                powerRollInput,
                contactRollInput
            },
            swing: {
                behaviorByCount: [
                    {
                        balls: 0,
                        strikes: 0,
                        zoneSwingPercent: 65,
                        chaseSwingPercent: 25,
                        zoneContactPercent: 85,
                        chaseContactPercent: 65,
                        foulContactPercent: 15
                    },
                    {
                        balls: 1,
                        strikes: 0,
                        zoneSwingPercent: 62,
                        chaseSwingPercent: 20,
                        zoneContactPercent: 86,
                        chaseContactPercent: 67,
                        foulContactPercent: 16
                    },
                    {
                        balls: 0,
                        strikes: 2,
                        zoneSwingPercent: 78,
                        chaseSwingPercent: 40,
                        zoneContactPercent: 78,
                        chaseContactPercent: 55,
                        foulContactPercent: 24
                    },
                    {
                        balls: 3,
                        strikes: 2,
                        zoneSwingPercent: 88,
                        chaseSwingPercent: 70,
                        zoneContactPercent: 82,
                        chaseContactPercent: 62,
                        foulContactPercent: 27
                    }
                ]
            },
            pitchEnvironmentTuning: {
                tuning: {
                    swing: {
                        disciplineChaseSwingEffect: 0,
                        disciplineZoneSwingEffect: 0,
                        pitchQualityZoneSwingEffect: 0,
                        pitchQualityChaseSwingEffect: 0
                    },
                    contact: {
                        contactSkillEffect: 0,
                        pitchQualityContactEffect: 0
                    }
                }
            }
        } as PitchEnvironmentTarget
    }

    public createHitterChange(overrides: Partial<HitterChange> = {}): HitterChange {
        return {
            plateDisiplineChange: 0,
            contactChange: 0,
            gapPowerChange: 0,
            hrPowerChange: 0,
            speedChange: 0,
            stealsChange: 0,
            defenseChange: 0,
            armChange: 0,
            ...overrides
        }
    }

    public createPitcherChange(overrides: Partial<PitcherChange> = {}): PitcherChange {
        return {
            powerChange: 0,
            controlChange: 0,
            movementChange: 0,
            ...overrides
        }
    }

    public createPitchCount(balls = 0, strikes = 0): PitchCount {
        return {
            balls,
            strikes,
            fouls: 0,
            pitches: 0
        }
    }

    public getSwingTakeInput(overrides: {
        pitchEnvironmentTarget?: PitchEnvironmentTarget
        hitterChange?: HitterChange
        inZone?: boolean
        pitchQuality?: number
        pitchCount?: PitchCount
    } = {}): SwingTakeRollInput {
        return SwingTakeModel.getInput(
            overrides.pitchEnvironmentTarget ?? this.createPitchEnvironmentTarget(),
            overrides.hitterChange ?? this.createHitterChange(),
            overrides.inZone ?? true,
            overrides.pitchQuality ?? 50,
            overrides.pitchCount ?? this.createPitchCount()
        )
    }

    public getSwingTakeChart(overrides: {
        pitchEnvironmentTarget?: PitchEnvironmentTarget
        hitterChange?: HitterChange
        inZone?: boolean
        pitchQuality?: number
        pitchCount?: PitchCount
    } = {}): RollChart {
        return this.service.getMatchupSwingTakeRollChart(
            overrides.pitchEnvironmentTarget ?? this.createPitchEnvironmentTarget(),
            overrides.hitterChange ?? this.createHitterChange(),
            overrides.inZone ?? true,
            overrides.pitchQuality ?? 50,
            overrides.pitchCount ?? this.createPitchCount()
        )
    }

    public getContactMissInput(overrides: {
        pitchEnvironmentTarget?: PitchEnvironmentTarget
        hitterChange?: HitterChange
        pitcherChange?: PitcherChange
        inZone?: boolean
        pitchQuality?: number
        pitchCount?: PitchCount
    } = {}): ContactMissRollInput {
        return ContactMissModel.getInput(
            overrides.pitchEnvironmentTarget ?? this.createPitchEnvironmentTarget(),
            overrides.hitterChange ?? this.createHitterChange(),
            overrides.pitcherChange ?? this.createPitcherChange(),
            overrides.inZone ?? true,
            overrides.pitchQuality ?? 50,
            overrides.pitchCount ?? this.createPitchCount()
        )
    }

    public getContactMissChart(overrides: {
        pitchEnvironmentTarget?: PitchEnvironmentTarget
        hitterChange?: HitterChange
        pitcherChange?: PitcherChange
        inZone?: boolean
        pitchQuality?: number
        pitchCount?: PitchCount
    } = {}): RollChart {
        return this.service.getMatchupContactMissRollChart(
            overrides.pitchEnvironmentTarget ?? this.createPitchEnvironmentTarget(),
            overrides.hitterChange ?? this.createHitterChange(),
            overrides.pitcherChange ?? this.createPitcherChange(),
            overrides.inZone ?? true,
            overrides.pitchQuality ?? 50,
            overrides.pitchCount ?? this.createPitchCount()
        )
    }

    public getFairFoulInput(overrides: {
        pitchEnvironmentTarget?: PitchEnvironmentTarget
        hitterChange?: HitterChange
        pitcherChange?: PitcherChange
        pitchQuality?: number
        guessPitch?: boolean
        pitchCount?: PitchCount
    } = {}): FairFoulRollInput {
        return FairFoulModel.getInput(
            overrides.pitchEnvironmentTarget ?? this.createPitchEnvironmentTarget(),
            overrides.hitterChange ?? this.createHitterChange(),
            overrides.pitcherChange ?? this.createPitcherChange(),
            overrides.pitchQuality ?? 50,
            overrides.guessPitch ?? false,
            overrides.pitchCount ?? this.createPitchCount()
        )
    }

    public getFairFoulChart(overrides: {
        pitchEnvironmentTarget?: PitchEnvironmentTarget
        hitterChange?: HitterChange
        pitcherChange?: PitcherChange
        pitchQuality?: number
        guessPitch?: boolean
        pitchCount?: PitchCount
    } = {}): RollChart {
        return this.service.getMatchupFairFoulRollChart(
            overrides.pitchEnvironmentTarget ?? this.createPitchEnvironmentTarget(),
            overrides.hitterChange ?? this.createHitterChange(),
            overrides.pitcherChange ?? this.createPitcherChange(),
            overrides.pitchQuality ?? 50,
            overrides.guessPitch ?? false,
            overrides.pitchCount ?? this.createPitchCount()
        )
    }

    public getEntries(chart: RollChart): string[] {
        assert.ok(chart.entries)

        return Array.from(chart.entries.values())
    }

    public getCounts(chart: RollChart): Map<string, number> {
        const counts = new Map<string, number>()

        for (const value of this.getEntries(chart)) {
            counts.set(value, (counts.get(value) ?? 0) + 1)
        }

        return counts
    }

    public assertSequentialIndexes(chart: RollChart): void {
        assert.ok(chart.entries)

        assert.deepEqual(
            Array.from(chart.entries.keys()),
            Array.from(
                { length: chart.entries.size },
                (_, index) => index
            )
        )
    }

    public getPowerTotal(input: PowerRollInput): number {
        return input.out +
            input.singles +
            input.doubles +
            input.triples +
            input.hr
    }

    public getContactTotal(input: ContactProfile): number {
        return input.groundball +
            input.flyBall +
            input.lineDrive
    }

    public getSwingTakeTotal(input: SwingTakeRollInput): number {
        return input.swing + input.take
    }

    public getContactMissTotal(input: ContactMissRollInput): number {
        return input.contact + input.miss
    }

    public getFairFoulTotal(input: FairFoulRollInput): number {
        return input.fair + input.foul
    }

    public getPowerChartBreakdown(hitterChange: HitterChange, pitcherChange: PitcherChange): {
        out: number
        singles: number
        doubles: number
        triples: number
        hr: number
        hit: number
        xbh: number
        totalBases: number
        chartBabip: number
    } {
        const chart = this.service.getMatchupPowerRollChart(
            this.createPitchEnvironmentTarget(),
            hitterChange,
            pitcherChange
        )

        const counts = this.getCounts(chart)
        const out = counts.get(PlayResult.OUT) ?? 0
        const singles = counts.get(PlayResult.SINGLE) ?? 0
        const doubles = counts.get(PlayResult.DOUBLE) ?? 0
        const triples = counts.get(PlayResult.TRIPLE) ?? 0
        const hr = counts.get(PlayResult.HR) ?? 0
        const hit = singles + doubles + triples + hr
        const xbh = doubles + triples + hr
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
        const babipDenominator = out + singles + doubles + triples

        return {
            out,
            singles,
            doubles,
            triples,
            hr,
            hit,
            xbh,
            totalBases,
            chartBabip: babipDenominator > 0
                ? (singles + doubles + triples) / babipDenominator
                : 0
        }
    }


}

const harness = new RollChartTestHarness()

describe("RollChartService", () => {

    describe("getMatchupSwingTakeRollChart", () => {

        it("creates the baseline swing-take chart for a neutral hitter", () => {
            const chart = harness.getSwingTakeChart()
            const entries = harness.getEntries(chart)
            const counts = harness.getCounts(chart)

            assert.equal(entries.length, 1000)
            assert.equal(counts.get(SwingTake.SWING), 650)
            assert.equal(counts.get(SwingTake.TAKE), 350)
            assert.equal(entries[0], SwingTake.SWING)
            assert.equal(entries[649], SwingTake.SWING)
            assert.equal(entries[650], SwingTake.TAKE)
            assert.equal(entries[999], SwingTake.TAKE)

            harness.assertSequentialIndexes(chart)
        })

        it("uses the SwingTakeModel result when creating the chart", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()
            const hitterChange = harness.createHitterChange({
                plateDisiplineChange: 0.35
            })
            const pitchCount = harness.createPitchCount(3, 2)

            const expected = SwingTakeModel.getInput(
                pitchEnvironmentTarget,
                hitterChange,
                false,
                65,
                pitchCount
            )

            const chart = harness.getSwingTakeChart({
                pitchEnvironmentTarget,
                hitterChange,
                inZone: false,
                pitchQuality: 65,
                pitchCount
            })

            const counts = harness.getCounts(chart)

            assert.equal(chart.entries?.size, 1000)
            assert.equal(counts.get(SwingTake.SWING) ?? 0, expected.swing)
            assert.equal(counts.get(SwingTake.TAKE) ?? 0, expected.take)

            harness.assertSequentialIndexes(chart)
        })

    })

    describe("getMatchupPowerRollChart", () => {

        it("creates the baseline power roll chart for neutral player changes", () => {
            const service = harness.service
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const chart = service.getMatchupPowerRollChart(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const entries = harness.getEntries(chart)
            const counts = harness.getCounts(chart)

            assert.equal(entries.length, 1000)
            assert.equal(counts.get(PlayResult.OUT), 700)
            assert.equal(counts.get(PlayResult.SINGLE), 200)
            assert.equal(counts.get(PlayResult.DOUBLE), 60)
            assert.equal(counts.get(PlayResult.TRIPLE), 10)
            assert.equal(counts.get(PlayResult.HR), 30)

            assert.equal(entries[0], PlayResult.OUT)
            assert.equal(entries[699], PlayResult.OUT)
            assert.equal(entries[700], PlayResult.SINGLE)
            assert.equal(entries[899], PlayResult.SINGLE)
            assert.equal(entries[900], PlayResult.DOUBLE)
            assert.equal(entries[959], PlayResult.DOUBLE)
            assert.equal(entries[960], PlayResult.TRIPLE)
            assert.equal(entries[969], PlayResult.TRIPLE)
            assert.equal(entries[970], PlayResult.HR)
            assert.equal(entries[999], PlayResult.HR)

            harness.assertSequentialIndexes(chart)
        })

        it("uses the normalized PowerModel result when creating the chart", () => {
            const service = harness.service
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()
            const hitterChange = harness.createHitterChange({
                contactChange: 0.35,
                gapPowerChange: 0.4,
                hrPowerChange: 0.5
            })
            const pitcherChange = harness.createPitcherChange({
                powerChange: 0.15,
                controlChange: 0.1,
                movementChange: -0.2
            })

            const expected = PowerModel.getInput(
                pitchEnvironmentTarget,
                hitterChange,
                pitcherChange
            )

            const chart = service.getMatchupPowerRollChart(
                pitchEnvironmentTarget,
                hitterChange,
                pitcherChange
            )

            const counts = harness.getCounts(chart)

            assert.equal(chart.entries?.size, 1000)
            assert.equal(counts.get(PlayResult.OUT) ?? 0, expected.out)
            assert.equal(counts.get(PlayResult.SINGLE) ?? 0, expected.singles)
            assert.equal(counts.get(PlayResult.DOUBLE) ?? 0, expected.doubles)
            assert.equal(counts.get(PlayResult.TRIPLE) ?? 0, expected.triples)
            assert.equal(counts.get(PlayResult.HR) ?? 0, expected.hr)

            harness.assertSequentialIndexes(chart)
        })

    })

    describe("getMatchupContactRollChart", () => {

        it("creates the baseline contact roll chart for neutral profiles", () => {
            const service = harness.service
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()
            const profile: ContactProfile = {
                groundball: 450,
                flyBall: 350,
                lineDrive: 200
            }

            const chart = service.getMatchupContactRollChart(
                pitchEnvironmentTarget,
                profile,
                profile
            )

            const entries = harness.getEntries(chart)
            const counts = harness.getCounts(chart)

            assert.equal(entries.length, 1000)
            assert.equal(counts.get(Contact.GROUNDBALL), 450)
            assert.equal(counts.get(Contact.FLY_BALL), 350)
            assert.equal(counts.get(Contact.LINE_DRIVE), 200)

            assert.equal(entries[0], Contact.GROUNDBALL)
            assert.equal(entries[449], Contact.GROUNDBALL)
            assert.equal(entries[450], Contact.FLY_BALL)
            assert.equal(entries[799], Contact.FLY_BALL)
            assert.equal(entries[800], Contact.LINE_DRIVE)
            assert.equal(entries[999], Contact.LINE_DRIVE)

            harness.assertSequentialIndexes(chart)
        })

        it("uses the normalized ContactTypeModel result when creating the chart", () => {
            const service = harness.service
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const hitterProfile: ContactProfile = {
                groundball: 600,
                flyBall: 250,
                lineDrive: 150
            }

            const pitcherProfile: ContactProfile = {
                groundball: 500,
                flyBall: 300,
                lineDrive: 200
            }

            const expected = ContactTypeModel.getInput(
                pitchEnvironmentTarget,
                hitterProfile,
                pitcherProfile
            )

            const chart = service.getMatchupContactRollChart(
                pitchEnvironmentTarget,
                hitterProfile,
                pitcherProfile
            )

            const counts = harness.getCounts(chart)

            assert.equal(chart.entries?.size, 1000)
            assert.equal(counts.get(Contact.GROUNDBALL) ?? 0, expected.groundball)
            assert.equal(counts.get(Contact.FLY_BALL) ?? 0, expected.flyBall)
            assert.equal(counts.get(Contact.LINE_DRIVE) ?? 0, expected.lineDrive)

            harness.assertSequentialIndexes(chart)
        })

    })

    describe("getFielderChanceRollChart", () => {

        it("creates a fielder chart in the declared position order", () => {
            const service = harness.service

            const input: FielderChanceRollInput = {
                first: 1,
                second: 2,
                third: 3,
                catcher: 4,
                shortstop: 5,
                leftField: 6,
                centerField: 7,
                rightField: 8,
                pitcher: 9
            }

            const chart = service.getFielderChanceRollChart(input)
            const entries = harness.getEntries(chart)

            assert.equal(entries.length, 45)

            assert.deepEqual(entries, [
                Position.FIRST_BASE,
                Position.SECOND_BASE,
                Position.SECOND_BASE,
                Position.THIRD_BASE,
                Position.THIRD_BASE,
                Position.THIRD_BASE,
                Position.CATCHER,
                Position.CATCHER,
                Position.CATCHER,
                Position.CATCHER,
                Position.SHORTSTOP,
                Position.SHORTSTOP,
                Position.SHORTSTOP,
                Position.SHORTSTOP,
                Position.SHORTSTOP,
                Position.LEFT_FIELD,
                Position.LEFT_FIELD,
                Position.LEFT_FIELD,
                Position.LEFT_FIELD,
                Position.LEFT_FIELD,
                Position.LEFT_FIELD,
                Position.CENTER_FIELD,
                Position.CENTER_FIELD,
                Position.CENTER_FIELD,
                Position.CENTER_FIELD,
                Position.CENTER_FIELD,
                Position.CENTER_FIELD,
                Position.CENTER_FIELD,
                Position.RIGHT_FIELD,
                Position.RIGHT_FIELD,
                Position.RIGHT_FIELD,
                Position.RIGHT_FIELD,
                Position.RIGHT_FIELD,
                Position.RIGHT_FIELD,
                Position.RIGHT_FIELD,
                Position.RIGHT_FIELD,
                Position.PITCHER,
                Position.PITCHER,
                Position.PITCHER,
                Position.PITCHER,
                Position.PITCHER,
                Position.PITCHER,
                Position.PITCHER,
                Position.PITCHER,
                Position.PITCHER
            ])

            harness.assertSequentialIndexes(chart)
        })

        it("omits positions with zero or negative counts", () => {
            const service = harness.service

            const input: FielderChanceRollInput = {
                first: 2,
                second: 0,
                third: -1,
                catcher: 1,
                shortstop: 0,
                leftField: -5,
                centerField: 1,
                rightField: 0,
                pitcher: 2
            }

            const chart = service.getFielderChanceRollChart(input)

            assert.deepEqual(harness.getEntries(chart), [
                Position.FIRST_BASE,
                Position.FIRST_BASE,
                Position.CATCHER,
                Position.CENTER_FIELD,
                Position.PITCHER,
                Position.PITCHER
            ])

            harness.assertSequentialIndexes(chart)
        })

        it("uses loop semantics for fractional counts", () => {
            const service = harness.service

            const input: FielderChanceRollInput = {
                first: 1.2,
                second: 0.2,
                third: 0,
                catcher: 0,
                shortstop: 0,
                leftField: 0,
                centerField: 0,
                rightField: 0,
                pitcher: 0
            }

            const chart = service.getFielderChanceRollChart(input)

            assert.deepEqual(harness.getEntries(chart), [
                Position.FIRST_BASE,
                Position.FIRST_BASE,
                Position.SECOND_BASE
            ])
        })

        it("returns an empty chart when every position count is non-positive", () => {
            const service = harness.service

            const input: FielderChanceRollInput = {
                first: 0,
                second: 0,
                third: 0,
                catcher: 0,
                shortstop: 0,
                leftField: 0,
                centerField: 0,
                rightField: 0,
                pitcher: 0
            }

            const chart = service.getFielderChanceRollChart(input)

            assert.equal(chart.entries?.size, 0)
            assert.deepEqual(harness.getEntries(chart), [])
        })

    })

    describe("getShallowDeepRollChart", () => {

        it("creates a shallow-normal-deep chart in order", () => {
            const service = harness.service

            const input: ShallowDeepRollInput = {
                shallow: 2,
                normal: 3,
                deep: 1
            }

            const chart = service.getShallowDeepRollChart(input)

            assert.deepEqual(harness.getEntries(chart), [
                ShallowDeep.SHALLOW,
                ShallowDeep.SHALLOW,
                ShallowDeep.NORMAL,
                ShallowDeep.NORMAL,
                ShallowDeep.NORMAL,
                ShallowDeep.DEEP
            ])

            harness.assertSequentialIndexes(chart)
        })

        it("omits zero and negative depth counts", () => {
            const service = harness.service

            const input: ShallowDeepRollInput = {
                shallow: -1,
                normal: 2,
                deep: 0
            }

            const chart = service.getShallowDeepRollChart(input)

            assert.deepEqual(harness.getEntries(chart), [
                ShallowDeep.NORMAL,
                ShallowDeep.NORMAL
            ])
        })

        it("returns an empty chart when every depth count is non-positive", () => {
            const service = harness.service

            const input: ShallowDeepRollInput = {
                shallow: 0,
                normal: 0,
                deep: 0
            }

            const chart = service.getShallowDeepRollChart(input)

            assert.equal(chart.entries?.size, 0)
            assert.deepEqual(harness.getEntries(chart), [])
        })

    })

    describe("getDefenseOutRollChart", () => {

        it("creates the baseline defense out chart for neutral changes", () => {
            const chart = harness.getDefenseOutChart()
            const entries = harness.getEntries(chart)
            const counts = harness.getCounts(chart)

            assert.equal(entries.length, 1000)
            assert.equal(counts.get(DefenseOutResult.OUT), 1000)
            assert.equal(counts.get(DefenseOutResult.SINGLE) ?? 0, 0)
            assert.equal(entries[0], DefenseOutResult.OUT)
            assert.equal(entries[999], DefenseOutResult.OUT)

            harness.assertSequentialIndexes(chart)
        })

        it("uses the DefenseOutModel result when creating the chart", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()
            const hitterChange = harness.createHitterChange({
                contactChange: 0.4,
                gapPowerChange: 0.2,
                hrPowerChange: 0.1
            })
            const hitQuality = harness.createContactQuality({
                exitVelocity: 102,
                launchAngle: 12,
                distance: 260
            })

            const expected = DefenseOutModel.getInput(pitchEnvironmentTarget, hitterChange, -0.4, Contact.LINE_DRIVE, hitQuality)
            const chart = harness.getDefenseOutChart({
                pitchEnvironmentTarget,
                hitterChange,
                defenseChange: -0.4,
                contact: Contact.LINE_DRIVE,
                hitQuality
            })
            const counts = harness.getCounts(chart)

            assert.equal(chart.entries?.size, 1000)
            assert.equal(counts.get(DefenseOutResult.OUT) ?? 0, expected.out)
            assert.equal(counts.get(DefenseOutResult.SINGLE) ?? 0, expected.single)

            harness.assertSequentialIndexes(chart)
        })

    })

    describe("getDefenseHitRollChart", () => {

        it("creates the baseline defense hit chart for neutral defense", () => {
            const chart = harness.getDefenseHitChart()
            const entries = harness.getEntries(chart)
            const counts = harness.getCounts(chart)

            assert.equal(entries.length, 1000)
            assert.equal(counts.get(DefenseHitResult.HIT), 1000)
            assert.equal(counts.get(DefenseHitResult.OUT) ?? 0, 0)
            assert.equal(entries[0], DefenseHitResult.HIT)
            assert.equal(entries[999], DefenseHitResult.HIT)

            harness.assertSequentialIndexes(chart)
        })

        it("uses the DefenseHitModel result when creating the chart", () => {
            const hitQuality = harness.createContactQuality({
                exitVelocity: 100,
                launchAngle: 18,
                distance: 250
            })

            const expected = DefenseHitModel.getInput(0.45, Contact.LINE_DRIVE, hitQuality)
            const chart = harness.getDefenseHitChart({
                defenseChange: 0.45,
                contact: Contact.LINE_DRIVE,
                hitQuality
            })
            const counts = harness.getCounts(chart)

            assert.equal(chart.entries?.size, 1000)
            assert.equal(counts.get(DefenseHitResult.HIT) ?? 0, expected.hit)
            assert.equal(counts.get(DefenseHitResult.OUT) ?? 0, expected.out)

            harness.assertSequentialIndexes(chart)
        })

    })



})

describe("PowerModel", () => {

    describe("getInput", () => {

        it("returns the baseline power distribution for neutral changes", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            assert.deepEqual(result, {
                out: 700,
                singles: 200,
                doubles: 60,
                triples: 10,
                hr: 30
            })
        })

        it("normalizes a non-1000 baseline to exactly 1000 entries", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget({
                out: 70,
                singles: 20,
                doubles: 6,
                triples: 1,
                hr: 3
            })

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            assert.deepEqual(result, {
                out: 700,
                singles: 200,
                doubles: 60,
                triples: 10,
                hr: 30
            })

            assert.equal(harness.getPowerTotal(result), 1000)
        })

        it("adds positive hitter contact by reducing outs and increasing hits", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({
                    contactChange: 0.5
                }),
                harness.createPitcherChange()
            )

            const baselineHits =
                baseline.singles +
                baseline.doubles +
                baseline.triples +
                baseline.hr

            const improvedHits =
                improved.singles +
                improved.doubles +
                improved.triples +
                improved.hr

            assert.ok(improved.out < baseline.out)
            assert.ok(improvedHits > baselineHits)
            assert.equal(harness.getPowerTotal(improved), 1000)
        })

        it("adds negative hitter contact by increasing outs and reducing hits", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({
                    contactChange: -0.5
                }),
                harness.createPitcherChange()
            )

            const baselineHits =
                baseline.singles +
                baseline.doubles +
                baseline.triples +
                baseline.hr

            const reducedHits =
                reduced.singles +
                reduced.doubles +
                reduced.triples +
                reduced.hr

            assert.ok(reduced.out > baseline.out)
            assert.ok(reducedHits < baselineHits)
            assert.equal(harness.getPowerTotal(reduced), 1000)
        })

        it("moves positive hitter gap power from singles toward doubles and triples", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({ gapPowerChange: 0.5 }),
                harness.createPitcherChange()
            )

            assert.ok(improved.singles < baseline.singles)
            assert.ok(improved.doubles > baseline.doubles)
            assert.ok(improved.triples > baseline.triples)
            assert.equal(improved.hr, baseline.hr)
            assert.equal(harness.getPowerTotal(improved), 1000)
        })

        it("moves negative hitter gap power from triples and doubles toward singles", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({ gapPowerChange: -0.5 }),
                harness.createPitcherChange()
            )

            assert.ok(reduced.singles > baseline.singles)
            assert.ok(reduced.doubles < baseline.doubles)
            assert.ok(reduced.triples < baseline.triples)
            assert.equal(reduced.hr, baseline.hr)
            assert.equal(harness.getPowerTotal(reduced), 1000)
        })

        it("moves positive hitter home run power from singles to home runs", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({ hrPowerChange: 0.25 }),
                harness.createPitcherChange()
            )

            assert.ok(improved.singles < baseline.singles)
            assert.ok(improved.hr > baseline.hr)
            assert.equal(harness.getPowerTotal(improved), 1000)
        })

        it("moves negative hitter home run power from home runs to singles", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({ hrPowerChange: -0.25 }),
                harness.createPitcherChange()
            )

            assert.ok(reduced.singles > baseline.singles)
            assert.ok(reduced.hr < baseline.hr)
            assert.equal(harness.getPowerTotal(reduced), 1000)
        })

        it("caps hitter outcome transfers at the available source count", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({
                    gapPowerChange: 100,
                    hrPowerChange: 100
                }),
                harness.createPitcherChange()
            )

            assert.ok(result.out >= 0)
            assert.ok(result.singles >= 0)
            assert.ok(result.doubles >= 0)
            assert.ok(result.triples >= 0)
            assert.ok(result.hr >= 0)
            assert.equal(harness.getPowerTotal(result), 1000)
        })

        it("uses pitcher power and control to increase outs and reduce singles", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange({
                    powerChange: 0.3,
                    controlChange: 0.3
                })
            )

            assert.ok(improved.out > baseline.out)
            assert.ok(improved.singles < baseline.singles)
            assert.equal(harness.getPowerTotal(improved), 1000)
        })

        it("uses negative pitcher power and control to reduce outs and increase singles", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange({
                    powerChange: -0.3,
                    controlChange: -0.3
                })
            )

            assert.ok(reduced.out < baseline.out)
            assert.ok(reduced.singles > baseline.singles)
            assert.equal(harness.getPowerTotal(reduced), 1000)
        })

        it("uses positive pitcher movement to convert extra-base hits into singles", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange({ movementChange: 0.5 })
            )

            assert.ok(improved.singles > baseline.singles)
            assert.ok(improved.doubles < baseline.doubles)
            assert.ok(improved.hr < baseline.hr)
            assert.ok(improved.triples <= baseline.triples)
            assert.equal(harness.getPowerTotal(improved), 1000)
        })

        it("does not allow negative pitcher power to increase the positive movement reduction of triples", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const negativePower = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange({
                    powerChange: -0.5,
                    movementChange: 0.5
                })
            )

            const neutralPower = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange({
                    powerChange: 0,
                    movementChange: 0.5
                })
            )

            const positivePower = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange({
                    powerChange: 0.5,
                    movementChange: 0.5
                })
            )

            assert.equal(negativePower.triples, neutralPower.triples)
            assert.ok(negativePower.triples < 10)
            assert.ok(positivePower.triples < negativePower.triples)

            assert.equal(harness.getPowerTotal(negativePower), 1000)
            assert.equal(harness.getPowerTotal(neutralPower), 1000)
            assert.equal(harness.getPowerTotal(positivePower), 1000)
        })

        it("uses negative pitcher movement to convert singles into extra-base hits", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange({ movementChange: -0.5 })
            )

            assert.ok(reduced.singles < baseline.singles)
            assert.ok(reduced.doubles > baseline.doubles)
            assert.ok(reduced.triples > baseline.triples)
            assert.ok(reduced.hr > baseline.hr)
            assert.equal(harness.getPowerTotal(reduced), 1000)
        })

        it("combines hitter and pitcher deviations from the same baseline", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const hitterOnly = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({
                    contactChange: 0.4,
                    gapPowerChange: 0.3,
                    hrPowerChange: 0.3
                }),
                harness.createPitcherChange()
            )

            const pitcherOnly = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange({
                    powerChange: 0.2,
                    controlChange: 0.2,
                    movementChange: 0.2
                })
            )

            const combined = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({
                    contactChange: 0.4,
                    gapPowerChange: 0.3,
                    hrPowerChange: 0.3
                }),
                harness.createPitcherChange({
                    powerChange: 0.2,
                    controlChange: 0.2,
                    movementChange: 0.2
                })
            )

            assert.notDeepEqual(combined, hitterOnly)
            assert.notDeepEqual(combined, pitcherOnly)
            assert.equal(harness.getPowerTotal(combined), 1000)
        })

        it("never returns negative outcome counts after combining extreme changes", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange({
                    contactChange: -100,
                    gapPowerChange: 100,
                    hrPowerChange: 100
                }),
                harness.createPitcherChange({
                    powerChange: 100,
                    controlChange: 100,
                    movementChange: -100
                })
            )

            assert.ok(Object.values(result).every(value => value >= 0))
            assert.equal(harness.getPowerTotal(result), 1000)
        })

        it("corrects normalization rounding by adding missing entries to outs", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget({
                out: 1,
                singles: 1,
                doubles: 1,
                triples: 0,
                hr: 0
            })

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            assert.deepEqual(result, {
                out: 334,
                singles: 333,
                doubles: 333,
                triples: 0,
                hr: 0
            })
        })

        it("corrects excess normalization rounding by reducing the largest field", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget({
                out: 1,
                singles: 1,
                doubles: 1,
                triples: 1,
                hr: 1
            })

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                harness.createHitterChange(),
                harness.createPitcherChange()
            )

            assert.deepEqual(result, {
                out: 200,
                singles: 200,
                doubles: 200,
                triples: 200,
                hr: 200
            })
        })

        it("throws when hitter gap power change is NaN", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange({ gapPowerChange: Number.NaN }),
                    harness.createPitcherChange()
                ),
                /Invalid hitter gap power change NaN\./
            )
        })

        it("throws when hitter gap power change is infinite", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange({ gapPowerChange: Number.POSITIVE_INFINITY }),
                    harness.createPitcherChange()
                ),
                /Invalid hitter gap power change Infinity\./
            )
        })

        it("throws when hitter home run power change is NaN", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange({ hrPowerChange: Number.NaN }),
                    harness.createPitcherChange()
                ),
                /Invalid hitter home run power change NaN\./
            )
        })

        it("throws when hitter home run power change is infinite", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange({ hrPowerChange: Number.NEGATIVE_INFINITY }),
                    harness.createPitcherChange()
                ),
                /Invalid hitter home run power change -Infinity\./
            )
        })

        it("throws when pitcher power change is NaN", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange(),
                    harness.createPitcherChange({ powerChange: Number.NaN })
                ),
                /Invalid pitcher power change NaN\./
            )
        })

        it("throws when pitcher power change is infinite", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange(),
                    harness.createPitcherChange({ powerChange: Number.POSITIVE_INFINITY })
                ),
                /Invalid pitcher power change Infinity\./
            )
        })

        it("throws when pitcher control change is NaN", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange(),
                    harness.createPitcherChange({ controlChange: Number.NaN })
                ),
                /Invalid pitcher control change NaN\./
            )
        })

        it("throws when pitcher control change is infinite", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange(),
                    harness.createPitcherChange({ controlChange: Number.NEGATIVE_INFINITY })
                ),
                /Invalid pitcher control change -Infinity\./
            )
        })

        it("throws when pitcher movement change is NaN", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange(),
                    harness.createPitcherChange({ movementChange: Number.NaN })
                ),
                /Invalid pitcher movement change NaN\./
            )
        })

        it("throws when pitcher movement change is infinite", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange(),
                    harness.createPitcherChange({ movementChange: Number.POSITIVE_INFINITY })
                ),
                /Invalid pitcher movement change Infinity\./
            )
        })

        it("throws when the baseline power total is zero", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget({
                out: 0,
                singles: 0,
                doubles: 0,
                triples: 0,
                hr: 0
            })

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange(),
                    harness.createPitcherChange()
                ),
                /Power roll input total must be greater than zero\./
            )
        })

        it("throws when all combined power outcomes are reduced to zero", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget({
                out: 0,
                singles: 1,
                doubles: 0,
                triples: 0,
                hr: 0
            })

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    harness.createHitterChange({ contactChange: -100 }),
                    harness.createPitcherChange({ movementChange: -100 })
                ),
                /Power roll input total must be greater than zero\./
            )
        })

    })

})

describe("ContactTypeModel", () => {

    describe("getInput", () => {

        it("returns the baseline contact distribution for neutral profiles", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const profile: ContactProfile = {
                groundball: 450,
                flyBall: 350,
                lineDrive: 200
            }

            const result = ContactTypeModel.getInput(
                pitchEnvironmentTarget,
                profile,
                profile
            )

            assert.deepEqual(result, {
                groundball: 450,
                flyBall: 350,
                lineDrive: 200
            })
        })

        it("combines hitter and pitcher deviations from the baseline", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const hitterProfile: ContactProfile = {
                groundball: 550,
                flyBall: 300,
                lineDrive: 150
            }

            const pitcherProfile: ContactProfile = {
                groundball: 500,
                flyBall: 300,
                lineDrive: 200
            }

            const result = ContactTypeModel.getInput(
                pitchEnvironmentTarget,
                hitterProfile,
                pitcherProfile
            )

            assert.deepEqual(result, {
                groundball: 600,
                flyBall: 250,
                lineDrive: 150
            })

            assert.equal(harness.getContactTotal(result), 1000)
        })

        it("clamps negative combined contact values to zero", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const hitterProfile: ContactProfile = {
                groundball: 0,
                flyBall: 700,
                lineDrive: 300
            }

            const pitcherProfile: ContactProfile = {
                groundball: 0,
                flyBall: 700,
                lineDrive: 300
            }

            const result = ContactTypeModel.getInput(
                pitchEnvironmentTarget,
                hitterProfile,
                pitcherProfile
            )

            assert.equal(result.groundball, 0)
            assert.ok(result.flyBall > 0)
            assert.ok(result.lineDrive > 0)
            assert.equal(harness.getContactTotal(result), 1000)
        })

        it("normalizes arbitrary contact totals to exactly 1000", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget(
                undefined,
                {
                    groundball: 45,
                    flyBall: 35,
                    lineDrive: 20
                }
            )

            const profile: ContactProfile = {
                groundball: 45,
                flyBall: 35,
                lineDrive: 20
            }

            const result = ContactTypeModel.getInput(
                pitchEnvironmentTarget,
                profile,
                profile
            )

            assert.deepEqual(result, {
                groundball: 450,
                flyBall: 350,
                lineDrive: 200
            })

            assert.equal(harness.getContactTotal(result), 1000)
        })

        it("adds normalization rounding differences to groundballs", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget(
                undefined,
                {
                    groundball: 1,
                    flyBall: 1,
                    lineDrive: 1
                }
            )

            const profile: ContactProfile = {
                groundball: 1,
                flyBall: 1,
                lineDrive: 1
            }

            const result = ContactTypeModel.getInput(
                pitchEnvironmentTarget,
                profile,
                profile
            )

            assert.deepEqual(result, {
                groundball: 334,
                flyBall: 333,
                lineDrive: 333
            })
        })

        it("removes excess normalization entries from the largest field", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget(
                undefined,
                {
                    groundball: 1,
                    flyBall: 1,
                    lineDrive: 4
                }
            )

            const profile: ContactProfile = {
                groundball: 1,
                flyBall: 1,
                lineDrive: 4
            }

            const result = ContactTypeModel.getInput(
                pitchEnvironmentTarget,
                profile,
                profile
            )

            assert.deepEqual(result, {
                groundball: 167,
                flyBall: 167,
                lineDrive: 666
            })

            assert.equal(harness.getContactTotal(result), 1000)
        })

        it("returns non-negative values after extreme profile differences", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const hitterProfile: ContactProfile = {
                groundball: -10000,
                flyBall: 10000,
                lineDrive: 10000
            }

            const pitcherProfile: ContactProfile = {
                groundball: -10000,
                flyBall: 10000,
                lineDrive: 10000
            }

            const result = ContactTypeModel.getInput(
                pitchEnvironmentTarget,
                hitterProfile,
                pitcherProfile
            )

            assert.ok(result.groundball >= 0)
            assert.ok(result.flyBall >= 0)
            assert.ok(result.lineDrive >= 0)
            assert.equal(harness.getContactTotal(result), 1000)
        })

        it("throws when the combined contact total is zero", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            const zeroProfile: ContactProfile = {
                groundball: 0,
                flyBall: 0,
                lineDrive: 0
            }

            assert.throws(
                () => ContactTypeModel.getInput(
                    pitchEnvironmentTarget,
                    zeroProfile,
                    zeroProfile
                ),
                /Contact type roll input total must be greater than zero\./
            )
        })

    })

})

describe("SwingTakeModel", () => {

    describe("getInput", () => {

        it("returns the zone swing baseline for a neutral hitter and average pitch", () => {
            const input = harness.getSwingTakeInput({
                inZone: true,
                pitchCount: harness.createPitchCount(0, 0)
            })

            assert.deepEqual(input, {
                swing: 650,
                take: 350
            })
        })

        it("returns the chase swing baseline for a neutral hitter and average pitch", () => {
            const input = harness.getSwingTakeInput({
                inZone: false,
                pitchCount: harness.createPitchCount(0, 0)
            })

            assert.deepEqual(input, {
                swing: 250,
                take: 750
            })
        })

        it("uses the behavior configured for the current count", () => {
            const input = harness.getSwingTakeInput({
                inZone: false,
                pitchCount: harness.createPitchCount(0, 2)
            })

            assert.deepEqual(input, {
                swing: 400,
                take: 600
            })
        })

        it("keeps the distribution normalized to 1000", () => {
            const input = harness.getSwingTakeInput({
                hitterChange: harness.createHitterChange({
                    plateDisiplineChange: 0.5
                }),
                inZone: false
            })

            assert.equal(input.swing + input.take, 1000)
        })

        it("reduces chase swings for positive plate discipline", () => {
            const baseline = harness.getSwingTakeInput({
                inZone: false
            })

            const improved = harness.getSwingTakeInput({
                hitterChange: harness.createHitterChange({
                    plateDisiplineChange: 0.5
                }),
                inZone: false
            })

            assert.ok(improved.swing < baseline.swing)
            assert.ok(improved.swing > 0)
        })

        it("increases chase swings for negative plate discipline", () => {
            const baseline = harness.getSwingTakeInput({
                inZone: false
            })

            const reduced = harness.getSwingTakeInput({
                hitterChange: harness.createHitterChange({
                    plateDisiplineChange: -0.5
                }),
                inZone: false
            })

            assert.ok(reduced.swing > baseline.swing)
            assert.ok(reduced.swing < 1000)
        })

        it("keeps rating 100 at the pitch-environment baseline for every count", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            for (const behavior of pitchEnvironmentTarget.swing.behaviorByCount) {
                const pitchCount = harness.createPitchCount(behavior.balls, behavior.strikes)

                const zone = harness.getSwingTakeInput({
                    pitchEnvironmentTarget,
                    hitterChange: harness.createHitterChange(),
                    inZone: true,
                    pitchCount
                })

                const chase = harness.getSwingTakeInput({
                    pitchEnvironmentTarget,
                    hitterChange: harness.createHitterChange(),
                    inZone: false,
                    pitchCount
                })

                assert.equal(zone.swing, Math.round(behavior.zoneSwingPercent * 10))
                assert.equal(chase.swing, Math.round(behavior.chaseSwingPercent * 10))
            }
        })

        it("does not change zone swings when discipline zone effect is zero", () => {
            const baseline = harness.getSwingTakeInput({
                hitterChange: harness.createHitterChange(),
                inZone: true
            })

            const improved = harness.getSwingTakeInput({
                hitterChange: harness.createHitterChange({
                    plateDisiplineChange: 0.7
                }),
                inZone: true
            })

            const reduced = harness.getSwingTakeInput({
                hitterChange: harness.createHitterChange({
                    plateDisiplineChange: -0.7
                }),
                inZone: true
            })

            assert.equal(improved.swing, baseline.swing)
            assert.equal(reduced.swing, baseline.swing)
        })

        it("uses discipline zone effect to adjust zone swings when configured", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            pitchEnvironmentTarget.pitchEnvironmentTuning!.tuning!.swing!.disciplineZoneSwingEffect = 0.1

            const baseline = harness.getSwingTakeInput({
                pitchEnvironmentTarget,
                hitterChange: harness.createHitterChange(),
                inZone: true
            })

            const improved = harness.getSwingTakeInput({
                pitchEnvironmentTarget,
                hitterChange: harness.createHitterChange({
                    plateDisiplineChange: 0.7
                }),
                inZone: true
            })

            const reduced = harness.getSwingTakeInput({
                pitchEnvironmentTarget,
                hitterChange: harness.createHitterChange({
                    plateDisiplineChange: -0.7
                }),
                inZone: true
            })

            assert.ok(improved.swing < baseline.swing)
            assert.ok(reduced.swing > baseline.swing)
            assert.ok(improved.swing > 0)
            assert.ok(reduced.swing < 1000)
        })

        it("uses discipline chase effect to scale the chase adjustment", () => {
            const neutralEnvironment = harness.createPitchEnvironmentTarget()
            const strongerEnvironment = harness.createPitchEnvironmentTarget()

            strongerEnvironment.pitchEnvironmentTuning!.tuning!.swing!.disciplineChaseSwingEffect = 0.5

            const neutralEffect = harness.getSwingTakeInput({
                pitchEnvironmentTarget: neutralEnvironment,
                hitterChange: harness.createHitterChange({
                    plateDisiplineChange: 0.5
                }),
                inZone: false
            })

            const strongerEffect = harness.getSwingTakeInput({
                pitchEnvironmentTarget: strongerEnvironment,
                hitterChange: harness.createHitterChange({
                    plateDisiplineChange: 0.5
                }),
                inZone: false
            })

            assert.ok(strongerEffect.swing < neutralEffect.swing)
        })

        it("does not use hitter contact in the swing-take decision", () => {
            const baseline = harness.getSwingTakeInput({
                inZone: false
            })

            const changed = harness.getSwingTakeInput({
                hitterChange: harness.createHitterChange({
                    contactChange: 0.7
                }),
                inZone: false
            })

            assert.deepEqual(changed, baseline)
        })

        it("applies zone pitch-quality tuning", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            pitchEnvironmentTarget.pitchEnvironmentTuning!.tuning!.swing!.pitchQualityZoneSwingEffect = 10

            const average = harness.getSwingTakeInput({
                pitchEnvironmentTarget,
                inZone: true,
                pitchQuality: 50
            })

            const highQuality = harness.getSwingTakeInput({
                pitchEnvironmentTarget,
                inZone: true,
                pitchQuality: 100
            })

            assert.ok(highQuality.swing < average.swing)
        })

        it("applies chase pitch-quality tuning", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            pitchEnvironmentTarget.pitchEnvironmentTuning!.tuning!.swing!.pitchQualityChaseSwingEffect = 10

            const average = harness.getSwingTakeInput({
                pitchEnvironmentTarget,
                inZone: false,
                pitchQuality: 50
            })

            const highQuality = harness.getSwingTakeInput({
                pitchEnvironmentTarget,
                inZone: false,
                pitchQuality: 100
            })

            assert.ok(highQuality.swing > average.swing)
        })

        it("preserves count-specific chase behavior while applying discipline", () => {
            const hitterChange = harness.createHitterChange({
                plateDisiplineChange: 0.7
            })

            const zeroZero = harness.getSwingTakeInput({
                hitterChange,
                inZone: false,
                pitchCount: harness.createPitchCount(0, 0)
            })

            const zeroTwo = harness.getSwingTakeInput({
                hitterChange,
                inZone: false,
                pitchCount: harness.createPitchCount(0, 2)
            })

            const fullCount = harness.getSwingTakeInput({
                hitterChange,
                inZone: false,
                pitchCount: harness.createPitchCount(3, 2)
            })

            assert.ok(zeroZero.swing > 0)
            assert.ok(zeroZero.swing < zeroTwo.swing)
            assert.ok(zeroTwo.swing < fullCount.swing)
        })

        it("clamps the swing rate and preserves the 1000-entry total", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            pitchEnvironmentTarget.pitchEnvironmentTuning!.tuning!.swing!.pitchQualityChaseSwingEffect = 1000

            const input = harness.getSwingTakeInput({
                pitchEnvironmentTarget,
                inZone: false,
                pitchQuality: 100
            })

            assert.equal(input.swing, 1000)
            assert.equal(input.take, 0)
        })

        it("throws when the environment has no behavior for the count", () => {
            assert.throws(() => {
                harness.getSwingTakeInput({
                    pitchCount: harness.createPitchCount(2, 1)
                })
            }, /Missing swing behavior for count 2-1/)
        })

        it("throws when the selected baseline swing rate is invalid", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            pitchEnvironmentTarget.swing.behaviorByCount[0].zoneSwingPercent = Number.NaN

            assert.throws(() => {
                harness.getSwingTakeInput({
                    pitchEnvironmentTarget,
                    inZone: true
                })
            }, /Invalid swing rate for count 0-0/)
        })

        it("throws when swing tuning is invalid", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()

            pitchEnvironmentTarget.pitchEnvironmentTuning!.tuning!.swing!.disciplineChaseSwingEffect = Number.NaN

            assert.throws(() => {
                harness.getSwingTakeInput({
                    pitchEnvironmentTarget
                })
            }, /Invalid disciplineChaseSwingEffect/)
        })

    })

})

describe("SwingTakeModel Diagnostics", () => {

    const averageVsRight = harness.createHitterChange({
        contactChange: 0.28,
        plateDisiplineChange: 0.29,
        gapPowerChange: 0.10,
        hrPowerChange: 0.62
    })

    const judgeVsRight = harness.createHitterChange({
        contactChange: 0.50,
        plateDisiplineChange: 0.64,
        gapPowerChange: 0.20,
        hrPowerChange: 0.62
    })

    const getSwingTakeRow = (label: string, hitterChange: HitterChange, inZone: boolean, pitchCount: PitchCount, pitchQuality = 50): {
        label: string
        inZone: boolean
        count: string
        pitchQuality: number
        swing: number
        take: number
        swingRate: number
        takeRate: number
    } => {
        const input = harness.getSwingTakeInput({
            hitterChange,
            inZone,
            pitchQuality,
            pitchCount
        })

        return {
            label,
            inZone,
            count: `${pitchCount.balls}-${pitchCount.strikes}`,
            pitchQuality,
            swing: input.swing,
            take: input.take,
            swingRate: input.swing / 1000,
            takeRate: input.take / 1000
        }
    }

    const getRatingRows = (inZone: boolean, pitchCount: PitchCount, pitchQuality = 50): ReturnType<typeof getSwingTakeRow>[] => {
        return [30, 50, 70, 90, 100, 110, 130, 150, 170].map(rating =>
            getSwingTakeRow(
                `Discipline ${rating}`,
                harness.createHitterChange({
                    plateDisiplineChange: (rating / 100) - 1
                }),
                inZone,
                pitchCount,
                pitchQuality
            )
        )
    }

    it("prints discipline elasticity for a 0-0 chase pitch", () => {
        const rows = getRatingRows(false, harness.createPitchCount(0, 0))

        console.log("\n[SWING-TAKE ELASTICITY: 0-0 CHASE]")
        console.table(rows)

        const low = rows.find(row => row.label === "Discipline 30")
        const neutral = rows.find(row => row.label === "Discipline 100")
        const high = rows.find(row => row.label === "Discipline 170")

        assert.ok(low)
        assert.ok(neutral)
        assert.ok(high)

        assert.ok(low.swing > neutral.swing)
        assert.ok(high.swing < neutral.swing)
    })

    it("prints discipline elasticity for a 0-0 strike", () => {
        const rows = getRatingRows(true, harness.createPitchCount(0, 0))

        console.log("\n[SWING-TAKE ELASTICITY: 0-0 IN ZONE]")
        console.table(rows)

        assert.ok(rows.every(row => row.swing >= 0 && row.swing <= 1000))
        assert.ok(rows.every(row => row.swing + row.take === 1000))
    })

    it("prints discipline elasticity with two strikes", () => {
        const pitchCount = harness.createPitchCount(0, 2)

        const rows = [
            ...getRatingRows(true, pitchCount).map(row => ({
                ...row,
                location: "zone"
            })),
            ...getRatingRows(false, pitchCount).map(row => ({
                ...row,
                location: "chase"
            }))
        ]

        console.log("\n[SWING-TAKE ELASTICITY: 0-2]")
        console.table(rows)

        const chaseLow = rows.find(row => row.location === "chase" && row.label === "Discipline 30")
        const chaseNeutral = rows.find(row => row.location === "chase" && row.label === "Discipline 100")
        const chaseHigh = rows.find(row => row.location === "chase" && row.label === "Discipline 170")

        assert.ok(chaseLow)
        assert.ok(chaseNeutral)
        assert.ok(chaseHigh)

        assert.ok(chaseLow.swing > chaseNeutral.swing)
        assert.ok(chaseHigh.swing < chaseNeutral.swing)
    })

    it("prints discipline elasticity at a full count", () => {
        const pitchCount = harness.createPitchCount(3, 2)

        const rows = [
            ...getRatingRows(true, pitchCount).map(row => ({
                ...row,
                location: "zone"
            })),
            ...getRatingRows(false, pitchCount).map(row => ({
                ...row,
                location: "chase"
            }))
        ]

        console.log("\n[SWING-TAKE ELASTICITY: 3-2]")
        console.table(rows)

        const chaseLow = rows.find(row => row.location === "chase" && row.label === "Discipline 30")
        const chaseNeutral = rows.find(row => row.location === "chase" && row.label === "Discipline 100")
        const chaseHigh = rows.find(row => row.location === "chase" && row.label === "Discipline 170")

        assert.ok(chaseLow)
        assert.ok(chaseNeutral)
        assert.ok(chaseHigh)

        assert.ok(chaseLow.swing > chaseNeutral.swing)
        assert.ok(chaseHigh.swing < chaseNeutral.swing)
    })

    it("prints Judge versus comparison hitter swing rates by count and location", () => {
        const scenarios = [
            { label: "0-0 zone", inZone: true, pitchCount: harness.createPitchCount(0, 0) },
            { label: "0-0 chase", inZone: false, pitchCount: harness.createPitchCount(0, 0) },
            { label: "0-2 zone", inZone: true, pitchCount: harness.createPitchCount(0, 2) },
            { label: "0-2 chase", inZone: false, pitchCount: harness.createPitchCount(0, 2) },
            { label: "3-2 zone", inZone: true, pitchCount: harness.createPitchCount(3, 2) },
            { label: "3-2 chase", inZone: false, pitchCount: harness.createPitchCount(3, 2) }
        ]

        const rows = scenarios.map(scenario => {
            const average = getSwingTakeRow(
                "Average hitter vs RHP",
                averageVsRight,
                scenario.inZone,
                scenario.pitchCount
            )

            const judge = getSwingTakeRow(
                "Aaron Judge vs RHP",
                judgeVsRight,
                scenario.inZone,
                scenario.pitchCount
            )

            return {
                scenario: scenario.label,
                averageSwing: average.swing,
                judgeSwing: judge.swing,
                difference: judge.swing - average.swing,
                averageSwingRate: average.swingRate,
                judgeSwingRate: judge.swingRate,
                rateDifference: judge.swingRate - average.swingRate
            }
        })

        console.log("\n[AARON JUDGE SWING-TAKE DIFFERENCE BY SCENARIO]")
        console.table(rows)

        const chaseRows = rows.filter(row => row.scenario.includes("chase"))

        assert.ok(chaseRows.every(row => row.judgeSwing <= row.averageSwing))
    })

    it("prints Judge chase separation across pitch quality", () => {
        const pitchQualities = [20, 35, 50, 65, 80, 100]
        const pitchCount = harness.createPitchCount(0, 0)

        const rows = pitchQualities.map(pitchQuality => {
            const average = getSwingTakeRow(
                "Average hitter vs RHP",
                averageVsRight,
                false,
                pitchCount,
                pitchQuality
            )

            const judge = getSwingTakeRow(
                "Aaron Judge vs RHP",
                judgeVsRight,
                false,
                pitchCount,
                pitchQuality
            )

            return {
                pitchQuality,
                averageSwing: average.swing,
                judgeSwing: judge.swing,
                difference: judge.swing - average.swing,
                averageSwingRate: average.swingRate,
                judgeSwingRate: judge.swingRate
            }
        })

        console.log("\n[AARON JUDGE 0-0 CHASE BY PITCH QUALITY]")
        console.table(rows)

        assert.ok(rows.every(row => row.judgeSwing <= row.averageSwing))
    })

    it("prints the exact Judge 0-0 chase calculation result", () => {
        const pitchCount = harness.createPitchCount(0, 0)

        const average = getSwingTakeRow(
            "Average hitter vs RHP",
            averageVsRight,
            false,
            pitchCount
        )

        const judge = getSwingTakeRow(
            "Aaron Judge vs RHP",
            judgeVsRight,
            false,
            pitchCount
        )

        console.log("\n[AARON JUDGE 0-0 CHASE DETAIL]")
        console.table([
            {
                metric: "Plate discipline change",
                average: averageVsRight.plateDisiplineChange,
                judge: judgeVsRight.plateDisiplineChange,
                difference: judgeVsRight.plateDisiplineChange - averageVsRight.plateDisiplineChange
            },
            {
                metric: "Swing",
                average: average.swing,
                judge: judge.swing,
                difference: judge.swing - average.swing
            },
            {
                metric: "Take",
                average: average.take,
                judge: judge.take,
                difference: judge.take - average.take
            },
            {
                metric: "Swing rate",
                average: average.swingRate,
                judge: judge.swingRate,
                difference: judge.swingRate - average.swingRate
            }
        ])

        assert.ok(judge.swing <= average.swing)
    })

    it("prints every configured count for average, minimum, and maximum discipline", () => {
        const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()
        const rows = pitchEnvironmentTarget.swing.behaviorByCount.flatMap(behavior => {
            const pitchCount = harness.createPitchCount(behavior.balls, behavior.strikes)

            return [
                getSwingTakeRow(
                    `Discipline 30, ${behavior.balls}-${behavior.strikes} chase`,
                    harness.createHitterChange({
                        plateDisiplineChange: -0.70
                    }),
                    false,
                    pitchCount
                ),
                getSwingTakeRow(
                    `Discipline 100, ${behavior.balls}-${behavior.strikes} chase`,
                    harness.createHitterChange(),
                    false,
                    pitchCount
                ),
                getSwingTakeRow(
                    `Discipline 170, ${behavior.balls}-${behavior.strikes} chase`,
                    harness.createHitterChange({
                        plateDisiplineChange: 0.70
                    }),
                    false,
                    pitchCount
                )
            ]
        })

        console.log("\n[SWING-TAKE ALL CONFIGURED CHASE COUNTS]")
        console.table(rows)

        assert.ok(rows.every(row => row.swing + row.take === 1000))
    })

})


describe("ContactMissModel", () => {

    describe("getInput", () => {

        it("returns the zone contact baseline for neutral players and an average pitch", () => {
            assert.deepEqual(harness.getContactMissInput(), {
                contact: 850,
                miss: 150
            })
        })

        it("returns the chase contact baseline for a pitch outside the zone", () => {
            assert.deepEqual(harness.getContactMissInput({ inZone: false }), {
                contact: 650,
                miss: 350
            })
        })

        it("uses the behavior configured for the current count", () => {
            assert.deepEqual(harness.getContactMissInput({
                pitchCount: harness.createPitchCount(0, 2)
            }), {
                contact: 780,
                miss: 220
            })
        })

        it("keeps the distribution normalized to 1000", () => {
            const result = harness.getContactMissInput({
                hitterChange: harness.createHitterChange({
                    contactChange: 0.5
                }),
                pitcherChange: harness.createPitcherChange({
                    powerChange: 0.5
                }),
                pitchQuality: 75,
                pitchCount: harness.createPitchCount(3, 2)
            })

            assert.equal(harness.getContactMissTotal(result), 1000)
            assert.ok(result.contact >= 0)
            assert.ok(result.miss >= 0)
        })

        it("increases contact for positive hitter contact", () => {
            const baseline = harness.getContactMissInput()

            const improved = harness.getContactMissInput({
                hitterChange: harness.createHitterChange({
                    contactChange: 0.5
                })
            })

            assert.ok(improved.contact > baseline.contact)
            assert.ok(improved.miss < baseline.miss)
            assert.equal(harness.getContactMissTotal(improved), 1000)
        })

        it("reduces contact for negative hitter contact", () => {
            const baseline = harness.getContactMissInput()

            const reduced = harness.getContactMissInput({
                hitterChange: harness.createHitterChange({
                    contactChange: -0.5
                })
            })

            assert.ok(reduced.contact < baseline.contact)
            assert.ok(reduced.miss > baseline.miss)
            assert.equal(harness.getContactMissTotal(reduced), 1000)
        })

        it("reduces contact for positive pitcher power", () => {
            const baseline = harness.getContactMissInput()

            const changed = harness.getContactMissInput({
                pitcherChange: harness.createPitcherChange({
                    powerChange: 0.5
                })
            })

            assert.ok(changed.contact < baseline.contact)
            assert.ok(changed.miss > baseline.miss)
        })

        it("increases contact for negative pitcher power", () => {
            const baseline = harness.getContactMissInput()

            const changed = harness.getContactMissInput({
                pitcherChange: harness.createPitcherChange({
                    powerChange: -0.5
                })
            })

            assert.ok(changed.contact > baseline.contact)
            assert.ok(changed.miss < baseline.miss)
        })

        it("reduces contact for higher pitch quality", () => {
            const baseline = harness.getContactMissInput()

            const changed = harness.getContactMissInput({
                pitchQuality: 100
            })

            assert.ok(changed.contact < baseline.contact)
            assert.ok(changed.miss > baseline.miss)
        })

        it("clamps the contact rate and preserves the 1000-entry total", () => {
            const result = harness.getContactMissInput({
                hitterChange: harness.createHitterChange({
                    contactChange: 100
                })
            })

            assert.equal(harness.getContactMissTotal(result), 1000)
            assert.ok(result.contact <= 1000)
            assert.ok(result.miss >= 0)
        })

        it("throws when the environment has no behavior for the count", () => {
            assert.throws(
                () => harness.getContactMissInput({
                    pitchCount: harness.createPitchCount(2, 1)
                }),
                /Missing swing behavior for count 2-1/
            )
        })

        it("throws when the selected contact rate is invalid", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()
            pitchEnvironmentTarget.swing.behaviorByCount[0].zoneContactPercent = Number.NaN

            assert.throws(
                () => harness.getContactMissInput({
                    pitchEnvironmentTarget
                }),
                /Invalid contact rate for count 0-0\./
            )
        })

        it("throws when contact tuning is invalid", () => {
            const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()
            pitchEnvironmentTarget.pitchEnvironmentTuning!.tuning!.contact!.contactSkillEffect = Number.NaN

            assert.throws(
                () => harness.getContactMissInput({
                    pitchEnvironmentTarget
                }),
                /Invalid contactSkillEffect/
            )
        })

    })

})

describe("ContactMissModel Diagnostics", () => {

    const neutralPitcherChange = harness.createPitcherChange()

    const averageVsRight = harness.createHitterChange({
        contactChange: 0.28,
        plateDisiplineChange: 0.29,
        gapPowerChange: 0.10,
        hrPowerChange: 0.62
    })

    const judgeVsRight = harness.createHitterChange({
        contactChange: 0.50,
        plateDisiplineChange: 0.64,
        gapPowerChange: 0.20,
        hrPowerChange: 0.62
    })

    const getContactMissRow = (label: string, hitterChange: HitterChange, inZone: boolean, pitchCount: PitchCount, pitchQuality = 50): {
        label: string
        inZone: boolean
        count: string
        pitchQuality: number
        contact: number
        miss: number
        contactRate: number
        missRate: number
    } => {
        const input = harness.getContactMissInput({
            hitterChange,
            pitcherChange: neutralPitcherChange,
            inZone,
            pitchQuality,
            pitchCount
        })

        return {
            label,
            inZone,
            count: `${pitchCount.balls}-${pitchCount.strikes}`,
            pitchQuality,
            contact: input.contact,
            miss: input.miss,
            contactRate: input.contact / 1000,
            missRate: input.miss / 1000
        }
    }

    const getRatingRows = (inZone: boolean, pitchCount: PitchCount, pitchQuality = 50): any[] => {
        return [
            30,
            50,
            70,
            90,
            100,
            110,
            130,
            150,
            170
        ].map(rating => {
            const contactChange = (rating / 100) - 1

            return getContactMissRow(
                `Contact ${rating}`,
                harness.createHitterChange({
                    contactChange
                }),
                inZone,
                pitchCount,
                pitchQuality
            )
        })
    }

    const getDifferenceRows = (average: ReturnType<typeof getContactMissRow>, judge: ReturnType<typeof getContactMissRow>): any[] => {
        return [
            {
                metric: "Contact",
                average: average.contact,
                judge: judge.contact,
                difference: judge.contact - average.contact
            },
            {
                metric: "Miss",
                average: average.miss,
                judge: judge.miss,
                difference: judge.miss - average.miss
            },
            {
                metric: "Contact rate",
                average: average.contactRate,
                judge: judge.contactRate,
                difference: judge.contactRate - average.contactRate
            },
            {
                metric: "Miss rate",
                average: average.missRate,
                judge: judge.missRate,
                difference: judge.missRate - average.missRate
            }
        ]
    }

    it("prints contact-rating elasticity for a neutral 0-0 strike", () => {
        const rows = getRatingRows(
            true,
            harness.createPitchCount(0, 0)
        )

        console.log("\n[CONTACT-MISS ELASTICITY: 0-0 IN ZONE]")
        console.table(rows)

        const low = rows.find(row => row.label === "Contact 30")
        const neutral = rows.find(row => row.label === "Contact 100")
        const high = rows.find(row => row.label === "Contact 170")

        assert.ok(low)
        assert.ok(neutral)
        assert.ok(high)

        assert.ok(low.contact < neutral.contact)
        assert.ok(high.contact > neutral.contact)
        assert.ok(high.contact > low.contact)
    })

    it("prints contact-rating elasticity for a neutral 0-0 chase pitch", () => {
        const rows = getRatingRows(
            false,
            harness.createPitchCount(0, 0)
        )

        console.log("\n[CONTACT-MISS ELASTICITY: 0-0 CHASE]")
        console.table(rows)

        const low = rows.find(row => row.label === "Contact 30")
        const neutral = rows.find(row => row.label === "Contact 100")
        const high = rows.find(row => row.label === "Contact 170")

        assert.ok(low)
        assert.ok(neutral)
        assert.ok(high)

        assert.ok(low.contact < neutral.contact)
        assert.ok(high.contact > neutral.contact)
        assert.ok(high.contact > low.contact)
    })

    it("prints contact-rating elasticity with two strikes", () => {
        const rows = [
            ...getRatingRows(
                true,
                harness.createPitchCount(0, 2)
            ).map(row => ({
                ...row,
                location: "zone"
            })),
            ...getRatingRows(
                false,
                harness.createPitchCount(0, 2)
            ).map(row => ({
                ...row,
                location: "chase"
            }))
        ]

        console.log("\n[CONTACT-MISS ELASTICITY: 0-2]")
        console.table(rows)

        const zoneLow = rows.find(row =>
            row.location === "zone" &&
            row.label === "Contact 30"
        )

        const zoneHigh = rows.find(row =>
            row.location === "zone" &&
            row.label === "Contact 170"
        )

        const chaseLow = rows.find(row =>
            row.location === "chase" &&
            row.label === "Contact 30"
        )

        const chaseHigh = rows.find(row =>
            row.location === "chase" &&
            row.label === "Contact 170"
        )

        assert.ok(zoneLow)
        assert.ok(zoneHigh)
        assert.ok(chaseLow)
        assert.ok(chaseHigh)

        assert.ok(zoneHigh.contact > zoneLow.contact)
        assert.ok(chaseHigh.contact > chaseLow.contact)
    })

    it("prints contact-rating elasticity at a full count", () => {
        const rows = [
            ...getRatingRows(
                true,
                harness.createPitchCount(3, 2)
            ).map(row => ({
                ...row,
                location: "zone"
            })),
            ...getRatingRows(
                false,
                harness.createPitchCount(3, 2)
            ).map(row => ({
                ...row,
                location: "chase"
            }))
        ]

        console.log("\n[CONTACT-MISS ELASTICITY: 3-2]")
        console.table(rows)

        const zoneLow = rows.find(row =>
            row.location === "zone" &&
            row.label === "Contact 30"
        )

        const zoneHigh = rows.find(row =>
            row.location === "zone" &&
            row.label === "Contact 170"
        )

        const chaseLow = rows.find(row =>
            row.location === "chase" &&
            row.label === "Contact 30"
        )

        const chaseHigh = rows.find(row =>
            row.location === "chase" &&
            row.label === "Contact 170"
        )

        assert.ok(zoneLow)
        assert.ok(zoneHigh)
        assert.ok(chaseLow)
        assert.ok(chaseHigh)

        assert.ok(zoneHigh.contact > zoneLow.contact)
        assert.ok(chaseHigh.contact > chaseLow.contact)
    })

    it("prints Judge versus comparison hitter contact rates by count and location", () => {
        const scenarios = [
            {
                label: "0-0 zone",
                inZone: true,
                pitchCount: harness.createPitchCount(0, 0)
            },
            {
                label: "0-0 chase",
                inZone: false,
                pitchCount: harness.createPitchCount(0, 0)
            },
            {
                label: "0-2 zone",
                inZone: true,
                pitchCount: harness.createPitchCount(0, 2)
            },
            {
                label: "0-2 chase",
                inZone: false,
                pitchCount: harness.createPitchCount(0, 2)
            },
            {
                label: "3-2 zone",
                inZone: true,
                pitchCount: harness.createPitchCount(3, 2)
            },
            {
                label: "3-2 chase",
                inZone: false,
                pitchCount: harness.createPitchCount(3, 2)
            }
        ]

        const rows = scenarios.map(scenario => {
            const average = getContactMissRow(
                "Average hitter vs RHP",
                averageVsRight,
                scenario.inZone,
                scenario.pitchCount
            )

            const judge = getContactMissRow(
                "Aaron Judge vs RHP",
                judgeVsRight,
                scenario.inZone,
                scenario.pitchCount
            )

            return {
                scenario: scenario.label,
                averageContact: average.contact,
                judgeContact: judge.contact,
                difference: judge.contact - average.contact,
                averageContactRate: average.contactRate,
                judgeContactRate: judge.contactRate,
                rateDifference: judge.contactRate - average.contactRate
            }
        })

        console.log("\n[AARON JUDGE CONTACT-MISS DIFFERENCE BY SCENARIO]")
        console.table(rows)

        assert.ok(rows.every(row => row.judgeContact > row.averageContact))
    })

    it("prints Judge contact separation across pitch quality", () => {
        const pitchQualities = [20, 35, 50, 65, 80, 100]

        const rows = pitchQualities.flatMap(pitchQuality => {
            const pitchCount = harness.createPitchCount(0, 0)

            const averageZone = getContactMissRow(
                "Average zone",
                averageVsRight,
                true,
                pitchCount,
                pitchQuality
            )

            const judgeZone = getContactMissRow(
                "Judge zone",
                judgeVsRight,
                true,
                pitchCount,
                pitchQuality
            )

            const averageChase = getContactMissRow(
                "Average chase",
                averageVsRight,
                false,
                pitchCount,
                pitchQuality
            )

            const judgeChase = getContactMissRow(
                "Judge chase",
                judgeVsRight,
                false,
                pitchCount,
                pitchQuality
            )

            return [
                {
                    pitchQuality,
                    location: "zone",
                    averageContact: averageZone.contact,
                    judgeContact: judgeZone.contact,
                    difference: judgeZone.contact - averageZone.contact,
                    averageContactRate: averageZone.contactRate,
                    judgeContactRate: judgeZone.contactRate
                },
                {
                    pitchQuality,
                    location: "chase",
                    averageContact: averageChase.contact,
                    judgeContact: judgeChase.contact,
                    difference: judgeChase.contact - averageChase.contact,
                    averageContactRate: averageChase.contactRate,
                    judgeContactRate: judgeChase.contactRate
                }
            ]
        })

        console.log("\n[AARON JUDGE CONTACT SEPARATION BY PITCH QUALITY]")
        console.table(rows)

        assert.ok(rows.every(row =>
            row.judgeContact >= row.averageContact
        ))
    })

    it("prints Judge's exact 0-0 zone and chase differences", () => {
        const pitchCount = harness.createPitchCount(0, 0)

        const averageZone = getContactMissRow(
            "Average hitter vs RHP",
            averageVsRight,
            true,
            pitchCount
        )

        const judgeZone = getContactMissRow(
            "Aaron Judge vs RHP",
            judgeVsRight,
            true,
            pitchCount
        )

        const averageChase = getContactMissRow(
            "Average hitter vs RHP",
            averageVsRight,
            false,
            pitchCount
        )

        const judgeChase = getContactMissRow(
            "Aaron Judge vs RHP",
            judgeVsRight,
            false,
            pitchCount
        )

        console.log("\n[AARON JUDGE 0-0 ZONE CONTACT DIFFERENCE]")
        console.table(getDifferenceRows(averageZone, judgeZone))

        console.log("\n[AARON JUDGE 0-0 CHASE CONTACT DIFFERENCE]")
        console.table(getDifferenceRows(averageChase, judgeChase))

        assert.ok(judgeZone.contact > averageZone.contact)
        assert.ok(judgeChase.contact > averageChase.contact)
    })

})

describe("FairFoulModel", () => {

    it("returns the baseline fair/foul distribution for neutral changes", () => {
        const input = harness.getFairFoulInput()

        assert.equal(input.fair, 850)
        assert.equal(input.foul, 150)
    })

    it("normalizes the baseline distribution to exactly 1000 entries", () => {
        const input = harness.getFairFoulInput()

        assert.equal(harness.getFairFoulTotal(input), 1000)
    })

    it("adds positive hitter contact by reducing foul balls", () => {
        const baseline = harness.getFairFoulInput()
        const improved = harness.getFairFoulInput({
            hitterChange: harness.createHitterChange({
                contactChange: GENERATED_FULL_CHANGE
            })
        })

        assert.ok(improved.fair > baseline.fair)
        assert.ok(improved.foul < baseline.foul)
    })

    it("adds negative hitter contact by increasing foul balls", () => {
        const baseline = harness.getFairFoulInput()
        const worse = harness.getFairFoulInput({
            hitterChange: harness.createHitterChange({
                contactChange: -GENERATED_FULL_CHANGE
            })
        })

        assert.ok(worse.fair < baseline.fair)
        assert.ok(worse.foul > baseline.foul)
    })

    it("adds positive pitcher power by increasing foul balls", () => {
        const baseline = harness.getFairFoulInput()
        const improved = harness.getFairFoulInput({
            pitcherChange: harness.createPitcherChange({
                powerChange: GENERATED_FULL_CHANGE
            })
        })

        assert.ok(improved.fair < baseline.fair)
        assert.ok(improved.foul > baseline.foul)
    })

    it("adds negative pitcher power by reducing foul balls", () => {
        const baseline = harness.getFairFoulInput()
        const worse = harness.getFairFoulInput({
            pitcherChange: harness.createPitcherChange({
                powerChange: -GENERATED_FULL_CHANGE
            })
        })

        assert.ok(worse.fair > baseline.fair)
        assert.ok(worse.foul < baseline.foul)
    })

    it("reduces fair balls for higher pitch quality", () => {
        const average = harness.getFairFoulInput()
        const better = harness.getFairFoulInput({
            pitchQuality: 70
        })

        assert.ok(better.fair < average.fair)
        assert.ok(better.foul > average.foul)
    })

    it("reduces foul balls when the hitter guesses a good pitch", () => {
        const baseline = harness.getFairFoulInput({
            pitchQuality: 70,
            guessPitch: false
        })

        const guessed = harness.getFairFoulInput({
            pitchQuality: 70,
            guessPitch: true
        })

        assert.ok(guessed.fair > baseline.fair)
        assert.ok(guessed.foul < baseline.foul)
    })

    it("clamps foul rate between zero and one hundred percent", () => {
        const input = harness.getFairFoulInput({
            hitterChange: harness.createHitterChange({
                contactChange: GENERATED_FULL_CHANGE * 10
            })
        })

        assert.ok(input.fair >= 0)
        assert.ok(input.foul >= 0)
        assert.equal(harness.getFairFoulTotal(input), 1000)
    })

    it("throws when the requested count is missing", () => {
        assert.throws(() => {
            harness.getFairFoulInput({
                pitchCount: harness.createPitchCount(2, 3)
            })
        })
    })

    it("throws when the count has an invalid foul contact rate", () => {
        const target = harness.createPitchEnvironmentTarget()

        target.swing.behaviorByCount[0].foulContactPercent = Number.NaN

        assert.throws(() => {
            harness.getFairFoulInput({
                pitchEnvironmentTarget: target
            })
        })
    })



})

describe("DefenseOutModel", () => {

    describe("getInput", () => {

        it("returns the baseline out-single distribution for neutral changes", () => {
            assert.deepEqual(harness.getDefenseOutInput(), {
                out: 1000,
                single: 0
            })
        })

        it("keeps the distribution normalized to 1000", () => {
            const input = harness.getDefenseOutInput({
                hitterChange: harness.createHitterChange({
                    contactChange: 0.4,
                    gapPowerChange: 0.2,
                    hrPowerChange: 0.1
                }),
                defenseChange: -0.4
            })

            assert.equal(harness.getDefenseOutTotal(input), 1000)
            assert.ok(input.out >= 0)
            assert.ok(input.single >= 0)
        })

        it("increases singles for weaker defense", () => {
            const baseline = harness.getDefenseOutInput()
            const weakerDefense = harness.getDefenseOutInput({
                defenseChange: -0.5
            })

            assert.ok(weakerDefense.single > baseline.single)
            assert.ok(weakerDefense.out < baseline.out)
            assert.equal(harness.getDefenseOutTotal(weakerDefense), 1000)
        })

        it("does not convert outs to singles for stronger defense alone", () => {
            const baseline = harness.getDefenseOutInput()
            const strongerDefense = harness.getDefenseOutInput({
                defenseChange: 0.5
            })

            assert.deepEqual(strongerDefense, baseline)
        })

        it("increases singles for better hitter contact", () => {
            const baseline = harness.getDefenseOutInput()
            const improved = harness.getDefenseOutInput({
                hitterChange: harness.createHitterChange({
                    contactChange: GENERATED_FULL_CHANGE
                })
            })

            assert.ok(improved.single > baseline.single)
            assert.ok(improved.out < baseline.out)
            assert.equal(harness.getDefenseOutTotal(improved), 1000)
        })

        it("uses hitter quality of contact when converting outs to singles", () => {
            const baseline = harness.getDefenseOutInput()
            const improved = harness.getDefenseOutInput({
                hitterChange: harness.createHitterChange({
                    gapPowerChange: GENERATED_FULL_CHANGE,
                    hrPowerChange: GENERATED_FULL_CHANGE
                })
            })

            assert.ok(improved.single > baseline.single)
            assert.ok(improved.out < baseline.out)
            assert.equal(harness.getDefenseOutTotal(improved), 1000)
        })

        it("creates more singles from difficult line drives than easy fly balls", () => {
            const hitterChange = harness.createHitterChange({
                contactChange: GENERATED_FULL_CHANGE
            })

            const lineDrive = harness.getDefenseOutInput({
                hitterChange,
                defenseChange: -0.4,
                contact: Contact.LINE_DRIVE,
                hitQuality: harness.createContactQuality({
                    exitVelocity: 105,
                    launchAngle: 10,
                    distance: 280
                })
            })

            const flyBall = harness.getDefenseOutInput({
                hitterChange,
                defenseChange: -0.4,
                contact: Contact.FLY_BALL,
                hitQuality: harness.createContactQuality({
                    exitVelocity: 75,
                    launchAngle: 55,
                    distance: 150
                })
            })

            assert.ok(lineDrive.single > flyBall.single)
        })

        it("never creates more singles than the available missed catches", () => {
            const input = harness.getDefenseOutInput({
                hitterChange: harness.createHitterChange({
                    contactChange: 100,
                    gapPowerChange: 100,
                    hrPowerChange: 100
                }),
                defenseChange: -100
            })

            assert.ok(input.single >= 0)
            assert.ok(input.single <= 1000)
            assert.ok(input.out >= 0)
            assert.equal(harness.getDefenseOutTotal(input), 1000)
        })

        it("throws when exit velocity is invalid", () => {
            assert.throws(
                () => harness.getDefenseOutInput({
                    hitQuality: harness.createContactQuality({
                        exitVelocity: Number.NaN
                    })
                }),
                /Invalid contact exit velocity NaN\./
            )
        })

        it("throws when launch angle is invalid", () => {
            assert.throws(
                () => harness.getDefenseOutInput({
                    hitQuality: harness.createContactQuality({
                        launchAngle: Number.POSITIVE_INFINITY
                    })
                }),
                /Invalid contact launch angle Infinity\./
            )
        })

        it("throws when distance is invalid", () => {
            assert.throws(
                () => harness.getDefenseOutInput({
                    hitQuality: harness.createContactQuality({
                        distance: Number.NEGATIVE_INFINITY
                    })
                }),
                /Invalid contact distance -Infinity\./
            )
        })

    })

})

describe("DefenseHitModel", () => {

    describe("getInput", () => {

        it("returns the baseline hit-out distribution for neutral defense", () => {
            assert.deepEqual(harness.getDefenseHitInput(), {
                hit: 1000,
                out: 0
            })
        })

        it("keeps the distribution normalized to 1000", () => {
            const input = harness.getDefenseHitInput({
                defenseChange: 0.5
            })

            assert.equal(harness.getDefenseHitTotal(input), 1000)
            assert.ok(input.hit >= 0)
            assert.ok(input.out >= 0)
        })

        it("converts more hits into outs for stronger defense", () => {
            const baseline = harness.getDefenseHitInput()
            const strongerDefense = harness.getDefenseHitInput({
                defenseChange: 0.5
            })

            assert.ok(strongerDefense.out > baseline.out)
            assert.ok(strongerDefense.hit < baseline.hit)
            assert.equal(harness.getDefenseHitTotal(strongerDefense), 1000)
        })

        it("does not convert hits into outs for weaker defense", () => {
            const baseline = harness.getDefenseHitInput()
            const weakerDefense = harness.getDefenseHitInput({
                defenseChange: -0.5
            })

            assert.deepEqual(weakerDefense, baseline)
        })

        it("converts more difficult line-drive hits than easy fly-ball hits", () => {
            const lineDrive = harness.getDefenseHitInput({
                defenseChange: 0.5,
                contact: Contact.LINE_DRIVE,
                hitQuality: harness.createContactQuality({
                    exitVelocity: 105,
                    launchAngle: 10,
                    distance: 280
                })
            })

            const flyBall = harness.getDefenseHitInput({
                defenseChange: 0.5,
                contact: Contact.FLY_BALL,
                hitQuality: harness.createContactQuality({
                    exitVelocity: 75,
                    launchAngle: 55,
                    distance: 150
                })
            })

            assert.ok(lineDrive.out > flyBall.out)
        })

        it("caps the defensive change at the available preventable hit pressure", () => {
            const fullDefense = harness.getDefenseHitInput({
                defenseChange: 1
            })

            const extremeDefense = harness.getDefenseHitInput({
                defenseChange: 100
            })

            assert.deepEqual(extremeDefense, fullDefense)
            assert.equal(harness.getDefenseHitTotal(extremeDefense), 1000)
        })

        it("never creates more outs than the available preventable hits", () => {
            const input = harness.getDefenseHitInput({
                defenseChange: 100,
                contact: Contact.FLY_BALL,
                hitQuality: harness.createContactQuality({
                    exitVelocity: 70,
                    launchAngle: 60,
                    distance: 100
                })
            })

            assert.ok(input.out >= 0)
            assert.ok(input.out <= 1000)
            assert.ok(input.hit >= 0)
            assert.equal(harness.getDefenseHitTotal(input), 1000)
        })

        it("throws when exit velocity is invalid", () => {
            assert.throws(
                () => harness.getDefenseHitInput({
                    hitQuality: harness.createContactQuality({
                        exitVelocity: Number.NaN
                    })
                }),
                /Invalid contact exit velocity NaN\./
            )
        })

        it("throws when launch angle is invalid", () => {
            assert.throws(
                () => harness.getDefenseHitInput({
                    hitQuality: harness.createContactQuality({
                        launchAngle: Number.POSITIVE_INFINITY
                    })
                }),
                /Invalid contact launch angle Infinity\./
            )
        })

        it("throws when distance is invalid", () => {
            assert.throws(
                () => harness.getDefenseHitInput({
                    hitQuality: harness.createContactQuality({
                        distance: Number.NEGATIVE_INFINITY
                    })
                }),
                /Invalid contact distance -Infinity\./
            )
        })

    })

})

describe("Aaron Judge Roll Chart Breakdown", () => {

    const neutralPitcherChange = harness.createPitcherChange()
    const averageHitter = harness.createHitterChange()

    const judgeVsRight = harness.createHitterChange({
        contactChange: 0.50,
        plateDisiplineChange: 0.64,
        gapPowerChange: 0.20,
        hrPowerChange: 0.62
    })

    const judgeVsLeft = harness.createHitterChange({
        contactChange: 0.50,
        plateDisiplineChange: 0.70,
        gapPowerChange: 0.16,
        hrPowerChange: 0.70
    })

    const getCount = (chart: RollChart, result: string): number => {
        return harness.getCounts(chart).get(result) ?? 0
    }

    const getDecisionBreakdown = (hitterChange: HitterChange, inZone: boolean, pitchCount: PitchCount, pitchQuality = 50): {
        swing: number
        take: number
        contact: number
        miss: number
        fair: number
        foul: number
    } => {
        const swingTake = harness.getSwingTakeChart({
            hitterChange,
            inZone,
            pitchQuality,
            pitchCount
        })

        const contactMiss = harness.getContactMissChart({
            hitterChange,
            pitcherChange: neutralPitcherChange,
            inZone,
            pitchQuality,
            pitchCount
        })

        const fairFoul = harness.getFairFoulChart({
            hitterChange,
            pitcherChange: neutralPitcherChange,
            pitchQuality,
            guessPitch: false,
            pitchCount
        })

        return {
            swing: getCount(swingTake, SwingTake.SWING),
            take: getCount(swingTake, SwingTake.TAKE),
            contact: getCount(contactMiss, "CONTACT"),
            miss: getCount(contactMiss, "MISS"),
            fair: getCount(fairFoul, "FAIR"),
            foul: getCount(fairFoul, "FOUL")
        }
    }

    const getScenarioBreakdown = (label: string, hitterChange: HitterChange, inZone: boolean, pitchCount: PitchCount, pitchQuality = 50): {
        label: string
        inZone: boolean
        count: string
        pitchQuality: number
        swingRate: number
        contactPerSwing: number
        fairPerContact: number
        fairBallPerPitch: number
        outPerPitch: number
        singlePerPitch: number
        doublePerPitch: number
        triplePerPitch: number
        hrPerPitch: number
    } => {
        const decisions = getDecisionBreakdown(hitterChange, inZone, pitchCount, pitchQuality)
        const power = harness.getPowerChartBreakdown(hitterChange, neutralPitcherChange)
        const swingRate = decisions.swing / 1000
        const contactPerSwing = decisions.contact / 1000
        const fairPerContact = decisions.fair / 1000
        const fairBallPerPitch = swingRate * contactPerSwing * fairPerContact

        return {
            label,
            inZone,
            count: `${pitchCount.balls}-${pitchCount.strikes}`,
            pitchQuality,
            swingRate,
            contactPerSwing,
            fairPerContact,
            fairBallPerPitch,
            outPerPitch: fairBallPerPitch * (power.out / 1000),
            singlePerPitch: fairBallPerPitch * (power.singles / 1000),
            doublePerPitch: fairBallPerPitch * (power.doubles / 1000),
            triplePerPitch: fairBallPerPitch * (power.triples / 1000),
            hrPerPitch: fairBallPerPitch * (power.hr / 1000)
        }
    }

    const getDifferenceRows = (average: ReturnType<typeof getScenarioBreakdown>, judge: ReturnType<typeof getScenarioBreakdown>): any[] => {
        return [
            { metric: "Swing rate", average: average.swingRate, judge: judge.swingRate, difference: judge.swingRate - average.swingRate },
            { metric: "Contact per swing", average: average.contactPerSwing, judge: judge.contactPerSwing, difference: judge.contactPerSwing - average.contactPerSwing },
            { metric: "Fair per contact", average: average.fairPerContact, judge: judge.fairPerContact, difference: judge.fairPerContact - average.fairPerContact },
            { metric: "Fair ball per pitch", average: average.fairBallPerPitch, judge: judge.fairBallPerPitch, difference: judge.fairBallPerPitch - average.fairBallPerPitch },
            { metric: "Out per pitch", average: average.outPerPitch, judge: judge.outPerPitch, difference: judge.outPerPitch - average.outPerPitch },
            { metric: "Single per pitch", average: average.singlePerPitch, judge: judge.singlePerPitch, difference: judge.singlePerPitch - average.singlePerPitch },
            { metric: "Double per pitch", average: average.doublePerPitch, judge: judge.doublePerPitch, difference: judge.doublePerPitch - average.doublePerPitch },
            { metric: "Triple per pitch", average: average.triplePerPitch, judge: judge.triplePerPitch, difference: judge.triplePerPitch - average.triplePerPitch },
            { metric: "HR per pitch", average: average.hrPerPitch, judge: judge.hrPerPitch, difference: judge.hrPerPitch - average.hrPerPitch }
        ]
    }

    it("prints Judge and rating-100 hitter fair-contact power charts", () => {
        const rows = [
            {
                player: "Rating-100 hitter",
                ...harness.getPowerChartBreakdown(averageHitter, neutralPitcherChange)
            },
            {
                player: "Aaron Judge vs RHP",
                ...harness.getPowerChartBreakdown(judgeVsRight, neutralPitcherChange)
            },
            {
                player: "Aaron Judge vs LHP",
                ...harness.getPowerChartBreakdown(judgeVsLeft, neutralPitcherChange)
            }
        ]

        console.log("\n[AARON JUDGE CONDITIONAL FAIR-CONTACT POWER CHART]")
        console.table(rows)

        assert.deepEqual(
            harness.getPowerChartBreakdown(averageHitter, neutralPitcherChange),
            {
                out: 700,
                singles: 200,
                doubles: 60,
                triples: 10,
                hr: 30,
                hit: 300,
                xbh: 100,
                totalBases: 470,
                chartBabip: 270 / 970
            }
        )

        assert.ok(rows.every(row =>
            row.out +
            row.singles +
            row.doubles +
            row.triples +
            row.hr === 1000
        ))
    })

    it("prints each isolated Judge power-rating contribution", () => {
        const rows = [
            {
                stage: "Rating-100 hitter",
                ...harness.getPowerChartBreakdown(
                    averageHitter,
                    neutralPitcherChange
                )
            },
            {
                stage: "Judge contact only",
                ...harness.getPowerChartBreakdown(
                    harness.createHitterChange({
                        contactChange: judgeVsRight.contactChange
                    }),
                    neutralPitcherChange
                )
            },
            {
                stage: "Judge gap only",
                ...harness.getPowerChartBreakdown(
                    harness.createHitterChange({
                        gapPowerChange: judgeVsRight.gapPowerChange
                    }),
                    neutralPitcherChange
                )
            },
            {
                stage: "Judge HR only",
                ...harness.getPowerChartBreakdown(
                    harness.createHitterChange({
                        hrPowerChange: judgeVsRight.hrPowerChange
                    }),
                    neutralPitcherChange
                )
            },
            {
                stage: "Judge contact + gap",
                ...harness.getPowerChartBreakdown(
                    harness.createHitterChange({
                        contactChange: judgeVsRight.contactChange,
                        gapPowerChange: judgeVsRight.gapPowerChange
                    }),
                    neutralPitcherChange
                )
            },
            {
                stage: "Judge contact + HR",
                ...harness.getPowerChartBreakdown(
                    harness.createHitterChange({
                        contactChange: judgeVsRight.contactChange,
                        hrPowerChange: judgeVsRight.hrPowerChange
                    }),
                    neutralPitcherChange
                )
            },
            {
                stage: "Judge full vs RHP",
                ...harness.getPowerChartBreakdown(
                    judgeVsRight,
                    neutralPitcherChange
                )
            },
            {
                stage: "Judge full vs LHP",
                ...harness.getPowerChartBreakdown(
                    judgeVsLeft,
                    neutralPitcherChange
                )
            }
        ]

        console.log("\n[AARON JUDGE ISOLATED POWER CONTRIBUTIONS]")
        console.table(rows)

        const neutral = rows[0]
        const contactOnly = rows[1]
        const gapOnly = rows[2]
        const hrOnly = rows[3]
        const right = rows[6]
        const left = rows[7]

        assert.ok(contactOnly.hit > neutral.hit)
        assert.ok(contactOnly.out < neutral.out)
        assert.ok(gapOnly.doubles > neutral.doubles)
        assert.ok(hrOnly.hr > neutral.hr)
        assert.ok(right.hr > neutral.hr)
        assert.ok(left.hr > neutral.hr)
        assert.ok(right.totalBases > neutral.totalBases)
        assert.ok(left.totalBases > neutral.totalBases)
    })

    it("prints the swing-contact-fair-power chain on a first-pitch strike", () => {
        const pitchCount = harness.createPitchCount(0, 0)
        const average = getScenarioBreakdown("Rating-100 hitter", averageHitter, true, pitchCount)
        const judge = getScenarioBreakdown("Aaron Judge vs RHP", judgeVsRight, true, pitchCount)

        console.log("\n[AARON JUDGE 0-0 IN-ZONE DECISION CHAIN]")
        console.table([average, judge])

        console.log("\n[AARON JUDGE 0-0 IN-ZONE DIFFERENCE]")
        console.table(getDifferenceRows(average, judge))

        assert.equal(average.swingRate, 0.65)
        assert.equal(average.contactPerSwing, 0.85)
        assert.equal(average.fairPerContact, 0.85)

        assert.equal(judge.swingRate, average.swingRate)
        assert.ok(judge.contactPerSwing > average.contactPerSwing)
        assert.ok(judge.fairPerContact > average.fairPerContact)
        assert.ok(judge.fairBallPerPitch > average.fairBallPerPitch)
        assert.ok(judge.hrPerPitch > average.hrPerPitch)
    })

    it("prints the swing-contact-fair-power chain on a first-pitch chase pitch", () => {
        const pitchCount = harness.createPitchCount(0, 0)
        const average = getScenarioBreakdown("Rating-100 hitter", averageHitter, false, pitchCount)
        const judge = getScenarioBreakdown("Aaron Judge vs RHP", judgeVsRight, false, pitchCount)

        console.log("\n[AARON JUDGE 0-0 CHASE DECISION CHAIN]")
        console.table([average, judge])

        console.log("\n[AARON JUDGE 0-0 CHASE DIFFERENCE]")
        console.table(getDifferenceRows(average, judge))

        assert.equal(average.swingRate, 0.25)
        assert.equal(average.contactPerSwing, 0.65)

        assert.ok(judge.swingRate < average.swingRate)
        assert.ok(judge.swingRate > 0)
        assert.ok(judge.contactPerSwing > average.contactPerSwing)
    })

    it("prints the swing-contact-fair-power chain with two strikes", () => {
        const pitchCount = harness.createPitchCount(0, 2)

        const rows = [
            getScenarioBreakdown("Rating-100 hitter, zone", averageHitter, true, pitchCount),
            getScenarioBreakdown("Judge RHP matchup, zone", judgeVsRight, true, pitchCount),
            getScenarioBreakdown("Rating-100 hitter, chase", averageHitter, false, pitchCount),
            getScenarioBreakdown("Judge RHP matchup, chase", judgeVsRight, false, pitchCount)
        ]

        console.log("\n[AARON JUDGE 0-2 DECISION CHAIN]")
        console.table(rows)

        assert.equal(rows[0].swingRate, 0.78)
        assert.equal(rows[2].swingRate, 0.40)

        assert.equal(rows[1].swingRate, rows[0].swingRate)
        assert.ok(rows[1].contactPerSwing > rows[0].contactPerSwing)
        assert.ok(rows[3].swingRate < rows[2].swingRate)
        assert.ok(rows[3].contactPerSwing > rows[2].contactPerSwing)
    })

    it("prints the swing-contact-fair-power chain at a full count", () => {
        const pitchCount = harness.createPitchCount(3, 2)

        const rows = [
            getScenarioBreakdown("Rating-100 hitter, zone", averageHitter, true, pitchCount),
            getScenarioBreakdown("Judge RHP matchup, zone", judgeVsRight, true, pitchCount),
            getScenarioBreakdown("Rating-100 hitter, chase", averageHitter, false, pitchCount),
            getScenarioBreakdown("Judge RHP matchup, chase", judgeVsRight, false, pitchCount)
        ]

        console.log("\n[AARON JUDGE 3-2 DECISION CHAIN]")
        console.table(rows)

        assert.equal(rows[0].swingRate, 0.88)
        assert.equal(rows[2].swingRate, 0.70)

        assert.equal(rows[1].swingRate, rows[0].swingRate)
        assert.ok(rows[1].contactPerSwing > rows[0].contactPerSwing)
        assert.ok(rows[3].swingRate < rows[2].swingRate)
        assert.ok(rows[3].contactPerSwing > rows[2].contactPerSwing)
    })

    it("prints Judge's right-left fair-contact differences", () => {
        const average = harness.getPowerChartBreakdown(
            averageHitter,
            neutralPitcherChange
        )

        const right = harness.getPowerChartBreakdown(
            judgeVsRight,
            neutralPitcherChange
        )

        const left = harness.getPowerChartBreakdown(
            judgeVsLeft,
            neutralPitcherChange
        )

        console.log("\n[AARON JUDGE RIGHT-LEFT FAIR-CONTACT DIFFERENCE]")
        console.table([
            {
                metric: "Out",
                average: average.out,
                vsR: right.out,
                vsL: left.out,
                vsRDifference: right.out - average.out,
                vsLDifference: left.out - average.out
            },
            {
                metric: "Single",
                average: average.singles,
                vsR: right.singles,
                vsL: left.singles,
                vsRDifference: right.singles - average.singles,
                vsLDifference: left.singles - average.singles
            },
            {
                metric: "Double",
                average: average.doubles,
                vsR: right.doubles,
                vsL: left.doubles,
                vsRDifference: right.doubles - average.doubles,
                vsLDifference: left.doubles - average.doubles
            },
            {
                metric: "Triple",
                average: average.triples,
                vsR: right.triples,
                vsL: left.triples,
                vsRDifference: right.triples - average.triples,
                vsLDifference: left.triples - average.triples
            },
            {
                metric: "Home run",
                average: average.hr,
                vsR: right.hr,
                vsL: left.hr,
                vsRDifference: right.hr - average.hr,
                vsLDifference: left.hr - average.hr
            },
            {
                metric: "Total hits",
                average: average.hit,
                vsR: right.hit,
                vsL: left.hit,
                vsRDifference: right.hit - average.hit,
                vsLDifference: left.hit - average.hit
            },
            {
                metric: "Total bases",
                average: average.totalBases,
                vsR: right.totalBases,
                vsL: left.totalBases,
                vsRDifference: right.totalBases - average.totalBases,
                vsLDifference: left.totalBases - average.totalBases
            },
            {
                metric: "Chart BABIP",
                average: average.chartBabip,
                vsR: right.chartBabip,
                vsL: left.chartBabip,
                vsRDifference: right.chartBabip - average.chartBabip,
                vsLDifference: left.chartBabip - average.chartBabip
            }
        ])

        assert.ok(right.hr > average.hr)
        assert.ok(left.hr > average.hr)
        assert.ok(right.totalBases > average.totalBases)
        assert.ok(left.totalBases > average.totalBases)
        assert.ok(left.hr > right.hr)
        assert.ok(left.totalBases > right.totalBases)
    })

    it("prints the complete Judge roll-chart pipeline against a rating-100 hitter", () => {
        const pitchEnvironmentTarget = harness.createPitchEnvironmentTarget()
        const pitchCount = harness.createPitchCount(0, 0)

        const averageZoneSwing = harness.getSwingTakeInput({
            pitchEnvironmentTarget,
            hitterChange: averageHitter,
            inZone: true,
            pitchCount
        })

        const judgeRightZoneSwing = harness.getSwingTakeInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsRight,
            inZone: true,
            pitchCount
        })

        const judgeLeftZoneSwing = harness.getSwingTakeInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsLeft,
            inZone: true,
            pitchCount
        })

        const averageChaseSwing = harness.getSwingTakeInput({
            pitchEnvironmentTarget,
            hitterChange: averageHitter,
            inZone: false,
            pitchCount
        })

        const judgeRightChaseSwing = harness.getSwingTakeInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsRight,
            inZone: false,
            pitchCount
        })

        const judgeLeftChaseSwing = harness.getSwingTakeInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsLeft,
            inZone: false,
            pitchCount
        })

        const averageZoneContact = harness.getContactMissInput({
            pitchEnvironmentTarget,
            hitterChange: averageHitter,
            pitcherChange: neutralPitcherChange,
            inZone: true,
            pitchCount
        })

        const judgeRightZoneContact = harness.getContactMissInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsRight,
            pitcherChange: neutralPitcherChange,
            inZone: true,
            pitchCount
        })

        const judgeLeftZoneContact = harness.getContactMissInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsLeft,
            pitcherChange: neutralPitcherChange,
            inZone: true,
            pitchCount
        })

        const averageChaseContact = harness.getContactMissInput({
            pitchEnvironmentTarget,
            hitterChange: averageHitter,
            pitcherChange: neutralPitcherChange,
            inZone: false,
            pitchCount
        })

        const judgeRightChaseContact = harness.getContactMissInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsRight,
            pitcherChange: neutralPitcherChange,
            inZone: false,
            pitchCount
        })

        const judgeLeftChaseContact = harness.getContactMissInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsLeft,
            pitcherChange: neutralPitcherChange,
            inZone: false,
            pitchCount
        })

        const averageFairFoul = harness.getFairFoulInput({
            pitchEnvironmentTarget,
            hitterChange: averageHitter,
            pitcherChange: neutralPitcherChange,
            pitchCount
        })

        const judgeRightFairFoul = harness.getFairFoulInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsRight,
            pitcherChange: neutralPitcherChange,
            pitchCount
        })

        const judgeLeftFairFoul = harness.getFairFoulInput({
            pitchEnvironmentTarget,
            hitterChange: judgeVsLeft,
            pitcherChange: neutralPitcherChange,
            pitchCount
        })

        const averagePower = harness.getPowerChartBreakdown(
            averageHitter,
            neutralPitcherChange
        )

        const judgeRightPower = harness.getPowerChartBreakdown(
            judgeVsRight,
            neutralPitcherChange
        )

        const judgeLeftPower = harness.getPowerChartBreakdown(
            judgeVsLeft,
            neutralPitcherChange
        )

        console.log("\n[AARON JUDGE COMPLETE ROLL-CHART PIPELINE]")
        console.table([
            {
                stage: "0-0 zone swing",
                average: averageZoneSwing.swing,
                judgeVsR: judgeRightZoneSwing.swing,
                judgeVsL: judgeLeftZoneSwing.swing,
                vsRDifference: judgeRightZoneSwing.swing - averageZoneSwing.swing,
                vsLDifference: judgeLeftZoneSwing.swing - averageZoneSwing.swing
            },
            {
                stage: "0-0 chase swing",
                average: averageChaseSwing.swing,
                judgeVsR: judgeRightChaseSwing.swing,
                judgeVsL: judgeLeftChaseSwing.swing,
                vsRDifference: judgeRightChaseSwing.swing - averageChaseSwing.swing,
                vsLDifference: judgeLeftChaseSwing.swing - averageChaseSwing.swing
            },
            {
                stage: "0-0 zone contact",
                average: averageZoneContact.contact,
                judgeVsR: judgeRightZoneContact.contact,
                judgeVsL: judgeLeftZoneContact.contact,
                vsRDifference: judgeRightZoneContact.contact - averageZoneContact.contact,
                vsLDifference: judgeLeftZoneContact.contact - averageZoneContact.contact
            },
            {
                stage: "0-0 chase contact",
                average: averageChaseContact.contact,
                judgeVsR: judgeRightChaseContact.contact,
                judgeVsL: judgeLeftChaseContact.contact,
                vsRDifference: judgeRightChaseContact.contact - averageChaseContact.contact,
                vsLDifference: judgeLeftChaseContact.contact - averageChaseContact.contact
            },
            {
                stage: "0-0 fair contact",
                average: averageFairFoul.fair,
                judgeVsR: judgeRightFairFoul.fair,
                judgeVsL: judgeLeftFairFoul.fair,
                vsRDifference: judgeRightFairFoul.fair - averageFairFoul.fair,
                vsLDifference: judgeLeftFairFoul.fair - averageFairFoul.fair
            },
            {
                stage: "Power out",
                average: averagePower.out,
                judgeVsR: judgeRightPower.out,
                judgeVsL: judgeLeftPower.out,
                vsRDifference: judgeRightPower.out - averagePower.out,
                vsLDifference: judgeLeftPower.out - averagePower.out
            },
            {
                stage: "Power single",
                average: averagePower.singles,
                judgeVsR: judgeRightPower.singles,
                judgeVsL: judgeLeftPower.singles,
                vsRDifference: judgeRightPower.singles - averagePower.singles,
                vsLDifference: judgeLeftPower.singles - averagePower.singles
            },
            {
                stage: "Power double",
                average: averagePower.doubles,
                judgeVsR: judgeRightPower.doubles,
                judgeVsL: judgeLeftPower.doubles,
                vsRDifference: judgeRightPower.doubles - averagePower.doubles,
                vsLDifference: judgeLeftPower.doubles - averagePower.doubles
            },
            {
                stage: "Power triple",
                average: averagePower.triples,
                judgeVsR: judgeRightPower.triples,
                judgeVsL: judgeLeftPower.triples,
                vsRDifference: judgeRightPower.triples - averagePower.triples,
                vsLDifference: judgeLeftPower.triples - averagePower.triples
            },
            {
                stage: "Power home run",
                average: averagePower.hr,
                judgeVsR: judgeRightPower.hr,
                judgeVsL: judgeLeftPower.hr,
                vsRDifference: judgeRightPower.hr - averagePower.hr,
                vsLDifference: judgeLeftPower.hr - averagePower.hr
            },
            {
                stage: "Power hits",
                average: averagePower.hit,
                judgeVsR: judgeRightPower.hit,
                judgeVsL: judgeLeftPower.hit,
                vsRDifference: judgeRightPower.hit - averagePower.hit,
                vsLDifference: judgeLeftPower.hit - averagePower.hit
            },
            {
                stage: "Power extra-base hits",
                average: averagePower.xbh,
                judgeVsR: judgeRightPower.xbh,
                judgeVsL: judgeLeftPower.xbh,
                vsRDifference: judgeRightPower.xbh - averagePower.xbh,
                vsLDifference: judgeLeftPower.xbh - averagePower.xbh
            },
            {
                stage: "Power total bases",
                average: averagePower.totalBases,
                judgeVsR: judgeRightPower.totalBases,
                judgeVsL: judgeLeftPower.totalBases,
                vsRDifference: judgeRightPower.totalBases - averagePower.totalBases,
                vsLDifference: judgeLeftPower.totalBases - averagePower.totalBases
            }
        ])

        assert.equal(averageZoneSwing.swing, 650)
        assert.equal(averageChaseSwing.swing, 250)
        assert.equal(averageZoneContact.contact, 850)
        assert.equal(averageChaseContact.contact, 650)
        assert.equal(averageFairFoul.fair, 850)

        assert.equal(judgeRightZoneSwing.swing, averageZoneSwing.swing)
        assert.ok(judgeRightChaseSwing.swing < averageChaseSwing.swing)
        assert.ok(judgeRightZoneContact.contact > averageZoneContact.contact)
        assert.ok(judgeRightChaseContact.contact > averageChaseContact.contact)
        assert.ok(judgeRightFairFoul.fair > averageFairFoul.fair)

        assert.equal(judgeLeftZoneSwing.swing, averageZoneSwing.swing)
        assert.ok(judgeLeftChaseSwing.swing < averageChaseSwing.swing)
        assert.ok(judgeLeftZoneContact.contact > averageZoneContact.contact)
        assert.ok(judgeLeftChaseContact.contact > averageChaseContact.contact)
        assert.ok(judgeLeftFairFoul.fair > averageFairFoul.fair)

        assert.ok(judgeRightPower.out < averagePower.out)
        assert.ok(judgeRightPower.hit > averagePower.hit)
        assert.ok(judgeRightPower.hr > averagePower.hr)
        assert.ok(judgeRightPower.totalBases > averagePower.totalBases)

        assert.ok(judgeLeftPower.out < averagePower.out)
        assert.ok(judgeLeftPower.hit > averagePower.hit)
        assert.ok(judgeLeftPower.hr > averagePower.hr)
        assert.ok(judgeLeftPower.totalBases > averagePower.totalBases)
    })

})


