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
    PitchCall
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

import { PlayerImporterService } from "../src/importer/service/player-importer-service.js"
import { importPitchEnvironmentTarget } from "../src/importer/index.js"
import { DownloaderService } from "../src/importer/service/downloader-service.js"

const statService = new StatService()
let pitchEnvironment: PitchEnvironmentTarget
let tunedPitchEnvironment: PitchEnvironmentTarget

const season = 2025
const baseDataDir = "data"

const playerImporterService = new PlayerImporterService(simService, statService, {} as any)
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
        pitchEnvironment = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)
        console.log(JSON.stringify(pitchEnvironment))
        assert.ok(pitchEnvironment)
    })
    
    it("should expose lineup wrap when next hitter is still on base", () => {
        const baselineGame = playerImporterService.buildStartedBaselineGame(pitchEnvironment)
        const game = clone(baselineGame)
        const offense = game.home

        const catcher = offense.players.find((p: GamePlayer) => p.currentPosition === Position.CATCHER)
        const leftFielder = offense.players.find((p: GamePlayer) => p.currentPosition === Position.LEFT_FIELD)
        const thirdBaseman = offense.players.find((p: GamePlayer) => p.currentPosition === Position.THIRD_BASE)

        assert.ok(catcher)
        assert.ok(leftFielder)
        assert.ok(thirdBaseman)

        offense.runner1BId = leftFielder._id
        offense.runner2BId = thirdBaseman._id
        offense.runner3BId = catcher._id
        offense.currentHitterIndex = offense.lineupIds.findIndex((id: string) => id === catcher._id)

        assert.throws(
            () => {
                ;(simService as any).validateNextHitterIsNotOnBase(
                    offense,
                    game,
                    {
                        index: 13,
                        result: PlayResult.OUT,
                        officialPlayResult: "Flyout",
                        runner: {
                            result: {
                                end: {
                                    first: leftFielder._id,
                                    second: thirdBaseman._id,
                                    third: catcher._id,
                                    scored: [],
                                    out: []
                                }
                            }
                        }
                    }
                )
            },
            /Next hitter is already on base/
        )
    })

    it("single should allow runner from second to score through cloned third-to-home event exactly once", () => {
        const baselineGame = playerImporterService.buildStartedBaselineGame(pitchEnvironment)
        const offense = clone(baselineGame.away)
        const defense = clone(baselineGame.home)
        const target = clone(pitchEnvironment)

        target.running.advancement.runnerOnSecondToHomeOnSingle = 1

        const hitter = offense.players.find((p: GamePlayer) => p.currentPosition === Position.RIGHT_FIELD)
        const runner2B = offense.players.find((p: GamePlayer) => p.currentPosition === Position.SECOND_BASE)
        const pitcher = defense.players.find((p: GamePlayer) => p.currentPosition === Position.PITCHER)
        const fielder = defense.players.find((p: GamePlayer) => p.currentPosition === Position.CENTER_FIELD)

        assert.ok(hitter)
        assert.ok(runner2B)
        assert.ok(pitcher)
        assert.ok(fielder)
        assert.notEqual(hitter._id, runner2B._id)

        const runnerResult: RunnerResult = {
            first: undefined,
            second: runner2B._id,
            third: undefined,
            scored: [],
            out: []
        }

        const events = (simService as any).runnerActions.getRunnerEvents(
            rngSequence([0.01, 0.10]),
            runnerResult,
            [],
            [],
            target,
            PlayResult.SINGLE,
            Contact.LINE_DRIVE,
            ShallowDeep.NORMAL,
            hitter,
            fielder,
            undefined,
            runner2B,
            undefined,
            offense,
            defense,
            pitcher,
            0
        )

        const runnerEvents = events.filter((e: RunnerEvent) => e.runner._id === runner2B._id)

        assert.equal(runnerResult.first, hitter._id)
        assert.equal(runnerResult.second, undefined)
        assert.equal(runnerResult.third, undefined)
        assert.deepEqual(runnerResult.scored, [runner2B._id])
        assert.deepEqual(runnerResult.out, [])

        assert.equal(runnerEvents.length, 2)
        assert.ok(runnerEvents.find((e: RunnerEvent) => e.movement.start === BaseResult.SECOND && e.movement.end === BaseResult.THIRD))
        assert.ok(runnerEvents.find((e: RunnerEvent) => e.movement.start === BaseResult.THIRD && e.movement.end === BaseResult.HOME))
    })

    it("single should allow runner from first to reach third through cloned second-to-third event without scoring twice", () => {
        const baselineGame = playerImporterService.buildStartedBaselineGame(pitchEnvironment)
        const offense = clone(baselineGame.away)
        const defense = clone(baselineGame.home)
        const target = clone(pitchEnvironment)

        target.running.advancement.runnerOnFirstToThirdOnSingle = 1

        const hitter = offense.players.find((p: GamePlayer) => p.currentPosition === Position.LEFT_FIELD)
        const runner1B = offense.players.find((p: GamePlayer) => p.currentPosition === Position.RIGHT_FIELD)
        const pitcher = defense.players.find((p: GamePlayer) => p.currentPosition === Position.PITCHER)
        const fielder = defense.players.find((p: GamePlayer) => p.currentPosition === Position.RIGHT_FIELD)

        assert.ok(hitter)
        assert.ok(runner1B)
        assert.ok(pitcher)
        assert.ok(fielder)
        assert.notEqual(hitter._id, runner1B._id)

        const runnerResult: RunnerResult = {
            first: runner1B._id,
            second: undefined,
            third: undefined,
            scored: [],
            out: []
        }

        const events = (simService as any).runnerActions.getRunnerEvents(
            rngSequence([0.01, 0.10]),
            runnerResult,
            [],
            [],
            target,
            PlayResult.SINGLE,
            Contact.LINE_DRIVE,
            ShallowDeep.NORMAL,
            hitter,
            fielder,
            runner1B,
            undefined,
            undefined,
            offense,
            defense,
            pitcher,
            0
        )

        const runnerEvents = events.filter((e: RunnerEvent) => e.runner._id === runner1B._id)

        assert.equal(runnerResult.first, hitter._id)
        assert.equal(runnerResult.second, undefined)
        assert.equal(runnerResult.third, runner1B._id)
        assert.deepEqual(runnerResult.scored, [])
        assert.deepEqual(runnerResult.out, [])

        assert.equal(runnerEvents.length, 2)
        assert.ok(runnerEvents.find((e: RunnerEvent) => e.movement.start === BaseResult.FIRST && e.movement.end === BaseResult.SECOND))
        assert.ok(runnerEvents.find((e: RunnerEvent) => e.movement.start === BaseResult.SECOND && e.movement.end === BaseResult.THIRD))
    })

    it("double should allow runner from first to score through cloned third-to-home event exactly once", () => {
        const baselineGame = playerImporterService.buildStartedBaselineGame(pitchEnvironment)
        const offense = clone(baselineGame.away)
        const defense = clone(baselineGame.home)
        const target = clone(pitchEnvironment)

        target.running.advancement.runnerOnFirstToHomeOnDouble = 1

        const hitter = offense.players.find((p: GamePlayer) => p.currentPosition === Position.LEFT_FIELD)
        const runner1B = offense.players.find((p: GamePlayer) => p.currentPosition === Position.RIGHT_FIELD)
        const pitcher = defense.players.find((p: GamePlayer) => p.currentPosition === Position.PITCHER)
        const fielder = defense.players.find((p: GamePlayer) => p.currentPosition === Position.CENTER_FIELD)

        assert.ok(hitter)
        assert.ok(runner1B)
        assert.ok(pitcher)
        assert.ok(fielder)
        assert.notEqual(hitter._id, runner1B._id)

        const runnerResult: RunnerResult = {
            first: runner1B._id,
            second: undefined,
            third: undefined,
            scored: [],
            out: []
        }

        const events = (simService as any).runnerActions.getRunnerEvents(
            rngSequence([0.01, 0.10]),
            runnerResult,
            [],
            [],
            target,
            PlayResult.DOUBLE,
            Contact.LINE_DRIVE,
            ShallowDeep.DEEP,
            hitter,
            fielder,
            runner1B,
            undefined,
            undefined,
            offense,
            defense,
            pitcher,
            0
        )

        const runnerEvents = events.filter((e: RunnerEvent) => e.runner._id === runner1B._id)

        assert.equal(runnerResult.first, undefined)
        assert.equal(runnerResult.second, hitter._id)
        assert.equal(runnerResult.third, undefined)
        assert.deepEqual(runnerResult.scored, [runner1B._id])
        assert.deepEqual(runnerResult.out, [])

        assert.equal(runnerEvents.length, 2)
        assert.ok(runnerEvents.find((e: RunnerEvent) => e.movement.start === BaseResult.FIRST && e.movement.end === BaseResult.THIRD))
        assert.ok(runnerEvents.find((e: RunnerEvent) => e.movement.start === BaseResult.THIRD && e.movement.end === BaseResult.HOME))
    })

    it("line-drive out to outfielder should record hitter out", () => {
        const baselineGame = playerImporterService.buildStartedBaselineGame(pitchEnvironment)
        const offense = clone(baselineGame.away)
        const defense = clone(baselineGame.home)
        const target = clone(pitchEnvironment)

        const hitter = offense.players.find((p: GamePlayer) => p.currentPosition === Position.RIGHT_FIELD)
        const pitcher = defense.players.find((p: GamePlayer) => p.currentPosition === Position.PITCHER)
        const fielder = defense.players.find((p: GamePlayer) => p.currentPosition === Position.RIGHT_FIELD)

        assert.ok(hitter)
        assert.ok(pitcher)
        assert.ok(fielder)

        const runnerResult: RunnerResult = {
            first: undefined,
            second: undefined,
            third: undefined,
            scored: [],
            out: []
        }

        const events = (simService as any).runnerActions.getRunnerEvents(
            rngSequence([0.50]),
            runnerResult,
            [],
            [],
            target,
            PlayResult.OUT,
            Contact.LINE_DRIVE,
            ShallowDeep.SHALLOW,
            hitter,
            fielder,
            undefined,
            undefined,
            undefined,
            offense,
            defense,
            pitcher,
            0
        )

        const hitterEvent = events.find((e: RunnerEvent) => e.runner._id === hitter._id)

        assert.ok(hitterEvent)
        assert.equal(hitterEvent.movement.start, BaseResult.HOME)
        assert.equal(hitterEvent.movement.end, BaseResult.HOME)
        assert.equal(hitterEvent.movement.isOut, true)
        assert.deepEqual(runnerResult.out, [hitter._id])
    })

    it("forced line-drive contact should break the offense ceiling", () => {
        const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: HIGH_OFFENSE_TUNING
        } as PitchEnvironmentTuning

        testPitchEnvironment.battedBall.contactRollInput = {
            groundball: 0,
            flyBall: 0,
            lineDrive: 100
        }

        const evaluation = playerImporterService.evaluatePitchEnvironment(
            testPitchEnvironment,
            seedrandom("manual-forced-line-drive-250"),
            evaluationGames
        )

        console.log("[FORCED LD OFFENSE]", {
            runs: evaluation.actual.teamRunsPerGame,
            avg: evaluation.actual.avg,
            obp: evaluation.actual.obp,
            slg: evaluation.actual.slg,
            ops: evaluation.actual.ops,
            babip: evaluation.actual.babip,
            homeRunPercent: evaluation.actual.homeRunPercent,
            targetRuns: evaluation.target.teamRunsPerGame
        })

        assert.ok(
            evaluation.actual.teamRunsPerGame > evaluation.target.teamRunsPerGame,
            `Expected forced LD contact to clear target R/G. actual=${evaluation.actual.teamRunsPerGame} target=${evaluation.target.teamRunsPerGame}`
        )
    })

    it("direct contact quality path should show whether pitchQualityChange can raise offense", () => {
        const sampleCount = 2500

        const makePitchEnvironment = (label: string, tuning: PitchEnvironmentTuning["tuning"]): PitchEnvironmentTarget => {
            const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

            testPitchEnvironment.pitchEnvironmentTuning = {
                _id: `direct-contact-quality-${label}`,
                tuning
            } as PitchEnvironmentTuning

            return testPitchEnvironment
        }

        const evaluate = (label: string, testPitchEnvironment: PitchEnvironmentTarget, pitchQualityChange: number) => {
            const contactWeights = [
                {
                    contact: Contact.GROUNDBALL,
                    name: "GROUNDBALL",
                    weight: testPitchEnvironment.battedBall.contactRollInput.groundball
                },
                {
                    contact: Contact.LINE_DRIVE,
                    name: "LINE_DRIVE",
                    weight: testPitchEnvironment.battedBall.contactRollInput.lineDrive
                },
                {
                    contact: Contact.FLY_BALL,
                    name: "FLY_BALL",
                    weight: testPitchEnvironment.battedBall.contactRollInput.flyBall
                }
            ]

            const totalWeight = contactWeights.reduce((sum, row) => sum + row.weight, 0)

            let weightedOut = 0
            let weightedSingle = 0
            let weightedDouble = 0
            let weightedTriple = 0
            let weightedHr = 0
            let weightedEv = 0
            let weightedLa = 0
            let weightedDistance = 0

            for (const row of contactWeights) {
                const rng = seedrandom(`${label}-${row.name}-${pitchQualityChange}`)

                let contactOut = 0
                let contactSingle = 0
                let contactDouble = 0
                let contactTriple = 0
                let contactHr = 0
                let contactEv = 0
                let contactLa = 0
                let contactDistance = 0

                for (let i = 0; i < sampleCount; i++) {
                    const hitQuality = (simService as any).gameRolls.getHitQuality(
                        rng,
                        testPitchEnvironment,
                        pitchQualityChange,
                        false,
                        row.contact
                    )

                    const model = (simService as any).getOutcomeModelForContactQuality(
                        testPitchEnvironment,
                        hitQuality,
                        row.contact,
                        pitchQualityChange
                    )

                    const modelTotal = model.out + model.single + model.double + model.triple + model.hr

                    contactOut += model.out / modelTotal
                    contactSingle += model.single / modelTotal
                    contactDouble += model.double / modelTotal
                    contactTriple += model.triple / modelTotal
                    contactHr += model.hr / modelTotal
                    contactEv += hitQuality.exitVelocity
                    contactLa += hitQuality.launchAngle
                    contactDistance += hitQuality.distance
                }

                contactOut /= sampleCount
                contactSingle /= sampleCount
                contactDouble /= sampleCount
                contactTriple /= sampleCount
                contactHr /= sampleCount
                contactEv /= sampleCount
                contactLa /= sampleCount
                contactDistance /= sampleCount

                const share = row.weight / totalWeight

                weightedOut += contactOut * share
                weightedSingle += contactSingle * share
                weightedDouble += contactDouble * share
                weightedTriple += contactTriple * share
                weightedHr += contactHr * share
                weightedEv += contactEv * share
                weightedLa += contactLa * share
                weightedDistance += contactDistance * share
            }

            const weightedBip = weightedOut + weightedSingle + weightedDouble + weightedTriple
            const weightedBabip = weightedBip > 0 ? (weightedSingle + weightedDouble + weightedTriple) / weightedBip : 0
            const weightedAvg = weightedSingle + weightedDouble + weightedTriple + weightedHr
            const weightedSlg = weightedSingle + (weightedDouble * 2) + (weightedTriple * 3) + (weightedHr * 4)

            const result = {
                label,
                pitchQualityChange,
                out: Number(weightedOut.toFixed(3)),
                single: Number(weightedSingle.toFixed(3)),
                double: Number(weightedDouble.toFixed(3)),
                triple: Number(weightedTriple.toFixed(3)),
                hr: Number(weightedHr.toFixed(3)),
                avgOnContact: Number(weightedAvg.toFixed(3)),
                slgOnContact: Number(weightedSlg.toFixed(3)),
                babip: Number(weightedBabip.toFixed(3)),
                avgEv: Number(weightedEv.toFixed(3)),
                avgLa: Number(weightedLa.toFixed(3)),
                avgDistance: Number(weightedDistance.toFixed(3))
            }

            console.log("[DIRECT CONTACT QUALITY SENSITIVITY]", result)

            return result
        }

        const defaultTuning = makeTuning()
        const aggressiveTuning = makeTuning({
            contactQuality: {
                evScale: 20,
                laScale: 8,
                distanceScale: 35,
                homeRunOutcomeScale: 0,

            },
            meta: {
                fullPitchQualityBonus: 150,
                fullTeamDefenseBonus: 0,
                fullFielderDefenseBonus: 0
            }
        })

        const defaultNeutral = evaluate("default-neutral", makePitchEnvironment("default", defaultTuning), 0)
        const aggressiveBadPitch = evaluate("aggressive-bad-pitch", makePitchEnvironment("aggressive", aggressiveTuning), -0.5)
        const aggressiveNeutral = evaluate("aggressive-neutral", makePitchEnvironment("aggressive", aggressiveTuning), 0)
        const aggressiveGoodPitch = evaluate("aggressive-good-pitch", makePitchEnvironment("aggressive", aggressiveTuning), 0.5)

        assert.ok(aggressiveBadPitch.avgOnContact > defaultNeutral.avgOnContact)
        assert.ok(aggressiveBadPitch.slgOnContact > defaultNeutral.slgOnContact)
        assert.ok(aggressiveBadPitch.hr >= defaultNeutral.hr)
        assert.ok(aggressiveGoodPitch.avgOnContact < aggressiveNeutral.avgOnContact)
    })

    it("default vs stronger pitch-quality offense should print pitch quality change distribution on balls in play", () => {
        const makePitchEnvironment = (label: string): PitchEnvironmentTarget => {
            const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

            const tuning = label === "stronger"
                ? makeTuning({
                    contactQuality: {
                        evScale: 20,
                        laScale: 8,
                        distanceScale: 35,
                        homeRunOutcomeScale: 0,
                    },
                    meta: {
                        fullPitchQualityBonus: 150,
                        fullTeamDefenseBonus: 0,
                        fullFielderDefenseBonus: 0
                    }
                })
                : makeTuning()

            testPitchEnvironment.pitchEnvironmentTuning = {
                _id: `pitch-quality-change-report-${label}`,
                tuning
            } as PitchEnvironmentTuning

            return testPitchEnvironment
        }

        const evaluate = (label: string) => {
            const testPitchEnvironment = makePitchEnvironment(label)
            const rng = seedrandom(`pitch-quality-change-report-${label}`)
            const games = evaluationGames

            const pitchQualityChanges: number[] = []
            const overallQualities: number[] = []
            const evs: number[] = []
            const las: number[] = []
            const distances: number[] = []

            const resultCounts = {
                out: 0,
                single: 0,
                double: 0,
                triple: 0,
                hr: 0,
                bb: 0,
                so: 0,
                hbp: 0
            }

            let runs = 0
            let pa = 0
            let ab = 0
            let hits = 0
            let totalBases = 0

            for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                const game = playerImporterService.buildStartedBaselineGame(
                    clone(testPitchEnvironment),
                    `pitch-quality-change-report-${label}-${gameIndex}`
                )

                while (!game.isComplete) {
                    simService.simPitch(game, rng)
                }

                runs += game.score.away + game.score.home

                const plays = game.halfInnings.flatMap(halfInning => halfInning.plays)

                for (const play of plays) {
                    pa++

                    if (play.result === PlayResult.OUT) {
                        resultCounts.out++
                        ab++
                    }

                    if (play.result === PlayResult.SINGLE) {
                        resultCounts.single++
                        hits++
                        ab++
                        totalBases += 1
                    }

                    if (play.result === PlayResult.DOUBLE) {
                        resultCounts.double++
                        hits++
                        ab++
                        totalBases += 2
                    }

                    if (play.result === PlayResult.TRIPLE) {
                        resultCounts.triple++
                        hits++
                        ab++
                        totalBases += 3
                    }

                    if (play.result === PlayResult.HR) {
                        resultCounts.hr++
                        hits++
                        ab++
                        totalBases += 4
                    }

                    if (play.result === PlayResult.BB) {
                        resultCounts.bb++
                    }

                    if (play.result === PlayResult.STRIKEOUT) {
                        resultCounts.so++
                        ab++
                    }

                    if (play.result === PlayResult.HIT_BY_PITCH) {
                        resultCounts.hbp++
                    }

                    const ballInPlay = play.pitchLog?.pitches?.find((pitch: any) => pitch.contactQuality)

                    if (ballInPlay?.contactQuality) {
                        const pitchQualityChange = ((ballInPlay.overallQuality / 50 * 100) - 100) / 100

                        pitchQualityChanges.push(pitchQualityChange)
                        overallQualities.push(ballInPlay.overallQuality)
                        evs.push(ballInPlay.contactQuality.exitVelocity)
                        las.push(ballInPlay.contactQuality.launchAngle)
                        distances.push(ballInPlay.contactQuality.distance)
                    }
                }
            }

            const avg = (values: number[]) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
            const min = (values: number[]) => values.length > 0 ? Math.min(...values) : 0
            const max = (values: number[]) => values.length > 0 ? Math.max(...values) : 0

            const countWhere = (values: number[], predicate: (value: number) => boolean) => values.filter(predicate).length
            const pctWhere = (values: number[], predicate: (value: number) => boolean) => values.length > 0 ? countWhere(values, predicate) / values.length : 0

            const babipDenominator = resultCounts.out + resultCounts.single + resultCounts.double + resultCounts.triple
            const babipNumerator = resultCounts.single + resultCounts.double + resultCounts.triple

            const report = {
                label,
                games,
                runsPerGame: runs / games / 2,
                avg: ab > 0 ? hits / ab : 0,
                obp: pa > 0 ? (hits + resultCounts.bb + resultCounts.hbp) / pa : 0,
                slg: ab > 0 ? totalBases / ab : 0,
                babip: babipDenominator > 0 ? babipNumerator / babipDenominator : 0,
                hrPerPA: pa > 0 ? resultCounts.hr / pa : 0,
                ballsInPlay: pitchQualityChanges.length,
                pitchQualityChangeAvg: avg(pitchQualityChanges),
                pitchQualityChangeMin: min(pitchQualityChanges),
                pitchQualityChangeMax: max(pitchQualityChanges),
                pitchQualityChangeNegativePct: pctWhere(pitchQualityChanges, value => value < 0),
                pitchQualityChangeBelowNegativePoint10Pct: pctWhere(pitchQualityChanges, value => value <= -0.10),
                pitchQualityChangeBelowNegativePoint25Pct: pctWhere(pitchQualityChanges, value => value <= -0.25),
                pitchQualityChangePositivePct: pctWhere(pitchQualityChanges, value => value > 0),
                pitchQualityChangeAbovePoint10Pct: pctWhere(pitchQualityChanges, value => value >= 0.10),
                pitchQualityChangeAbovePoint25Pct: pctWhere(pitchQualityChanges, value => value >= 0.25),
                overallQualityAvg: avg(overallQualities),
                overallQualityMin: min(overallQualities),
                overallQualityMax: max(overallQualities),
                avgEv: avg(evs),
                avgLa: avg(las),
                avgDistance: avg(distances),
                resultCounts
            }

            console.log("[BIP PITCH QUALITY CHANGE REPORT]", report)

            return report
        }

        const baseline = evaluate("default")
        const stronger = evaluate("stronger")

        assert.ok(baseline.ballsInPlay > 0)
        assert.ok(stronger.ballsInPlay > 0)
        assert.ok(stronger.runsPerGame > baseline.runsPerGame - 0.5)
    })

    it("generated contact quality should print full EV LA bucket report", () => {
        const testPitchEnvironment = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeDisabledMetaTuning()
        } as PitchEnvironmentTuning

        const sampleCount = 2000
        const contacts = [Contact.GROUNDBALL, Contact.LINE_DRIVE, Contact.FLY_BALL]

        const buckets = new Map<string, any>()

        for (const contact of contacts) {
            const rng = seedrandom(`bucket-report-${contact}`)

            for (let i = 0; i < sampleCount; i++) {
                const hitQuality = (simService as any).gameRolls.getHitQuality(
                    rng,
                    testPitchEnvironment,
                    0,
                    false,
                    contact
                )

                const model = (simService as any).getOutcomeModelForContactQuality(
                    testPitchEnvironment,
                    hitQuality,
                    contact,
                    0
                )

                const key = `${contact}:${model.evBin}:${model.laBin}`

                if (!buckets.has(key)) {
                    buckets.set(key, {
                        contact,
                        evBin: model.evBin,
                        laBin: model.laBin,
                        samples: 0,
                        out: 0,
                        single: 0,
                        double: 0,
                        triple: 0,
                        hr: 0
                    })
                }

                const bucket = buckets.get(key)!
                const total = model.out + model.single + model.double + model.triple + model.hr

                bucket.samples++
                bucket.out += model.out / total
                bucket.single += model.single / total
                bucket.double += model.double / total
                bucket.triple += model.triple / total
                bucket.hr += model.hr / total
            }
        }

        const rows = Array.from(buckets.values()).map(b => {
            const out = b.out / b.samples
            const single = b.single / b.samples
            const double = b.double / b.samples
            const triple = b.triple / b.samples
            const hr = b.hr / b.samples
            const bip = out + single + double + triple
            const babip = bip > 0 ? (single + double + triple) / bip : 0

            return {
                ...b,
                out,
                single,
                double,
                triple,
                hr,
                babip
            }
        })

        console.log("\n=== TOP BUCKETS (ALL) ===")
        rows
            .sort((a, b) => b.samples - a.samples)
            .slice(0, 50)
            .forEach(r => {
                console.log(
                    `[${r.contact}] EV=${r.evBin} LA=${r.laBin} N=${r.samples} ` +
                    `OUT=${r.out.toFixed(3)} 1B=${r.single.toFixed(3)} ` +
                    `2B=${r.double.toFixed(3)} 3B=${r.triple.toFixed(3)} ` +
                    `HR=${r.hr.toFixed(3)} BABIP=${r.babip.toFixed(3)}`
                )
            })

        for (const contact of contacts) {
            const contactRows = rows.filter(r => r.contact === contact)

            const totalSamples = contactRows.reduce((sum, r) => sum + r.samples, 0)

            const avgEv = contactRows.reduce((sum, r) => sum + (r.evBin * r.samples), 0) / totalSamples
            const avgLa = contactRows.reduce((sum, r) => sum + (r.laBin * r.samples), 0) / totalSamples

            const hrRate = contactRows.reduce((sum, r) => sum + (r.hr * r.samples), 0) / totalSamples
            const babip = contactRows.reduce((sum, r) => sum + (r.babip * r.samples), 0) / totalSamples

            console.log(`\n=== ${contact} SUMMARY ===`)
            console.log({
                totalSamples,
                avgEv: avgEv.toFixed(2),
                avgLa: avgLa.toFixed(2),
                hrRate: hrRate.toFixed(3),
                babip: babip.toFixed(3)
            })

            console.log(`--- TOP HR BUCKETS (${contact}) ---`)
            contactRows
                .sort((a, b) => (b.hr - a.hr))
                .slice(0, 10)
                .forEach(r => {
                    console.log(
                        `EV=${r.evBin} LA=${r.laBin} HR=${r.hr.toFixed(3)} N=${r.samples}`
                    )
                })
        }

        assert.ok(rows.length > 0)
    })

    it("direct getHitQuality should match in-game contact quality distribution by contact type", () => {
        const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeDisabledMetaTuning()
        } as PitchEnvironmentTuning

        const avg = (values: number[]): number => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

        const direct = {
            groundBall: { ev: [] as number[], la: [] as number[], distance: [] as number[] },
            lineDrive: { ev: [] as number[], la: [] as number[], distance: [] as number[] },
            flyBall: { ev: [] as number[], la: [] as number[], distance: [] as number[] }
        }

        const game = {
            groundBall: { ev: [] as number[], la: [] as number[], distance: [] as number[] },
            lineDrive: { ev: [] as number[], la: [] as number[], distance: [] as number[] },
            flyBall: { ev: [] as number[], la: [] as number[], distance: [] as number[] }
        }

        const add = (bucket: { ev: number[], la: number[], distance: number[] }, contactQuality: any): void => {
            bucket.ev.push(contactQuality.exitVelocity)
            bucket.la.push(contactQuality.launchAngle)
            bucket.distance.push(contactQuality.distance)
        }

        const sampleCount = 3000

        const directSamples = [
            { contact: Contact.GROUNDBALL, key: "groundBall" as const },
            { contact: Contact.LINE_DRIVE, key: "lineDrive" as const },
            { contact: Contact.FLY_BALL, key: "flyBall" as const }
        ]

        for (const row of directSamples) {
            const rng = seedrandom(`direct-contact-quality-${row.key}`)

            for (let i = 0; i < sampleCount; i++) {
                const contactQuality = (simService as any).gameRolls.getHitQuality(
                    rng,
                    testPitchEnvironment,
                    0,
                    false,
                    row.contact
                )

                add(direct[row.key], contactQuality)
            }
        }

        const rng = seedrandom("game-contact-quality-distribution")
        const games = evaluationGames

        for (let gameIndex = 0; gameIndex < games; gameIndex++) {
            const simulatedGame = playerImporterService.buildStartedBaselineGame(
                clone(testPitchEnvironment),
                `game-contact-quality-distribution-${gameIndex}`
            )

            while (!simulatedGame.isComplete) {
                simService.simPitch(simulatedGame, rng)
            }

            for (const play of simulatedGame.halfInnings.flatMap(halfInning => halfInning.plays)) {
                const pitch = play.pitchLog?.pitches?.find((p: any) => p.contactQuality)

                if (!pitch?.contactQuality) continue

                if (play.contact === Contact.GROUNDBALL) add(game.groundBall, pitch.contactQuality)
                if (play.contact === Contact.LINE_DRIVE) add(game.lineDrive, pitch.contactQuality)
                if (play.contact === Contact.FLY_BALL) add(game.flyBall, pitch.contactQuality)
            }
        }

        const report = {
            groundBall: {
                directCount: direct.groundBall.la.length,
                gameCount: game.groundBall.la.length,
                directEv: avg(direct.groundBall.ev),
                gameEv: avg(game.groundBall.ev),
                directLa: avg(direct.groundBall.la),
                gameLa: avg(game.groundBall.la),
                directDistance: avg(direct.groundBall.distance),
                gameDistance: avg(game.groundBall.distance)
            },
            lineDrive: {
                directCount: direct.lineDrive.la.length,
                gameCount: game.lineDrive.la.length,
                directEv: avg(direct.lineDrive.ev),
                gameEv: avg(game.lineDrive.ev),
                directLa: avg(direct.lineDrive.la),
                gameLa: avg(game.lineDrive.la),
                directDistance: avg(direct.lineDrive.distance),
                gameDistance: avg(game.lineDrive.distance)
            },
            flyBall: {
                directCount: direct.flyBall.la.length,
                gameCount: game.flyBall.la.length,
                directEv: avg(direct.flyBall.ev),
                gameEv: avg(game.flyBall.ev),
                directLa: avg(direct.flyBall.la),
                gameLa: avg(game.flyBall.la),
                directDistance: avg(direct.flyBall.distance),
                gameDistance: avg(game.flyBall.distance)
            }
        }

        console.log("[CONTACT QUALITY DIRECT VS GAME]", report)

        assert.ok(game.groundBall.la.length > 800)
        assert.ok(game.lineDrive.la.length > 800)
        assert.ok(game.flyBall.la.length > 800)

        assert.ok(Math.abs(report.groundBall.directLa - report.groundBall.gameLa) < 1.5)
        assert.ok(Math.abs(report.lineDrive.directLa - report.lineDrive.gameLa) < 1.5)
        assert.ok(Math.abs(report.flyBall.directLa - report.flyBall.gameLa) < 1.5)

        assert.ok(Math.abs(report.groundBall.directEv - report.groundBall.gameEv) < 1.5)
        assert.ok(Math.abs(report.lineDrive.directEv - report.lineDrive.gameEv) < 1.5)
        assert.ok(Math.abs(report.flyBall.directEv - report.flyBall.gameEv) < 1.5)
    })

    it("disabled meta tuning should print expected vs actual in-game contact and EV LA report", () => {
        const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeDisabledMetaTuning()
        } as PitchEnvironmentTuning

        const rng = seedrandom("disabled-meta-live-game-contact-report")
        const games = evaluationGames

        const contactCounts = {
            groundBall: 0,
            lineDrive: 0,
            flyBall: 0,
            none: 0
        }

        const resultCounts = {
            out: 0,
            single: 0,
            double: 0,
            triple: 0,
            hr: 0,
            bb: 0,
            hbp: 0,
            so: 0,
            other: 0
        }

        const evBuckets = new Map<number, number>()
        const laBuckets = new Map<number, number>()
        const evLaBuckets = new Map<string, { evBin: number, laBin: number, count: number, hr: number, hits: number, outs: number }>()

        let totalRuns = 0
        let totalPlays = 0
        let totalBallsInPlay = 0
        let totalEv = 0
        let totalLa = 0
        let totalDistance = 0
        let totalContactQuality = 0

        for (let gameIndex = 0; gameIndex < games; gameIndex++) {
            const game = playerImporterService.buildStartedBaselineGame(
                clone(testPitchEnvironment),
                `disabled-meta-contact-report-${gameIndex}`
            )

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            totalRuns += game.score.away + game.score.home

            const plays = game.halfInnings.flatMap(halfInning => halfInning.plays)
            totalPlays += plays.length

            for (const play of plays) {
                if (play.contact === Contact.GROUNDBALL) contactCounts.groundBall++
                else if (play.contact === Contact.LINE_DRIVE) contactCounts.lineDrive++
                else if (play.contact === Contact.FLY_BALL) contactCounts.flyBall++
                else contactCounts.none++

                switch (play.result) {
                    case PlayResult.OUT:
                        resultCounts.out++
                        break
                    case PlayResult.SINGLE:
                        resultCounts.single++
                        break
                    case PlayResult.DOUBLE:
                        resultCounts.double++
                        break
                    case PlayResult.TRIPLE:
                        resultCounts.triple++
                        break
                    case PlayResult.HR:
                        resultCounts.hr++
                        break
                    case PlayResult.BB:
                        resultCounts.bb++
                        break
                    case PlayResult.HIT_BY_PITCH:
                        resultCounts.hbp++
                        break
                    case PlayResult.STRIKEOUT:
                        resultCounts.so++
                        break
                    default:
                        resultCounts.other++
                        break
                }

                const pitchWithContactQuality = play.pitchLog?.pitches?.find((pitch: any) => pitch.contactQuality)

                if (pitchWithContactQuality?.contactQuality) {
                    const hitQuality = pitchWithContactQuality.contactQuality

                    totalBallsInPlay++
                    totalContactQuality++
                    totalEv += hitQuality.exitVelocity
                    totalLa += hitQuality.launchAngle
                    totalDistance += hitQuality.distance

                    const evBin = Math.floor(hitQuality.exitVelocity / 2) * 2
                    const laBin = Math.floor(hitQuality.launchAngle / 2) * 2
                    const key = `${evBin}:${laBin}`

                    evBuckets.set(evBin, (evBuckets.get(evBin) ?? 0) + 1)
                    laBuckets.set(laBin, (laBuckets.get(laBin) ?? 0) + 1)

                    if (!evLaBuckets.has(key)) {
                        evLaBuckets.set(key, {
                            evBin,
                            laBin,
                            count: 0,
                            hr: 0,
                            hits: 0,
                            outs: 0
                        })
                    }

                    const bucket = evLaBuckets.get(key)!
                    bucket.count++

                    if (play.result === PlayResult.HR) bucket.hr++
                    if (
                        play.result === PlayResult.SINGLE ||
                        play.result === PlayResult.DOUBLE ||
                        play.result === PlayResult.TRIPLE ||
                        play.result === PlayResult.HR
                    ) {
                        bucket.hits++
                    }
                    if (play.result === PlayResult.OUT) bucket.outs++
                }
            }
        }

        const contactTotal = contactCounts.groundBall + contactCounts.lineDrive + contactCounts.flyBall
        const hitTotal = resultCounts.single + resultCounts.double + resultCounts.triple + resultCounts.hr
        const abTotal = resultCounts.out + hitTotal + resultCounts.so
        const babipDenominator = resultCounts.out + resultCounts.single + resultCounts.double + resultCounts.triple
        const babipNumerator = resultCounts.single + resultCounts.double + resultCounts.triple
        const totalBases = resultCounts.single + (resultCounts.double * 2) + (resultCounts.triple * 3) + (resultCounts.hr * 4)

        const expectedContact = testPitchEnvironment.battedBall.contactRollInput
        const expectedTotal = expectedContact.groundball + expectedContact.lineDrive + expectedContact.flyBall

        console.log("\n=== DISABLED META EXPECTED CONTACT MIX ===")
        console.log({
            groundBall: expectedContact.groundball / expectedTotal,
            lineDrive: expectedContact.lineDrive / expectedTotal,
            flyBall: expectedContact.flyBall / expectedTotal,
            raw: expectedContact
        })

        console.log("\n=== DISABLED META ACTUAL CONTACT MIX ===")
        console.log({
            groundBall: contactCounts.groundBall / contactTotal,
            lineDrive: contactCounts.lineDrive / contactTotal,
            flyBall: contactCounts.flyBall / contactTotal,
            none: contactCounts.none,
            raw: contactCounts
        })

        console.log("\n=== DISABLED META GAME OUTCOME REPORT ===")
        console.log({
            games,
            runsPerGame: totalRuns / games / 2,
            pa: totalPlays,
            ab: abTotal,
            avg: abTotal > 0 ? hitTotal / abTotal : 0,
            obp: totalPlays > 0 ? (hitTotal + resultCounts.bb + resultCounts.hbp) / totalPlays : 0,
            slg: abTotal > 0 ? totalBases / abTotal : 0,
            babip: babipDenominator > 0 ? babipNumerator / babipDenominator : 0,
            hrPerPA: totalPlays > 0 ? resultCounts.hr / totalPlays : 0,
            bbPerPA: totalPlays > 0 ? resultCounts.bb / totalPlays : 0,
            soPerPA: totalPlays > 0 ? resultCounts.so / totalPlays : 0,
            ballsInPlayPerPA: totalPlays > 0 ? totalBallsInPlay / totalPlays : 0,
            resultCounts
        })

        console.log("\n=== DISABLED META CONTACT QUALITY SUMMARY ===")
        console.log({
            ballsInPlay: totalBallsInPlay,
            avgEv: totalContactQuality > 0 ? totalEv / totalContactQuality : 0,
            avgLa: totalContactQuality > 0 ? totalLa / totalContactQuality : 0,
            avgDistance: totalContactQuality > 0 ? totalDistance / totalContactQuality : 0
        })

        console.log("\n=== DISABLED META TOP EV BUCKETS ===")
        Array.from(evBuckets.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 25)
            .forEach(([evBin, count]) => {
                console.log(`[EV] ${evBin} N=${count} PCT=${(count / totalBallsInPlay).toFixed(3)}`)
            })

        console.log("\n=== DISABLED META TOP LA BUCKETS ===")
        Array.from(laBuckets.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 35)
            .forEach(([laBin, count]) => {
                console.log(`[LA] ${laBin} N=${count} PCT=${(count / totalBallsInPlay).toFixed(3)}`)
            })

        console.log("\n=== DISABLED META TOP LIVE EV/LA BUCKETS ===")
        Array.from(evLaBuckets.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 50)
            .forEach(bucket => {
                console.log(
                    `[LIVE EVLA] EV=${bucket.evBin} LA=${bucket.laBin} N=${bucket.count} ` +
                    `H=${(bucket.hits / bucket.count).toFixed(3)} ` +
                    `HR=${(bucket.hr / bucket.count).toFixed(3)} ` +
                    `OUT=${(bucket.outs / bucket.count).toFixed(3)}`
                )
            })

        assert.ok(contactTotal > 0)
        assert.ok(totalBallsInPlay > 0)
    })

    it("default tuning should print batter outs versus runner advancement outs", () => {
        const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeTuning()
        } as PitchEnvironmentTuning

        const rng = seedrandom("default-batter-outs-versus-runner-outs-report")
        const games = evaluationGames

        const report = {
            games,
            totalRuns: 0,
            totalPlateAppearances: 0,
            batterOuts: 0,
            runnerOuts: 0,
            runnerOutsTryingToScore: 0,
            runnerOutsTryingExtraBase: 0,
            runnerScoringEvents: 0,
            runnerNonHrScoringEvents: 0,
            batterHrScoringEvents: 0,
            runnerOutsByStartEnd: new Map<string, number>(),
            runnerScoringByStartEnd: new Map<string, number>(),
            runnerOutsByPlayResult: new Map<string, number>(),
            runnerScoringByPlayResult: new Map<string, number>()
        }

        const bump = (map: Map<string, number>, key: string) => {
            map.set(key, (map.get(key) ?? 0) + 1)
        }

        const formatMap = (map: Map<string, number>) => {
            return Array.from(map.entries())
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .map(([key, value]) => ({ key, value }))
        }

        for (let gameIndex = 0; gameIndex < games; gameIndex++) {
            const game = playerImporterService.buildStartedBaselineGame(
                clone(testPitchEnvironment),
                `default-batter-runner-out-report-${gameIndex}`
            )

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            report.totalRuns += game.score.away + game.score.home

            for (const play of game.halfInnings.flatMap(halfInning => halfInning.plays)) {
                report.totalPlateAppearances++

                for (const event of play.runner?.events ?? []) {
                    const isBatterEvent = event.runner?._id === play.hitterId
                    const startEnd = `${event.movement?.start ?? "?"}->${event.movement?.end ?? "?"}`
                    const playResult = String(play.result)

                    if (event.movement?.isOut) {
                        if (isBatterEvent) {
                            report.batterOuts++
                        } else {
                            report.runnerOuts++
                            bump(report.runnerOutsByStartEnd, startEnd)
                            bump(report.runnerOutsByPlayResult, playResult)

                            if (event.movement?.end === BaseResult.HOME || event.movement?.outBase === BaseResult.HOME) {
                                report.runnerOutsTryingToScore++
                            } else {
                                report.runnerOutsTryingExtraBase++
                            }
                        }
                    }

                    if (event.isScoringEvent) {
                        report.runnerScoringEvents++

                        if (isBatterEvent && play.result === PlayResult.HR) {
                            report.batterHrScoringEvents++
                        } else {
                            report.runnerNonHrScoringEvents++
                            bump(report.runnerScoringByStartEnd, startEnd)
                            bump(report.runnerScoringByPlayResult, playResult)
                        }
                    }
                }
            }
        }

        console.log("[DEFAULT BATTER OUTS VS RUNNER OUTS]", {
            games,
            teamRunsPerGame: report.totalRuns / games / 2,
            paPerTeamGame: report.totalPlateAppearances / games / 2,
            batterOutsPerTeamGame: report.batterOuts / games / 2,
            runnerOutsPerTeamGame: report.runnerOuts / games / 2,
            runnerOutsTryingToScorePerTeamGame: report.runnerOutsTryingToScore / games / 2,
            runnerOutsTryingExtraBasePerTeamGame: report.runnerOutsTryingExtraBase / games / 2,
            runnerScoringEventsPerTeamGame: report.runnerScoringEvents / games / 2,
            runnerNonHrScoringEventsPerTeamGame: report.runnerNonHrScoringEvents / games / 2,
            batterHrScoringEventsPerTeamGame: report.batterHrScoringEvents / games / 2
        })

        console.log("[DEFAULT RUNNER OUTS BY START END]", formatMap(report.runnerOutsByStartEnd))
        console.log("[DEFAULT RUNNER OUTS BY PLAY RESULT]", formatMap(report.runnerOutsByPlayResult))
        console.log("[DEFAULT RUNNER SCORING BY START END]", formatMap(report.runnerScoringByStartEnd))
        console.log("[DEFAULT RUNNER SCORING BY PLAY RESULT]", formatMap(report.runnerScoringByPlayResult))

        assert.ok(report.totalRuns > 0)
        assert.ok(report.totalPlateAppearances > 0)
    })

    it("default tuning should print runner advancement run conversion report", () => {
        const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeTuning()
        } as PitchEnvironmentTuning

        const rng = seedrandom("default-runner-advancement-run-conversion-report")
        const games = evaluationGames

        const report = {
            games,
            totalRuns: 0,
            totalPlateAppearances: 0,
            totalLeftOnBase: 0,

            byPlayResult: new Map<string, { plays: number, runs: number, scoredEvents: number }>(),
            byRunnerEvent: new Map<string, { events: number, scored: number, outs: number }>(),
            byStartEnd: new Map<string, { events: number, scored: number, outs: number }>(),

            scoringEvents: {
                thirdToHome: 0,
                secondToHome: 0,
                firstToHome: 0,
                hitterHome: 0
            },

            advancementEvents: {
                firstToThird: 0,
                secondToHomeOnSingle: 0,
                firstToHomeOnDouble: 0,
                thirdToHomeOnFlyOut: 0,
                thirdToHomeOnGroundBall: 0
            },

            outsOnBases: {
                home: 0,
                first: 0,
                second: 0,
                third: 0
            }
        }

        const bumpPlayResult = (playResult: PlayResult, runs: number, scoredEvents: number) => {
            const key = String(playResult)

            if (!report.byPlayResult.has(key)) {
                report.byPlayResult.set(key, { plays: 0, runs: 0, scoredEvents: 0 })
            }

            const row = report.byPlayResult.get(key)!
            row.plays++
            row.runs += runs
            row.scoredEvents += scoredEvents
        }

        const bumpRunnerEvent = (key: string, event: RunnerEvent) => {
            if (!report.byRunnerEvent.has(key)) {
                report.byRunnerEvent.set(key, { events: 0, scored: 0, outs: 0 })
            }

            const row = report.byRunnerEvent.get(key)!
            row.events++
            if (event.isScoringEvent) row.scored++
            if (event.movement?.isOut) row.outs++
        }

        const bumpStartEnd = (event: RunnerEvent) => {
            const key = `${event.movement?.start ?? "?"}->${event.movement?.end ?? "?"}`

            if (!report.byStartEnd.has(key)) {
                report.byStartEnd.set(key, { events: 0, scored: 0, outs: 0 })
            }

            const row = report.byStartEnd.get(key)!
            row.events++
            if (event.isScoringEvent) row.scored++
            if (event.movement?.isOut) row.outs++
        }

        for (let gameIndex = 0; gameIndex < games; gameIndex++) {
            const game = playerImporterService.buildStartedBaselineGame(
                clone(testPitchEnvironment),
                `default-runner-advancement-report-${gameIndex}`
            )

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            report.totalRuns += game.score.away + game.score.home

            for (const halfInning of game.halfInnings) {
                const plays = halfInning.plays ?? []
                const finalPlay = plays[plays.length - 1]
                const finalEnd = finalPlay?.runner?.result?.end

                if (finalEnd?.first) report.totalLeftOnBase++
                if (finalEnd?.second) report.totalLeftOnBase++
                if (finalEnd?.third) report.totalLeftOnBase++

                for (const play of plays) {
                    const events = play.runner?.events ?? []
                    const scoredEvents = events.filter((event: RunnerEvent) => event.isScoringEvent).length
                    const runs = play.runner?.result?.end?.scored?.length ?? scoredEvents

                    report.totalPlateAppearances++

                    bumpPlayResult(play.result, runs, scoredEvents)

                    for (const event of events) {
                        bumpRunnerEvent(String(event.eventType ?? play.result), event)
                        bumpStartEnd(event)

                        if (event.isScoringEvent && event.movement?.start === BaseResult.THIRD && event.movement?.end === BaseResult.HOME) {
                            report.scoringEvents.thirdToHome++
                        }

                        if (event.isScoringEvent && event.movement?.start === BaseResult.SECOND && event.movement?.end === BaseResult.HOME) {
                            report.scoringEvents.secondToHome++
                        }

                        if (event.isScoringEvent && event.movement?.start === BaseResult.FIRST && event.movement?.end === BaseResult.HOME) {
                            report.scoringEvents.firstToHome++
                        }

                        if (event.isScoringEvent && event.movement?.start === BaseResult.HOME && event.movement?.end === BaseResult.HOME) {
                            report.scoringEvents.hitterHome++
                        }

                        if (event.movement?.start === BaseResult.FIRST && event.movement?.end === BaseResult.THIRD) {
                            report.advancementEvents.firstToThird++
                        }

                        if (play.result === PlayResult.SINGLE && event.movement?.start === BaseResult.THIRD && event.movement?.end === BaseResult.HOME && event.eventType !== PlayResult.SINGLE) {
                            report.advancementEvents.secondToHomeOnSingle++
                        }

                        if (play.result === PlayResult.DOUBLE && event.movement?.start === BaseResult.THIRD && event.movement?.end === BaseResult.HOME && event.eventType !== PlayResult.DOUBLE) {
                            report.advancementEvents.firstToHomeOnDouble++
                        }

                        if (play.result === PlayResult.OUT && play.contact === Contact.FLY_BALL && event.movement?.start === BaseResult.THIRD && event.movement?.end === BaseResult.HOME) {
                            report.advancementEvents.thirdToHomeOnFlyOut++
                        }

                        if (play.result === PlayResult.OUT && play.contact === Contact.GROUNDBALL && event.movement?.start === BaseResult.THIRD && event.movement?.end === BaseResult.HOME) {
                            report.advancementEvents.thirdToHomeOnGroundBall++
                        }

                        if (event.movement?.isOut && event.movement?.outBase === BaseResult.HOME) report.outsOnBases.home++
                        if (event.movement?.isOut && event.movement?.outBase === BaseResult.FIRST) report.outsOnBases.first++
                        if (event.movement?.isOut && event.movement?.outBase === BaseResult.SECOND) report.outsOnBases.second++
                        if (event.movement?.isOut && event.movement?.outBase === BaseResult.THIRD) report.outsOnBases.third++
                    }
                }
            }
        }

        const formatMap = (map: Map<string, any>) => {
            return Array.from(map.entries())
                .sort((a, b) => b[1].events - a[1].events || String(a[0]).localeCompare(String(b[0])))
                .map(([key, row]) => ({ key, ...row }))
        }

        console.log("[DEFAULT RUNNER ADVANCEMENT RUN CONVERSION]", {
            games,
            teamRunsPerGame: report.totalRuns / games / 2,
            leftOnBasePerTeamGame: report.totalLeftOnBase / games / 2,
            paPerTeamGame: report.totalPlateAppearances / games / 2,
            scoringEventsPerTeamGame: Object.values(report.scoringEvents).reduce((sum, value) => sum + value, 0) / games / 2,
            scoringEvents: report.scoringEvents,
            advancementEvents: report.advancementEvents,
            outsOnBases: report.outsOnBases
        })

        console.log("[DEFAULT RUNNER ADVANCEMENT BY PLAY RESULT]", formatMap(report.byPlayResult))
        console.log("[DEFAULT RUNNER ADVANCEMENT BY EVENT TYPE]", formatMap(report.byRunnerEvent))
        console.log("[DEFAULT RUNNER ADVANCEMENT BY START END]", formatMap(report.byStartEnd))

        assert.ok(report.totalRuns > 0)
        assert.ok(report.totalPlateAppearances > 0)
    })

    it("default tuning should print baseline offense", () => {
        const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeTuning()
        } as PitchEnvironmentTuning

        const evaluation = playerImporterService.evaluatePitchEnvironment(
            testPitchEnvironment,
            seedrandom("default-tuning-baseline-250"),
            evaluationGames
        )

        console.log("[DEFAULT TUNING BASELINE]", {
            runs: evaluation.actual.teamRunsPerGame,
            targetRuns: evaluation.target.teamRunsPerGame,
            avg: evaluation.actual.avg,
            targetAvg: evaluation.target.avg,
            obp: evaluation.actual.obp,
            targetObp: evaluation.target.obp,
            slg: evaluation.actual.slg,
            targetSlg: evaluation.target.slg,
            babip: evaluation.actual.babip,
            targetBabip: evaluation.target.babip,
            soPercent: evaluation.actual.soPercent,
            targetSoPercent: evaluation.target.soPercent,
            bbPercent: evaluation.actual.bbPercent,
            targetBbPercent: evaluation.target.bbPercent,
            homeRunPercent: evaluation.actual.homeRunPercent,
            targetHomeRunPercent: evaluation.target.homeRunPercent,
            pitchesPerPA: evaluation.actual.pitchesPerPA,
            targetPitchesPerPA: evaluation.target.pitchesPerPA
        })

        assert.ok(evaluation.actual.teamRunsPerGame > 0)
        assert.ok(Number.isFinite(evaluation.actual.teamRunsPerGame))
        assert.ok(Number.isFinite(evaluation.actual.avg))
        assert.ok(Number.isFinite(evaluation.actual.obp))
        assert.ok(Number.isFinite(evaluation.actual.slg))
    })

    it("default tuning should print result rates by count", () => {
        const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeTuning()
        } as PitchEnvironmentTuning

        const rng = seedrandom("default-tuning-count-result-report")
        const games = evaluationGames

        const countRows = new Map<string, {
            pitches: number
            paEndingHere: number
            balls: number
            calledStrikes: number
            swingingStrikes: number
            fouls: number
            inPlay: number
            bb: number
            hbp: number
            so: number
            hits: number
            outs: number
            hr: number
            swings: number
            takes: number
            inZone: number
            outZone: number
            contact: number
        }>()

        const getRow = (count: string) => {
            if (!countRows.has(count)) {
                countRows.set(count, {
                    pitches: 0,
                    paEndingHere: 0,
                    balls: 0,
                    calledStrikes: 0,
                    swingingStrikes: 0,
                    fouls: 0,
                    inPlay: 0,
                    bb: 0,
                    hbp: 0,
                    so: 0,
                    hits: 0,
                    outs: 0,
                    hr: 0,
                    swings: 0,
                    takes: 0,
                    inZone: 0,
                    outZone: 0,
                    contact: 0
                })
            }

            return countRows.get(count)!
        }

        const getCountKey = (balls: number, strikes: number): string => `${balls}-${strikes}`

        const applyPitchToCount = (pitch: any, count: { balls: number, strikes: number }) => {
            if (pitch.result === PitchCall.BALL) {
                count.balls++
                return
            }

            if (pitch.result === PitchCall.STRIKE) {
                count.strikes++
                return
            }

            if (pitch.result === PitchCall.FOUL && count.strikes < 2) {
                count.strikes++
                return
            }
        }

        for (let gameIndex = 0; gameIndex < games; gameIndex++) {
            const game = playerImporterService.buildStartedBaselineGame(
                clone(testPitchEnvironment),
                `default-count-result-report-${gameIndex}`
            )

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            for (const play of game.halfInnings.flatMap(halfInning => halfInning.plays)) {
                const pitches = play.pitchLog?.pitches ?? []

                let balls = play.count?.start?.balls ?? 0
                let strikes = play.count?.start?.strikes ?? 0
                let finalPitchCountKey = getCountKey(balls, strikes)

                for (const pitch of pitches) {
                    const countKey = getCountKey(balls, strikes)
                    const row = getRow(countKey)

                    finalPitchCountKey = countKey

                    row.pitches++

                    if (pitch.swing) row.swings++
                    else row.takes++

                    if (pitch.inZone) row.inZone++
                    else row.outZone++

                    if (pitch.con || pitch.contactQuality) row.contact++

                    if (pitch.result === PitchCall.BALL) row.balls++
                    else if (pitch.result === PitchCall.STRIKE && pitch.swing) row.swingingStrikes++
                    else if (pitch.result === PitchCall.STRIKE) row.calledStrikes++
                    else if (pitch.result === PitchCall.FOUL) row.fouls++
                    else if (pitch.result === PitchCall.IN_PLAY) row.inPlay++

                    applyPitchToCount(pitch, { get balls() { return balls }, set balls(value) { balls = value }, get strikes() { return strikes }, set strikes(value) { strikes = value } })
                }

                const finalRow = getRow(finalPitchCountKey)
                finalRow.paEndingHere++

                if (play.result === PlayResult.BB) finalRow.bb++
                if (play.result === PlayResult.HIT_BY_PITCH) finalRow.hbp++
                if (play.result === PlayResult.STRIKEOUT) finalRow.so++
                if (play.result === PlayResult.OUT) finalRow.outs++

                if (
                    play.result === PlayResult.SINGLE ||
                    play.result === PlayResult.DOUBLE ||
                    play.result === PlayResult.TRIPLE ||
                    play.result === PlayResult.HR
                ) {
                    finalRow.hits++
                }

                if (play.result === PlayResult.HR) finalRow.hr++
            }
        }

        const preferredOrder = [
            "0-0", "1-0", "2-0", "3-0",
            "0-1", "1-1", "2-1", "3-1",
            "0-2", "1-2", "2-2", "3-2"
        ]

        const rows = preferredOrder
            .filter(count => countRows.has(count))
            .map(count => {
                const row = countRows.get(count)!
                const zonePitches = row.inZone + row.outZone
                const swingDenominator = row.swings + row.takes
                const contactDenominator = row.swings

                return {
                    count,
                    pitches: row.pitches,
                    paEndingHere: row.paEndingHere,
                    swingRate: swingDenominator > 0 ? row.swings / swingDenominator : 0,
                    zoneRate: zonePitches > 0 ? row.inZone / zonePitches : 0,
                    contactRate: contactDenominator > 0 ? row.contact / contactDenominator : 0,
                    ballRate: row.pitches > 0 ? row.balls / row.pitches : 0,
                    calledStrikeRate: row.pitches > 0 ? row.calledStrikes / row.pitches : 0,
                    swingingStrikeRate: row.pitches > 0 ? row.swingingStrikes / row.pitches : 0,
                    foulRate: row.pitches > 0 ? row.fouls / row.pitches : 0,
                    inPlayRate: row.pitches > 0 ? row.inPlay / row.pitches : 0,
                    bbPerPAEndingHere: row.paEndingHere > 0 ? row.bb / row.paEndingHere : 0,
                    hbpPerPAEndingHere: row.paEndingHere > 0 ? row.hbp / row.paEndingHere : 0,
                    soPerPAEndingHere: row.paEndingHere > 0 ? row.so / row.paEndingHere : 0,
                    hitPerPAEndingHere: row.paEndingHere > 0 ? row.hits / row.paEndingHere : 0,
                    hrPerPAEndingHere: row.paEndingHere > 0 ? row.hr / row.paEndingHere : 0,
                    outPerPAEndingHere: row.paEndingHere > 0 ? row.outs / row.paEndingHere : 0,
                    raw: row
                }
            })

        console.log("=== DEFAULT RESULT RATES BY COUNT ===")
        for (const row of rows) {
            console.log(row)
        }

        assert.ok(rows.length > 0)
    }) 

    it("disabled meta tuning should print sampled trajectory vs final logged contact", () => {
        const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeDisabledMetaTuning()
        } as PitchEnvironmentTuning

        const rng = seedrandom("disabled-meta-sampled-vs-final-contact")
        const games = evaluationGames

        const getSampledTrajectory = (hitQuality: any): string => {
            const evBin = Math.floor(hitQuality.exitVelocity / 2) * 2
            const laBin = Math.floor(hitQuality.launchAngle / 2) * 2

            const matches = testPitchEnvironment.battedBall.xy.byTrajectoryEvLa.filter((row: any) =>
                Number(row.evBin) === evBin &&
                Number(row.laBin) === laBin
            )

            if (matches.length === 1) return matches[0].trajectory

            const trajectoryCounts = matches.reduce((acc: any, row: any) => {
                acc[row.trajectory] = (acc[row.trajectory] ?? 0) + Number(row.count ?? 0)
                return acc
            }, {})

            const best = Object.entries(trajectoryCounts)
                .sort((a: any, b: any) => b[1] - a[1])[0]

            if (best) return best[0] as string

            if (laBin < 0) return "groundBall"
            if (laBin < 24) return "lineDrive"
            return "flyBall"
        }

        const report = new Map<string, {
            count: number
            out: number
            single: number
            double: number
            triple: number
            hr: number
        }>()

        const bump = (key: string, result: PlayResult) => {
            if (!report.has(key)) {
                report.set(key, {
                    count: 0,
                    out: 0,
                    single: 0,
                    double: 0,
                    triple: 0,
                    hr: 0
                })
            }

            const row = report.get(key)!
            row.count++

            if (result === PlayResult.OUT) row.out++
            else if (result === PlayResult.SINGLE) row.single++
            else if (result === PlayResult.DOUBLE) row.double++
            else if (result === PlayResult.TRIPLE) row.triple++
            else if (result === PlayResult.HR) row.hr++
        }

        for (let gameIndex = 0; gameIndex < games; gameIndex++) {
            const game = playerImporterService.buildStartedBaselineGame(
                clone(testPitchEnvironment),
                `disabled-meta-sampled-vs-final-contact-${gameIndex}`
            )

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            for (const play of game.halfInnings.flatMap(halfInning => halfInning.plays)) {
                const pitchWithContactQuality = play.pitchLog?.pitches?.find((pitch: any) => pitch.contactQuality)

                if (!pitchWithContactQuality?.contactQuality) continue

                const sampledTrajectory = getSampledTrajectory(pitchWithContactQuality.contactQuality)
                const finalContact = play.contact

                bump(`${sampledTrajectory} -> ${finalContact}`, play.result)
            }
        }

        console.log("\n=== SAMPLED TRAJECTORY VS FINAL CONTACT ===")

        Array.from(report.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .forEach(([key, row]) => {
                const hit = row.single + row.double + row.triple + row.hr
                const bip = row.out + row.single + row.double + row.triple
                const babip = bip > 0 ? (row.single + row.double + row.triple) / bip : 0
                const hrRate = row.hr / row.count

                console.log(`[${key}]`, {
                    count: row.count,
                    out: Number((row.out / row.count).toFixed(3)),
                    hit: Number((hit / row.count).toFixed(3)),
                    hr: Number(hrRate.toFixed(3)),
                    babip: Number(babip.toFixed(3)),
                    raw: row
                })
            })

        assert.ok(report.size > 0)
    })

    it("manual high-offense full game should print available evaluation pipeline rates", () => {
        const evaluation = evaluateManualTuning("high-offense-debug", HIGH_OFFENSE_TUNING)
        const actual = evaluation.actual

        console.log("[HIGH OFFENSE PIPELINE]", {
            runs: actual.teamRunsPerGame,
            avg: actual.avg,
            obp: actual.obp,
            slg: actual.slg,
            ops: actual.ops,
            babip: actual.babip,
            pitchesPerPA: actual.pitchesPerPA,
            soPercent: actual.soPercent,
            bbPercent: actual.bbPercent,
            hbpPercent: actual.hbpPercent,
            singlePercent: actual.singlePercent,
            doublePercent: actual.doublePercent,
            triplePercent: actual.triplePercent,
            homeRunPercent: actual.homeRunPercent,
            teamHitsPerGame: actual.teamHitsPerGame,
            teamHomeRunsPerGame: actual.teamHomeRunsPerGame,
            teamBBPerGame: actual.teamBBPerGame,
            teamSOPerGame: actual.teamSOPerGame,
            targetRuns: evaluation.target.teamRunsPerGame
        })

        assert.ok(Number.isFinite(actual.teamRunsPerGame))
        assert.ok(Number.isFinite(actual.avg))
        assert.ok(Number.isFinite(actual.babip))
        assert.ok(Number.isFinite(actual.soPercent))
        assert.ok(Number.isFinite(actual.homeRunPercent))
    })

    it("manual high-offense tuning should be able to get near target runs", () => {
        const evaluation = evaluateManualTuning("high-offense", HIGH_OFFENSE_TUNING)

        assert.ok(
            evaluation.actual.teamRunsPerGame > evaluation.target.teamRunsPerGame - 0.5,
            `Expected high-offense tuning to get near target R/G. actual=${evaluation.actual.teamRunsPerGame} target=${evaluation.target.teamRunsPerGame}`
        )
    })

    it("manual low-offense tuning should be able to stay below target", () => {
        const evaluation = evaluateManualTuning("low-offense", LOW_OFFENSE_TUNING)

        console.log("[MANUAL LOW-OFFENSE]", {
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
            targetRuns: evaluation.target.teamRunsPerGame
        })

        assert.ok(
            evaluation.actual.teamRunsPerGame < evaluation.target.teamRunsPerGame,
            `Expected low-offense tuning to stay below target R/G. actual=${evaluation.actual.teamRunsPerGame} target=${evaluation.target.teamRunsPerGame}`
        )
    })

    it("getOutcomeModelForContactQuality should return the exact EV/LA bucket when pitch-quality shifting is disabled", () => {
        const pitchEnvironmentTarget = {
            pitchEnvironmentTuning: {
                tuning: makeDisabledMetaTuning()
            },
            battedBall: {
                outcomeByEvLa: [
                    { evBin: 100, laBin: 20, count: 10, out: 4, single: 3, double: 2, triple: 0, hr: 1 }
                ]
            }
        } as any

        const contactQuality = {
            exitVelocity: 101.9,
            launchAngle: 21.9
        } as any

        const model = (simService as any).getOutcomeModelForContactQuality(
            pitchEnvironmentTarget,
            contactQuality,
            Contact.LINE_DRIVE,
            0
        )

        assert.strictEqual(model.evBin, 100)
        assert.strictEqual(model.laBin, 20)
        assert.strictEqual(model.count, 10)
        assert.strictEqual(model.out, 4)
        assert.strictEqual(model.single, 3)
        assert.strictEqual(model.double, 2)
        assert.strictEqual(model.triple, 0)
        assert.strictEqual(model.hr, 1)
        assert.strictEqual(model.expectedBases, (3 + (2 * 2) + (1 * 4)) / 10)
    })

    it("getOutcomeModelForContactQuality should use the nearest EV/LA bucket when the exact bucket is missing", () => {
        const pitchEnvironmentTarget = {
            pitchEnvironmentTuning: {
                tuning: makeDisabledMetaTuning()
            },
            battedBall: {
                outcomeByEvLa: [
                    { evBin: 98, laBin: 18, count: 10, out: 5, single: 3, double: 1, triple: 0, hr: 1 }
                ]
            }
        } as any

        const contactQuality = {
            exitVelocity: 101.0,
            launchAngle: 21.0
        } as any

        const model = (simService as any).getOutcomeModelForContactQuality(
            pitchEnvironmentTarget,
            contactQuality,
            Contact.LINE_DRIVE,
            0
        )

        assert.strictEqual(model.evBin, 98)
        assert.strictEqual(model.laBin, 18)
        assert.strictEqual(model.count, 10)
        assert.strictEqual(model.out, 5)
        assert.strictEqual(model.single, 3)
        assert.strictEqual(model.double, 1)
        assert.strictEqual(model.triple, 0)
        assert.strictEqual(model.hr, 1)
    })

    it("getPlayResultFromOutcomeModel should map cumulative ranges exactly", () => {
        const model = {
            count: 10,
            out: 2,
            single: 3,
            double: 2,
            triple: 1,
            hr: 2
        }

        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.0), PlayResult.OUT)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.199999), PlayResult.OUT)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.2), PlayResult.SINGLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.499999), PlayResult.SINGLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.5), PlayResult.DOUBLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.699999), PlayResult.DOUBLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.7), PlayResult.TRIPLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.799999), PlayResult.TRIPLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.8), PlayResult.HR)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.999999), PlayResult.HR)
    })

    it("getPlayResultFromOutcomeModel should support fractional outcome weights", () => {
        const model = {
            count: 1,
            out: 0.5,
            single: 0.25,
            double: 0.125,
            triple: 0.075,
            hr: 0.05
        }

        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.0), PlayResult.OUT)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.499999), PlayResult.OUT)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.5), PlayResult.SINGLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.749999), PlayResult.SINGLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.75), PlayResult.DOUBLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.874999), PlayResult.DOUBLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.875), PlayResult.TRIPLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.949999), PlayResult.TRIPLE)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.95), PlayResult.HR)
        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.999999), PlayResult.HR)
    })

    it("getPlayResultFromOutcomeModel should return OUT when total is zero", () => {
        const model = {
            count: 0,
            out: 0,
            single: 0,
            double: 0,
            triple: 0,
            hr: 0
        }

        assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.5), PlayResult.OUT)
    })

    it("getHitQuality should produce a deterministic ground ball profile with disabled meta tuning", () => {
        const pitchEnvironmentTarget = {
            pitchEnvironmentTuning: {
                tuning: makeDisabledMetaTuning()
            },
            importReference: {
                hitter: {
                    physics: {
                        exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
                        launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
                        distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
                        byTrajectory: {
                            groundBall: {
                                exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
                                launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
                                distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
                            },
                            lineDrive: {
                                exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
                                launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
                                distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
                            },
                            flyBall: {
                                exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
                                launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
                                distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
                            }
                        }
                    }
                }
            },
            battedBall: {
                xy: {
                    byTrajectoryEvLa: [
                        { trajectory: "groundBall", evBin: 84, laBin: -6, xBin: 20, yBin: 60, count: 10 },
                        { trajectory: "groundBall", evBin: 84, laBin: -4, xBin: 10, yBin: 70, count: 10 },
                        { trajectory: "lineDrive", evBin: 94, laBin: 12, xBin: 0, yBin: 180, count: 10 },
                        { trajectory: "flyBall", evBin: 92, laBin: 32, xBin: 5, yBin: 260, count: 10 }
                    ],
                    byTrajectory: [
                        { trajectory: "groundBall", xBin: 15, yBin: 65, count: 50 },
                        { trajectory: "lineDrive", xBin: 0, yBin: 185, count: 50 },
                        { trajectory: "flyBall", xBin: 0, yBin: 255, count: 50 }
                    ]
                },
                spray: {
                    byTrajectoryEvLa: [
                        { trajectory: "groundBall", evBin: 84, laBin: -6, sprayBin: 12, count: 10 },
                        { trajectory: "groundBall", evBin: 84, laBin: -4, sprayBin: 8, count: 10 },
                        { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: 0, count: 10 },
                        { trajectory: "flyBall", evBin: 92, laBin: 32, sprayBin: 2, count: 10 }
                    ],
                    byTrajectory: [
                        { trajectory: "groundBall", sprayBin: 10, count: 50 },
                        { trajectory: "lineDrive", sprayBin: 0, count: 50 },
                        { trajectory: "flyBall", sprayBin: 0, count: 50 }
                    ]
                }
            }
        } as any

        const result = (simService as any).gameRolls.getHitQuality(() => 0.5, pitchEnvironmentTarget, 0, false, Contact.GROUNDBALL)

        assert.ok(Number.isFinite(result.exitVelocity))
        assert.ok(Number.isFinite(result.launchAngle))
        assert.ok(Number.isFinite(result.distance))
        assert.ok(Number.isFinite(result.coordX))
        assert.ok(Number.isFinite(result.coordY))
        assert.ok(result.launchAngle < 5)
        assert.ok(result.distance < 150)

        const evBin = Math.floor(result.exitVelocity / 2) * 2
        const laBin = Math.floor(result.launchAngle / 2) * 2

        assert.ok(evBin === 84 || evBin === 86)
        assert.ok(laBin === -6 || laBin === -4)
    })

    it("getHitQuality should produce a deterministic line drive profile with disabled meta tuning", () => {
        const pitchEnvironmentTarget = {
            pitchEnvironmentTuning: {
                tuning: makeDisabledMetaTuning()
            },
            importReference: {
                hitter: {
                    physics: {
                        exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
                        launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
                        distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
                        byTrajectory: {
                            groundBall: {
                                exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
                                launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
                                distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
                            },
                            lineDrive: {
                                exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
                                launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
                                distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
                            },
                            flyBall: {
                                exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
                                launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
                                distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
                            }
                        }
                    }
                }
            },
            battedBall: {
                xy: {
                    byTrajectoryEvLa: [
                        { trajectory: "groundBall", evBin: 84, laBin: -6, xBin: 20, yBin: 60, count: 10 },
                        { trajectory: "lineDrive", evBin: 94, laBin: 12, xBin: -10, yBin: 180, count: 10 },
                        { trajectory: "lineDrive", evBin: 96, laBin: 12, xBin: 0, yBin: 190, count: 10 },
                        { trajectory: "flyBall", evBin: 92, laBin: 32, xBin: 5, yBin: 260, count: 10 }
                    ],
                    byTrajectory: [
                        { trajectory: "groundBall", xBin: 15, yBin: 65, count: 50 },
                        { trajectory: "lineDrive", xBin: 0, yBin: 185, count: 50 },
                        { trajectory: "flyBall", xBin: 0, yBin: 255, count: 50 }
                    ]
                },
                spray: {
                    byTrajectoryEvLa: [
                        { trajectory: "groundBall", evBin: 84, laBin: -6, sprayBin: 12, count: 10 },
                        { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: -5, count: 10 },
                        { trajectory: "lineDrive", evBin: 96, laBin: 12, sprayBin: 0, count: 10 },
                        { trajectory: "flyBall", evBin: 92, laBin: 32, sprayBin: 2, count: 10 }
                    ],
                    byTrajectory: [
                        { trajectory: "groundBall", sprayBin: 10, count: 50 },
                        { trajectory: "lineDrive", sprayBin: 0, count: 50 },
                        { trajectory: "flyBall", sprayBin: 0, count: 50 }
                    ]
                }
            }
        } as any

        const result = (simService as any).gameRolls.getHitQuality(() => 0.5, pitchEnvironmentTarget, 0, false, Contact.LINE_DRIVE)

        assert.ok(Number.isFinite(result.exitVelocity))
        assert.ok(Number.isFinite(result.launchAngle))
        assert.ok(Number.isFinite(result.distance))
        assert.ok(Number.isFinite(result.coordX))
        assert.ok(Number.isFinite(result.coordY))
        assert.ok(result.launchAngle > 5)
        assert.ok(result.launchAngle < 20)
        assert.ok(result.distance > 150)

        const evBin = Math.floor(result.exitVelocity / 2) * 2
        const laBin = Math.floor(result.launchAngle / 2) * 2

        assert.ok(evBin === 94 || evBin === 96)
        assert.strictEqual(laBin, 12)
    })

    it("getHitQuality should produce a deterministic fly ball profile with disabled meta tuning", () => {
        const pitchEnvironmentTarget = {
            pitchEnvironmentTuning: {
                tuning: makeDisabledMetaTuning()
            },
            importReference: {
                hitter: {
                    physics: {
                        exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
                        launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
                        distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
                        byTrajectory: {
                            groundBall: {
                                exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
                                launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
                                distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
                            },
                            lineDrive: {
                                exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
                                launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
                                distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
                            },
                            flyBall: {
                                exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
                                launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
                                distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
                            }
                        }
                    }
                }
            },
            battedBall: {
                xy: {
                    byTrajectoryEvLa: [
                        { trajectory: "groundBall", evBin: 84, laBin: -6, xBin: 20, yBin: 60, count: 10 },
                        { trajectory: "lineDrive", evBin: 94, laBin: 12, xBin: -10, yBin: 180, count: 10 },
                        { trajectory: "flyBall", evBin: 92, laBin: 32, xBin: 5, yBin: 260, count: 10 },
                        { trajectory: "flyBall", evBin: 94, laBin: 32, xBin: 0, yBin: 270, count: 10 }
                    ],
                    byTrajectory: [
                        { trajectory: "groundBall", xBin: 15, yBin: 65, count: 50 },
                        { trajectory: "lineDrive", xBin: 0, yBin: 185, count: 50 },
                        { trajectory: "flyBall", xBin: 0, yBin: 255, count: 50 }
                    ]
                },
                spray: {
                    byTrajectoryEvLa: [
                        { trajectory: "groundBall", evBin: 84, laBin: -6, sprayBin: 12, count: 10 },
                        { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: -5, count: 10 },
                        { trajectory: "flyBall", evBin: 92, laBin: 32, sprayBin: 2, count: 10 },
                        { trajectory: "flyBall", evBin: 94, laBin: 32, sprayBin: 0, count: 10 }
                    ],
                    byTrajectory: [
                        { trajectory: "groundBall", sprayBin: 10, count: 50 },
                        { trajectory: "lineDrive", sprayBin: 0, count: 50 },
                        { trajectory: "flyBall", sprayBin: 0, count: 50 }
                    ]
                }
            }
        } as any

        const result = (simService as any).gameRolls.getHitQuality(() => 0.5, pitchEnvironmentTarget, 0, false, Contact.FLY_BALL)

        assert.ok(Number.isFinite(result.exitVelocity))
        assert.ok(Number.isFinite(result.launchAngle))
        assert.ok(Number.isFinite(result.distance))
        assert.ok(Number.isFinite(result.coordX))
        assert.ok(Number.isFinite(result.coordY))
        assert.ok(result.launchAngle > 20)
        assert.ok(result.distance > 220)
        assert.ok(result.coordY > 200)

        const evBin = Math.floor(result.exitVelocity / 2) * 2
        const laBin = Math.floor(result.launchAngle / 2) * 2

        assert.ok(evBin === 92 || evBin === 94)
        assert.strictEqual(laBin, 32)
    })

    it("getHitQuality should use spray fallback when xy data is missing", () => {
        const pitchEnvironmentTarget = {
            pitchEnvironmentTuning: {
                tuning: makeDisabledMetaTuning()
            },
            importReference: {
                hitter: {
                    physics: {
                        exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
                        launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
                        distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
                        byTrajectory: {
                            groundBall: {
                                exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
                                launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
                                distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
                            },
                            lineDrive: {
                                exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
                                launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
                                distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
                            },
                            flyBall: {
                                exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
                                launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
                                distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
                            }
                        }
                    }
                }
            },
            battedBall: {
                xy: {
                    byTrajectoryEvLa: [],
                    byTrajectory: []
                },
                spray: {
                    byTrajectoryEvLa: [
                        { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: 30, count: 10 }
                    ],
                    byTrajectory: [
                        { trajectory: "lineDrive", sprayBin: 30, count: 50 }
                    ]
                }
            }
        } as any

        const result = (simService as any).gameRolls.getHitQuality(() => 0.5, pitchEnvironmentTarget, 0, false, Contact.LINE_DRIVE)

        assert.ok(Number.isFinite(result.coordX))
        assert.ok(Number.isFinite(result.coordY))
        assert.ok(result.coordX > 0)
        assert.ok(result.coordY > 0)

        const reconstructedDistance = Math.sqrt((result.coordX * result.coordX) + (result.coordY * result.coordY))
        assert.ok(Math.abs(result.distance - reconstructedDistance) < 1e-9)
    })

    it("getHitQuality should not change EV LA or distance from tuning when pitchQualityChange is zero and guessPitch is false", () => {
        const basePitchEnvironmentTarget = {
            pitchEnvironmentTuning: {
                tuning: makeDisabledMetaTuning()
            },
            importReference: {
                hitter: {
                    physics: {
                        exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
                        launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
                        distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
                        byTrajectory: {
                            groundBall: {
                                exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
                                launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
                                distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
                            },
                            lineDrive: {
                                exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
                                launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
                                distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
                            },
                            flyBall: {
                                exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
                                launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
                                distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
                            }
                        }
                    }
                }
            },
            battedBall: {
                xy: {
                    byTrajectoryEvLa: [
                        { trajectory: "lineDrive", evBin: 94, laBin: 12, xBin: 0, yBin: 190, count: 10 },
                        { trajectory: "lineDrive", evBin: 96, laBin: 12, xBin: 0, yBin: 200, count: 10 }
                    ],
                    byTrajectory: [
                        { trajectory: "lineDrive", xBin: 0, yBin: 185, count: 50 }
                    ]
                },
                spray: {
                    byTrajectoryEvLa: [
                        { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: 0, count: 10 },
                        { trajectory: "lineDrive", evBin: 96, laBin: 12, sprayBin: 0, count: 10 }
                    ],
                    byTrajectory: [
                        { trajectory: "lineDrive", sprayBin: 0, count: 50 }
                    ]
                }
            }
        } as any

        const boostedPitchEnvironmentTarget = clone(basePitchEnvironmentTarget)
        boostedPitchEnvironmentTarget.pitchEnvironmentTuning.tuning.contactQuality.evScale = 3
        boostedPitchEnvironmentTarget.pitchEnvironmentTuning.tuning.contactQuality.laScale = 3
        boostedPitchEnvironmentTarget.pitchEnvironmentTuning.tuning.contactQuality.distanceScale = 3

        const baseResult = (simService as any).gameRolls.getHitQuality(() => 0.5, basePitchEnvironmentTarget, 0, false, Contact.LINE_DRIVE)
        const boostedResult = (simService as any).gameRolls.getHitQuality(() => 0.5, boostedPitchEnvironmentTarget, 0, false, Contact.LINE_DRIVE)

        assert.strictEqual(boostedResult.exitVelocity, baseResult.exitVelocity)
        assert.strictEqual(boostedResult.launchAngle, baseResult.launchAngle)
        assert.strictEqual(boostedResult.distance, baseResult.distance)
    })

    it("generated contact quality outcome models should print weighted expected offense from contact mix", () => {
        const testPitchEnvironment = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeDisabledMetaTuning()
        } as PitchEnvironmentTuning

        const sampleCount = 3000

        const contactWeights = [
            {
                contact: Contact.GROUNDBALL,
                name: "GROUNDBALL",
                weight: testPitchEnvironment.battedBall.contactRollInput.groundball
            },
            {
                contact: Contact.LINE_DRIVE,
                name: "LINE_DRIVE",
                weight: testPitchEnvironment.battedBall.contactRollInput.lineDrive
            },
            {
                contact: Contact.FLY_BALL,
                name: "FLY_BALL",
                weight: testPitchEnvironment.battedBall.contactRollInput.flyBall
            }
        ]

        const totalWeight = contactWeights.reduce((sum, row) => sum + row.weight, 0)

        let weightedOut = 0
        let weightedSingle = 0
        let weightedDouble = 0
        let weightedTriple = 0
        let weightedHr = 0

        for (const row of contactWeights) {
            const rng = seedrandom(`weighted-contact-quality-model-${row.name}`)

            let contactOut = 0
            let contactSingle = 0
            let contactDouble = 0
            let contactTriple = 0
            let contactHr = 0

            for (let i = 0; i < sampleCount; i++) {
                const hitQuality = (simService as any).gameRolls.getHitQuality(
                    rng,
                    testPitchEnvironment,
                    0,
                    false,
                    row.contact
                )

                const model = (simService as any).getOutcomeModelForContactQuality(
                    testPitchEnvironment,
                    hitQuality,
                    row.contact,
                    0
                )

                const modelTotal = model.out + model.single + model.double + model.triple + model.hr

                contactOut += model.out / modelTotal
                contactSingle += model.single / modelTotal
                contactDouble += model.double / modelTotal
                contactTriple += model.triple / modelTotal
                contactHr += model.hr / modelTotal
            }

            contactOut /= sampleCount
            contactSingle /= sampleCount
            contactDouble /= sampleCount
            contactTriple /= sampleCount
            contactHr /= sampleCount

            const contactBip = contactOut + contactSingle + contactDouble + contactTriple
            const contactBabip = contactBip > 0 ? (contactSingle + contactDouble + contactTriple) / contactBip : 0
            const contactAvg = contactSingle + contactDouble + contactTriple + contactHr
            const contactSlg = contactSingle + (contactDouble * 2) + (contactTriple * 3) + (contactHr * 4)

            const share = row.weight / totalWeight

            weightedOut += contactOut * share
            weightedSingle += contactSingle * share
            weightedDouble += contactDouble * share
            weightedTriple += contactTriple * share
            weightedHr += contactHr * share

            console.log(
                `[CONTACT MODEL WEIGHTED INPUT] ${row.name} ` +
                `WEIGHT=${row.weight} SHARE=${share.toFixed(3)} ` +
                `OUT=${contactOut.toFixed(3)} ` +
                `1B=${contactSingle.toFixed(3)} ` +
                `2B=${contactDouble.toFixed(3)} ` +
                `3B=${contactTriple.toFixed(3)} ` +
                `HR=${contactHr.toFixed(3)} ` +
                `AVG=${contactAvg.toFixed(3)} ` +
                `SLG=${contactSlg.toFixed(3)} ` +
                `BABIP=${contactBabip.toFixed(3)}`
            )
        }

        const weightedBip = weightedOut + weightedSingle + weightedDouble + weightedTriple
        const weightedBabip = weightedBip > 0 ? (weightedSingle + weightedDouble + weightedTriple) / weightedBip : 0
        const weightedAvg = weightedSingle + weightedDouble + weightedTriple + weightedHr
        const weightedSlg = weightedSingle + (weightedDouble * 2) + (weightedTriple * 3) + (weightedHr * 4)

        console.log("[CONTACT MODEL WEIGHTED TOTAL]", {
            contactRollInput: testPitchEnvironment.battedBall.contactRollInput,
            out: Number(weightedOut.toFixed(3)),
            single: Number(weightedSingle.toFixed(3)),
            double: Number(weightedDouble.toFixed(3)),
            triple: Number(weightedTriple.toFixed(3)),
            hr: Number(weightedHr.toFixed(3)),
            avgOnContact: Number(weightedAvg.toFixed(3)),
            slgOnContact: Number(weightedSlg.toFixed(3)),
            babip: Number(weightedBabip.toFixed(3))
        })

        assert.ok(weightedBabip > 0)
    })

    it("pitch environment trajectory physics should keep ground balls out of line-drive launch angles", () => {
        const physics = pitchEnvironment.importReference.hitter.physics.byTrajectory

        const rows = [
            { name: "groundBall", stats: physics.groundBall },
            { name: "lineDrive", stats: physics.lineDrive },
            { name: "flyBall", stats: physics.flyBall }
        ]

        for (const row of rows) {
            console.log(
                `[TRAJECTORY PHYSICS] ${row.name} ` +
                `EV avg=${row.stats.avgExitVelocity.toFixed(2)} ` +
                `LA avg=${row.stats.avgLaunchAngle.toFixed(2)} ` +
                `DIST avg=${row.stats.avgDistance.toFixed(2)} ` +
                `count=${row.stats.count}`
            )
        }

        assert.ok(physics.groundBall.avgLaunchAngle < 5)
        assert.ok(physics.lineDrive.avgLaunchAngle > physics.groundBall.avgLaunchAngle)
        assert.ok(physics.flyBall.avgLaunchAngle > physics.lineDrive.avgLaunchAngle)
    })

    it("getHitQuality ground balls should mostly sample ground-ball launch angles", () => {
        const testPitchEnvironment = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeDisabledMetaTuning()
        } as PitchEnvironmentTuning

        const sampleCount = 5000
        const rng = seedrandom("ground-ball-launch-angle-distribution")

        let belowZero = 0
        let zeroToFive = 0
        let fiveToTen = 0
        let tenToTwenty = 0
        let twentyPlus = 0
        let totalLaunchAngle = 0

        const buckets = new Map<number, number>()

        for (let i = 0; i < sampleCount; i++) {
            const hitQuality = (simService as any).gameRolls.getHitQuality(
                rng,
                testPitchEnvironment,
                0,
                false,
                Contact.GROUNDBALL
            )

            totalLaunchAngle += hitQuality.launchAngle

            if (hitQuality.launchAngle < 0) belowZero++
            else if (hitQuality.launchAngle < 5) zeroToFive++
            else if (hitQuality.launchAngle < 10) fiveToTen++
            else if (hitQuality.launchAngle < 20) tenToTwenty++
            else twentyPlus++

            const laBin = Math.floor(hitQuality.launchAngle / 2) * 2
            buckets.set(laBin, (buckets.get(laBin) ?? 0) + 1)
        }

        const avgLaunchAngle = totalLaunchAngle / sampleCount
        const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20)

        console.log(
            `[GROUND BALL LA DIST] avg=${avgLaunchAngle.toFixed(2)} ` +
            `<0=${(belowZero / sampleCount).toFixed(3)} ` +
            `0-5=${(zeroToFive / sampleCount).toFixed(3)} ` +
            `5-10=${(fiveToTen / sampleCount).toFixed(3)} ` +
            `10-20=${(tenToTwenty / sampleCount).toFixed(3)} ` +
            `20+=${(twentyPlus / sampleCount).toFixed(3)}`
        )

        for (const [laBin, count] of sortedBuckets) {
            console.log(`[GROUND BALL LA BUCKET] LA=${laBin} N=${count}`)
        }

        assert.ok(avgLaunchAngle < 5)
        assert.ok((tenToTwenty + twentyPlus) / sampleCount < 0.15)
    })

    it("getOutcomeModelForContactQuality should suppress ground ball home runs without inflating triples", () => {
        const pitchEnvironmentTarget = {
            pitchEnvironmentTuning: {
                tuning: makeDisabledMetaTuning()
            },
            battedBall: {
                outcomeByEvLa: [
                    { evBin: 90, laBin: -10, count: 100, out: 70, single: 15, double: 5, triple: 4, hr: 6 }
                ]
            }
        } as any

        const contactQuality = {
            exitVelocity: 90,
            launchAngle: -10
        } as any

        const model = (simService as any).getOutcomeModelForContactQuality(
            pitchEnvironmentTarget,
            contactQuality,
            Contact.GROUNDBALL,
            0
        )

        assert.strictEqual(model.hr, 0)
        assert.strictEqual(model.triple, 4)
        assert.strictEqual(model.out, 76)
        assert.strictEqual(model.single, 15)
        assert.strictEqual(model.double, 5)
        assert.strictEqual(model.count, 100)
    })

    it("defense tuning should print outcome sensitivity", async () => {
        const values = [-300, -200, -100, -50, 0, 50, 100, 200, 300]

        const evaluateDefense = (fullTeamDefenseBonus: number, fullFielderDefenseBonus: number) => {
            const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

            testPitchEnvironment.pitchEnvironmentTuning = {
                tuning: makeTuning({
                    contactQuality: {
                        evScale: -2.75,
                        laScale: -2.125,
                        distanceScale: -3,
                        homeRunOutcomeScale: 0,
                    },
                    swing: {
                        pitchQualityZoneSwingEffect: -4,
                        pitchQualityChaseSwingEffect: 0,
                        disciplineZoneSwingEffect: 2,
                        disciplineChaseSwingEffect: 5
                    },
                    contact: {
                        pitchQualityContactEffect: -8,
                        contactSkillEffect: -4
                    },
                    running: {
                        stealAttemptAggressionScale: 1.49
                    },
                    meta: {
                        fullPitchQualityBonus: 0,
                        fullTeamDefenseBonus,
                        fullFielderDefenseBonus
                    }
                })
            } as PitchEnvironmentTuning

            const evaluation = playerImporterService.evaluatePitchEnvironment(
                testPitchEnvironment,
                seedrandom(`defense-sensitivity-${fullTeamDefenseBonus}-${fullFielderDefenseBonus}-${evaluationGames}`),
                evaluationGames
            )

            return {
                fullTeamDefenseBonus,
                fullFielderDefenseBonus,
                effectiveTeamDefenseBonus:  fullTeamDefenseBonus,
                effectiveFielderDefenseBonus: fullFielderDefenseBonus,
                runs: evaluation.actual.teamRunsPerGame,
                runsDiff: evaluation.diff.teamRunsPerGame,
                avg: evaluation.actual.avg,
                avgDiff: evaluation.diff.avg,
                obp: evaluation.actual.obp,
                obpDiff: evaluation.diff.obp,
                slg: evaluation.actual.slg,
                slgDiff: evaluation.diff.slg,
                ops: evaluation.actual.ops,
                opsDiff: evaluation.diff.ops,
                babip: evaluation.actual.babip,
                babipDiff: evaluation.diff.babip,
                hitsPerGame: evaluation.actual.teamHitsPerGame,
                hitsPerGameDiff: evaluation.diff.teamHitsPerGame,
                homeRunsPerGame: evaluation.actual.teamHomeRunsPerGame,
                homeRunsPerGameDiff: evaluation.diff.teamHomeRunsPerGame,
                bbPerGame: evaluation.actual.teamBBPerGame,
                bbPerGameDiff: evaluation.diff.teamBBPerGame,
                singlePercent: evaluation.actual.singlePercent,
                singlePercentDiff: evaluation.diff.singlePercent,
                homeRunPercent: evaluation.actual.homeRunPercent,
                homeRunPercentDiff: evaluation.diff.homeRunPercent
            }
        }

        const paired = values.map(value => evaluateDefense(value, value))
        const teamOnly = values.map(value => evaluateDefense(value, 0))
        const fielderOnly = values.map(value => evaluateDefense(0, value))

        console.log("=== DEFENSE SENSITIVITY PAIRED ===")
        for (const row of paired) {
            console.log(row)
        }

        console.log("=== DEFENSE SENSITIVITY TEAM ONLY ===")
        for (const row of teamOnly) {
            console.log(row)
        }

        console.log("=== DEFENSE SENSITIVITY FIELDER ONLY ===")
        for (const row of fielderOnly) {
            console.log(row)
        }

        assert.ok(paired.length > 0)
        assert.ok(teamOnly.length > 0)
        assert.ok(fielderOnly.length > 0)
    })


    

})

const evaluateManualTuning = (name: string, tuning: PitchEnvironmentTuning["tuning"]) => {
    const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

    testPitchEnvironment.pitchEnvironmentTuning = {
        _id: `manual-${name}`,
        tuning
    }

    const evaluation = playerImporterService.evaluatePitchEnvironment(
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
        const game = playerImporterService.buildStartedBaselineGame(
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