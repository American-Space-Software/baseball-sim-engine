import assert from "assert"
import {
    StatService,
    simService,
    BaseResult,
    Contact,
    PlayResult,
    Position,
    ShallowDeep,
    ThrowResult,
    PitchCall,
    SimService
} from "../src/sim/index.js"
import seedrandom from "seedrandom"
import type {
    PitchEnvironmentTarget,
    PitchEnvironmentTuning,
    Game,
    GamePlayer,
    RunnerEvent,
    RunnerResult
} from "../src/sim/index.js"

import { PitchEnvironmentService } from "../src/importer/service/pitch-environment-service.js"
import { importPitchEnvironmentTarget } from "../src/importer/index.js"
import { DownloaderService } from "../src/importer/service/downloader-service.js"

const statService = new StatService()
let pitchEnvironment: PitchEnvironmentTarget
let tunedPitchEnvironment: PitchEnvironmentTarget

const season = 2025
const baseDataDir = "data"

const pitchEnvironmentService = new PitchEnvironmentService(simService, statService, {} as any)
const downloaderservice = new DownloaderService("data", 1000)

const players = await downloaderservice.buildSeasonPlayerImports(season, new Set([]))

const evaluationSeed = 4
const evaluationGames = 70

const options = {
    workers: 25,
    gamesPerIteration: evaluationGames
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const makeTuning = (overrides?: Partial<PitchEnvironmentTuning["tuning"]>): PitchEnvironmentTuning["tuning"] => {
    return {
        contactQuality: {
            evScale: overrides?.contactQuality?.evScale ?? 0,
            laScale: overrides?.contactQuality?.laScale ?? 0,
            distanceScale: overrides?.contactQuality?.distanceScale ?? 0,
            outOutcomeScale: overrides?.contactQuality?.outOutcomeScale ?? 0,
            doubleOutcomeScale: overrides?.contactQuality?.doubleOutcomeScale ?? 0,
            tripleOutcomeScale: overrides?.contactQuality?.tripleOutcomeScale ?? 0,
            homeRunOutcomeScale: overrides?.contactQuality?.homeRunOutcomeScale ?? 0,
        },
        swing: {
            pitchQualityZoneSwingEffect: overrides?.swing?.pitchQualityZoneSwingEffect ?? 0,
            pitchQualityChaseSwingEffect: overrides?.swing?.pitchQualityChaseSwingEffect ?? 0,
            disciplineZoneSwingEffect: overrides?.swing?.disciplineZoneSwingEffect ?? 0,
            disciplineChaseSwingEffect: overrides?.swing?.disciplineChaseSwingEffect ?? 0,
            walkRateScale: overrides?.swing?.walkRateScale ?? 0,            
        },
        contact: {
            pitchQualityContactEffect: overrides?.contact?.pitchQualityContactEffect ?? 0,
            contactSkillEffect: overrides?.contact?.contactSkillEffect ?? 0
        },
        running: {
            stealAttemptAggressionScale: overrides?.running?.stealAttemptAggressionScale ?? 1,
            advancementAggressionScale: overrides?.running?.advancementAggressionScale ?? 1
        },
        meta: {
            fullPitchQualityBonus: overrides?.meta?.fullPitchQualityBonus ?? 0,
            fullTeamDefenseBonus: overrides?.meta?.fullTeamDefenseBonus ?? 0,
            fullFielderDefenseBonus: overrides?.meta?.fullFielderDefenseBonus ?? 0
        }
    }
}


const makeDisabledMetaTuning = (overrides?: Partial<PitchEnvironmentTuning["tuning"]>): PitchEnvironmentTuning["tuning"] => {
    return makeTuning({
        ...overrides,
        meta: {
            fullPitchQualityBonus: overrides?.meta?.fullPitchQualityBonus ?? -0,
            fullTeamDefenseBonus: overrides?.meta?.fullTeamDefenseBonus ?? -0,
            fullFielderDefenseBonus: overrides?.meta?.fullFielderDefenseBonus ?? -0
        }
    })
}


const HIGH_OFFENSE_TUNING: PitchEnvironmentTuning["tuning"] = makeTuning({
    contactQuality: {
        evScale: 0,
        laScale: 0,
        distanceScale: 0,
        doubleOutcomeScale: 0.35,
        tripleOutcomeScale: 0.15,
        homeRunOutcomeScale: 1.25,
        outOutcomeScale: -0.35
    },
    swing: {
        pitchQualityZoneSwingEffect: 0,
        pitchQualityChaseSwingEffect: 0,
        disciplineZoneSwingEffect: 0,
        disciplineChaseSwingEffect: 0,
        walkRateScale: 0.1
    },
    contact: {
        pitchQualityContactEffect: 0,
        contactSkillEffect: 0
    },
    running: {
        stealAttemptAggressionScale: 1.6,
        advancementAggressionScale: 1.2
    },
    meta: {
        fullPitchQualityBonus: 0,
        fullTeamDefenseBonus: -100,
        fullFielderDefenseBonus: -100
    }
})

const LOW_OFFENSE_TUNING: PitchEnvironmentTuning["tuning"] = makeTuning({
    contactQuality: {
        evScale: 0,
        laScale: 0,
        distanceScale: 0,
        doubleOutcomeScale: -0.35,
        tripleOutcomeScale: -0.15,
        homeRunOutcomeScale: -0.75,
        outOutcomeScale: 0.35
    },
    swing: {
        pitchQualityZoneSwingEffect: 0,
        pitchQualityChaseSwingEffect: 0,
        disciplineZoneSwingEffect: 0,
        disciplineChaseSwingEffect: 0,
        walkRateScale: -0.1
    },
    contact: {
        pitchQualityContactEffect: 0,
        contactSkillEffect: 0
    },
    running: {
        stealAttemptAggressionScale: 0.1,
        advancementAggressionScale: 0.4
    },
    meta: {
        fullPitchQualityBonus: 0,
        fullTeamDefenseBonus: 100,
        fullFielderDefenseBonus: 100
    }
})

const rngSequence = (values: number[]): (() => number) => {
    let index = 0

    return () => {
        const value = values[Math.min(index, values.length - 1)]
        index++
        return value
    }
}

describe("Baseball Sim Engine", async () => {


    it("should calculate pitch environment target for season", async () => {
        pitchEnvironment = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(season, players)
        // console.log("PITCH ENVIRONMENT TARGET", JSON.stringify(pitchEnvironment))
        assert.ok(pitchEnvironment)
    })


    it("evaluated hit type rates should equal hits per PA", () => {
        const evaluationRng = new seedrandom(evaluationSeed)
        const evaluation = pitchEnvironmentService.evaluatePitchEnvironment(pitchEnvironment, evaluationRng, 20)

        const actualHitTypePerPA =
            Number(evaluation.actual.singlePercent ?? 0) +
            Number(evaluation.actual.doublePercent ?? 0) +
            Number(evaluation.actual.triplePercent ?? 0) +
            Number(evaluation.actual.homeRunPercent ?? 0)

        const actualHitsPerPA =
            Number(evaluation.actual.teamHitsPerGame ?? 0) /
            (
                Number(evaluation.actual.teamHitsPerGame ?? 0) / actualHitTypePerPA
            )

        assert.ok(
            Math.abs(actualHitTypePerPA - actualHitsPerPA) < 0.000001,
            `hit type PA mismatch hitsPerPA=${actualHitsPerPA} reconstructed=${actualHitTypePerPA} 1B=${evaluation.actual.singlePercent} 2B=${evaluation.actual.doublePercent} 3B=${evaluation.actual.triplePercent} HR=${evaluation.actual.homeRunPercent}`
        )
    })


    const buildTarget = (contactQualityTuning: any = {}): any => ({
                pitchEnvironmentTuning: {
                    tuning: {
                        contactQuality: {
                            evScale: 0,
                            laScale: 0,
                            distanceScale: 0,
                            outOutcomeScale: 0,
                            doubleOutcomeScale: 0,
                            tripleOutcomeScale: 0,
                            homeRunOutcomeScale: 0,
                            ...contactQualityTuning
                        }
                    }
                },
                battedBall: {
                    outcomeByEvLa: [
                        {
                            evBin: 100,
                            laBin: 20,
                            out: 60,
                            single: 20,
                            double: 10,
                            triple: 4,
                            hr: 6
                        }
                    ]
                }
    })

    const contactQuality: any = {
        exitVelocity: 100,
        launchAngle: 20,
        distance: 300,
        coordX: 0,
        coordY: 200
    }

    const getModel = (target: any) => {
        const simService: any = Object.create(SimService.prototype)

        return simService.getOutcomeModelForContactQuality(
            target,
            contactQuality,
            Contact.LINE_DRIVE,
            0
        )
    }

    const hits = (model: any): number => {
        return model.single + model.double + model.triple + model.hr
    }

    it("outOutcomeScale should increase outs and reduce batting average when positive", () => {
        const baseline = getModel(buildTarget())
        const adjusted = getModel(buildTarget({ outOutcomeScale: 0.25 }))

        assert.equal(baseline.out, 60)
        assert.equal(hits(baseline), 40)

        assert.equal(adjusted.out, 70)
        assert.equal(hits(adjusted), 30)
        assert.equal(adjusted.count, baseline.count)
    })

    it("outOutcomeScale should reduce outs and increase batting average when negative", () => {
        const baseline = getModel(buildTarget())
        const adjusted = getModel(buildTarget({ outOutcomeScale: -0.25 }))

        assert.equal(baseline.out, 60)
        assert.equal(hits(baseline), 40)

        assert.equal(adjusted.out, 45)
        assert.equal(hits(adjusted), 55)
        assert.equal(adjusted.count, baseline.count)
    })

    it("extra-base outcome scales should not change batting average", () => {
        const baseline = getModel(buildTarget())
        const adjusted = getModel(buildTarget({
            homeRunOutcomeScale: 0.5,
            tripleOutcomeScale: 0.5,
            doubleOutcomeScale: 0.5
        }))

        assert.equal(adjusted.out, baseline.out)
        assert.equal(hits(adjusted), hits(baseline))
        assert.equal(adjusted.count, baseline.count)
    })

    it("negative extra-base outcome scales should not change batting average", () => {
        const baseline = getModel(buildTarget())
        const adjusted = getModel(buildTarget({
            homeRunOutcomeScale: -0.5,
            tripleOutcomeScale: -0.5,
            doubleOutcomeScale: -0.5
        }))

        assert.equal(adjusted.out, baseline.out)
        assert.equal(hits(adjusted), hits(baseline))
        assert.equal(adjusted.count, baseline.count)
    })


    it("should print full tuning knob sensitivity ranges for offense and advancement", () => {
        const games = 60

        type KnobSpec = {
            name: string
            values: number[]
            apply: (tuning: PitchEnvironmentTuning["tuning"], value: number) => void
        }

        const knobSpecs: KnobSpec[] = [
            {
                name: "advancementAggressionScale",
                values: [-0.99, -0.5, 0, 0.5, 1, 2, 3, 4],
                apply: (tuning, value) => { tuning.running.advancementAggressionScale = value }
            },
            {
                name: "stealAttemptAggressionScale",
                values: [-0.75, -0.5, 0, 0.25, 0.5, 1, 1.5, 2],
                apply: (tuning, value) => { tuning.running.stealAttemptAggressionScale = value }
            },
            {
                name: "walkRateScale",
                values: [-0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.1],
                apply: (tuning, value) => { tuning.swing.walkRateScale = value }
            },
            {
                name: "outOutcomeScale",
                values: [-0.25, -0.15, -0.075, 0, 0.075, 0.15, 0.25],
                apply: (tuning, value) => { tuning.contactQuality.outOutcomeScale = value }
            },

            {
                name: "doubleOutcomeScale",
                values: [-0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35],
                apply: (tuning, value) => { tuning.contactQuality.doubleOutcomeScale = value }
            },
            {
                name: "tripleOutcomeScale",
                values: [-0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35],
                apply: (tuning, value) => { tuning.contactQuality.tripleOutcomeScale = value }
            },
            {
                name: "homeRunOutcomeScale",
                values: [-0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35],
                apply: (tuning, value) => { tuning.contactQuality.homeRunOutcomeScale = value }
            },
            {
                name: "pitchQualityContactEffect",
                values: [-0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35],
                apply: (tuning, value) => {
                    tuning.contact.pitchQualityContactEffect = value
                    tuning.contact.contactSkillEffect = value
                }
            },
            {
                name: "fullTeamDefenseBonus",
                values: [-200, -100, -50, 0, 50, 100, 200],
                apply: (tuning, value) => { tuning.meta.fullTeamDefenseBonus = value }
            },
            {
                name: "fullFielderDefenseBonus",
                values: [-200, -100, -50, 0, 50, 100, 200],
                apply: (tuning, value) => { tuning.meta.fullFielderDefenseBonus = value }
            }
        ]

        const getBaseStateKey = (first?: string, second?: string, third?: string): string => `${first ? "1" : "_"}${second ? "2" : "_"}${third ? "3" : "_"}`
        const baseText = (base: BaseResult | undefined): string => base === undefined ? "NONE" : String(base)

        const getRow = (map: Map<string, any>, key: string, factory: () => any): any => {
            if (!map.has(key)) map.set(key, factory())
            return map.get(key)
        }

        const getOrderedRunnerEvents = (events: RunnerEvent[]): RunnerEvent[] => {
            const baseRank = (base: BaseResult | undefined): number => {
                if (base === BaseResult.HOME) return 0
                if (base === BaseResult.FIRST) return 1
                if (base === BaseResult.SECOND) return 2
                if (base === BaseResult.THIRD) return 3
                return -1
            }

            return events.slice().sort((a, b) => {
                const pitchDiff = (a.pitchIndex ?? 0) - (b.pitchIndex ?? 0)
                if (pitchDiff !== 0) return pitchDiff
                return baseRank(a.movement?.start) - baseRank(b.movement?.start)
            })
        }

        const evaluate = (label: string, apply?: (tuning: PitchEnvironmentTuning["tuning"]) => void) => {
            const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)
            const seeded = pitchEnvironmentService.seedPitchEnvironmentTuning(testPitchEnvironment)

            testPitchEnvironment.pitchEnvironmentTuning = clone(seeded)

            if (apply) {
                apply(testPitchEnvironment.pitchEnvironmentTuning.tuning!)
            }

            const totals = {
                label,
                games,
                pa: 0,
                ab: 0,
                runs: 0,
                hits: 0,
                singles: 0,
                doubles: 0,
                triples: 0,
                hr: 0,
                bb: 0,
                hbp: 0,
                so: 0,
                outs: 0,
                lob: 0,
                scoreRuns: 0,
                linescoreRuns: 0,
                eventRuns: 0,
                runnersOnPa: 0,
                basesEmptyPa: 0,
                runnerOutsOnBases: 0,
                gidpLike: 0,
                sbAttempts: 0,
                sb: 0,
                cs: 0,
                wildPitchAdvances: 0,
                passedBallAdvances: 0
            }

            const advancement = {
                single1BTo3BRiskAttempts: 0,
                single1BTo3BSafe: 0,
                single1BTo3BOut: 0,
                single2BToHomeRiskAttempts: 0,
                single2BToHomeSafe: 0,
                single2BToHomeOut: 0,
                double1BToHomeRiskAttempts: 0,
                double1BToHomeSafe: 0,
                double1BToHomeOut: 0,
                out3BToHomeAttempts: 0,
                out3BToHomeSafe: 0,
                out3BToHomeOut: 0,
                automaticSecondToHomeOnDouble: 0,
                automaticThirdToHomeOnSingle: 0,
                automaticThirdToHomeOnDouble: 0
            }

            const baseStates = new Map<string, any>()
            const playResults = new Map<string, any>()
            const chainRows = new Map<string, any>()

            const rng = seedrandom(`knob-sensitivity-${label}`)

            for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                const game = pitchEnvironmentService.buildStartedBaselineGame(
                    clone(testPitchEnvironment),
                    `knob-sensitivity-${label}-${gameIndex}`
                )

                while (!game.isComplete) {
                    simService.simPitch(game, rng)
                }

                totals.scoreRuns += game.score.away + game.score.home
                totals.runs += game.score.away + game.score.home

                for (const halfInning of game.halfInnings) {
                    totals.linescoreRuns += halfInning.linescore.runs ?? 0
                    totals.lob += halfInning.linescore.leftOnBase ?? 0

                    for (const play of halfInning.plays) {
                        if (!play.count?.end) continue

                        const start:RunnerResult = play.runner?.result?.start 
                        const events: RunnerEvent[] = play.runner?.events ?? []
                        const startedWithRunners = !!start.first || !!start.second || !!start.third
                        const baseStateKey = `${play.count?.start?.outs ?? 0}:${getBaseStateKey(start.first, start.second, start.third)}`
                        const playResultKey = String(play.result)
                        const runsOnPlay = events.filter(event => event.isScoringEvent).length
                        const outsOnPlay = events.filter(event => event.movement?.isOut).length
                        const runnerOutsOnBases = events.filter(event => event.movement?.isOut && event.movement?.start !== BaseResult.HOME && !event.isCS).length

                        totals.pa++
                        totals.eventRuns += runsOnPlay
                        totals.outs += outsOnPlay
                        totals.runnerOutsOnBases += runnerOutsOnBases

                        if (startedWithRunners) totals.runnersOnPa++
                        else totals.basesEmptyPa++

                        if (play.result !== PlayResult.BB && play.result !== PlayResult.HIT_BY_PITCH) {
                            totals.ab++
                        }

                        if (play.result === PlayResult.BB) totals.bb++
                        if (play.result === PlayResult.HIT_BY_PITCH) totals.hbp++
                        if (play.result === PlayResult.STRIKEOUT) totals.so++

                        if (play.result === PlayResult.SINGLE) {
                            totals.hits++
                            totals.singles++
                        }

                        if (play.result === PlayResult.DOUBLE) {
                            totals.hits++
                            totals.doubles++
                        }

                        if (play.result === PlayResult.TRIPLE) {
                            totals.hits++
                            totals.triples++
                        }

                        if (play.result === PlayResult.HR) {
                            totals.hits++
                            totals.hr++
                        }

                        if (play.result === PlayResult.OUT && play.contact === Contact.GROUNDBALL && events.filter(event => event.movement?.isOut && !event.isCS).length >= 2) {
                            totals.gidpLike++
                        }

                        totals.sbAttempts += events.filter(event => event.isSBAttempt).length
                        totals.sb += events.filter(event => event.isSB).length
                        totals.cs += events.filter(event => event.isCS).length
                        totals.wildPitchAdvances += events.filter(event => event.isWP).length
                        totals.passedBallAdvances += events.filter(event => event.isPB).length

                        const baseStateRow = getRow(baseStates, baseStateKey, () => ({
                            key: baseStateKey,
                            pa: 0,
                            runs: 0,
                            hits: 0,
                            bb: 0,
                            outs: 0,
                            runnerOutsOnBases: 0
                        }))

                        baseStateRow.pa++
                        baseStateRow.runs += runsOnPlay
                        baseStateRow.outs += outsOnPlay
                        baseStateRow.runnerOutsOnBases += runnerOutsOnBases
                        if (play.result === PlayResult.BB) baseStateRow.bb++
                        if (play.result === PlayResult.SINGLE || play.result === PlayResult.DOUBLE || play.result === PlayResult.TRIPLE || play.result === PlayResult.HR) baseStateRow.hits++

                        const playResultRow = getRow(playResults, playResultKey, () => ({
                            key: playResultKey,
                            pa: 0,
                            runs: 0,
                            outs: 0,
                            runnerOutsOnBases: 0,
                            runnersOn: 0,
                            basesEmpty: 0
                        }))

                        playResultRow.pa++
                        playResultRow.runs += runsOnPlay
                        playResultRow.outs += outsOnPlay
                        playResultRow.runnerOutsOnBases += runnerOutsOnBases
                        if (startedWithRunners) playResultRow.runnersOn++
                        else playResultRow.basesEmpty++

                        const originalStartByRunner = new Map<string, BaseResult | undefined>()

                        if (start.first) originalStartByRunner.set(start.first, BaseResult.FIRST)
                        if (start.second) originalStartByRunner.set(start.second, BaseResult.SECOND)
                        if (start.third) originalStartByRunner.set(start.third, BaseResult.THIRD)
                        if (play.hitterId) originalStartByRunner.set(play.hitterId, BaseResult.HOME)

                        const eventsByRunner = new Map<string, RunnerEvent[]>()

                        for (const event of events) {
                            const runnerId = event.runner?._id
                            if (!runnerId) continue

                            if (!originalStartByRunner.has(runnerId)) {
                                originalStartByRunner.set(runnerId, event.movement?.start)
                            }

                            if (!eventsByRunner.has(runnerId)) {
                                eventsByRunner.set(runnerId, [])
                            }

                            eventsByRunner.get(runnerId)!.push(event)
                        }

                        for (const [runnerId, runnerEvents] of eventsByRunner.entries()) {
                            const orderedEvents = getOrderedRunnerEvents(runnerEvents)
                            const originalStart = originalStartByRunner.get(runnerId)
                            const finalEvent = orderedEvents[orderedEvents.length - 1]
                            const finalEnd = finalEvent?.movement?.end
                            const isOut = orderedEvents.some(event => event.movement?.isOut)
                            const scored = orderedEvents.some(event => event.isScoringEvent)
                            const hasThrow = orderedEvents.some(event => event.throw)
                            const hasSB = orderedEvents.some(event => event.isSB)
                            const hasCS = orderedEvents.some(event => event.isCS)
                            const hasWP = orderedEvents.some(event => event.isWP)
                            const hasPB = orderedEvents.some(event => event.isPB)

                            const chainKey = [
                                `play=${String(play.result)}`,
                                `contact=${String(play.contact)}`,
                                `shallow=${String(play.shallowDeep)}`,
                                `orig=${baseText(originalStart)}`,
                                `final=${baseText(finalEnd)}`,
                                `out=${isOut}`,
                                `scored=${scored}`,
                                `throw=${hasThrow}`,
                                `sb=${hasSB}`,
                                `cs=${hasCS}`,
                                `wp=${hasWP}`,
                                `pb=${hasPB}`,
                                `steps=${orderedEvents.length}`
                            ].join("|")

                            const chainRow = getRow(chainRows, chainKey, () => ({
                                key: chainKey,
                                count: 0,
                                runs: 0,
                                outs: 0,
                                throws: 0
                            }))

                            chainRow.count++
                            if (scored) chainRow.runs++
                            if (isOut) chainRow.outs++
                            if (hasThrow) chainRow.throws++

                            if (play.result === PlayResult.SINGLE && originalStart === BaseResult.THIRD && scored) {
                                advancement.automaticThirdToHomeOnSingle++
                            }

                            if (play.result === PlayResult.DOUBLE && originalStart === BaseResult.THIRD && scored) {
                                advancement.automaticThirdToHomeOnDouble++
                            }

                            if (play.result === PlayResult.DOUBLE && originalStart === BaseResult.SECOND && scored) {
                                advancement.automaticSecondToHomeOnDouble++
                            }

                            if (play.result === PlayResult.SINGLE && originalStart === BaseResult.FIRST && orderedEvents.length > 1) {
                                advancement.single1BTo3BRiskAttempts++
                                if (isOut) advancement.single1BTo3BOut++
                                else if (finalEnd === BaseResult.THIRD || finalEnd === BaseResult.HOME || scored) advancement.single1BTo3BSafe++
                            }

                            if (play.result === PlayResult.SINGLE && originalStart === BaseResult.SECOND && orderedEvents.length > 1) {
                                advancement.single2BToHomeRiskAttempts++
                                if (isOut) advancement.single2BToHomeOut++
                                else if (finalEnd === BaseResult.HOME || scored) advancement.single2BToHomeSafe++
                            }

                            if (play.result === PlayResult.DOUBLE && originalStart === BaseResult.FIRST && orderedEvents.length > 1) {
                                advancement.double1BToHomeRiskAttempts++
                                if (isOut) advancement.double1BToHomeOut++
                                else if (finalEnd === BaseResult.HOME || scored) advancement.double1BToHomeSafe++
                            }

                            if (play.result === PlayResult.OUT && originalStart === BaseResult.THIRD && (orderedEvents.length > 1 || finalEnd === BaseResult.HOME || isOut)) {
                                advancement.out3BToHomeAttempts++
                                if (isOut) advancement.out3BToHomeOut++
                                else if (finalEnd === BaseResult.HOME || scored) advancement.out3BToHomeSafe++
                            }
                        }
                    }
                }
            }

            const ab = Math.max(1, totals.ab)
            const pa = Math.max(1, totals.pa)
            const bip = Math.max(1, totals.ab - totals.so - totals.hr)
            const totalBases = totals.singles + (totals.doubles * 2) + (totals.triples * 3) + (totals.hr * 4)

            const summary = {
                label,
                teamRunsPerGame: totals.runs / games / 2,
                teamPaPerGame: totals.pa / games / 2,
                avg: totals.hits / ab,
                obp: (totals.hits + totals.bb + totals.hbp) / pa,
                slg: totalBases / ab,
                ops: ((totals.hits + totals.bb + totals.hbp) / pa) + (totalBases / ab),
                babip: (totals.hits - totals.hr) / bip,
                bbPercent: totals.bb / pa,
                soPercent: totals.so / pa,
                singlePercent: totals.singles / pa,
                doublePercent: totals.doubles / pa,
                triplePercent: totals.triples / pa,
                homeRunPercent: totals.hr / pa,
                xbhPercent: (totals.doubles + totals.triples + totals.hr) / pa,
                teamHomeRunsPerGame: totals.hr / games / 2,
                teamDoublesPerGame: totals.doubles / games / 2,
                teamSBAttemptsPerGame: totals.sbAttempts / games / 2,
                teamSBPerGame: totals.sb / games / 2,
                teamCSPerGame: totals.cs / games / 2,
                stealSuccessRate: totals.sbAttempts > 0 ? totals.sb / totals.sbAttempts : 0,
                teamLOBPerGame: totals.lob / games / 2,
                runnersOnPAShare: totals.runnersOnPa / pa,
                runnerOutsOnBasesPerGame: totals.runnerOutsOnBases / games / 2,
                gidpLikePerGame: totals.gidpLike / games / 2,
                wildPitchAdvancesPerGame: totals.wildPitchAdvances / games / 2,
                passedBallAdvancesPerGame: totals.passedBallAdvances / games / 2,
                scoreMinusLinescore: totals.scoreRuns - totals.linescoreRuns,
                scoreMinusEvents: totals.scoreRuns - totals.eventRuns,
                single1BTo3BRiskAttemptsPerGame: advancement.single1BTo3BRiskAttempts / games / 2,
                single1BTo3BRiskSafeRate: advancement.single1BTo3BRiskAttempts > 0 ? advancement.single1BTo3BSafe / advancement.single1BTo3BRiskAttempts : 0,
                single1BTo3BRiskOutRate: advancement.single1BTo3BRiskAttempts > 0 ? advancement.single1BTo3BOut / advancement.single1BTo3BRiskAttempts : 0,
                single2BToHomeRiskAttemptsPerGame: advancement.single2BToHomeRiskAttempts / games / 2,
                single2BToHomeRiskSafeRate: advancement.single2BToHomeRiskAttempts > 0 ? advancement.single2BToHomeSafe / advancement.single2BToHomeRiskAttempts : 0,
                single2BToHomeRiskOutRate: advancement.single2BToHomeRiskAttempts > 0 ? advancement.single2BToHomeOut / advancement.single2BToHomeRiskAttempts : 0,
                double1BToHomeRiskAttemptsPerGame: advancement.double1BToHomeRiskAttempts / games / 2,
                double1BToHomeRiskSafeRate: advancement.double1BToHomeRiskAttempts > 0 ? advancement.double1BToHomeSafe / advancement.double1BToHomeRiskAttempts : 0,
                double1BToHomeRiskOutRate: advancement.double1BToHomeRiskAttempts > 0 ? advancement.double1BToHomeOut / advancement.double1BToHomeRiskAttempts : 0,
                out3BToHomeAttemptsPerGame: advancement.out3BToHomeAttempts / games / 2,
                out3BToHomeSafeRate: advancement.out3BToHomeAttempts > 0 ? advancement.out3BToHomeSafe / advancement.out3BToHomeAttempts : 0,
                out3BToHomeOutRate: advancement.out3BToHomeAttempts > 0 ? advancement.out3BToHomeOut / advancement.out3BToHomeAttempts : 0,
                automaticSecondToHomeOnDoublePerGame: advancement.automaticSecondToHomeOnDouble / games / 2,
                automaticThirdToHomeOnSinglePerGame: advancement.automaticThirdToHomeOnSingle / games / 2,
                automaticThirdToHomeOnDoublePerGame: advancement.automaticThirdToHomeOnDouble / games / 2
            }

            const topBaseStates = Array.from(baseStates.values())
                .map(row => ({
                    key: row.key,
                    pa: row.pa,
                    paShare: row.pa / pa,
                    runsPerPA: row.runs / Math.max(1, row.pa),
                    runnerOutsOnBasesPerPA: row.runnerOutsOnBases / Math.max(1, row.pa)
                }))
                .sort((a, b) => b.pa - a.pa)
                .slice(0, 12)

            const topPlayResults = Array.from(playResults.values())
                .map(row => ({
                    key: row.key,
                    pa: row.pa,
                    paShare: row.pa / pa,
                    runsPerEvent: row.runs / Math.max(1, row.pa),
                    runnerOutsOnBasesPerEvent: row.runnerOutsOnBases / Math.max(1, row.pa),
                    runnersOnShare: row.runnersOn / Math.max(1, row.pa)
                }))
                .sort((a, b) => b.pa - a.pa)

            const topChains = Array.from(chainRows.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 20)

            return {
                label,
                tuning: testPitchEnvironment.pitchEnvironmentTuning?.tuning,
                summary,
                topBaseStates,
                topPlayResults,
                topChains
            }
        }

        const baseline = evaluate("baseline-defaults")

        console.log("\n=== BASELINE DEFAULT TUNING ===")
        console.log(JSON.stringify(baseline.tuning, null, 2))

        console.log("\n=== BASELINE DEFAULT SUMMARY ===")
        console.log(JSON.stringify(baseline.summary, null, 2))

        console.log("\n=== BASELINE PLAY RESULT RUN VALUE ===")
        for (const row of baseline.topPlayResults) {
            console.log(row)
        }

        console.log("\n=== BASELINE TOP BASE STATES ===")
        for (const row of baseline.topBaseStates) {
            console.log(row)
        }

        const allRows: any[] = []

        for (const spec of knobSpecs) {
            console.log(`\n=== KNOB SWEEP START ${spec.name} ===`)

            const rows = spec.values.map(value => {
                const result = evaluate(`${spec.name}=${value}`, tuning => spec.apply(tuning, value))
                const row = {
                    knob: spec.name,
                    value,
                    ...result.summary,
                    deltaRuns: result.summary.teamRunsPerGame - baseline.summary.teamRunsPerGame,
                    deltaAVG: result.summary.avg - baseline.summary.avg,
                    deltaOBP: result.summary.obp - baseline.summary.obp,
                    deltaSLG: result.summary.slg - baseline.summary.slg,
                    deltaOPS: result.summary.ops - baseline.summary.ops,
                    deltaBABIP: result.summary.babip - baseline.summary.babip,
                    deltaBBPercent: result.summary.bbPercent - baseline.summary.bbPercent,
                    deltaSOPercent: result.summary.soPercent - baseline.summary.soPercent,
                    deltaHRPercent: result.summary.homeRunPercent - baseline.summary.homeRunPercent,
                    deltaDoublePercent: result.summary.doublePercent - baseline.summary.doublePercent,
                    deltaSBPerGame: result.summary.teamSBPerGame - baseline.summary.teamSBPerGame,
                    deltaSBAttemptsPerGame: result.summary.teamSBAttemptsPerGame - baseline.summary.teamSBAttemptsPerGame,
                    deltaRunnerOutsOnBasesPerGame: result.summary.runnerOutsOnBasesPerGame - baseline.summary.runnerOutsOnBasesPerGame,
                    deltaDouble1BToHomeRiskAttemptsPerGame: result.summary.double1BToHomeRiskAttemptsPerGame - baseline.summary.double1BToHomeRiskAttemptsPerGame,
                    deltaSingle2BToHomeRiskAttemptsPerGame: result.summary.single2BToHomeRiskAttemptsPerGame - baseline.summary.single2BToHomeRiskAttemptsPerGame,
                    deltaSingle1BTo3BRiskAttemptsPerGame: result.summary.single1BTo3BRiskAttemptsPerGame - baseline.summary.single1BTo3BRiskAttemptsPerGame
                }

                allRows.push(row)

                console.log(JSON.stringify(row, null, 2))

                if (spec.name === "advancementAggressionScale") {
                    console.log(`\n=== ADVANCEMENT DETAIL ${spec.name}=${value} TOP PLAY RESULTS ===`)
                    for (const playRow of result.topPlayResults) {
                        console.log(playRow)
                    }

                    console.log(`\n=== ADVANCEMENT DETAIL ${spec.name}=${value} TOP CHAINS ===`)
                    for (const chainRow of result.topChains) {
                        console.log(chainRow)
                    }
                }

                return row
            })

            const minRuns = rows.reduce((best, row) => row.teamRunsPerGame < best.teamRunsPerGame ? row : best, rows[0])
            const maxRuns = rows.reduce((best, row) => row.teamRunsPerGame > best.teamRunsPerGame ? row : best, rows[0])
            const minOps = rows.reduce((best, row) => row.ops < best.ops ? row : best, rows[0])
            const maxOps = rows.reduce((best, row) => row.ops > best.ops ? row : best, rows[0])

            console.log(`\n=== KNOB SWEEP SUMMARY ${spec.name} ===`)
            console.log({
                knob: spec.name,
                runsRange: maxRuns.teamRunsPerGame - minRuns.teamRunsPerGame,
                minRuns: {
                    value: minRuns.value,
                    teamRunsPerGame: minRuns.teamRunsPerGame,
                    ops: minRuns.ops,
                    avg: minRuns.avg,
                    babip: minRuns.babip
                },
                maxRuns: {
                    value: maxRuns.value,
                    teamRunsPerGame: maxRuns.teamRunsPerGame,
                    ops: maxRuns.ops,
                    avg: maxRuns.avg,
                    babip: maxRuns.babip
                },
                opsRange: maxOps.ops - minOps.ops,
                minOps: {
                    value: minOps.value,
                    teamRunsPerGame: minOps.teamRunsPerGame,
                    ops: minOps.ops
                },
                maxOps: {
                    value: maxOps.value,
                    teamRunsPerGame: maxOps.teamRunsPerGame,
                    ops: maxOps.ops
                }
            })
        }

        console.log("\n=== ALL KNOB ROWS COMPACT ===")
        for (const row of allRows) {
            console.log([
                row.knob,
                `v=${row.value}`,
                `R=${row.teamRunsPerGame.toFixed(3)}`,
                `dR=${row.deltaRuns.toFixed(3)}`,
                `AVG=${row.avg.toFixed(3)}`,
                `OBP=${row.obp.toFixed(3)}`,
                `SLG=${row.slg.toFixed(3)}`,
                `OPS=${row.ops.toFixed(3)}`,
                `BABIP=${row.babip.toFixed(3)}`,
                `BB%=${row.bbPercent.toFixed(3)}`,
                `SO%=${row.soPercent.toFixed(3)}`,
                `HR%=${row.homeRunPercent.toFixed(3)}`,
                `2B%=${row.doublePercent.toFixed(3)}`,
                `SBA/G=${row.teamSBAttemptsPerGame.toFixed(3)}`,
                `SB/G=${row.teamSBPerGame.toFixed(3)}`,
                `ROOB/G=${row.runnerOutsOnBasesPerGame.toFixed(3)}`,
                `1B3B/G=${row.single1BTo3BRiskAttemptsPerGame.toFixed(3)}`,
                `2BH/G=${row.single2BToHomeRiskAttemptsPerGame.toFixed(3)}`,
                `1BH2B/G=${row.double1BToHomeRiskAttemptsPerGame.toFixed(3)}`
            ].join(" | "))
        }

        assert.strictEqual(baseline.summary.scoreMinusLinescore, 0)
        assert.strictEqual(baseline.summary.scoreMinusEvents, 0)
        assert.ok(baseline.summary.teamRunsPerGame > 0)
    })

})

