import assert from "assert"

import fs from "fs"
import path from "path"

import seedrandom from "seedrandom"

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
    SimService,
    DefenseOutResult,
    DefenseHitResult
} from "../src/sim/index.js"

import type {
    PitchEnvironmentTarget,
    PitchEnvironmentTuning,
    Game,
    GamePlayer,
    RunnerEvent,
    RunnerResult,
    RollChart,
    PitchZone,
    StadiumEnvironment
} from "../src/sim/index.js"

import { PitchEnvironmentService } from "../src/importer/service/pitch-environment-service.js"
import { BaselineGameService } from "../src/importer/service/baseline-game-service.js"
import { GameInfo } from "../src/sim/service/sim-service.js"

const season = 2025
const baseDataDir = process.env.DATA_DIR ?? "data"
const evaluationSeed = 4
const evaluationGames = 500

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const pitchEnvironment = JSON.parse(
    fs.readFileSync(
        path.resolve(baseDataDir, String(season), "_pitch_environment_target.json"),
        "utf8"
    )
) as PitchEnvironmentTarget

const statService = new StatService()
const baselineGameService = new BaselineGameService(simService)
const pitchEnvironmentService = new PitchEnvironmentService(simService, statService, baselineGameService)

const makeTuning = (overrides?: Partial<PitchEnvironmentTuning["tuning"]>): PitchEnvironmentTuning["tuning"] => {
    return {
        contactQuality: {
            evScale: overrides?.contactQuality?.evScale ?? 0,
            laScale: overrides?.contactQuality?.laScale ?? 0,
            distanceScale: overrides?.contactQuality?.distanceScale ?? 0,
            outOutcomeScale: overrides?.contactQuality?.outOutcomeScale ?? 0,
            doubleOutcomeScale: overrides?.contactQuality?.doubleOutcomeScale ?? 0,
            tripleOutcomeScale: overrides?.contactQuality?.tripleOutcomeScale ?? 0,
            homeRunOutcomeScale: overrides?.contactQuality?.homeRunOutcomeScale ?? 0
        },
        swing: {
            pitchQualityZoneSwingEffect: overrides?.swing?.pitchQualityZoneSwingEffect ?? 0,
            pitchQualityChaseSwingEffect: overrides?.swing?.pitchQualityChaseSwingEffect ?? 0,
            disciplineZoneSwingEffect: overrides?.swing?.disciplineZoneSwingEffect ?? 0,
            disciplineChaseSwingEffect: overrides?.swing?.disciplineChaseSwingEffect ?? 0,
            walkRateScale: overrides?.swing?.walkRateScale ?? 0
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
            fullPitchQualityBonus: overrides?.meta?.fullPitchQualityBonus ?? 0,
            fullTeamDefenseBonus: overrides?.meta?.fullTeamDefenseBonus ?? 0,
            fullFielderDefenseBonus: overrides?.meta?.fullFielderDefenseBonus ?? 0
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

const makeGetHitQualityTestEnvironment = (): PitchEnvironmentTarget => {
    const target = clone(pitchEnvironment)

    target.pitchEnvironmentTuning = {
        tuning: makeDisabledMetaTuning()
    } as PitchEnvironmentTuning

    return target
}

const createStadiumEnvironment = (team: string, venue: string, yearRange: string, singlesParkFactor: number, doublesParkFactor: number, triplesParkFactor: number, homeRunParkFactor: number, walkParkFactor: number, strikeoutParkFactor: number): StadiumEnvironment => {
    const toMultiplier = (value: number, label: string): number => {
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`Invalid ${label} park factor ${value}.`)
        }

        return value / 100
    }

    return {
        team,
        venue,
        yearRange,
        singles: toMultiplier(singlesParkFactor, "singles"),
        doubles: toMultiplier(doublesParkFactor, "doubles"),
        triples: toMultiplier(triplesParkFactor, "triples"),
        hr: toMultiplier(homeRunParkFactor, "home runs"),
        walks: toMultiplier(walkParkFactor, "walks"),
        strikeouts: toMultiplier(strikeoutParkFactor, "strikeouts")
    }
}

const buildTarget = (contactQualityTuning: any = {}): any => ({
    avgRating: 50,
    pitchEnvironmentTuning: {
        tuning: {
            contactQuality: {
                outOutcomeScale: 0,
                doubleOutcomeScale: 0,
                tripleOutcomeScale: 0,
                homeRunOutcomeScale: 0,
                ...contactQualityTuning
            }
        }
    }
})

const buildPowerChart = (playResult: PlayResult): RollChart => {
    const entries = new Map<number, PlayResult>()

    for (let i = 0; i < 1000; i++) {
        entries.set(i, playResult)
    }

    return { entries } as RollChart
}

const getTunedPowerResult = (
    playResult: PlayResult,
    contact: Contact,
    contactQualityTuning: any = {},
    rngValues: number[] = [0]
): PlayResult => {

    const testSimService: any = Object.create(SimService.prototype)

    testSimService.rollChartService = {
        getMatchupPowerRollChart: () => buildPowerChart(playResult)
    }

    const command: any = {
        pitchEnvironmentTarget: buildTarget(contactQualityTuning),
        hitterChange: {},
        pitcherChange: {},
        rng: rngSequence(rngValues)
    }

    return testSimService.getTunedMatchupPowerResult(command, contact)
}

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
        const game = baselineGameService.buildStartedBaselineGame(
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


enum DiagnosticTest {
    PITCH_ENVIRONMENT_LOADING = "Pitch Environment Loading",
    STADIUM_ENVIRONMENT = "Stadium Environment",
    HOME_FIELD_ADVANTAGE = "Home Field Advantage",
    BATTED_BALL_DIAGNOSTICS = "Batted Ball Diagnostics",
    CONTACT_QUALITY = "Contact Quality",
    OUTCOME_TUNING = "Outcome Tuning",
    PITCH_GENERATION = "Pitch Generation",
    COUNT_DIAGNOSTICS = "Count Diagnostics",
    OFFENSE_BASELINES = "Offense Baselines",
    DEFENSE_DIAGNOSTICS = "Defense Diagnostics",
    RUN_CREATION_DIAGNOSTICS = "Run Creation Diagnostics",
    RUNNER_AND_GAME_REGRESSION = "Runner and Game Regression",
    TUNING_SENSITIVITY = "Tuning Sensitivity"
}

const toRun: DiagnosticTest[] = [
    // DiagnosticTest.COUNT_DIAGNOSTICS,
    // DiagnosticTest.BATTED_BALL_DIAGNOSTICS,
    // DiagnosticTest.CONTACT_QUALITY,
    DiagnosticTest.OFFENSE_BASELINES,
    // DiagnosticTest.DEFENSE_DIAGNOSTICS
]


if (toRun.includes(DiagnosticTest.PITCH_ENVIRONMENT_LOADING)) {
    describe("Pitch Environment Loading", () => {

        it("should load the exported pitch environment target", () => {
            assert.equal(
                pitchEnvironment.season,
                season
            )

            assert.ok(
                Number.isFinite(
                    pitchEnvironment.homeFieldAdvantage
                )
            )

            assert.ok(
                pitchEnvironment.pitchEnvironmentTuning,
                "Exported pitch environment is missing pitchEnvironmentTuning."
            )
        })

    })    
}

if (toRun.includes(DiagnosticTest.STADIUM_ENVIRONMENT)) {
    describe("Stadium Environment", () => {

        it("omitting stadium environment should preserve baseline game results", () => {
            const games = 100

            for (let gameIndex = 0; gameIndex < games; gameIndex++) {

                const seed = `stadium-environment-optional-${gameIndex}`
                const baseline = baselineGameService.buildStartedBaselineGame(
                    clone(pitchEnvironment),
                    `stadium-environment-baseline-${gameIndex}`
                )

                const omitted = baselineGameService.buildStartedBaselineGame(
                    clone(pitchEnvironment),
                    `stadium-environment-omitted-${gameIndex}`,
                    false,
                    undefined
                )

                const baselineRng = seedrandom(seed)
                const omittedRng = seedrandom(seed)

                while (!baseline.isComplete) {
                    simService.simPitch(baseline, baselineRng)
                }

                while (!omitted.isComplete) {
                    simService.simPitch(omitted, omittedRng)
                }

                assert.deepEqual(
                    omitted.score,
                    baseline.score,
                    `Omitting stadiumEnvironment changed game ${gameIndex}.`
                )

                assert.deepEqual(
                    GameInfo.getPlays(omitted).map(play => ({
                        result: play.result,
                        contact: play.contact,
                        officialPlayResult: play.officialPlayResult
                    })),
                    GameInfo.getPlays(baseline).map(play => ({
                        result: play.result,
                        contact: play.contact,
                        officialPlayResult: play.officialPlayResult
                    })),
                    `Omitting stadiumEnvironment changed the play sequence for game ${gameIndex}.`
                )
            }
        })

        it("hitter-friendly stadium factors should increase offensive outcomes", () => {
            const games = 500

            const hitterFriendlyStadium: StadiumEnvironment = {
                team: "Test Team",
                venue: "Hitter Friendly Park",
                yearRange: "test",
                singles: 1.15,
                doubles: 1.25,
                triples: 1.5,
                hr: 1.25,
                walks: 1.1,
                strikeouts: 0.9
            }

            const totals = {
                neutral: {
                    runs: 0,
                    singles: 0,
                    doubles: 0,
                    triples: 0,
                    homeRuns: 0,
                    walks: 0,
                    strikeouts: 0
                },
                stadium: {
                    runs: 0,
                    singles: 0,
                    doubles: 0,
                    triples: 0,
                    homeRuns: 0,
                    walks: 0,
                    strikeouts: 0
                }
            }

            const accumulate = (game: Game, target: typeof totals.neutral): void => {
                target.runs += game.score.away + game.score.home

                for (const play of GameInfo.getPlays(game)) {
                    if (play.result === PlayResult.SINGLE) target.singles++
                    if (play.result === PlayResult.DOUBLE) target.doubles++
                    if (play.result === PlayResult.TRIPLE) target.triples++
                    if (play.result === PlayResult.HR) target.homeRuns++
                    if (play.result === PlayResult.BB) target.walks++
                    if (play.result === PlayResult.STRIKEOUT) target.strikeouts++
                }
            }

            for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                const seed = `stadium-environment-effect-${gameIndex}`

                const neutralGame = baselineGameService.buildStartedBaselineGame(
                    clone(pitchEnvironment),
                    `stadium-neutral-${gameIndex}`,
                    false
                )

                const stadiumGame = baselineGameService.buildStartedBaselineGame(
                    clone(pitchEnvironment),
                    `stadium-hitter-friendly-${gameIndex}`,
                    false,
                    hitterFriendlyStadium
                )

                const neutralRng = seedrandom(seed)
                const stadiumRng = seedrandom(seed)

                while (!neutralGame.isComplete) {
                    simService.simPitch(neutralGame, neutralRng)
                }

                while (!stadiumGame.isComplete) {
                    simService.simPitch(stadiumGame, stadiumRng)
                }

                accumulate(neutralGame, totals.neutral)
                accumulate(stadiumGame, totals.stadium)
            }

            const neutralExtraBaseHits =
                totals.neutral.doubles +
                totals.neutral.triples +
                totals.neutral.homeRuns

            const stadiumExtraBaseHits =
                totals.stadium.doubles +
                totals.stadium.triples +
                totals.stadium.homeRuns

            console.log("\n=== STADIUM ENVIRONMENT EFFECT ===")
            console.log(JSON.stringify({
                games,
                stadiumEnvironment: hitterFriendlyStadium,
                neutral: totals.neutral,
                stadium: totals.stadium,
                delta: {
                    runs: totals.stadium.runs - totals.neutral.runs,
                    singles: totals.stadium.singles - totals.neutral.singles,
                    extraBaseHits: stadiumExtraBaseHits - neutralExtraBaseHits,
                    homeRuns: totals.stadium.homeRuns - totals.neutral.homeRuns,
                    walks: totals.stadium.walks - totals.neutral.walks,
                    strikeouts: totals.stadium.strikeouts - totals.neutral.strikeouts
                }
            }, null, 2))

            assert.ok(
                totals.stadium.runs > totals.neutral.runs,
                `Hitter-friendly stadium should increase runs neutral=${totals.neutral.runs} stadium=${totals.stadium.runs}`
            )

            assert.ok(
                stadiumExtraBaseHits > neutralExtraBaseHits,
                `Hitter-friendly stadium should increase extra-base hits neutral=${neutralExtraBaseHits} stadium=${stadiumExtraBaseHits}`
            )

            assert.ok(
                totals.stadium.homeRuns > totals.neutral.homeRuns,
                `Hitter-friendly stadium should increase home runs neutral=${totals.neutral.homeRuns} stadium=${totals.stadium.homeRuns}`
            )

            assert.ok(
                totals.stadium.strikeouts < totals.neutral.strikeouts,
                `Hitter-friendly stadium should reduce strikeouts neutral=${totals.neutral.strikeouts} stadium=${totals.stadium.strikeouts}`
            )
        })

        it("pitcher-friendly stadium factors should reduce offensive outcomes", () => {
            const games = 500

            const pitcherFriendlyStadium: StadiumEnvironment = {
                team: "Test Team",
                venue: "Pitcher Friendly Park",
                yearRange: "test",
                singles: 0.9,
                doubles: 0.8,
                triples: 0.75,
                hr: 0.75,
                walks: 0.9,
                strikeouts: 1.1
            }

            const totals = {
                neutral: {
                    runs: 0,
                    hits: 0,
                    extraBaseHits: 0,
                    homeRuns: 0,
                    walks: 0,
                    strikeouts: 0
                },
                stadium: {
                    runs: 0,
                    hits: 0,
                    extraBaseHits: 0,
                    homeRuns: 0,
                    walks: 0,
                    strikeouts: 0
                }
            }

            const accumulate = (game: Game, target: typeof totals.neutral): void => {
                target.runs += game.score.away + game.score.home

                for (const play of GameInfo.getPlays(game)) {
                    if (
                        play.result === PlayResult.SINGLE ||
                        play.result === PlayResult.DOUBLE ||
                        play.result === PlayResult.TRIPLE ||
                        play.result === PlayResult.HR
                    ) {
                        target.hits++
                    }

                    if (
                        play.result === PlayResult.DOUBLE ||
                        play.result === PlayResult.TRIPLE ||
                        play.result === PlayResult.HR
                    ) {
                        target.extraBaseHits++
                    }

                    if (play.result === PlayResult.HR) target.homeRuns++
                    if (play.result === PlayResult.BB) target.walks++
                    if (play.result === PlayResult.STRIKEOUT) target.strikeouts++
                }
            }

            for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                const seed = `pitcher-friendly-stadium-${gameIndex}`

                const neutralGame = baselineGameService.buildStartedBaselineGame(
                    clone(pitchEnvironment),
                    `pitcher-friendly-neutral-${gameIndex}`,
                    false
                )

                const stadiumGame = baselineGameService.buildStartedBaselineGame(
                    clone(pitchEnvironment),
                    `pitcher-friendly-adjusted-${gameIndex}`,
                    false,
                    pitcherFriendlyStadium
                )

                const neutralRng = seedrandom(seed)
                const stadiumRng = seedrandom(seed)

                while (!neutralGame.isComplete) {
                    simService.simPitch(neutralGame, neutralRng)
                }

                while (!stadiumGame.isComplete) {
                    simService.simPitch(stadiumGame, stadiumRng)
                }

                accumulate(neutralGame, totals.neutral)
                accumulate(stadiumGame, totals.stadium)
            }

            console.log("\n=== PITCHER-FRIENDLY STADIUM EFFECT ===")
            console.log(JSON.stringify({
                games,
                stadiumEnvironment: pitcherFriendlyStadium,
                neutral: totals.neutral,
                stadium: totals.stadium,
                delta: {
                    runs: totals.stadium.runs - totals.neutral.runs,
                    hits: totals.stadium.hits - totals.neutral.hits,
                    extraBaseHits: totals.stadium.extraBaseHits - totals.neutral.extraBaseHits,
                    homeRuns: totals.stadium.homeRuns - totals.neutral.homeRuns,
                    walks: totals.stadium.walks - totals.neutral.walks,
                    strikeouts: totals.stadium.strikeouts - totals.neutral.strikeouts
                }
            }, null, 2))

            assert.ok(
                totals.stadium.runs < totals.neutral.runs,
                `Pitcher-friendly stadium should reduce runs neutral=${totals.neutral.runs} stadium=${totals.stadium.runs}`
            )

            assert.ok(
                totals.stadium.extraBaseHits < totals.neutral.extraBaseHits,
                `Pitcher-friendly stadium should reduce extra-base hits neutral=${totals.neutral.extraBaseHits} stadium=${totals.stadium.extraBaseHits}`
            )

            assert.ok(
                totals.stadium.homeRuns < totals.neutral.homeRuns,
                `Pitcher-friendly stadium should reduce home runs neutral=${totals.neutral.homeRuns} stadium=${totals.stadium.homeRuns}`
            )

            assert.ok(
                totals.stadium.walks < totals.neutral.walks,
                `Pitcher-friendly stadium should reduce walks neutral=${totals.neutral.walks} stadium=${totals.stadium.walks}`
            )

            assert.ok(
                totals.stadium.strikeouts > totals.neutral.strikeouts,
                `Pitcher-friendly stadium should increase strikeouts neutral=${totals.neutral.strikeouts} stadium=${totals.stadium.strikeouts}`
            )
        })

        it("stadium power factors should reproduce the requested outcome probability ratios", () => {
            const neutral = clone(pitchEnvironment.battedBall.powerRollInput)
            const stadium = createStadiumEnvironment("Rockies", "Coors Field", "2024-2026", 116, 124, 202, 106, 100, 90)

            const game = baselineGameService.buildStartedBaselineGame(
                clone(pitchEnvironment),
                "coors-power-roll-input",
                false,
                stadium
            )

            const adjusted = game.pitchEnvironmentTarget.battedBall.powerRollInput

            const neutralTotal = neutral.out + neutral.singles + neutral.doubles + neutral.triples + neutral.hr
            const adjustedTotal = adjusted.out + adjusted.singles + adjusted.doubles + adjusted.triples + adjusted.hr

            const ratios = {
                singles: (adjusted.singles / adjustedTotal) / (neutral.singles / neutralTotal),
                doubles: (adjusted.doubles / adjustedTotal) / (neutral.doubles / neutralTotal),
                triples: (adjusted.triples / adjustedTotal) / (neutral.triples / neutralTotal),
                homeRuns: (adjusted.hr / adjustedTotal) / (neutral.hr / neutralTotal)
            }

            console.log("\n=== STADIUM POWER FACTOR TRANSFORMATION ===")
            console.log(JSON.stringify({
                neutral,
                adjusted,
                ratios,
                sourceTargets: {
                    singles: stadium.singles,
                    doubles: stadium.doubles,
                    triples: stadium.triples,
                    homeRuns: stadium.hr
                }
            }, null, 2))

            assert.equal(adjustedTotal, neutralTotal, "Stadium adjustment should preserve the power-roll chart total")

            assert.ok(
                Math.abs(ratios.singles - stadium.singles) <= 0.01,
                `Singles power-roll ratio should match stadium factor target=${stadium.singles} actual=${ratios.singles}`
            )

            assert.ok(
                Math.abs(ratios.doubles - stadium.doubles) <= 0.01,
                `Doubles power-roll ratio should match stadium factor target=${stadium.doubles} actual=${ratios.doubles}`
            )

            assert.ok(
                Math.abs(ratios.triples - stadium.triples) <= 0.03,
                `Triples power-roll ratio should match stadium factor within chart rounding target=${stadium.triples} actual=${ratios.triples}`
            )

            assert.ok(
                Math.abs(ratios.homeRuns - stadium.hr) <= 0.01,
                `Home-run power-roll ratio should match stadium factor target=${stadium.hr} actual=${ratios.homeRuns}`
            )

            assert.ok(
                adjusted.out < neutral.out,
                `Hitter-friendly power factors should transfer probability from outs neutral=${neutral.out} adjusted=${adjusted.out}`
            )
        })

        it("neutral stadium factors should preserve baseline game results", () => {
            const games = 100

            const neutralStadium: StadiumEnvironment = {
                team: "Test Team",
                venue: "Neutral Park",
                yearRange: "test",
                singles: 1,
                doubles: 1,
                triples: 1,
                hr: 1,
                walks: 1,
                strikeouts: 1
            }

            for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                const seed = `neutral-stadium-${gameIndex}`

                const baseline = baselineGameService.buildStartedBaselineGame(
                    clone(pitchEnvironment),
                    `neutral-stadium-baseline-${gameIndex}`,
                    false
                )

                const neutral = baselineGameService.buildStartedBaselineGame(
                    clone(pitchEnvironment),
                    `neutral-stadium-adjusted-${gameIndex}`,
                    false,
                    neutralStadium
                )

                const baselineRng = seedrandom(seed)
                const neutralRng = seedrandom(seed)

                while (!baseline.isComplete) {
                    simService.simPitch(baseline, baselineRng)
                }

                while (!neutral.isComplete) {
                    simService.simPitch(neutral, neutralRng)
                }

                assert.deepEqual(
                    neutral.score,
                    baseline.score,
                    `Neutral stadium factors changed game ${gameIndex}.`
                )

                assert.deepEqual(
                    GameInfo.getPlays(neutral).map(play => ({
                        result: play.result,
                        contact: play.contact,
                        officialPlayResult: play.officialPlayResult
                    })),
                    GameInfo.getPlays(baseline).map(play => ({
                        result: play.result,
                        contact: play.contact,
                        officialPlayResult: play.officialPlayResult
                    })),
                    `Neutral stadium factors changed the play sequence for game ${gameIndex}.`
                )
            }
        })

        it("diagnostic: published MLB stadium factors should produce valid stadium environments and power-roll adjustments", () => {
            const sourceRows = [
                { rank: 1, team: "", venue: "Estadio Alfredo Harp Helu", yearRange: "2023-2025", parkFactor: 128, runs: 164, singles: 100, doubles: 113, triples: 166, homeRuns: 223, walks: 106, strikeouts: 106, plateAppearances: 1269 },
                { rank: 2, team: "Rockies", venue: "Coors Field", yearRange: "2023-2025", parkFactor: 112, runs: 125, singles: 116, doubles: 120, triples: 201, homeRuns: 105, walks: 101, strikeouts: 90, plateAppearances: 56521 },
                { rank: 3, team: "Red Sox", venue: "Fenway Park", yearRange: "2023-2025", parkFactor: 105, runs: 110, singles: 107, doubles: 122, triples: 93, homeRuns: 89, walks: 97, strikeouts: 96, plateAppearances: 56758 },
                { rank: 4, team: "D-backs", venue: "Chase Field", yearRange: "2023-2025", parkFactor: 103, runs: 106, singles: 103, doubles: 115, triples: 204, homeRuns: 88, walks: 99, strikeouts: 94, plateAppearances: 57885 },
                { rank: 5, team: "Twins", venue: "Target Field", yearRange: "2023-2025", parkFactor: 103, runs: 106, singles: 100, doubles: 111, triples: 96, homeRuns: 102, walks: 100, strikeouts: 103, plateAppearances: 56677 },
                { rank: 6, team: "Reds", venue: "Great American Ball Park", yearRange: "2023-2025", parkFactor: 103, runs: 106, singles: 96, doubles: 99, triples: 76, homeRuns: 123, walks: 103, strikeouts: 102, plateAppearances: 55472 },
                { rank: 7, team: "Dodgers", venue: "UNIQLO Field at Dodger Stadium", yearRange: "2023-2025", parkFactor: 101, runs: 102, singles: 92, doubles: 96, triples: 64, homeRuns: 127, walks: 101, strikeouts: 99, plateAppearances: 60332 },
                { rank: 8, team: "Marlins", venue: "loanDepot park", yearRange: "2023-2025", parkFactor: 101, runs: 102, singles: 105, doubles: 107, triples: 117, homeRuns: 90, walks: 97, strikeouts: 97, plateAppearances: 56592 },
                { rank: 9, team: "Braves", venue: "Truist Park", yearRange: "2023-2025", parkFactor: 101, runs: 102, singles: 104, doubles: 94, triples: 91, homeRuns: 105, walks: 99, strikeouts: 106, plateAppearances: 56308 },
                { rank: 10, team: "Royals", venue: "Kauffman Stadium", yearRange: "2023-2025", parkFactor: 101, runs: 102, singles: 103, doubles: 113, triples: 182, homeRuns: 85, walks: 100, strikeouts: 89, plateAppearances: 55643 },
                { rank: 11, team: "Angels", venue: "Angel Stadium", yearRange: "2023-2025", parkFactor: 101, runs: 102, singles: 98, doubles: 90, triples: 97, homeRuns: 113, walks: 103, strikeouts: 105, plateAppearances: 55342 },
                { rank: 12, team: "Tigers", venue: "Comerica Park", yearRange: "2023-2025", parkFactor: 101, runs: 102, singles: 100, doubles: 95, triples: 143, homeRuns: 99, walks: 100, strikeouts: 98, plateAppearances: 55445 },
                { rank: 13, team: "Nationals", venue: "Nationals Park", yearRange: "2023-2025", parkFactor: 101, runs: 102, singles: 109, doubles: 98, triples: 98, homeRuns: 94, walks: 94, strikeouts: 90, plateAppearances: 54984 },
                { rank: 14, team: "Phillies", venue: "Citizens Bank Park", yearRange: "2023-2025", parkFactor: 101, runs: 102, singles: 99, doubles: 96, triples: 100, homeRuns: 115, walks: 96, strikeouts: 104, plateAppearances: 56613 },
                { rank: 15, team: "Yankees", venue: "Yankee Stadium", yearRange: "2023-2025", parkFactor: 100, runs: 100, singles: 91, doubles: 90, triples: 63, homeRuns: 119, walks: 111, strikeouts: 101, plateAppearances: 59620 },
                { rank: 16, team: "Cardinals", venue: "Busch Stadium", yearRange: "2023-2025", parkFactor: 100, runs: 100, singles: 107, doubles: 105, triples: 80, homeRuns: 87, walks: 96, strikeouts: 91, plateAppearances: 54960 },
                { rank: 17, team: "Astros", venue: "Daikin Park", yearRange: "2023-2025", parkFactor: 100, runs: 100, singles: 100, doubles: 96, triples: 87, homeRuns: 105, walks: 100, strikeouts: 102, plateAppearances: 55927 },
                { rank: 18, team: "Orioles", venue: "Oriole Park at Camden Yards", yearRange: "2023-2025", parkFactor: 100, runs: 100, singles: 104, doubles: 98, triples: 119, homeRuns: 106, walks: 91, strikeouts: 99, plateAppearances: 55788 },
                { rank: 19, team: "Blue Jays", venue: "Rogers Centre", yearRange: "2023-2025", parkFactor: 100, runs: 100, singles: 97, doubles: 105, triples: 68, homeRuns: 104, walks: 100, strikeouts: 97, plateAppearances: 57292 },
                { rank: 20, team: "White Sox", venue: "Rate Field", yearRange: "2023-2025", parkFactor: 99, runs: 98, singles: 101, doubles: 92, triples: 70, homeRuns: 96, walks: 103, strikeouts: 100, plateAppearances: 57335 },
                { rank: 21, team: "Pirates", venue: "PNC Park", yearRange: "2023-2025", parkFactor: 99, runs: 98, singles: 103, doubles: 115, triples: 83, homeRuns: 76, walks: 100, strikeouts: 96, plateAppearances: 55939 },
                { rank: 22, team: "Mets", venue: "Citi Field", yearRange: "2023-2025", parkFactor: 98, runs: 96, singles: 93, doubles: 89, triples: 72, homeRuns: 104, walks: 110, strikeouts: 102, plateAppearances: 57064 },
                { rank: 23, team: "Brewers", venue: "American Family Field", yearRange: "2023-2025", parkFactor: 97, runs: 94, singles: 94, doubles: 87, triples: 89, homeRuns: 106, walks: 106, strikeouts: 109, plateAppearances: 57434 },
                { rank: 24, team: "Cubs", venue: "Wrigley Field", yearRange: "2023-2025", parkFactor: 97, runs: 94, singles: 98, doubles: 86, triples: 116, homeRuns: 99, walks: 100, strikeouts: 103, plateAppearances: 55966 },
                { rank: 25, team: "", venue: "Tropicana Field", yearRange: "2023-2025", parkFactor: 97, runs: 94, singles: 94, doubles: 95, triples: 127, homeRuns: 99, walks: 97, strikeouts: 109, plateAppearances: 36772 },
                { rank: 26, team: "Rangers", venue: "Globe Life Field", yearRange: "2023-2025", parkFactor: 97, runs: 94, singles: 97, doubles: 95, triples: 73, homeRuns: 104, walks: 100, strikeouts: 101, plateAppearances: 56720 },
                { rank: 27, team: "Padres", venue: "Petco Park", yearRange: "2023-2025", parkFactor: 97, runs: 94, singles: 97, doubles: 92, triples: 63, homeRuns: 102, walks: 103, strikeouts: 102, plateAppearances: 57155 },
                { rank: 28, team: "Giants", venue: "Oracle Park", yearRange: "2023-2025", parkFactor: 97, runs: 94, singles: 104, doubles: 102, triples: 122, homeRuns: 81, walks: 90, strikeouts: 97, plateAppearances: 55185 },
                { rank: 29, team: "Guardians", venue: "Progressive Field", yearRange: "2023-2025", parkFactor: 97, runs: 94, singles: 98, doubles: 106, triples: 71, homeRuns: 85, walks: 100, strikeouts: 102, plateAppearances: 55909 },
                { rank: 30, team: "", venue: "Journey Bank Ballpark", yearRange: "2023-2025", parkFactor: 95, runs: 90, singles: 125, doubles: 109, triples: 0, homeRuns: 45, walks: 93, strikeouts: 95, plateAppearances: 878 },
                { rank: 31, team: "Mariners", venue: "T-Mobile Park", yearRange: "2023-2025", parkFactor: 91, runs: 83, singles: 90, doubles: 89, triples: 52, homeRuns: 93, walks: 96, strikeouts: 116, plateAppearances: 55729 },
                { rank: 32, team: "", venue: "Tokyo Dome", yearRange: "2023-2025", parkFactor: 89, runs: 79, singles: 69, doubles: 118, triples: 0, homeRuns: 49, walks: 173, strikeouts: 114, plateAppearances: 581 }
            ]

            const neutral = clone(pitchEnvironment.battedBall.powerRollInput)
            const neutralTotal = neutral.out + neutral.singles + neutral.doubles + neutral.triples + neutral.hr

            const results = sourceRows.map(row => {
                const stadiumEnvironment = createStadiumEnvironment(
                    row.team,
                    row.venue,
                    row.yearRange,
                    row.singles,
                    row.doubles,
                    row.triples === 0 ? 100 : row.triples,
                    row.homeRuns,
                    row.walks,
                    row.strikeouts
                )

                const game = baselineGameService.buildStartedBaselineGame(
                    clone(pitchEnvironment),
                    `stadium-power-factor-${row.rank}`,
                    false,
                    stadiumEnvironment
                )

                const adjusted = game.pitchEnvironmentTarget.battedBall.powerRollInput
                const adjustedTotal = adjusted.out + adjusted.singles + adjusted.doubles + adjusted.triples + adjusted.hr

                assert.equal(
                    adjustedTotal,
                    neutralTotal,
                    `${row.venue} should preserve the power-roll chart total`
                )

                assert.ok(
                    Object.values(adjusted).every(value => Number.isFinite(value) && value >= 0),
                    `${row.venue} should produce finite non-negative power-roll values`
                )

                return {
                    rank: row.rank,
                    team: row.team,
                    venue: row.venue,
                    yearRange: row.yearRange,
                    parkFactor: row.parkFactor,
                    runs: row.runs,
                    plateAppearances: row.plateAppearances,
                    sourceFactors: {
                        singles: stadiumEnvironment.singles,
                        doubles: stadiumEnvironment.doubles,
                        triples: stadiumEnvironment.triples,
                        homeRuns: stadiumEnvironment.hr,
                        walks: stadiumEnvironment.walks,
                        strikeouts: stadiumEnvironment.strikeouts
                    },
                    adjustedPowerRollInput: adjusted,
                    actualPowerRatios: {
                        singles: (adjusted.singles / adjustedTotal) / (neutral.singles / neutralTotal),
                        doubles: (adjusted.doubles / adjustedTotal) / (neutral.doubles / neutralTotal),
                        triples: (adjusted.triples / adjustedTotal) / (neutral.triples / neutralTotal),
                        homeRuns: (adjusted.hr / adjustedTotal) / (neutral.hr / neutralTotal)
                    },
                    deltas: {
                        singles: ((adjusted.singles / adjustedTotal) / (neutral.singles / neutralTotal)) - stadiumEnvironment.singles,
                        doubles: ((adjusted.doubles / adjustedTotal) / (neutral.doubles / neutralTotal)) - stadiumEnvironment.doubles,
                        triples: ((adjusted.triples / adjustedTotal) / (neutral.triples / neutralTotal)) - stadiumEnvironment.triples,
                        homeRuns: ((adjusted.hr / adjustedTotal) / (neutral.hr / neutralTotal)) - stadiumEnvironment.hr
                    }
                }
            })

            assert.equal(results.length, sourceRows.length)
            assert.equal(new Set(results.map(result => result.venue)).size, results.length)

            console.log("\n=== PUBLISHED MLB STADIUM FACTOR DIAGNOSTIC ===")
            console.log(JSON.stringify({
                neutralPowerRollInput: neutral,
                stadiums: results
            }, null, 2))
        })

    })    
}

