import { strict as assert } from "assert"

import { describe, it } from "mocha"

import { Contact, PlayResult, Position, ShallowDeep } from "../src/sim/service/enums.js"
import {
    ContactTypeModel,
    PowerModel,
    RollChartService
} from "../src/sim/service/roll-chart-service.js"

import type {
    ContactProfile,
    FielderChanceRollInput,
    HitterChange,
    PitchEnvironmentTarget,
    PitcherChange,
    PowerRollInput,
    RollChart,
    ShallowDeepRollInput
} from "../src/sim/service/interfaces.js"

const createPitchEnvironmentTarget = (powerRollInput: PowerRollInput = {
    out: 700,
    singles: 200,
    doubles: 60,
    triples: 10,
    hr: 30
}, contactRollInput: ContactProfile = {
    groundball: 450,
    flyBall: 350,
    lineDrive: 200
}): PitchEnvironmentTarget => ({
    avgRating: 100,
    battedBall: {
        powerRollInput,
        contactRollInput
    }
} as PitchEnvironmentTarget)

const createHitterChange = (overrides: Partial<HitterChange> = {}): HitterChange => ({
    plateDisiplineChange: 0,
    contactChange: 0,
    gapPowerChange: 0,
    hrPowerChange: 0,
    speedChange: 0,
    stealsChange: 0,
    defenseChange: 0,
    armChange: 0,
    ...overrides
})

const createPitcherChange = (overrides: Partial<PitcherChange> = {}): PitcherChange => ({
    powerChange: 0,
    controlChange: 0,
    movementChange: 0,
    ...overrides
})

const getEntries = (chart: RollChart): string[] => {
    assert.ok(chart.entries)
    return Array.from(chart.entries.values())
}

const getCounts = (chart: RollChart): Map<string, number> => {
    const counts = new Map<string, number>()

    for (const value of getEntries(chart)) {
        counts.set(value, (counts.get(value) ?? 0) + 1)
    }

    return counts
}

const assertSequentialIndexes = (chart: RollChart): void => {
    assert.ok(chart.entries)
    assert.deepEqual(
        Array.from(chart.entries.keys()),
        Array.from({ length: chart.entries.size }, (_, index) => index)
    )
}

const getPowerTotal = (input: PowerRollInput): number => {
    return input.out + input.singles + input.doubles + input.triples + input.hr
}

const getContactTotal = (input: ContactProfile): number => {
    return input.groundball + input.flyBall + input.lineDrive
}