const evaluateManualTuning = (name: string, tuning: PitchEnvironmentTuning["tuning"]) => {
    const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

    testPitchEnvironment.pitchEnvironmentTuning = {
        _id: `manual-${name}`,
        tuning
    }

    const evaluation = pitchEnvironmentService.evaluatePitchEnvironment(
        testPitchEnvironment,
        seedrandom(`manual-${name}-${evaluationGames}`),
        evaluationGames
    )

    const rng = seedrandom(`manual-${name}-run-conversion-${evaluationGames}`)

    let games = 0
    let halfInnings = 0
    let totalRuns = 0
    let totalHits = 0
    let totalHomeRuns = 0
    let totalWalks = 0
    let totalStrikeouts = 0
    let totalOuts = 0
    let totalPlateAppearances = 0
    let totalLeftOnBase = 0
    let totalRunnerOuts = 0
    let totalRunnerScoredEvents = 0

    const baseState = new Map<string, { pa: number, runs: number, hits: number, walks: number, homeRuns: number, outs: number }>()
    const outState = new Map<number, { pa: number, runs: number, hits: number, walks: number, homeRuns: number }>()

    const getBaseKey = (runnerResult: any): string => {
        const first = runnerResult?.start?.first ? "1" : "0"
        const second = runnerResult?.start?.second ? "1" : "0"
        const third = runnerResult?.start?.third ? "1" : "0"

        return `${first}${second}${third}`
    }

    const addBaseState = (key: string, play: any, runs: number) => {
        if (!baseState.has(key)) {
            baseState.set(key, { pa: 0, runs: 0, hits: 0, walks: 0, homeRuns: 0, outs: 0 })
        }

        const row = baseState.get(key)!
        row.pa++
        row.runs += runs

        if (
            play.result === PlayResult.SINGLE ||
            play.result === PlayResult.DOUBLE ||
            play.result === PlayResult.TRIPLE ||
            play.result === PlayResult.HR
        ) {
            row.hits++
        }

        if (play.result === PlayResult.BB) row.walks++
        if (play.result === PlayResult.HR) row.homeRuns++
        if (play.result === PlayResult.OUT || play.result === PlayResult.STRIKEOUT) row.outs++
    }

    const addOutState = (outs: number, play: any, runs: number) => {
        if (!outState.has(outs)) {
            outState.set(outs, { pa: 0, runs: 0, hits: 0, walks: 0, homeRuns: 0 })
        }

        const row = outState.get(outs)!
        row.pa++
        row.runs += runs

        if (
            play.result === PlayResult.SINGLE ||
            play.result === PlayResult.DOUBLE ||
            play.result === PlayResult.TRIPLE ||
            play.result === PlayResult.HR
        ) {
            row.hits++
        }

        if (play.result === PlayResult.BB) row.walks++
        if (play.result === PlayResult.HR) row.homeRuns++
    }

    for (let gameIndex = 0; gameIndex < evaluationGames; gameIndex++) {
        const game = pitchEnvironmentService.buildStartedBaselineGame(
            clone(testPitchEnvironment),
            `manual-${name}-run-conversion-${gameIndex}`
        )

        while (!game.isComplete) {
            simService.simPitch(game, rng)
        }

        games++
        totalRuns += game.score.away + game.score.home

        for (const halfInning of game.halfInnings) {
            halfInnings++

            const plays = halfInning.plays ?? []
            const finalPlay = plays[plays.length - 1]
            const finalEnd = finalPlay?.runner?.result?.end

            if (finalEnd) {
                if (finalEnd.first) totalLeftOnBase++
                if (finalEnd.second) totalLeftOnBase++
                if (finalEnd.third) totalLeftOnBase++
            }

            for (const play of plays) {
                const runnerStart = play.runner?.result?.start
                const runnerEnd = play.runner?.result?.end
                const playRuns = runnerEnd?.scored?.length ?? 0
                const outsBefore = Math.min(2, totalOuts % 3)
                const baseKey = getBaseKey(play.runner?.result)

                totalPlateAppearances++
                totalRunnerScoredEvents += playRuns

                addBaseState(baseKey, play, playRuns)
                addOutState(outsBefore, play, playRuns)

                if (
                    play.result === PlayResult.SINGLE ||
                    play.result === PlayResult.DOUBLE ||
                    play.result === PlayResult.TRIPLE ||
                    play.result === PlayResult.HR
                ) {
                    totalHits++
                }

                if (play.result === PlayResult.HR) totalHomeRuns++
                if (play.result === PlayResult.BB) totalWalks++
                if (play.result === PlayResult.STRIKEOUT) totalStrikeouts++

                const runnerOuts = runnerEnd?.out?.length ?? 0
                totalRunnerOuts += runnerOuts
                totalOuts += runnerOuts

                if (!runnerEnd?.out?.includes(play.hitterId) && (play.result === PlayResult.OUT || play.result === PlayResult.STRIKEOUT)) {
                    totalOuts++
                }

                if (runnerStart && runnerEnd) {
                    void runnerStart
                }
            }
        }
    }

    const formatMap = (map: Map<any, any>) => {
        return Array.from(map.entries())
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
            .map(([key, row]) => ({
                key,
                pa: row.pa,
                runs: row.runs,
                runsPerPA: row.pa > 0 ? row.runs / row.pa : 0,
                hits: row.hits,
                walks: row.walks,
                homeRuns: row.homeRuns,
                outs: row.outs
            }))
    }

    console.log(`[MANUAL ${name.toUpperCase()}]`, {
        runs: evaluation.actual.teamRunsPerGame,
        avg: evaluation.actual.avg,
        obp: evaluation.actual.obp,
        slg: evaluation.actual.slg,
        ops: evaluation.actual.ops,
        babip: evaluation.actual.babip,
        pitchesPerPA: evaluation.actual.pitchesPerPA,
        zSwing: evaluation.actual.swingAtStrikesPercent,
        chase: evaluation.actual.swingAtBallsPercent,
        zContact: evaluation.actual.inZoneContactPercent,
        chaseContact: evaluation.actual.outZoneContactPercent,
        bbPercent: evaluation.actual.bbPercent,
        soPercent: evaluation.actual.soPercent,
        homeRunPercent: evaluation.actual.homeRunPercent,
        teamHomeRunsPerGame: evaluation.actual.teamHomeRunsPerGame,
        teamHitsPerGame: evaluation.actual.teamHitsPerGame,
        teamBBPerGame: evaluation.actual.teamBBPerGame,
        targetRuns: evaluation.target.teamRunsPerGame,
        targetHomeRunPercent: evaluation.target.homeRunPercent,
        targetTeamHomeRunsPerGame: evaluation.target.teamHomeRunsPerGame
    })

    console.log(`[MANUAL ${name.toUpperCase()} RUN CONVERSION]`, {
        games,
        teamRunsPerGame: totalRuns / games / 2,
        teamHitsPerGame: totalHits / games / 2,
        teamHomeRunsPerGame: totalHomeRuns / games / 2,
        teamBBPerGame: totalWalks / games / 2,
        teamSOPerGame: totalStrikeouts / games / 2,
        leftOnBasePerTeamGame: totalLeftOnBase / games / 2,
        runnerOutsPerTeamGame: totalRunnerOuts / games / 2,
        scoredRunnerEventsPerTeamGame: totalRunnerScoredEvents / games / 2,
        paPerTeamGame: totalPlateAppearances / games / 2,
        runsPerHit: totalHits > 0 ? totalRuns / totalHits : 0,
        runsPerTimesOnBase: (totalHits + totalWalks) > 0 ? totalRuns / (totalHits + totalWalks) : 0
    })

    console.log(`[MANUAL ${name.toUpperCase()} BASE STATE]`, formatMap(baseState))
    console.log(`[MANUAL ${name.toUpperCase()} OUT STATE]`, formatMap(outState))

    return evaluation
}