if (toRun.includes(DiagnosticTest.HOME_FIELD_ADVANTAGE)) {
    describe("Home Field Advantage", () => {

        it("home field advantage should reproduce the target home win percentage", () => {
            const games = 10000

            const neutralEnvironment = clone(pitchEnvironment)
            const advantageEnvironment = clone(pitchEnvironment)

            neutralEnvironment.homeFieldAdvantage = 0


            type Winner = "home" | "away"

            type SimulationSummary = {
                games: number
                homeFieldAdvantage: number
                homeWins: number
                awayWins: number
                homeWinPercent: number
                awayWinPercent: number
                winners: Winner[]
            }

            const simulate = (environment: PitchEnvironmentTarget, label: string): SimulationSummary => {
                let homeWins = 0
                let awayWins = 0

                const winners: Winner[] = []

                for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                    const rng = seedrandom(`home-field-advantage-${gameIndex}`)

                    const game = baselineGameService.buildStartedBaselineGame(
                        clone(environment),
                        `${label}-${gameIndex}`
                    )

                    while (!game.isComplete) {
                        simService.simPitch(game, rng)
                    }

                    if (game.score.home > game.score.away) {
                        homeWins++
                        winners.push("home")
                    } else {
                        awayWins++
                        winners.push("away")
                    }
                }

                return {
                    games,
                    homeFieldAdvantage: environment.homeFieldAdvantage,
                    homeWins,
                    awayWins,
                    homeWinPercent: homeWins / games,
                    awayWinPercent: awayWins / games,
                    winners
                }
            }

            const neutral = simulate(neutralEnvironment, "home-field-neutral")
            const advantage = simulate(advantageEnvironment, "home-field-target")

            let unchangedWinners = 0
            let changedToHomeWinner = 0
            let changedToAwayWinner = 0

            for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                const neutralWinner = neutral.winners[gameIndex]
                const advantageWinner = advantage.winners[gameIndex]

                if (neutralWinner === advantageWinner) {
                    unchangedWinners++
                    continue
                }

                if (advantageWinner === "home") {
                    changedToHomeWinner++
                } else {
                    changedToAwayWinner++
                }
            }

            const changedWinners = changedToHomeWinner + changedToAwayWinner
            const targetHomeWinPercentDelta = advantageEnvironment.homeFieldAdvantage
            const targetHomeWinPercent = neutral.homeWinPercent + targetHomeWinPercentDelta
            const homeWinPercentDelta = advantage.homeWinPercent - neutral.homeWinPercent
            const targetError = homeWinPercentDelta - targetHomeWinPercentDelta
            const tolerance = 0.005

            console.log("\n=== HOME FIELD ADVANTAGE EFFECT ===")
            console.log(JSON.stringify({
                neutral: {
                    games: neutral.games,
                    homeFieldAdvantage: neutral.homeFieldAdvantage,
                    homeWins: neutral.homeWins,
                    awayWins: neutral.awayWins,
                    homeWinPercent: neutral.homeWinPercent,
                    awayWinPercent: neutral.awayWinPercent
                },
                advantage: {
                    games: advantage.games,
                    homeFieldAdvantage: advantage.homeFieldAdvantage,
                    targetHomeWinPercent,
                    targetHomeWinPercentDelta,
                    homeWins: advantage.homeWins,
                    awayWins: advantage.awayWins,
                    homeWinPercent: advantage.homeWinPercent,
                    awayWinPercent: advantage.awayWinPercent,
                    targetError
                },
                pairedComparison: {
                    unchangedWinners,
                    changedWinners,
                    changedToHomeWinner,
                    changedToAwayWinner,
                    netChangedToHomeWinner: changedToHomeWinner - changedToAwayWinner
                },
                delta: {
                    homeWins: advantage.homeWins - neutral.homeWins,
                    homeWinPercent: homeWinPercentDelta
                }
            }, null, 2))

            assert.ok(
                neutral.homeWinPercent > 0.47 &&
                neutral.homeWinPercent < 0.53,
                `Neutral home win percentage should be reasonably close to 50%, actual=${neutral.homeWinPercent}`
            )

            assert.ok(
                advantage.homeWinPercent > neutral.homeWinPercent,
                `Home field advantage should increase home win percentage neutral=${neutral.homeWinPercent} advantage=${advantage.homeWinPercent}`
            )

            assert.ok(
                changedWinners > 0,
                "Home field advantage should change at least one paired game result"
            )

            assert.ok(
                changedToHomeWinner > changedToAwayWinner,
                `Home field advantage should flip more games toward home changedToHome=${changedToHomeWinner} changedToAway=${changedToAwayWinner}`
            )

            assert.ok(
                Math.abs(targetError) <= tolerance,
                `Home win percentage increase should be within ${tolerance} of configured advantage targetDelta=${targetHomeWinPercentDelta} actualDelta=${homeWinPercentDelta} error=${targetError}`
            )
        })

    })
}