describe("RollChartService", () => {

    describe("getMatchupPowerRollChart", () => {

        it("creates the baseline power roll chart for neutral player changes", () => {
            const service = new RollChartService()
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const chart = service.getMatchupPowerRollChart(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const entries = getEntries(chart)
            const counts = getCounts(chart)

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

            assertSequentialIndexes(chart)
        })

        it("uses the normalized PowerModel result when creating the chart", () => {
            const service = new RollChartService()
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()
            const hitterChange = createHitterChange({
                contactChange: 0.35,
                gapPowerChange: 0.4,
                hrPowerChange: 0.5
            })
            const pitcherChange = createPitcherChange({
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

            const counts = getCounts(chart)

            assert.equal(chart.entries?.size, 1000)
            assert.equal(counts.get(PlayResult.OUT) ?? 0, expected.out)
            assert.equal(counts.get(PlayResult.SINGLE) ?? 0, expected.singles)
            assert.equal(counts.get(PlayResult.DOUBLE) ?? 0, expected.doubles)
            assert.equal(counts.get(PlayResult.TRIPLE) ?? 0, expected.triples)
            assert.equal(counts.get(PlayResult.HR) ?? 0, expected.hr)

            assertSequentialIndexes(chart)
        })

    })

    describe("getMatchupContactRollChart", () => {

        it("creates the baseline contact roll chart for neutral profiles", () => {
            const service = new RollChartService()
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()
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

            const entries = getEntries(chart)
            const counts = getCounts(chart)

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

            assertSequentialIndexes(chart)
        })

        it("uses the normalized ContactTypeModel result when creating the chart", () => {
            const service = new RollChartService()
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

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

            const counts = getCounts(chart)

            assert.equal(chart.entries?.size, 1000)
            assert.equal(counts.get(Contact.GROUNDBALL) ?? 0, expected.groundball)
            assert.equal(counts.get(Contact.FLY_BALL) ?? 0, expected.flyBall)
            assert.equal(counts.get(Contact.LINE_DRIVE) ?? 0, expected.lineDrive)

            assertSequentialIndexes(chart)
        })

    })

    describe("getFielderChanceRollChart", () => {

        it("creates a fielder chart in the declared position order", () => {
            const service = new RollChartService()

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
            const entries = getEntries(chart)

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

            assertSequentialIndexes(chart)
        })

        it("omits positions with zero or negative counts", () => {
            const service = new RollChartService()

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

            assert.deepEqual(getEntries(chart), [
                Position.FIRST_BASE,
                Position.FIRST_BASE,
                Position.CATCHER,
                Position.CENTER_FIELD,
                Position.PITCHER,
                Position.PITCHER
            ])

            assertSequentialIndexes(chart)
        })

        it("uses loop semantics for fractional counts", () => {
            const service = new RollChartService()

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

            assert.deepEqual(getEntries(chart), [
                Position.FIRST_BASE,
                Position.FIRST_BASE,
                Position.SECOND_BASE
            ])
        })

        it("returns an empty chart when every position count is non-positive", () => {
            const service = new RollChartService()

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
            assert.deepEqual(getEntries(chart), [])
        })

    })

    describe("getShallowDeepRollChart", () => {

        it("creates a shallow-normal-deep chart in order", () => {
            const service = new RollChartService()

            const input: ShallowDeepRollInput = {
                shallow: 2,
                normal: 3,
                deep: 1
            }

            const chart = service.getShallowDeepRollChart(input)

            assert.deepEqual(getEntries(chart), [
                ShallowDeep.SHALLOW,
                ShallowDeep.SHALLOW,
                ShallowDeep.NORMAL,
                ShallowDeep.NORMAL,
                ShallowDeep.NORMAL,
                ShallowDeep.DEEP
            ])

            assertSequentialIndexes(chart)
        })

        it("omits zero and negative depth counts", () => {
            const service = new RollChartService()

            const input: ShallowDeepRollInput = {
                shallow: -1,
                normal: 2,
                deep: 0
            }

            const chart = service.getShallowDeepRollChart(input)

            assert.deepEqual(getEntries(chart), [
                ShallowDeep.NORMAL,
                ShallowDeep.NORMAL
            ])
        })

        it("returns an empty chart when every depth count is non-positive", () => {
            const service = new RollChartService()

            const input: ShallowDeepRollInput = {
                shallow: 0,
                normal: 0,
                deep: 0
            }

            const chart = service.getShallowDeepRollChart(input)

            assert.equal(chart.entries?.size, 0)
            assert.deepEqual(getEntries(chart), [])
        })

    })

})

describe("PowerModel", () => {

    describe("getInput", () => {

        it("returns the baseline power distribution for neutral changes", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
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
            const pitchEnvironmentTarget = createPitchEnvironmentTarget({
                out: 70,
                singles: 20,
                doubles: 6,
                triples: 1,
                hr: 3
            })

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            assert.deepEqual(result, {
                out: 700,
                singles: 200,
                doubles: 60,
                triples: 10,
                hr: 30
            })

            assert.equal(getPowerTotal(result), 1000)
        })

        it("adds positive hitter contact by moving probability from outs to singles", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({ contactChange: 0.5 }),
                createPitcherChange()
            )

            assert.ok(improved.out < baseline.out)
            assert.ok(improved.singles > baseline.singles)
            assert.equal(improved.doubles, baseline.doubles)
            assert.equal(improved.triples, baseline.triples)
            assert.equal(improved.hr, baseline.hr)
            assert.equal(getPowerTotal(improved), 1000)
        })

        it("adds negative hitter contact by moving probability from singles to outs", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({ contactChange: -0.5 }),
                createPitcherChange()
            )

            assert.ok(reduced.out > baseline.out)
            assert.ok(reduced.singles < baseline.singles)
            assert.equal(reduced.doubles, baseline.doubles)
            assert.equal(reduced.triples, baseline.triples)
            assert.equal(reduced.hr, baseline.hr)
            assert.equal(getPowerTotal(reduced), 1000)
        })

        it("moves positive hitter gap power from singles toward doubles and triples", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({ gapPowerChange: 0.5 }),
                createPitcherChange()
            )

            assert.ok(improved.singles < baseline.singles)
            assert.ok(improved.doubles > baseline.doubles)
            assert.ok(improved.triples > baseline.triples)
            assert.equal(improved.hr, baseline.hr)
            assert.equal(getPowerTotal(improved), 1000)
        })

        it("moves negative hitter gap power from triples and doubles toward singles", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({ gapPowerChange: -0.5 }),
                createPitcherChange()
            )

            assert.ok(reduced.singles > baseline.singles)
            assert.ok(reduced.doubles < baseline.doubles)
            assert.ok(reduced.triples < baseline.triples)
            assert.equal(reduced.hr, baseline.hr)
            assert.equal(getPowerTotal(reduced), 1000)
        })

        it("moves positive hitter home run power from singles to home runs", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({ hrPowerChange: 0.25 }),
                createPitcherChange()
            )

            assert.ok(improved.singles < baseline.singles)
            assert.ok(improved.hr > baseline.hr)
            assert.equal(getPowerTotal(improved), 1000)
        })

        it("moves negative hitter home run power from home runs to singles", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({ hrPowerChange: -0.25 }),
                createPitcherChange()
            )

            assert.ok(reduced.singles > baseline.singles)
            assert.ok(reduced.hr < baseline.hr)
            assert.equal(getPowerTotal(reduced), 1000)
        })

        it("caps hitter outcome transfers at the available source count", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({
                    gapPowerChange: 100,
                    hrPowerChange: 100
                }),
                createPitcherChange()
            )

            assert.ok(result.out >= 0)
            assert.ok(result.singles >= 0)
            assert.ok(result.doubles >= 0)
            assert.ok(result.triples >= 0)
            assert.ok(result.hr >= 0)
            assert.equal(getPowerTotal(result), 1000)
        })

        it("uses pitcher power and control to increase outs and reduce singles", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange({
                    powerChange: 0.3,
                    controlChange: 0.3
                })
            )

            assert.ok(improved.out > baseline.out)
            assert.ok(improved.singles < baseline.singles)
            assert.equal(getPowerTotal(improved), 1000)
        })

        it("uses negative pitcher power and control to reduce outs and increase singles", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange({
                    powerChange: -0.3,
                    controlChange: -0.3
                })
            )

            assert.ok(reduced.out < baseline.out)
            assert.ok(reduced.singles > baseline.singles)
            assert.equal(getPowerTotal(reduced), 1000)
        })

        it("uses positive pitcher movement to convert extra-base hits into singles", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const improved = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange({ movementChange: 0.5 })
            )

            assert.ok(improved.singles > baseline.singles)
            assert.ok(improved.doubles < baseline.doubles)
            assert.ok(improved.hr < baseline.hr)
            assert.ok(improved.triples <= baseline.triples)
            assert.equal(getPowerTotal(improved), 1000)
        })

        it("does not allow negative pitcher power to increase the positive movement reduction of triples", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const negativePower = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange({
                    powerChange: -0.5,
                    movementChange: 0.5
                })
            )

            const neutralPower = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange({
                    powerChange: 0,
                    movementChange: 0.5
                })
            )

            const positivePower = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange({
                    powerChange: 0.5,
                    movementChange: 0.5
                })
            )

            assert.equal(negativePower.triples, neutralPower.triples)
            assert.ok(negativePower.triples < 10)
            assert.ok(positivePower.triples < negativePower.triples)

            assert.equal(getPowerTotal(negativePower), 1000)
            assert.equal(getPowerTotal(neutralPower), 1000)
            assert.equal(getPowerTotal(positivePower), 1000)
        })

        it("uses negative pitcher movement to convert singles into extra-base hits", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const baseline = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
            )

            const reduced = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange({ movementChange: -0.5 })
            )

            assert.ok(reduced.singles < baseline.singles)
            assert.ok(reduced.doubles > baseline.doubles)
            assert.ok(reduced.triples > baseline.triples)
            assert.ok(reduced.hr > baseline.hr)
            assert.equal(getPowerTotal(reduced), 1000)
        })

        it("combines hitter and pitcher deviations from the same baseline", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const hitterOnly = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({
                    contactChange: 0.4,
                    gapPowerChange: 0.3,
                    hrPowerChange: 0.3
                }),
                createPitcherChange()
            )

            const pitcherOnly = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange({
                    powerChange: 0.2,
                    controlChange: 0.2,
                    movementChange: 0.2
                })
            )

            const combined = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({
                    contactChange: 0.4,
                    gapPowerChange: 0.3,
                    hrPowerChange: 0.3
                }),
                createPitcherChange({
                    powerChange: 0.2,
                    controlChange: 0.2,
                    movementChange: 0.2
                })
            )

            assert.notDeepEqual(combined, hitterOnly)
            assert.notDeepEqual(combined, pitcherOnly)
            assert.equal(getPowerTotal(combined), 1000)
        })

        it("never returns negative outcome counts after combining extreme changes", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange({
                    contactChange: -100,
                    gapPowerChange: 100,
                    hrPowerChange: 100
                }),
                createPitcherChange({
                    powerChange: 100,
                    controlChange: 100,
                    movementChange: -100
                })
            )

            assert.ok(Object.values(result).every(value => value >= 0))
            assert.equal(getPowerTotal(result), 1000)
        })

        it("corrects normalization rounding by adding missing entries to outs", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget({
                out: 1,
                singles: 1,
                doubles: 1,
                triples: 0,
                hr: 0
            })

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
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
            const pitchEnvironmentTarget = createPitchEnvironmentTarget({
                out: 1,
                singles: 1,
                doubles: 1,
                triples: 1,
                hr: 1
            })

            const result = PowerModel.getInput(
                pitchEnvironmentTarget,
                createHitterChange(),
                createPitcherChange()
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
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange({ gapPowerChange: Number.NaN }),
                    createPitcherChange()
                ),
                /Invalid hitter gap power change NaN\./
            )
        })

        it("throws when hitter gap power change is infinite", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange({ gapPowerChange: Number.POSITIVE_INFINITY }),
                    createPitcherChange()
                ),
                /Invalid hitter gap power change Infinity\./
            )
        })

        it("throws when hitter home run power change is NaN", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange({ hrPowerChange: Number.NaN }),
                    createPitcherChange()
                ),
                /Invalid hitter home run power change NaN\./
            )
        })

        it("throws when hitter home run power change is infinite", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange({ hrPowerChange: Number.NEGATIVE_INFINITY }),
                    createPitcherChange()
                ),
                /Invalid hitter home run power change -Infinity\./
            )
        })

        it("throws when pitcher power change is NaN", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange(),
                    createPitcherChange({ powerChange: Number.NaN })
                ),
                /Invalid pitcher power change NaN\./
            )
        })

        it("throws when pitcher power change is infinite", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange(),
                    createPitcherChange({ powerChange: Number.POSITIVE_INFINITY })
                ),
                /Invalid pitcher power change Infinity\./
            )
        })

        it("throws when pitcher control change is NaN", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange(),
                    createPitcherChange({ controlChange: Number.NaN })
                ),
                /Invalid pitcher control change NaN\./
            )
        })

        it("throws when pitcher control change is infinite", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange(),
                    createPitcherChange({ controlChange: Number.NEGATIVE_INFINITY })
                ),
                /Invalid pitcher control change -Infinity\./
            )
        })

        it("throws when pitcher movement change is NaN", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange(),
                    createPitcherChange({ movementChange: Number.NaN })
                ),
                /Invalid pitcher movement change NaN\./
            )
        })

        it("throws when pitcher movement change is infinite", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange(),
                    createPitcherChange({ movementChange: Number.POSITIVE_INFINITY })
                ),
                /Invalid pitcher movement change Infinity\./
            )
        })

        it("throws when the baseline power total is zero", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget({
                out: 0,
                singles: 0,
                doubles: 0,
                triples: 0,
                hr: 0
            })

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange(),
                    createPitcherChange()
                ),
                /Power roll input total must be greater than zero\./
            )
        })

        it("throws when all combined power outcomes are reduced to zero", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget({
                out: 0,
                singles: 1,
                doubles: 0,
                triples: 0,
                hr: 0
            })

            assert.throws(
                () => PowerModel.getInput(
                    pitchEnvironmentTarget,
                    createHitterChange({ contactChange: -100 }),
                    createPitcherChange({ movementChange: -100 })
                ),
                /Power roll input total must be greater than zero\./
            )
        })

    })

})

describe("ContactTypeModel", () => {

    describe("getInput", () => {

        it("returns the baseline contact distribution for neutral profiles", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

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
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

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

            assert.equal(getContactTotal(result), 1000)
        })

        it("clamps negative combined contact values to zero", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

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
            assert.equal(getContactTotal(result), 1000)
        })

        it("normalizes arbitrary contact totals to exactly 1000", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget(
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

            assert.equal(getContactTotal(result), 1000)
        })

        it("adds normalization rounding differences to groundballs", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget(
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
            const pitchEnvironmentTarget = createPitchEnvironmentTarget(
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

            assert.equal(getContactTotal(result), 1000)
        })

        it("returns non-negative values after extreme profile differences", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

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
            assert.equal(getContactTotal(result), 1000)
        })

        it("throws when the combined contact total is zero", () => {
            const pitchEnvironmentTarget = createPitchEnvironmentTarget()

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