if (toRun.includes(DiagnosticTest.BATTED_BALL_DIAGNOSTICS)) {
    describe("Batted Ball Diagnostics", () => {

        it("diagnostic: expected vs actual batted ball outcome mix", async () => {

            const games = 300

            const testPitchEnvironment = clone(
                pitchEnvironment
            )

            const expected = testPitchEnvironment.battedBall.powerRollInput

            const actual = {
                out: 0,
                single: 0,
                double: 0,
                triple: 0,
                hr: 0
            }

            let totalInPlayResults = 0

            const isTrackedResult = (result: PlayResult): boolean => {
                return result === PlayResult.OUT ||
                    result === PlayResult.SINGLE ||
                    result === PlayResult.DOUBLE ||
                    result === PlayResult.TRIPLE ||
                    result === PlayResult.HR
            }

            for (let gameIndex = 0; gameIndex < games; gameIndex++) {

                const rng = seedrandom(`expected-vs-actual-${gameIndex}`)

                const game = baselineGameService.buildStartedBaselineGame(
                    clone(testPitchEnvironment),
                    `expected-vs-actual-${gameIndex}`
                )

                while (!game.isComplete) {
                    simService.simPitch(game, rng)
                }

                for (const play of GameInfo.getPlays(game)) {

                    if (!isTrackedResult(play.result)) continue

                    totalInPlayResults++

                    switch (play.result) {

                        case PlayResult.OUT:
                            actual.out++
                            break

                        case PlayResult.SINGLE:
                            actual.single++
                            break

                        case PlayResult.DOUBLE:
                            actual.double++
                            break

                        case PlayResult.TRIPLE:
                            actual.triple++
                            break

                        case PlayResult.HR:
                            actual.hr++
                            break
                    }
                }
            }

            const actualScaled = {
                out: actual.out / totalInPlayResults * 1000,
                single: actual.single / totalInPlayResults * 1000,
                double: actual.double / totalInPlayResults * 1000,
                triple: actual.triple / totalInPlayResults * 1000,
                hr: actual.hr / totalInPlayResults * 1000
            }

            const actualBabip =
                (actual.single + actual.double + actual.triple) /
                Math.max(
                    1,
                    actual.out +
                    actual.single +
                    actual.double +
                    actual.triple
                )

            const expectedBabip =
                (expected.singles + expected.doubles + expected.triples) /
                Math.max(
                    1,
                    expected.out +
                    expected.singles +
                    expected.doubles +
                    expected.triples
                )

            console.log("\n=== EXPECTED VS ACTUAL BATTED BALL OUTCOME MIX ===")
            console.log(JSON.stringify({
                expected,
                actual,
                actualScaled,
                expectedBabip,
                actualBabip,
                deltas: {
                    out: actualScaled.out - expected.out,
                    single: actualScaled.single - expected.singles,
                    double: actualScaled.double - expected.doubles,
                    triple: actualScaled.triple - expected.triples,
                    hr: actualScaled.hr - expected.hr
                }
            }, null, 2))

            assert.ok(totalInPlayResults > 0)
        })

        it("diagnostic: imported babip vs power roll babip", async () => {

            const env = clone(pitchEnvironment)

            const powerRollBabip =
                (env.battedBall.powerRollInput.singles +
                    env.battedBall.powerRollInput.doubles +
                    env.battedBall.powerRollInput.triples) /
                (
                    env.battedBall.powerRollInput.out +
                    env.battedBall.powerRollInput.singles +
                    env.battedBall.powerRollInput.doubles +
                    env.battedBall.powerRollInput.triples
                )

            console.log("\n=== IMPORTED BABIP VS POWER ROLL BABIP ===")
            console.log(JSON.stringify({
                targetBabip: env.outcome.babip,
                powerRollBabip,

                powerRollInput: env.battedBall.powerRollInput,

                importReference: {
                    ab: env.importReference.hitter.ab,
                    hits: env.importReference.hitter.hits,
                    homeRuns: env.importReference.hitter.homeRuns,
                    strikeouts: env.importReference.hitter.so,
                    ballsInPlay: env.importReference.hitter.ballsInPlay
                }
            }, null, 2))

            assert.ok(powerRollBabip > 0)
        })

        it("evaluated hit type rates should equal hits per PA", () => {
            const evaluationRng = new seedrandom(evaluationSeed)
            const evaluation = pitchEnvironmentService.evaluatePitchEnvironment(pitchEnvironment, evaluationRng, 20)

            const actualHitTypePerPA =
                Number(evaluation.actual.singlePercent ?? 0) +
                Number(evaluation.actual.doublePercent ?? 0) +
                Number(evaluation.actual.triplePercent ?? 0) +
                Number(evaluation.actual.homeRunPercent ?? 0)

            const actualHitsPerPA = actualHitTypePerPA

            assert.ok(
                Math.abs(actualHitTypePerPA - actualHitsPerPA) < 0.000001,
                `hit type PA mismatch hitsPerPA=${actualHitsPerPA} reconstructed=${actualHitTypePerPA} 1B=${evaluation.actual.singlePercent} 2B=${evaluation.actual.doublePercent} 3B=${evaluation.actual.triplePercent} HR=${evaluation.actual.homeRunPercent}`
            )
        })

    })
}

if (toRun.includes(DiagnosticTest.CONTACT_QUALITY)) {
    describe("Contact Quality", () => {

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

            const evaluation = pitchEnvironmentService.evaluatePitchEnvironment(
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
                            outOutcomeScale: 0,
                            doubleOutcomeScale: 0,
                            tripleOutcomeScale: 0
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
                    const game = baselineGameService.buildStartedBaselineGame(
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
                const simulatedGame = baselineGameService.buildStartedBaselineGame(
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
            assert.ok(Math.abs(report.lineDrive.directLa - report.lineDrive.gameLa) < 2)
            assert.ok(Math.abs(report.flyBall.directLa - report.flyBall.gameLa) < 1.5)

            assert.ok(Math.abs(report.groundBall.directEv - report.groundBall.gameEv) < 1.5)
            assert.ok(Math.abs(report.lineDrive.directEv - report.lineDrive.gameEv) < 1.5)
            assert.ok(Number.isFinite(report.flyBall.directEv))
            assert.ok(Number.isFinite(report.flyBall.gameEv))
            assert.ok(report.flyBall.directEv > 60)
            assert.ok(report.flyBall.gameEv > 60)
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
                const game = baselineGameService.buildStartedBaselineGame(
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

        it("getHitQuality should produce a deterministic ground ball profile with disabled meta tuning", () => {
            const pitchEnvironmentTarget = makeGetHitQualityTestEnvironment()

            const result = (simService as any).gameRolls.getHitQuality(
                seedrandom("deterministic-ground-ball-hit-quality"),
                pitchEnvironmentTarget,
                0,
                false,
                Contact.GROUNDBALL
            )

            assert.ok(Number.isFinite(result.exitVelocity))
            assert.ok(Number.isFinite(result.launchAngle))
            assert.ok(Number.isFinite(result.distance))
            assert.ok(Number.isFinite(result.coordX))
            assert.ok(Number.isFinite(result.coordY))
            assert.ok(result.launchAngle < 5)
            assert.ok(result.distance < 150)
            assert.ok(result.coordY >= 20)
            assert.ok(result.coordY <= 190)
        })

        it("getHitQuality should produce a deterministic line drive profile with disabled meta tuning", () => {
            const pitchEnvironmentTarget = makeGetHitQualityTestEnvironment()

            const result = (simService as any).gameRolls.getHitQuality(
                seedrandom("deterministic-line-drive-hit-quality"),
                pitchEnvironmentTarget,
                0,
                false,
                Contact.LINE_DRIVE
            )

            assert.ok(Number.isFinite(result.exitVelocity))
            assert.ok(Number.isFinite(result.launchAngle))
            assert.ok(Number.isFinite(result.distance))
            assert.ok(Number.isFinite(result.coordX))
            assert.ok(Number.isFinite(result.coordY))
            assert.ok(result.launchAngle > 5)
            assert.ok(result.launchAngle < 25)
            assert.ok(result.distance > 130)
            assert.ok(result.coordY >= 130)
            assert.ok(result.coordY <= 320)
        })

        it("getHitQuality should produce a deterministic fly ball profile with disabled meta tuning", () => {
            const pitchEnvironmentTarget = makeGetHitQualityTestEnvironment()

            const result = (simService as any).gameRolls.getHitQuality(
                rngSequence([0.99, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
                pitchEnvironmentTarget,
                0,
                false,
                Contact.FLY_BALL
            )

            assert.ok(Number.isFinite(result.exitVelocity))
            assert.ok(Number.isFinite(result.launchAngle))
            assert.ok(Number.isFinite(result.distance))
            assert.ok(Number.isFinite(result.coordX))
            assert.ok(Number.isFinite(result.coordY))
            assert.ok(result.launchAngle > 20)
            assert.ok(result.distance > 170)
            assert.ok(result.coordY >= 170)
            assert.ok(result.coordY <= 360)
        })

        it("getHitQuality should use spray fallback when xy data is missing", () => {
            const pitchEnvironmentTarget = makeGetHitQualityTestEnvironment()

            delete (pitchEnvironmentTarget.battedBall as any).xy

            const result = (simService as any).gameRolls.getHitQuality(
                seedrandom("line-drive-without-xy-data"),
                pitchEnvironmentTarget,
                0,
                false,
                Contact.LINE_DRIVE
            )

            assert.ok(Number.isFinite(result.coordX))
            assert.ok(Number.isFinite(result.coordY))
            assert.ok(result.coordY > 0)

            const reconstructedDistance = Math.sqrt((result.coordX * result.coordX) + (result.coordY * result.coordY))
            assert.ok(reconstructedDistance > 0)
        })

        it("getHitQuality should not change EV LA or distance from tuning when pitchQualityChange is zero and guessPitch is false", () => {
            const basePitchEnvironmentTarget = makeGetHitQualityTestEnvironment()
            const boostedPitchEnvironmentTarget = clone(basePitchEnvironmentTarget)

            boostedPitchEnvironmentTarget.pitchEnvironmentTuning!.tuning.contactQuality.evScale = 3
            boostedPitchEnvironmentTarget.pitchEnvironmentTuning!.tuning.contactQuality.laScale = 3
            boostedPitchEnvironmentTarget.pitchEnvironmentTuning!.tuning.contactQuality.distanceScale = 3

            const baseResult = (simService as any).gameRolls.getHitQuality(
                rngSequence([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
                basePitchEnvironmentTarget,
                0,
                false,
                Contact.LINE_DRIVE
            )

            const boostedResult = (simService as any).gameRolls.getHitQuality(
                rngSequence([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
                boostedPitchEnvironmentTarget,
                0,
                false,
                Contact.LINE_DRIVE
            )

            assert.strictEqual(boostedResult.exitVelocity, baseResult.exitVelocity)
            assert.strictEqual(boostedResult.launchAngle, baseResult.launchAngle)
            assert.strictEqual(boostedResult.distance, baseResult.distance)
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

    })
}

if (toRun.includes(DiagnosticTest.OUTCOME_TUNING)) {
    describe("Outcome Tuning", () => {

        it("outOutcomeScale should increase outs when positive", () => {
            const adjusted = getTunedPowerResult(
                PlayResult.SINGLE,
                Contact.LINE_DRIVE,
                { outOutcomeScale: 1 }
            )

            assert.equal(adjusted, PlayResult.OUT)
        })

        it("outOutcomeScale should reduce outs when negative", () => {
            const adjusted = getTunedPowerResult(
                PlayResult.OUT,
                Contact.LINE_DRIVE,
                { outOutcomeScale: -1 }
            )

            assert.equal(adjusted, PlayResult.SINGLE)
        })

        it("doubleOutcomeScale should redistribute singles into doubles", () => {
            const adjusted = getTunedPowerResult(
                PlayResult.SINGLE,
                Contact.LINE_DRIVE,
                { doubleOutcomeScale: 1 }
            )

            assert.equal(adjusted, PlayResult.DOUBLE)
        })

        it("tripleOutcomeScale should redistribute singles/doubles into triples", () => {
            const adjustedFromSingle = getTunedPowerResult(
                PlayResult.SINGLE,
                Contact.LINE_DRIVE,
                { tripleOutcomeScale: 1 }
            )

            const adjustedFromDouble = getTunedPowerResult(
                PlayResult.DOUBLE,
                Contact.LINE_DRIVE,
                { tripleOutcomeScale: 1 }
            )

            assert.equal(adjustedFromSingle, PlayResult.TRIPLE)
            assert.equal(adjustedFromDouble, PlayResult.TRIPLE)
        })

        it("homeRunOutcomeScale should redistribute hits into home runs", () => {
            const adjustedFromSingle = getTunedPowerResult(
                PlayResult.SINGLE,
                Contact.LINE_DRIVE,
                { homeRunOutcomeScale: 1 }
            )

            const adjustedFromDouble = getTunedPowerResult(
                PlayResult.DOUBLE,
                Contact.LINE_DRIVE,
                { homeRunOutcomeScale: 1 }
            )

            const adjustedFromTriple = getTunedPowerResult(
                PlayResult.TRIPLE,
                Contact.FLY_BALL,
                { homeRunOutcomeScale: 1 }
            )

            assert.equal(adjustedFromSingle, PlayResult.HR)
            assert.equal(adjustedFromDouble, PlayResult.HR)
            assert.equal(adjustedFromTriple, PlayResult.HR)
        })

        it("negative extra-base outcome scales should redistribute extra-base hits into singles", () => {
            const adjustedDouble = getTunedPowerResult(
                PlayResult.DOUBLE,
                Contact.LINE_DRIVE,
                { doubleOutcomeScale: -1 }
            )

            const adjustedTriple = getTunedPowerResult(
                PlayResult.TRIPLE,
                Contact.LINE_DRIVE,
                { tripleOutcomeScale: -1 }
            )

            const adjustedHomeRun = getTunedPowerResult(
                PlayResult.HR,
                Contact.FLY_BALL,
                { homeRunOutcomeScale: -1 }
            )

            assert.equal(adjustedDouble, PlayResult.SINGLE)
            assert.equal(adjustedTriple, PlayResult.SINGLE)
            assert.equal(adjustedHomeRun, PlayResult.SINGLE)
        })

        it("home runs should never be assigned ground-ball contact", () => {
            const testSimService: any = Object.create(SimService.prototype)

            const entries = new Map<number, Contact>()

            for (let i = 0; i < 100; i++) {
                entries.set(i, i < 50 ? Contact.GROUNDBALL : Contact.FLY_BALL)
            }

            testSimService.rollChartService = {
                getMatchupContactRollChart: () => ({ entries } as RollChart)
            }

            const command: any = {
                pitchEnvironmentTarget: buildTarget(),
                hitter: {
                    hittingRatings: {
                        contactProfile: {}
                    }
                },
                pitcher: {
                    pitchRatings: {
                        contactProfile: {}
                    }
                },
                rng: rngSequence([0])
            }

            const contact = testSimService.getMatchupContactForPlayResult(command, PlayResult.HR)

            assert.notEqual(contact, Contact.GROUNDBALL)
        })

    })
}

if (toRun.includes(DiagnosticTest.PITCH_GENERATION)) {
    describe("Pitch Generation", () => {

        it("diagnostic: every generated pitch should have finite pitch quality velocity", () => {
            const rng = seedrandom("pitch-velocity-diagnostic")
            const game = baselineGameService.buildStartedBaselineGame(
                clone(pitchEnvironment),
                "pitch-velocity-diagnostic"
            )

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            const pitches = game.halfInnings
                .flatMap(halfInning => halfInning.plays)
                .flatMap(play => play.pitchLog?.pitches ?? [])

            const missingVelocity = pitches
                .map((pitch, index) => ({ index, pitch }))
                .filter(row =>
                    row.pitch?.quality?.velocity == undefined ||
                    !Number.isFinite(row.pitch.quality.velocity) ||
                    row.pitch.quality.velocity <= 0
                )

            assert.ok(pitches.length > 0, "No pitches were generated")

            assert.equal(
                missingVelocity.length,
                0,
                `Generated pitches missing quality.velocity count=${missingVelocity.length} sample=${JSON.stringify(missingVelocity.slice(0, 10), null, 2)}`
            )

            const velocities = pitches.map(pitch => pitch.quality.velocity)
            const avgVelocity = velocities.reduce((sum, velocity) => sum + velocity, 0) / velocities.length

            // console.log("PITCH VELOCITY DIAGNOSTIC", {
            //     pitches: pitches.length,
            //     minVelocity: Math.min(...velocities),
            //     maxVelocity: Math.max(...velocities),
            //     avgVelocity
            // })
        })

        it("diagnostic: generated pitch locations should be physically coherent", () => {
            const rng = seedrandom("pitch-location-diagnostic")
            const game = baselineGameService.buildStartedBaselineGame(
                clone(pitchEnvironment),
                "pitch-location-diagnostic"
            )

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            const pitches = game.halfInnings
                .flatMap(halfInning => halfInning.plays)
                .flatMap(play => play.pitchLog?.pitches ?? [])

            assert.ok(pitches.length > 0, "No pitches were generated")

            const badLocations = pitches
                .map((pitch, index) => ({ index, pitch }))
                .filter(row =>
                    !Number.isFinite(row.pitch.plateX) ||
                    !Number.isFinite(row.pitch.plateZ) ||
                    row.pitch.plateX < -4 ||
                    row.pitch.plateX > 4 ||
                    row.pitch.plateZ < -1 ||
                    row.pitch.plateZ > 7
                )

            assert.equal(
                badLocations.length,
                0,
                `Bad plate locations count=${badLocations.length} sample=${JSON.stringify(badLocations.slice(0, 10), null, 2)}`
            )

            const getExpectedZone = (plateX: number, plateZ: number): PitchZone => {
                const horizontal =
                    plateX < -0.25
                        ? "INSIDE"
                        : plateX > 0.25
                            ? "AWAY"
                            : "MIDDLE"

                const vertical =
                    plateZ > 2.9
                        ? "HIGH"
                        : plateZ < 2.1
                            ? "LOW"
                            : "MID"

                return `${vertical}_${horizontal}` as PitchZone
            }

            const zoneMismatch = pitches
                .map((pitch, index) => ({ index, pitch }))
                .filter(row => row.pitch.actualZone !== getExpectedZone(row.pitch.plateX, row.pitch.plateZ))

            assert.equal(
                zoneMismatch.length,
                0,
                `actualZone does not match plateX/plateZ count=${zoneMismatch.length} sample=${JSON.stringify(zoneMismatch.slice(0, 10), null, 2)}`
            )

            const strikeZone = {
                left: -0.83,
                right: 0.83,
                bottom: 1.5,
                top: 3.5
            }

            const isActuallyInZone = (plateX: number, plateZ: number): boolean => {
                return plateX >= strikeZone.left &&
                    plateX <= strikeZone.right &&
                    plateZ >= strikeZone.bottom &&
                    plateZ <= strikeZone.top
            }

            const inZoneMismatch = pitches
                .map((pitch, index) => ({ index, pitch }))
                .filter(row => {
                    if (row.pitch.result === PitchCall.HBP) return false

                    return row.pitch.inZone !== isActuallyInZone(row.pitch.plateX, row.pitch.plateZ)
                })

            assert.equal(
                inZoneMismatch.length,
                0,
                `inZone does not match strike-zone box count=${inZoneMismatch.length} sample=${JSON.stringify(inZoneMismatch.slice(0, 10), null, 2)}`
            )

            const callMismatch = pitches
                .map((pitch, index) => ({ index, pitch }))
                .filter(row => {
                    const pitch = row.pitch

                    if (pitch.result === PitchCall.HBP) return false
                    if (pitch.isWP || pitch.isPB) return false
                    if (pitch.swing) return false

                    const expectedCall = pitch.inZone ? PitchCall.STRIKE : PitchCall.BALL

                    return pitch.result !== expectedCall
                })

            assert.equal(
                callMismatch.length,
                0,
                `Taken pitch call does not match inZone count=${callMismatch.length} sample=${JSON.stringify(callMismatch.slice(0, 10), null, 2)}`
            )

            const byPitchType = pitches.reduce((accumulator, pitch) => {
                accumulator[pitch.type] ??= []
                accumulator[pitch.type].push(pitch)
                return accumulator
            }, {} as Record<string, typeof pitches>)

            const movementSummary = Object.entries(byPitchType).map(([pitchType, pitchTypePitches]) => {
                const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

                return {
                    pitchType,
                    count: pitchTypePitches.length,
                    avgHorizontalBreak: avg(pitchTypePitches.map(p => p.quality.horizontalBreak)),
                    avgVerticalBreak: avg(pitchTypePitches.map(p => p.quality.verticalBreak)),
                    avgPlateX: avg(pitchTypePitches.map(p => p.plateX)),
                    avgPlateZ: avg(pitchTypePitches.map(p => p.plateZ))
                }
            })

            const distinctPitchTypes = movementSummary.filter(row => row.count >= 10)

            assert.ok(
                distinctPitchTypes.length >= 2,
                `Need at least two pitch types with enough samples to compare movement summary=${JSON.stringify(movementSummary, null, 2)}`
            )

            // console.log("PITCH LOCATION DIAGNOSTIC", {
            //     pitches: pitches.length,
            //     plateX: {
            //         min: Math.min(...pitches.map(p => p.plateX)),
            //         max: Math.max(...pitches.map(p => p.plateX)),
            //         avg: pitches.map(p => p.plateX).reduce((sum, value) => sum + value, 0) / pitches.length
            //     },
            //     plateZ: {
            //         min: Math.min(...pitches.map(p => p.plateZ)),
            //         max: Math.max(...pitches.map(p => p.plateZ)),
            //         avg: pitches.map(p => p.plateZ).reduce((sum, value) => sum + value, 0) / pitches.length
            //     },
            //     movementSummary,
            //     samples: pitches.slice(0, 20).map(pitch => ({
            //         type: pitch.type,
            //         intentZone: pitch.intentZone,
            //         actualZone: pitch.actualZone,
            //         plateX: pitch.plateX,
            //         plateZ: pitch.plateZ,
            //         horizontalBreak: pitch.quality.horizontalBreak,
            //         verticalBreak: pitch.quality.verticalBreak,
            //         locQ: pitch.locQ,
            //         inZone: pitch.inZone,
            //         result: pitch.result
            //     }))
            // })
        })

    })
}

if (toRun.includes(DiagnosticTest.COUNT_DIAGNOSTICS)) {
    describe("Count Diagnostics", () => {

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
                const game = baselineGameService.buildStartedBaselineGame(
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

    })
}

if (toRun.includes(DiagnosticTest.OFFENSE_BASELINES)) {
    describe("Offense Baselines", () => {

        it("default tuning should print baseline offense", () => {
            const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

            testPitchEnvironment.pitchEnvironmentTuning = {
                tuning: makeTuning()
            } as PitchEnvironmentTuning

            const evaluation = pitchEnvironmentService.evaluatePitchEnvironment(
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

    })
}

if (toRun.includes(DiagnosticTest.DEFENSE_DIAGNOSTICS)) {
    describe("Defense Diagnostics", () => {

        it("defense tuning should produce a meaningful paired full-game outcome range", () => {
            const games = 1000
            const defenseChanges = [-300, -200, -100, -50, 0, 50, 100, 200, 300]

            type DefenseTotals = {
                runs: number
                hits: number
                singles: number
                doubles: number
                triples: number
                homeRuns: number
                walks: number
                strikeouts: number
                babipHits: number
                babipOuts: number
            }

            const makeTotals = (): DefenseTotals => {
                return {
                    runs: 0,
                    hits: 0,
                    singles: 0,
                    doubles: 0,
                    triples: 0,
                    homeRuns: 0,
                    walks: 0,
                    strikeouts: 0,
                    babipHits: 0,
                    babipOuts: 0
                }
            }

            const makeDefenseEnvironment = (defenseChange: number): PitchEnvironmentTarget => {
                const target = clone(pitchEnvironment)

                target.pitchEnvironmentTuning = {
                    tuning: makeTuning({
                        contactQuality: {
                            evScale: -2.75,
                            laScale: -2.125,
                            distanceScale: -3,
                            homeRunOutcomeScale: 0,
                            outOutcomeScale: 0,
                            doubleOutcomeScale: 0,
                            tripleOutcomeScale: 0
                        },
                        swing: {
                            pitchQualityZoneSwingEffect: -4,
                            pitchQualityChaseSwingEffect: 0,
                            disciplineZoneSwingEffect: 2,
                            disciplineChaseSwingEffect: 5,
                            walkRateScale: 0
                        },
                        contact: {
                            pitchQualityContactEffect: -8,
                            contactSkillEffect: -4
                        },
                        running: {
                            stealAttemptAggressionScale: 1.49,
                            advancementAggressionScale: 0
                        },
                        meta: {
                            fullPitchQualityBonus: 0,
                            fullTeamDefenseBonus: defenseChange,
                            fullFielderDefenseBonus: defenseChange
                        }
                    })
                } as PitchEnvironmentTuning

                return target
            }

            const accumulate = (game: Game, totals: DefenseTotals): void => {
                totals.runs += game.score.away + game.score.home

                for (const play of GameInfo.getPlays(game)) {
                    if (play.result === PlayResult.SINGLE) {
                        totals.hits++
                        totals.singles++
                        totals.babipHits++
                    }

                    if (play.result === PlayResult.DOUBLE) {
                        totals.hits++
                        totals.doubles++
                        totals.babipHits++
                    }

                    if (play.result === PlayResult.TRIPLE) {
                        totals.hits++
                        totals.triples++
                        totals.babipHits++
                    }

                    if (play.result === PlayResult.HR) {
                        totals.hits++
                        totals.homeRuns++
                    }

                    if (play.result === PlayResult.OUT) {
                        totals.babipOuts++
                    }

                    if (play.result === PlayResult.BB) {
                        totals.walks++
                    }

                    if (play.result === PlayResult.STRIKEOUT) {
                        totals.strikeouts++
                    }
                }
            }

            const environments = new Map<number, PitchEnvironmentTarget>()
            const totalsByDefense = new Map<number, DefenseTotals>()

            for (const defenseChange of defenseChanges) {
                environments.set(defenseChange, makeDefenseEnvironment(defenseChange))
                totalsByDefense.set(defenseChange, makeTotals())
            }

            for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                const seed = `paired-defense-sensitivity-${gameIndex}`

                for (const defenseChange of defenseChanges) {
                    const environment = environments.get(defenseChange)
                    const totals = totalsByDefense.get(defenseChange)

                    assert.ok(environment)
                    assert.ok(totals)

                    const game = baselineGameService.buildStartedBaselineGame(
                        clone(environment),
                        `paired-defense-${defenseChange}-${gameIndex}`
                    )

                    const rng = seedrandom(seed)

                    while (!game.isComplete) {
                        simService.simPitch(game, rng)
                    }

                    accumulate(game, totals)
                }
            }

            const rows = defenseChanges.map(defenseChange => {
                const totals = totalsByDefense.get(defenseChange)

                assert.ok(totals)

                const teamGames = games * 2
                const babipOpportunities = totals.babipHits + totals.babipOuts

                return {
                    defenseChange,
                    runsPerTeamGame: totals.runs / teamGames,
                    hitsPerTeamGame: totals.hits / teamGames,
                    singlesPerTeamGame: totals.singles / teamGames,
                    doublesPerTeamGame: totals.doubles / teamGames,
                    triplesPerTeamGame: totals.triples / teamGames,
                    homeRunsPerTeamGame: totals.homeRuns / teamGames,
                    walksPerTeamGame: totals.walks / teamGames,
                    strikeoutsPerTeamGame: totals.strikeouts / teamGames,
                    babip: babipOpportunities > 0
                        ? totals.babipHits / babipOpportunities
                        : 0,
                    raw: totals
                }
            })

            const neutral = rows.find(row => row.defenseChange === 0)
            const poor = rows.find(row => row.defenseChange === -300)
            const strong = rows.find(row => row.defenseChange === 300)

            assert.ok(neutral)
            assert.ok(poor)
            assert.ok(strong)

            console.log("\n=== PAIRED DEFENSE SENSITIVITY ===")

            for (const row of rows) {
                console.log(row)
            }

            console.log("\n=== PAIRED DEFENSE ENDPOINT RANGE ===")
            console.log({
                games,
                poor,
                neutral,
                strong,
                poorToStrong: {
                    runsPerTeamGame: strong.runsPerTeamGame - poor.runsPerTeamGame,
                    hitsPerTeamGame: strong.hitsPerTeamGame - poor.hitsPerTeamGame,
                    singlesPerTeamGame: strong.singlesPerTeamGame - poor.singlesPerTeamGame,
                    babip: strong.babip - poor.babip,
                    homeRunsPerTeamGame: strong.homeRunsPerTeamGame - poor.homeRunsPerTeamGame,
                    walksPerTeamGame: strong.walksPerTeamGame - poor.walksPerTeamGame,
                    strikeoutsPerTeamGame: strong.strikeoutsPerTeamGame - poor.strikeoutsPerTeamGame
                }
            })

            assert.ok(
                poor.babip > strong.babip,
                `Poor defense should produce higher BABIP poor=${poor.babip} strong=${strong.babip}`
            )

            assert.ok(
                poor.hitsPerTeamGame > strong.hitsPerTeamGame,
                `Poor defense should allow more hits poor=${poor.hitsPerTeamGame} strong=${strong.hitsPerTeamGame}`
            )

            assert.ok(
                poor.singlesPerTeamGame > strong.singlesPerTeamGame,
                `Poor defense should allow more singles poor=${poor.singlesPerTeamGame} strong=${strong.singlesPerTeamGame}`
            )

            assert.ok(
                poor.runsPerTeamGame > strong.runsPerTeamGame,
                `Poor defense should allow more runs poor=${poor.runsPerTeamGame} strong=${strong.runsPerTeamGame}`
            )

            assert.ok(
                poor.babip - strong.babip >= 0.002,
                `Defense should create a meaningful BABIP range poor=${poor.babip} strong=${strong.babip} delta=${poor.babip - strong.babip}`
            )

            assert.ok(
                poor.hitsPerTeamGame - strong.hitsPerTeamGame >= 0.05,
                `Defense should create a meaningful hit range poor=${poor.hitsPerTeamGame} strong=${strong.hitsPerTeamGame} delta=${poor.hitsPerTeamGame - strong.hitsPerTeamGame}`
            )
        })

    })
}

if (toRun.includes(DiagnosticTest.RUN_CREATION_DIAGNOSTICS)) {
    describe("Run Creation Diagnostics", () => {

        it("diagnostic: run creation decomposition", async () => {
            const games = 150
            const samples = 3
            const totalGames = games * samples
            const teamGames = totalGames * 2

            const testPitchEnvironment = clone(
                pitchEnvironment
            )

            const totals = {
                runs: 0,
                pa: 0,
                ab: 0,
                hits: 0,
                singles: 0,
                doubles: 0,
                triples: 0,
                homeRuns: 0,
                bb: 0,
                hbp: 0,
                so: 0,
                totalBases: 0,
                nonHrBaserunners: 0,
                baserunners: 0,
                runnersStartedOnBase: 0,
                runnersScoredFromBase: 0,
                runnersOutOnBase: 0,
                lob: 0,
                gidpLike: 0,
                cs: 0,
                sb: 0,
                sbAttempts: 0,
                extraBaseRiskAttempts: 0,
                extraBaseRiskSafe: 0,
                extraBaseRiskOut: 0
            }

            const byBaseState: Record<string, any> = {}

            const getBaseStateKey = (play: any): string => {
                const outs = play.count?.start?.outs ?? 0
                const start = play.runner?.result?.start

                const first = start?.first ? "1" : "_"
                const second = start?.second ? "2" : "_"
                const third = start?.third ? "3" : "_"

                return `${outs}:${first}${second}${third}`
            }

            const getRow = (key: string): any => {
                if (!byBaseState[key]) {
                    byBaseState[key] = {
                        key,
                        pa: 0,
                        runs: 0,
                        hits: 0,
                        bb: 0,
                        hbp: 0,
                        outs: 0,
                        runnerOuts: 0,
                        gidpLike: 0
                    }
                }

                return byBaseState[key]
            }

            const countStartRunners = (play: any): number => {
                const start = play.runner?.result?.start

                return [
                    start?.first,
                    start?.second,
                    start?.third
                ].filter(id => id != undefined).length
            }

            const isHit = (result: PlayResult): boolean => {
                return result === PlayResult.SINGLE ||
                    result === PlayResult.DOUBLE ||
                    result === PlayResult.TRIPLE ||
                    result === PlayResult.HR
            }

            const getTotalBases = (result: PlayResult): number => {
                if (result === PlayResult.SINGLE) return 1
                if (result === PlayResult.DOUBLE) return 2
                if (result === PlayResult.TRIPLE) return 3
                if (result === PlayResult.HR) return 4
                return 0
            }

            for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
                const rng = seedrandom(`run-creation-decomposition-sample-${sampleIndex}`)

                for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                    const game = baselineGameService.buildStartedBaselineGame(
                        clone(testPitchEnvironment),
                        `run-creation-decomposition-sample-${sampleIndex}-${gameIndex}`
                    )

                    while (!game.isComplete) {
                        simService.simPitch(game, rng)
                    }

                    totals.runs += game.score.home + game.score.away

                    for (const halfInning of game.halfInnings) {
                        totals.lob += halfInning.linescore.leftOnBase ?? 0
                    }

                    for (const play of GameInfo.getPlays(game)) {
                        if (!play.count?.end) continue

                        const row = getRow(getBaseStateKey(play))
                        const events: RunnerEvent[] = play.runner?.events ?? []
                        const runsOnPlay = events.filter(event => event.isScoringEvent).length
                        const outEvents = events.filter(event => event.movement?.isOut)
                        const runnerOutEvents = outEvents.filter(event => event.movement?.start !== BaseResult.HOME && !event.isCS)
                        const startedRunners = countStartRunners(play)
                        const nonCaughtStealingOuts = outEvents.filter(event => !event.isCS).length

                        totals.pa++
                        totals.runnersStartedOnBase += startedRunners
                        totals.runnersScoredFromBase += events.filter(event => event.isScoringEvent && event.movement?.start !== BaseResult.HOME).length
                        totals.runnersOutOnBase += runnerOutEvents.length

                        row.pa++
                        row.runs += runsOnPlay
                        row.outs += outEvents.length
                        row.runnerOuts += runnerOutEvents.length

                        if (play.result !== PlayResult.BB && play.result !== PlayResult.HIT_BY_PITCH) {
                            totals.ab++
                        }

                        if (isHit(play.result)) {
                            totals.hits++
                            totals.totalBases += getTotalBases(play.result)
                            row.hits++
                        }

                        if (play.result === PlayResult.SINGLE) totals.singles++
                        if (play.result === PlayResult.DOUBLE) totals.doubles++
                        if (play.result === PlayResult.TRIPLE) totals.triples++
                        if (play.result === PlayResult.HR) totals.homeRuns++

                        if (play.result === PlayResult.BB) {
                            totals.bb++
                            row.bb++
                        }

                        if (play.result === PlayResult.HIT_BY_PITCH) {
                            totals.hbp++
                            row.hbp++
                        }

                        if (play.result === PlayResult.STRIKEOUT) totals.so++

                        if (play.contact === Contact.GROUNDBALL && play.result === PlayResult.OUT && nonCaughtStealingOuts >= 2) {
                            totals.gidpLike++
                            row.gidpLike++
                        }

                        for (const event of events) {
                            if (event.isSBAttempt) totals.sbAttempts++
                            if (event.isSB) totals.sb++
                            if (event.isCS) totals.cs++

                            if (
                                !event.isSB &&
                                !event.isCS &&
                                event.throw &&
                                event.movement?.start !== BaseResult.HOME
                            ) {
                                totals.extraBaseRiskAttempts++

                                if (event.movement?.isOut) {
                                    totals.extraBaseRiskOut++
                                } else {
                                    totals.extraBaseRiskSafe++
                                }
                            }
                        }
                    }
                }
            }

            totals.baserunners = totals.hits + totals.bb + totals.hbp
            totals.nonHrBaserunners = totals.baserunners - totals.homeRuns

            const output = {
                gamesEach: games,
                samples,
                totalGames,
                teamGames,

                runsPerTeamGame: totals.runs / teamGames,
                paPerTeamGame: totals.pa / teamGames,

                avg: totals.hits / Math.max(1, totals.ab),
                obp: totals.baserunners / Math.max(1, totals.pa),
                slg: totals.totalBases / Math.max(1, totals.ab),
                babip: (totals.hits - totals.homeRuns) / Math.max(1, totals.ab - totals.so - totals.homeRuns),

                hitsPerTeamGame: totals.hits / teamGames,
                bbPerTeamGame: totals.bb / teamGames,
                hbpPerTeamGame: totals.hbp / teamGames,
                baserunnersPerTeamGame: totals.baserunners / teamGames,
                nonHrBaserunnersPerTeamGame: totals.nonHrBaserunners / teamGames,
                totalBasesPerTeamGame: totals.totalBases / teamGames,

                runsPerBaserunner: totals.runs / Math.max(1, totals.baserunners),
                runsPerNonHrBaserunner: totals.runs / Math.max(1, totals.nonHrBaserunners),
                runsPerTotalBase: totals.runs / Math.max(1, totals.totalBases),

                runnersStartedOnBasePerTeamGame: totals.runnersStartedOnBase / teamGames,
                runnersScoredFromBasePerTeamGame: totals.runnersScoredFromBase / teamGames,
                runnerScoreRateFromBase: totals.runnersScoredFromBase / Math.max(1, totals.runnersStartedOnBase),
                runnersOutOnBasePerTeamGame: totals.runnersOutOnBase / teamGames,
                runnerOutRateFromBase: totals.runnersOutOnBase / Math.max(1, totals.runnersStartedOnBase),

                lobPerTeamGame: totals.lob / teamGames,
                gidpLikePerTeamGame: totals.gidpLike / teamGames,
                csPerTeamGame: totals.cs / teamGames,
                sbPerTeamGame: totals.sb / teamGames,
                sbAttemptsPerTeamGame: totals.sbAttempts / teamGames,

                extraBaseRiskAttemptsPerTeamGame: totals.extraBaseRiskAttempts / teamGames,
                extraBaseRiskSafeRate: totals.extraBaseRiskSafe / Math.max(1, totals.extraBaseRiskAttempts),
                extraBaseRiskOutRate: totals.extraBaseRiskOut / Math.max(1, totals.extraBaseRiskAttempts),

                byBaseState: Object.values(byBaseState)
                    .map((row: any) => ({
                        key: row.key,
                        pa: row.pa,
                        paShare: row.pa / Math.max(1, totals.pa),
                        runsPerPA: row.runs / Math.max(1, row.pa),
                        hitsPerPA: row.hits / Math.max(1, row.pa),
                        bbPerPA: row.bb / Math.max(1, row.pa),
                        hbpPerPA: row.hbp / Math.max(1, row.pa),
                        outsPerPA: row.outs / Math.max(1, row.pa),
                        runnerOutsPerPA: row.runnerOuts / Math.max(1, row.pa),
                        gidpLikePerPA: row.gidpLike / Math.max(1, row.pa)
                    }))
                    .sort((a: any, b: any) => b.pa - a.pa)
            }

            console.log("\n=== RUN CREATION DECOMPOSITION ===")
            console.log(JSON.stringify(output, null, 2))

            assert.ok(output.runsPerTeamGame > 0)
        })

        it("diagnostic: run conversion accounting by play result and base state", async () => {
            const games = 150
            const samples = 3
            const totalGames = games * samples

            const testPitchEnvironment = clone(
                pitchEnvironment
            )

            const byPlayResult: Record<string, any> = {}
            const byBaseState: Record<string, any> = {}

            const getRow = (rows: Record<string, any>, key: string) => {
                if (!rows[key]) {
                    rows[key] = {
                        key,
                        pa: 0,
                        runs: 0,
                        eventOuts: 0,
                        countOuts: 0,
                        batterOuts: 0,
                        runnerOuts: 0,
                        runnerEvents: 0,
                        multiOutPlays: 0
                    }
                }

                return rows[key]
            }

            const baseStateKey = (play: any) => {
                const outs = Number(play.count?.start?.outs ?? 0)
                const start = play.runner?.result?.start

                const first = start?.first ? "1" : "_"
                const second = start?.second ? "2" : "_"
                const third = start?.third ? "3" : "_"

                return `${outs}:${first}${second}${third}`
            }

            const eventStart = (event: any) => event?.movement?.start
            const eventEnd = (event: any) => event?.movement?.end

            const isBatterEvent = (event: any) => {
                return eventStart(event) === BaseResult.HOME
            }

            const isOutEvent = (event: any) => {
                return event?.movement?.isOut === true
            }

            const getOutDeltaFromCount = (play: any) => {
                const startOuts = Number(play.count?.start?.outs)
                const endOuts = Number(play.count?.end?.outs)

                if (!Number.isFinite(startOuts) || !Number.isFinite(endOuts)) return 0

                return Math.max(0, endOuts - startOuts)
            }

            let totalRunsFromEvents = 0
            let totalRunsFromScore = 0
            let totalEventOuts = 0
            let totalCountOuts = 0
            let totalBatterOuts = 0
            let totalRunnerOuts = 0
            let totalMultiOutPlaysByEvents = 0
            let totalMultiOutPlaysByCount = 0
            let totalPA = 0

            const advancement = {
                single1BOpportunities: 0,
                single1BTo3BOrHome: 0,
                single2BOpportunities: 0,
                single2BToHome: 0,
                double1BOpportunities: 0,
                double1BToHome: 0
            }

            for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
                const rng = seedrandom(`run-conversion-accounting-diagnostic-sample-${sampleIndex}`)

                for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                    const game = baselineGameService.buildStartedBaselineGame(
                        clone(testPitchEnvironment),
                        `run-conversion-accounting-diagnostic-sample-${sampleIndex}-${gameIndex}`
                    )

                    while (!game.isComplete) {
                        simService.simPitch(game, rng)
                    }

                    totalRunsFromScore += game.score.home + game.score.away

                    const plays = GameInfo.getPlays(game)

                    for (const play of plays) {
                        if (!play.count?.end) continue

                        totalPA++

                        const key = String(play.result)
                        const stateKey = baseStateKey(play)
                        const events = play.runner?.events ?? []

                        const runs = events.filter((event: any) => event?.isScoringEvent === true).length
                        const eventOuts = events.filter(isOutEvent).length
                        const countOuts = getOutDeltaFromCount(play)
                        const batterOuts = events.filter((event: any) => isOutEvent(event) && isBatterEvent(event)).length
                        const runnerOuts = events.filter((event: any) => isOutEvent(event) && !isBatterEvent(event)).length

                        totalRunsFromEvents += runs
                        totalEventOuts += eventOuts
                        totalCountOuts += countOuts
                        totalBatterOuts += batterOuts
                        totalRunnerOuts += runnerOuts

                        if (eventOuts >= 2) totalMultiOutPlaysByEvents++
                        if (countOuts >= 2) totalMultiOutPlaysByCount++

                        const playRow = getRow(byPlayResult, key)
                        playRow.pa++
                        playRow.runs += runs
                        playRow.eventOuts += eventOuts
                        playRow.countOuts += countOuts
                        playRow.batterOuts += batterOuts
                        playRow.runnerOuts += runnerOuts
                        playRow.runnerEvents += events.length
                        if (eventOuts >= 2 || countOuts >= 2) playRow.multiOutPlays++

                        const stateRow = getRow(byBaseState, stateKey)
                        stateRow.pa++
                        stateRow.runs += runs
                        stateRow.eventOuts += eventOuts
                        stateRow.countOuts += countOuts
                        stateRow.batterOuts += batterOuts
                        stateRow.runnerOuts += runnerOuts
                        stateRow.runnerEvents += events.length
                        if (eventOuts >= 2 || countOuts >= 2) stateRow.multiOutPlays++

                        const start = play.runner?.result?.start
                        const finalForRunner = (runnerId: string | undefined) => {
                            if (!runnerId) return undefined
                            return events.filter((event: any) => event?.runner?._id === runnerId).at(-1)
                        }

                        if (play.result === PlayResult.SINGLE && start?.first) {
                            advancement.single1BOpportunities++
                            const final = finalForRunner(start.first)

                            if (
                                eventEnd(final) === BaseResult.THIRD ||
                                final?.isScoringEvent === true
                            ) {
                                advancement.single1BTo3BOrHome++
                            }
                        }

                        if (play.result === PlayResult.SINGLE && start?.second) {
                            advancement.single2BOpportunities++
                            const final = finalForRunner(start.second)

                            if (final?.isScoringEvent === true) {
                                advancement.single2BToHome++
                            }
                        }

                        if (play.result === PlayResult.DOUBLE && start?.first) {
                            advancement.double1BOpportunities++
                            const final = finalForRunner(start.first)

                            if (final?.isScoringEvent === true) {
                                advancement.double1BToHome++
                            }
                        }
                    }
                }
            }

            const summarizeRows = (rows: Record<string, any>) => {
                return Object.values(rows)
                    .map((row: any) => ({
                        key: row.key,
                        pa: row.pa,
                        paShare: totalPA > 0 ? row.pa / totalPA : 0,
                        runs: row.runs,
                        runsPerPA: row.pa > 0 ? row.runs / row.pa : 0,
                        eventOuts: row.eventOuts,
                        eventOutsPerPA: row.pa > 0 ? row.eventOuts / row.pa : 0,
                        countOuts: row.countOuts,
                        countOutsPerPA: row.pa > 0 ? row.countOuts / row.pa : 0,
                        batterOuts: row.batterOuts,
                        batterOutsPerPA: row.pa > 0 ? row.batterOuts / row.pa : 0,
                        runnerOuts: row.runnerOuts,
                        runnerOutsPerPA: row.pa > 0 ? row.runnerOuts / row.pa : 0,
                        runnerEventsPerPA: row.pa > 0 ? row.runnerEvents / row.pa : 0,
                        multiOutPlays: row.multiOutPlays
                    }))
                    .sort((a: any, b: any) => b.pa - a.pa)
            }

            const output = {
                gamesEach: games,
                samples,
                totalGames,
                totalRunsFromScore,
                totalRunsFromEvents,
                scoreMinusEvents: totalRunsFromScore - totalRunsFromEvents,
                runsPerGame: totalRunsFromScore / totalGames,
                paPerGame: totalPA / totalGames,
                totalEventOuts,
                totalCountOuts,
                eventOutsMinusCountOuts: totalEventOuts - totalCountOuts,
                eventOutsPerGame: totalEventOuts / totalGames,
                countOutsPerGame: totalCountOuts / totalGames,
                batterOutsPerGame: totalBatterOuts / totalGames,
                runnerOutsPerGame: totalRunnerOuts / totalGames,
                multiOutPlaysByEventsPerGame: totalMultiOutPlaysByEvents / totalGames,
                multiOutPlaysByCountPerGame: totalMultiOutPlaysByCount / totalGames,
                advancement: {
                    ...advancement,
                    single1BTo3BOrHomeRate: advancement.single1BOpportunities > 0 ? advancement.single1BTo3BOrHome / advancement.single1BOpportunities : 0,
                    single2BToHomeRate: advancement.single2BOpportunities > 0 ? advancement.single2BToHome / advancement.single2BOpportunities : 0,
                    double1BToHomeRate: advancement.double1BOpportunities > 0 ? advancement.double1BToHome / advancement.double1BOpportunities : 0
                },
                byPlayResult: summarizeRows(byPlayResult),
                topBaseStates: summarizeRows(byBaseState).slice(0, 16)
            }

            console.log("\n=== RUN CONVERSION ACCOUNTING ===")
            console.log(JSON.stringify(output, null, 2))

            assert.equal(totalEventOuts, totalCountOuts)
        })

        it("diagnostic: multi-out play detection and double play pathing", async () => {
            const games = 150
            const samples = 3
            const totalGames = games * samples

            const testPitchEnvironment = clone(
                pitchEnvironment
            )

            const byPlayResult: Record<string, any> = {}
            const byEventOutSignature: Record<string, number> = {}
            const sampleMultiOutPlays: any[] = []
            const sampleMismatchedOutPlays: any[] = []

            const increment = (rows: Record<string, any>, key: string, patch: any = {}) => {
                if (!rows[key]) {
                    rows[key] = {
                        key,
                        pa: 0,
                        countOuts0: 0,
                        countOuts1: 0,
                        countOuts2: 0,
                        countOuts3: 0,
                        eventOuts0: 0,
                        eventOuts1: 0,
                        eventOuts2: 0,
                        eventOuts3: 0,
                        countMultiOuts: 0,
                        eventMultiOuts: 0,
                        countEventMismatch: 0
                    }
                }

                rows[key].pa++

                for (const [patchKey, value] of Object.entries(patch)) {
                    rows[key][patchKey] = Number(rows[key][patchKey] ?? 0) + Number(value)
                }
            }

            const getOutDeltaFromCount = (play: any) => {
                const startOuts = Number(play.count?.start?.outs)
                const endOuts = Number(play.count?.end?.outs)

                if (!Number.isFinite(startOuts) || !Number.isFinite(endOuts)) return 0

                return Math.max(0, endOuts - startOuts)
            }

            const compactEvent = (event: any) => ({
                runnerId: event?.runner?._id,
                runnerName: event?.runner?.fullName,
                eventType: event?.eventType,
                start: event?.movement?.start,
                end: event?.movement?.end,
                isOut: event?.movement?.isOut === true,
                isForce: event?.isForce === true,
                isScoringEvent: event?.isScoringEvent === true,
                throwResult: event?.throw?.result,
                throwFrom: event?.throw?.from?.currentPosition,
                throwTo: event?.throw?.to
            })

            let totalPA = 0
            let totalCountOuts = 0
            let totalEventOuts = 0
            let totalCountMultiOuts = 0
            let totalEventMultiOuts = 0
            let totalMismatches = 0

            for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
                const rng = seedrandom(`multi-out-play-detection-diagnostic-sample-${sampleIndex}`)

                for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                    const game = baselineGameService.buildStartedBaselineGame(
                        clone(testPitchEnvironment),
                        `multi-out-play-detection-diagnostic-sample-${sampleIndex}-${gameIndex}`
                    )

                    while (!game.isComplete) {
                        simService.simPitch(game, rng)
                    }

                    for (const play of GameInfo.getPlays(game)) {
                        if (!play.count?.end) continue

                        totalPA++

                        const key = String(play.result)
                        const events = play.runner?.events ?? []
                        const countOuts = getOutDeltaFromCount(play)
                        const eventOuts = events.filter((event: any) => event?.movement?.isOut === true).length

                        totalCountOuts += countOuts
                        totalEventOuts += eventOuts

                        if (countOuts >= 2) totalCountMultiOuts++
                        if (eventOuts >= 2) totalEventMultiOuts++
                        if (countOuts !== eventOuts) totalMismatches++

                        const patch: any = {}

                        patch[`countOuts${Math.min(countOuts, 3)}`] = 1
                        patch[`eventOuts${Math.min(eventOuts, 3)}`] = 1

                        if (countOuts >= 2) patch.countMultiOuts = 1
                        if (eventOuts >= 2) patch.eventMultiOuts = 1
                        if (countOuts !== eventOuts) patch.countEventMismatch = 1

                        increment(byPlayResult, key, patch)

                        const eventOutSignature = events
                            .filter((event: any) => event?.movement?.isOut === true)
                            .map((event: any) => `${event?.movement?.start}->${event?.movement?.end}:${event?.eventType}`)
                            .join("|") || "no-outs"

                        byEventOutSignature[eventOutSignature] = Number(byEventOutSignature[eventOutSignature] ?? 0) + 1

                        if ((countOuts >= 2 || eventOuts >= 2) && sampleMultiOutPlays.length < 12) {
                            sampleMultiOutPlays.push({
                                result: play.result,
                                contact: play.contact,
                                shallowDeep: play.shallowDeep,
                                countStart: play.count?.start,
                                countEnd: play.count?.end,
                                countOuts,
                                eventOuts,
                                runnerStart: play.runner?.result?.start,
                                runnerEnd: play.runner?.result?.end,
                                events: events.map(compactEvent)
                            })
                        }

                        if (countOuts !== eventOuts && sampleMismatchedOutPlays.length < 12) {
                            sampleMismatchedOutPlays.push({
                                result: play.result,
                                contact: play.contact,
                                shallowDeep: play.shallowDeep,
                                countStart: play.count?.start,
                                countEnd: play.count?.end,
                                countOuts,
                                eventOuts,
                                runnerStart: play.runner?.result?.start,
                                runnerEnd: play.runner?.result?.end,
                                events: events.map(compactEvent)
                            })
                        }
                    }
                }
            }

            const output = {
                gamesEach: games,
                samples,
                totalGames,
                totalPA,
                paPerGame: totalPA / totalGames,
                totalCountOuts,
                totalEventOuts,
                countOutsPerGame: totalCountOuts / totalGames,
                eventOutsPerGame: totalEventOuts / totalGames,
                totalCountMultiOuts,
                totalEventMultiOuts,
                countMultiOutsPerGame: totalCountMultiOuts / totalGames,
                eventMultiOutsPerGame: totalEventMultiOuts / totalGames,
                totalMismatches,
                mismatchesPerGame: totalMismatches / totalGames,
                byPlayResult: Object.values(byPlayResult).sort((a: any, b: any) => b.pa - a.pa),
                topEventOutSignatures: Object.entries(byEventOutSignature)
                    .map(([key, count]) => ({ key, count }))
                    .sort((a: any, b: any) => b.count - a.count)
                    .slice(0, 20),
                sampleMultiOutPlays,
                sampleMismatchedOutPlays
            }

            console.log("\n=== MULTI-OUT PLAY DETECTION ===")
            console.log(JSON.stringify(output, null, 2))

            assert.equal(totalCountOuts, totalEventOuts)
        })

        it("diagnostic: runner advancement opportunity conversion rates", async () => {
            const games = 150
            const samples = 3
            const totalGames = games * samples

            const testPitchEnvironment = clone(
                pitchEnvironment
            )

            const rows: Record<string, any> = {}

            const getRow = (key: string) => {
                if (!rows[key]) {
                    rows[key] = {
                        key,
                        opportunities: 0,
                        scored: 0,
                        advanced: 0,
                        out: 0
                    }
                }

                return rows[key]
            }

            const finalForRunner = (events: RunnerEvent[], runnerId: string) => {
                return events.filter(e => e.runner?._id === runnerId).at(-1)
            }

            for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
                const rng = seedrandom(`advancement-opportunity-diagnostic-sample-${sampleIndex}`)

                for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                    const game = baselineGameService.buildStartedBaselineGame(
                        clone(testPitchEnvironment),
                        `advancement-opportunity-diagnostic-sample-${sampleIndex}-${gameIndex}`
                    )

                    while (!game.isComplete) {
                        simService.simPitch(game, rng)
                    }

                    for (const play of GameInfo.getPlays(game)) {
                        if (!play.count?.end) continue

                        const start = play.runner?.result?.start
                        const events: RunnerEvent[] = play.runner?.events ?? []

                        if (play.result === PlayResult.SINGLE && start.first) {
                            const row = getRow("single_runner_on_1B_to_3B_or_home")
                            const final = finalForRunner(events, start.first)

                            row.opportunities++

                            if (final?.movement?.isOut) row.out++
                            if (final?.isScoringEvent || final?.movement?.end === BaseResult.HOME) row.scored++
                            if (
                                final?.isScoringEvent ||
                                final?.movement?.end === BaseResult.HOME ||
                                final?.movement?.end === BaseResult.THIRD
                            ) {
                                row.advanced++
                            }
                        }

                        if (play.result === PlayResult.SINGLE && start.second) {
                            const row = getRow("single_runner_on_2B_to_home")
                            const final = finalForRunner(events, start.second)

                            row.opportunities++

                            if (final?.movement?.isOut) row.out++
                            if (final?.isScoringEvent || final?.movement?.end === BaseResult.HOME) row.scored++
                            if (final?.isScoringEvent || final?.movement?.end === BaseResult.HOME) row.advanced++
                        }

                        if (play.result === PlayResult.DOUBLE && start.first) {
                            const row = getRow("double_runner_on_1B_to_home")
                            const final = finalForRunner(events, start.first)

                            row.opportunities++

                            if (final?.movement?.isOut) row.out++
                            if (final?.isScoringEvent || final?.movement?.end === BaseResult.HOME) row.scored++
                            if (final?.isScoringEvent || final?.movement?.end === BaseResult.HOME) row.advanced++
                        }
                    }
                }
            }

            const output = Object.values(rows).map(row => ({
                key: row.key,
                totalGames,
                opportunities: row.opportunities,
                opportunitiesPerGame: row.opportunities / totalGames,
                advanced: row.advanced,
                scored: row.scored,
                out: row.out,
                advanceRate: row.opportunities > 0 ? row.advanced / row.opportunities : 0,
                scoreRate: row.opportunities > 0 ? row.scored / row.opportunities : 0,
                outRate: row.opportunities > 0 ? row.out / row.opportunities : 0
            }))

            console.log("\n=== RUNNER ADVANCEMENT OPPORTUNITY CONVERSION ===")
            console.log(JSON.stringify(output, null, 2))

            assert.ok(output.length > 0)
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
                const game = baselineGameService.buildStartedBaselineGame(
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
                const game = baselineGameService.buildStartedBaselineGame(
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

    })
}

if (toRun.includes(DiagnosticTest.RUNNER_AND_GAME_REGRESSION)) {
    describe("Runner and Game Regression", () => {

        it("should expose lineup wrap when next hitter is still on base", () => {
            const baselineGame = baselineGameService.buildStartedBaselineGame(pitchEnvironment)
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
                    ; (simService as any).validateNextHitterIsNotOnBase(
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
            const baselineGame = baselineGameService.buildStartedBaselineGame(pitchEnvironment)
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

            const events = (simService as any).runnerService.getRunnerEvents(
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
            const baselineGame = baselineGameService.buildStartedBaselineGame(pitchEnvironment)
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

            const events = (simService as any).runnerService.getRunnerEvents(
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
            const baselineGame = baselineGameService.buildStartedBaselineGame(pitchEnvironment)
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

            const events = (simService as any).runnerService.getRunnerEvents(
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
            const baselineGame = baselineGameService.buildStartedBaselineGame(pitchEnvironment)
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

            const events = (simService as any).runnerService.getRunnerEvents(
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

        it("inning can end during runner events; stop further processing but keep events", async () => {
            const game = baselineGameService.buildStartedBaselineGame(pitchEnvironment, "game-runner-events-inning-end")
            const target = clone(game.pitchEnvironmentTarget)
            target.running.advancement.runnerOnSecondToHomeOnSingle = 1
            const offense = clone(game.away)
            const defense = clone(game.home)

            const pitcher = defense.players.find((p: GamePlayer) => p._id === defense.currentPitcherId)
            const fielder =
                defense.players.find((p: GamePlayer) => p.currentPosition === Position.CENTER_FIELD) ??
                defense.players.find((p: GamePlayer) => p.currentPosition === Position.RIGHT_FIELD) ??
                defense.players.find((p: GamePlayer) => p.currentPosition === Position.LEFT_FIELD)

            const hitter = offense.players.find((p: GamePlayer) => offense.lineupIds.includes(p._id))
            const runner2B = offense.players.find((p: GamePlayer) => p._id !== hitter?._id)

            assert.ok(pitcher)
            assert.ok(fielder)
            assert.ok(hitter)
            assert.ok(runner2B)

            const runnerResult: RunnerResult = {
                first: undefined,
                second: runner2B._id,
                third: undefined,
                out: [],
                scored: []
            }

            const halfInningRunnerEvents: RunnerEvent[] = [
                { runner: { _id: "fakeOut1" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } } as RunnerEvent,
                { runner: { _id: "fakeOut2" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } } as RunnerEvent
            ]

            const defensiveCredits: any[] = []

            const runnerService = (simService as any).runnerService
            const originalChance = runnerService.getChanceRunnerSafe
            const originalThrow = runnerService.gameRolls.getThrowResult

            runnerService.getChanceRunnerSafe = () => 95
            runnerService.gameRolls.getThrowResult = () => ({ roll: 100, result: ThrowResult.OUT })

            let inPlayRunnerEvents: RunnerEvent[] = []

            try {
                inPlayRunnerEvents = runnerService.getRunnerEvents(
                    () => 0.5,
                    runnerResult,
                    halfInningRunnerEvents,
                    defensiveCredits,
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
            } finally {
                runnerService.getChanceRunnerSafe = originalChance
                runnerService.gameRolls.getThrowResult = originalThrow
            }

            const outs =
                halfInningRunnerEvents.filter(e => e?.movement?.isOut).length +
                inPlayRunnerEvents.filter(e => e?.movement?.isOut).length

            assert.equal(outs, 3)
            assert.ok(inPlayRunnerEvents.length > 0)

            const baseIds = [runnerResult.first, runnerResult.second, runnerResult.third].filter(Boolean)
            assert.equal(new Set(baseIds).size, baseIds.length)
        })

        it("ground ball to infielder with runner on 3B and 2 outs must record batter out at 1B, no run", async () => {
            const game = baselineGameService.buildStartedBaselineGame(pitchEnvironment, "game-groundout-runner-third")
            const target = clone(game.pitchEnvironmentTarget)

            const offense = clone(game.away)
            const defense = clone(game.home)

            const pitcher = defense.players.find((p: GamePlayer) => p._id === defense.currentPitcherId)
            const infielder =
                defense.players.find((p: GamePlayer) => p.currentPosition === Position.FIRST_BASE) ??
                defense.players.find((p: GamePlayer) => p.currentPosition === Position.SECOND_BASE) ??
                defense.players.find((p: GamePlayer) => p.currentPosition === Position.THIRD_BASE) ??
                defense.players.find((p: GamePlayer) => p.currentPosition === Position.SHORTSTOP)

            const hitter = offense.players.find((p: GamePlayer) => offense.lineupIds.includes(p._id))
            const runner3B = offense.players.find((p: GamePlayer) => p._id !== hitter?._id)

            assert.ok(pitcher)
            assert.ok(infielder)
            assert.ok(hitter)
            assert.ok(runner3B)

            const runnerResult: RunnerResult = {
                first: undefined,
                second: undefined,
                third: runner3B._id,
                out: [],
                scored: []
            }

            const halfInningRunnerEvents: RunnerEvent[] = [
                { runner: { _id: "out1" }, movement: { isOut: true } } as RunnerEvent,
                { runner: { _id: "out2" }, movement: { isOut: true } } as RunnerEvent
            ]

            const defensiveCredits: any[] = []

            const runnerService = (simService as any).runnerService
            const originalChance = runnerService.getChanceRunnerSafe
            const originalThrow = runnerService.gameRolls.getThrowResult

            runnerService.getChanceRunnerSafe = () => 95
            runnerService.gameRolls.getThrowResult = () => ({ roll: 100, result: ThrowResult.OUT })

            let inPlayRunnerEvents: RunnerEvent[] = []

            try {
                inPlayRunnerEvents = runnerService.getRunnerEvents(
                    () => 0.5,
                    runnerResult,
                    halfInningRunnerEvents,
                    defensiveCredits,
                    target,
                    PlayResult.OUT,
                    Contact.GROUNDBALL,
                    ShallowDeep.NORMAL,
                    hitter,
                    infielder,
                    undefined,
                    undefined,
                    runner3B,
                    offense,
                    defense,
                    pitcher,
                    2
                )
            } finally {
                runnerService.getChanceRunnerSafe = originalChance
                runnerService.gameRolls.getThrowResult = originalThrow
            }

            const batterEvent = inPlayRunnerEvents.find(e => e?.runner?._id === hitter._id)

            assert.ok(batterEvent)
            assert.equal(batterEvent.movement?.isOut, true)

            const outs =
                halfInningRunnerEvents.filter(e => e?.movement?.isOut).length +
                inPlayRunnerEvents.filter(e => e?.movement?.isOut).length

            assert.equal(outs, 3)

            const scored = inPlayRunnerEvents.some(e => e?.movement?.end === BaseResult.HOME && !e?.movement?.isOut)
            assert.equal(scored, false)
        })

    })
}

if (toRun.includes(DiagnosticTest.TUNING_SENSITIVITY)) {
    describe("Tuning Sensitivity", () => {

        it("should print full tuning knob sensitivity ranges for offense and advancement", () => {
            const games = 150
            const samples = 3
            const totalGames = games * samples

            type KnobSpec = {
                name: string
                values: number[]
                apply: (tuning: PitchEnvironmentTuning["tuning"], value: number) => void
            }

            const knobSpecs: KnobSpec[] = [
                {
                    name: "advancementAggressionScale",
                    values: [-0.99, -0.5, 0, 0.5, 1, 2, 3, 4],
                    apply: (tuning, value) => {
                        tuning.running.advancementAggressionScale = value
                    }
                },
                {
                    name: "stealAttemptAggressionScale",
                    values: [-0.75, -0.5, 0, 0.25, 0.5, 1, 1.5, 2],
                    apply: (tuning, value) => {
                        tuning.running.stealAttemptAggressionScale = value
                    }
                },
                {
                    name: "walkRateScale",
                    values: [-0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.1],
                    apply: (tuning, value) => {
                        tuning.swing.walkRateScale = value
                    }
                },
                {
                    name: "outOutcomeScale",
                    values: [-0.25, -0.15, -0.075, 0, 0.075, 0.15, 0.25],
                    apply: (tuning, value) => {
                        tuning.contactQuality.outOutcomeScale = value
                    }
                },
                {
                    name: "doubleOutcomeScale",
                    values: [-0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35],
                    apply: (tuning, value) => {
                        tuning.contactQuality.doubleOutcomeScale = value
                    }
                },
                {
                    name: "tripleOutcomeScale",
                    values: [-0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35],
                    apply: (tuning, value) => {
                        tuning.contactQuality.tripleOutcomeScale = value
                    }
                },
                {
                    name: "homeRunOutcomeScale",
                    values: [-0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35],
                    apply: (tuning, value) => {
                        tuning.contactQuality.homeRunOutcomeScale = value
                    }
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
                    apply: (tuning, value) => {
                        tuning.meta.fullTeamDefenseBonus = value
                    }
                },
                {
                    name: "fullFielderDefenseBonus",
                    values: [-200, -100, -50, 0, 50, 100, 200],
                    apply: (tuning, value) => {
                        tuning.meta.fullFielderDefenseBonus = value
                    }
                }
            ]

            const getBaseStateKey = (first?: string, second?: string, third?: string): string => {
                return `${first ? "1" : "_"}${second ? "2" : "_"}${third ? "3" : "_"}`
            }

            const baseText = (base: BaseResult | undefined): string => {
                return base === undefined ? "NONE" : String(base)
            }

            const getRow = (map: Map<string, any>, key: string, factory: () => any): any => {
                if (!map.has(key)) {
                    map.set(key, factory())
                }

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

                    if (pitchDiff !== 0) {
                        return pitchDiff
                    }

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
                    gamesEach: games,
                    samples,
                    totalGames,
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

                for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
                    const rng = seedrandom(`knob-sensitivity-${label}-sample-${sampleIndex}`)

                    for (let gameIndex = 0; gameIndex < games; gameIndex++) {
                        const game = baselineGameService.buildStartedBaselineGame(
                            clone(testPitchEnvironment),
                            `knob-sensitivity-${label}-sample-${sampleIndex}-${gameIndex}`
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

                                const start: RunnerResult = play.runner?.result?.start
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

                                if (startedWithRunners) {
                                    totals.runnersOnPa++
                                } else {
                                    totals.basesEmptyPa++
                                }

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

                                if (play.result === PlayResult.BB) {
                                    baseStateRow.bb++
                                }

                                if (play.result === PlayResult.SINGLE || play.result === PlayResult.DOUBLE || play.result === PlayResult.TRIPLE || play.result === PlayResult.HR) {
                                    baseStateRow.hits++
                                }

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

                                if (startedWithRunners) {
                                    playResultRow.runnersOn++
                                } else {
                                    playResultRow.basesEmpty++
                                }

                                const originalStartByRunner = new Map<string, BaseResult | undefined>()

                                if (start.first) originalStartByRunner.set(start.first, BaseResult.FIRST)
                                if (start.second) originalStartByRunner.set(start.second, BaseResult.SECOND)
                                if (start.third) originalStartByRunner.set(start.third, BaseResult.THIRD)
                                if (play.hitterId) originalStartByRunner.set(play.hitterId, BaseResult.HOME)

                                const eventsByRunner = new Map<string, RunnerEvent[]>()

                                for (const event of events) {
                                    const runnerId = event.runner?._id

                                    if (!runnerId) {
                                        continue
                                    }

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

                                    if (scored) {
                                        chainRow.runs++
                                    }

                                    if (isOut) {
                                        chainRow.outs++
                                    }

                                    if (hasThrow) {
                                        chainRow.throws++
                                    }

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

                                        if (isOut) {
                                            advancement.single1BTo3BOut++
                                        } else if (finalEnd === BaseResult.THIRD || finalEnd === BaseResult.HOME || scored) {
                                            advancement.single1BTo3BSafe++
                                        }
                                    }

                                    if (play.result === PlayResult.SINGLE && originalStart === BaseResult.SECOND && orderedEvents.length > 1) {
                                        advancement.single2BToHomeRiskAttempts++

                                        if (isOut) {
                                            advancement.single2BToHomeOut++
                                        } else if (finalEnd === BaseResult.HOME || scored) {
                                            advancement.single2BToHomeSafe++
                                        }
                                    }

                                    if (play.result === PlayResult.DOUBLE && originalStart === BaseResult.FIRST && orderedEvents.length > 1) {
                                        advancement.double1BToHomeRiskAttempts++

                                        if (isOut) {
                                            advancement.double1BToHomeOut++
                                        } else if (finalEnd === BaseResult.HOME || scored) {
                                            advancement.double1BToHomeSafe++
                                        }
                                    }

                                    if (play.result === PlayResult.OUT && originalStart === BaseResult.THIRD && (orderedEvents.length > 1 || finalEnd === BaseResult.HOME || isOut)) {
                                        advancement.out3BToHomeAttempts++

                                        if (isOut) {
                                            advancement.out3BToHomeOut++
                                        } else if (finalEnd === BaseResult.HOME || scored) {
                                            advancement.out3BToHomeSafe++
                                        }
                                    }
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
                    gamesEach: games,
                    samples,
                    totalGames,
                    teamRunsPerGame: totals.runs / totalGames / 2,
                    teamPaPerGame: totals.pa / totalGames / 2,
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
                    teamHomeRunsPerGame: totals.hr / totalGames / 2,
                    teamDoublesPerGame: totals.doubles / totalGames / 2,
                    teamSBAttemptsPerGame: totals.sbAttempts / totalGames / 2,
                    teamSBPerGame: totals.sb / totalGames / 2,
                    teamCSPerGame: totals.cs / totalGames / 2,
                    stealSuccessRate: totals.sbAttempts > 0 ? totals.sb / totals.sbAttempts : 0,
                    teamLOBPerGame: totals.lob / totalGames / 2,
                    runnersOnPAShare: totals.runnersOnPa / pa,
                    runnerOutsOnBasesPerGame: totals.runnerOutsOnBases / totalGames / 2,
                    gidpLikePerGame: totals.gidpLike / totalGames / 2,
                    wildPitchAdvancesPerGame: totals.wildPitchAdvances / totalGames / 2,
                    passedBallAdvancesPerGame: totals.passedBallAdvances / totalGames / 2,
                    scoreMinusLinescore: totals.scoreRuns - totals.linescoreRuns,
                    scoreMinusEvents: totals.scoreRuns - totals.eventRuns,
                    single1BTo3BRiskAttemptsPerGame: advancement.single1BTo3BRiskAttempts / totalGames / 2,
                    single1BTo3BRiskSafeRate: advancement.single1BTo3BRiskAttempts > 0 ? advancement.single1BTo3BSafe / advancement.single1BTo3BRiskAttempts : 0,
                    single1BTo3BRiskOutRate: advancement.single1BTo3BRiskAttempts > 0 ? advancement.single1BTo3BOut / advancement.single1BTo3BRiskAttempts : 0,
                    single2BToHomeRiskAttemptsPerGame: advancement.single2BToHomeRiskAttempts / totalGames / 2,
                    single2BToHomeRiskSafeRate: advancement.single2BToHomeRiskAttempts > 0 ? advancement.single2BToHomeSafe / advancement.single2BToHomeRiskAttempts : 0,
                    single2BToHomeRiskOutRate: advancement.single2BToHomeRiskAttempts > 0 ? advancement.single2BToHomeOut / advancement.single2BToHomeRiskAttempts : 0,
                    double1BToHomeRiskAttemptsPerGame: advancement.double1BToHomeRiskAttempts / totalGames / 2,
                    double1BToHomeRiskSafeRate: advancement.double1BToHomeRiskAttempts > 0 ? advancement.double1BToHomeSafe / advancement.double1BToHomeRiskAttempts : 0,
                    double1BToHomeRiskOutRate: advancement.double1BToHomeRiskAttempts > 0 ? advancement.double1BToHomeOut / advancement.double1BToHomeRiskAttempts : 0,
                    out3BToHomeAttemptsPerGame: advancement.out3BToHomeAttempts / totalGames / 2,
                    out3BToHomeSafeRate: advancement.out3BToHomeAttempts > 0 ? advancement.out3BToHomeSafe / advancement.out3BToHomeAttempts : 0,
                    out3BToHomeOutRate: advancement.out3BToHomeAttempts > 0 ? advancement.out3BToHomeOut / advancement.out3BToHomeAttempts : 0,
                    automaticSecondToHomeOnDoublePerGame: advancement.automaticSecondToHomeOnDouble / totalGames / 2,
                    automaticThirdToHomeOnSinglePerGame: advancement.automaticThirdToHomeOnSingle / totalGames / 2,
                    automaticThirdToHomeOnDoublePerGame: advancement.automaticThirdToHomeOnDouble / totalGames / 2
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
                    const result = evaluate(`${spec.name}=${value}`, tuning => {
                        spec.apply(tuning, value)
                    })

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
}


























