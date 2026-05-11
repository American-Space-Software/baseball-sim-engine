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
const evaluationGames = 30

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
            singleOutcomeScale: overrides?.contactQuality?.singleOutcomeScale ?? 0,
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

describe("Tuner", async () => {

    it("should calculate pitch environment target for season", async () => {
        pitchEnvironment = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)

        assert.ok(pitchEnvironment)
    })


    // it("should print count progression and walk bottleneck report", () => {
    //     const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

    //     testPitchEnvironment.pitchEnvironmentTuning = {
    //         tuning: makeTuning()
    //     } as PitchEnvironmentTuning

    //     const rng = seedrandom("walk-bottleneck-full-test")
    //     const games = evaluationGames

    //     const countRows = new Map<string, {
    //         pitches: number
    //         paEndingHere: number
    //         bb: number
    //         so: number
    //         inPlay: number
    //         hits: number
    //         hr: number
    //     }>()

    //     const getRow = (count: string) => {
    //         if (!countRows.has(count)) {
    //             countRows.set(count, {
    //                 pitches: 0,
    //                 paEndingHere: 0,
    //                 bb: 0,
    //                 so: 0,
    //                 inPlay: 0,
    //                 hits: 0,
    //                 hr: 0
    //             })
    //         }
    //         return countRows.get(count)!
    //     }

    //     const getCountKey = (balls: number, strikes: number): string => `${balls}-${strikes}`

    //     for (let gameIndex = 0; gameIndex < games; gameIndex++) {
    //         const game = playerImporterService.buildStartedBaselineGame(
    //             clone(testPitchEnvironment),
    //             `walk-bottleneck-full-${gameIndex}`
    //         )

    //         while (!game.isComplete) {
    //             simService.simPitch(game, rng)
    //         }

    //         for (const play of game.halfInnings.flatMap(hi => hi.plays)) {
    //             const pitches = play.pitchLog?.pitches ?? []

    //             let balls = 0
    //             let strikes = 0
    //             let finalCount = getCountKey(balls, strikes)

    //             for (const pitch of pitches) {
    //                 const key = getCountKey(balls, strikes)
    //                 const row = getRow(key)

    //                 finalCount = key
    //                 row.pitches++

    //                 if (pitch.result === PitchCall.IN_PLAY) row.inPlay++

    //                 if (pitch.result === PitchCall.BALL) {
    //                     balls++
    //                 } else if (pitch.result === PitchCall.STRIKE) {
    //                     strikes++
    //                 } else if (pitch.result === PitchCall.FOUL && strikes < 2) {
    //                     strikes++
    //                 }
    //             }

    //             const finalRow = getRow(finalCount)
    //             finalRow.paEndingHere++

    //             if (play.result === PlayResult.BB) finalRow.bb++
    //             if (play.result === PlayResult.STRIKEOUT) finalRow.so++

    //             if (
    //                 play.result === PlayResult.SINGLE ||
    //                 play.result === PlayResult.DOUBLE ||
    //                 play.result === PlayResult.TRIPLE ||
    //                 play.result === PlayResult.HR
    //             ) {
    //                 finalRow.hits++
    //             }

    //             if (play.result === PlayResult.HR) finalRow.hr++
    //         }
    //     }

    //     const rows = Array.from(countRows.entries()).map(([count, row]) => ({
    //         count,
    //         ...row
    //     }))

    //     const totalPitches = rows.reduce((s, r) => s + r.pitches, 0)
    //     const totalPA = rows.reduce((s, r) => s + r.paEndingHere, 0)
    //     const totalBB = rows.reduce((s, r) => s + r.bb, 0)
    //     const totalBIP = rows.reduce((s, r) => s + r.inPlay, 0)
    //     const totalHits = rows.reduce((s, r) => s + r.hits, 0)
    //     const totalHR = rows.reduce((s, r) => s + r.hr, 0)
    //     const totalSO = rows.reduce((s, r) => s + r.so, 0)

    //     const before3 = rows.filter(r => Number(r.count.split("-")[0]) < 3)
    //     const at3 = rows.filter(r => Number(r.count.split("-")[0]) === 3)

    //     console.log("=== WALK BOTTLENECK SUMMARY ===")
    //     console.log({
    //         countRows: rows.length,
    //         totalPitches,
    //         totalPAEnding: totalPA,
    //         threeBallPitchShare: totalPitches > 0 ? at3.reduce((s, r) => s + r.pitches, 0) / totalPitches : 0,
    //         walkShareFromThreeBallCounts: totalBB > 0 ? at3.reduce((s, r) => s + r.bb, 0) / totalBB : 0,
    //         endedBeforeThreeBallsShare: totalPA > 0 ? before3.reduce((s, r) => s + r.paEndingHere, 0) / totalPA : 0,
    //         bipBeforeThreeBallsShareOfPA: totalPA > 0 ? before3.reduce((s, r) => s + r.inPlay, 0) / totalPA : 0,
    //         bipBeforeThreeBallsShareOfBIP: totalBIP > 0 ? before3.reduce((s, r) => s + r.inPlay, 0) / totalBIP : 0,
    //         walksPerPA: totalPA > 0 ? totalBB / totalPA : 0,
    //         ballsInPlayPerPA: totalPA > 0 ? totalBIP / totalPA : 0,
    //         strikeoutsPerPA: totalPA > 0 ? totalSO / totalPA : 0,
    //         hitsPerPA: totalPA > 0 ? totalHits / totalPA : 0,
    //         homeRunsPerPA: totalPA > 0 ? totalHR / totalPA : 0
    //     })

    //     console.log("=== WALK BOTTLENECK BY COUNT ===")
    //     for (const row of rows.sort((a, b) => {
    //         const [ab, as] = a.count.split("-").map(Number)
    //         const [bb, bs] = b.count.split("-").map(Number)
    //         return as === bs ? ab - bb : as - bs
    //     })) {
    //         console.log(row)
    //     }

    //     assert.ok(totalPA > 0)
    // })
    
    // it("should print tuning knob sensitivity against core offense metrics", async () => {
    //     const baseEnvironment = clone(pitchEnvironment)
    //     const games = 100

    //     const baseTuning = clone(baseEnvironment.pitchEnvironmentTuning?.tuning ?? {
    //         contactQuality: {
    //             evScale: 0,
    //             laScale: 0,
    //             distanceScale: 0,
    //             homeRunOutcomeScale: 0
    //         },
    //         swing: {
    //             pitchQualityZoneSwingEffect: 0,
    //             pitchQualityChaseSwingEffect: 0,
    //             disciplineZoneSwingEffect: 0,
    //             disciplineChaseSwingEffect: 0
    //         },
    //         contact: {
    //             pitchQualityContactEffect: 0,
    //             contactSkillEffect: 0
    //         },
    //         running: {
    //             stealAttemptAggressionScale: 1
    //         },
    //         meta: {
    //             fullPitchQualityBonus: 0,
    //             fullTeamDefenseBonus: 0,
    //             fullFielderDefenseBonus: 0
    //         }
    //     })

    //     const makeEnvironment = (label: string, tuning: PitchEnvironmentTuning["tuning"]): PitchEnvironmentTarget => {
    //         const testEnvironment = clone(baseEnvironment)

    //         testEnvironment.pitchEnvironmentTuning = {
    //             _id: `knob-sensitivity-${label}`,
    //             tuning
    //         } as PitchEnvironmentTuning

    //         return testEnvironment
    //     }

    //     const evaluate = (label: string, tuning: PitchEnvironmentTuning["tuning"]) => {
    //         const testEnvironment = makeEnvironment(label, tuning)
    //         const result = playerImporterService.evaluatePitchEnvironment(
    //             testEnvironment,
    //             seedrandom(`knob-sensitivity-${label}`),
    //             games
    //         )

    //         return {
    //             label,
    //             runs: result.actual.teamRunsPerGame,
    //             avg: result.actual.avg,
    //             obp: result.actual.obp,
    //             slg: result.actual.slg,
    //             ops: result.actual.ops,
    //             babip: result.actual.babip,
    //             bbPercent: result.actual.bbPercent,
    //             homeRunPercent: result.actual.homeRunPercent,
    //             teamHitsPerGame: result.actual.teamHitsPerGame,
    //             teamHomeRunsPerGame: result.actual.teamHomeRunsPerGame,
    //             teamBBPerGame: result.actual.teamBBPerGame,
    //             pitchesPerPA: result.actual.pitchesPerPA,
    //             chase: result.actual.swingAtBallsPercent,
    //             zSwing: result.actual.swingAtStrikesPercent,
    //             zContact: result.actual.inZoneContactPercent,
    //             chaseContact: result.actual.outZoneContactPercent
    //         }
    //     }

    //     const withPatch = (patch: Partial<PitchEnvironmentTuning["tuning"]>): PitchEnvironmentTuning["tuning"] => {
    //         return {
    //             contactQuality: {
    //                 ...baseTuning.contactQuality,
    //                 ...(patch.contactQuality ?? {})
    //             },
    //             swing: {
    //                 ...baseTuning.swing,
    //                 ...(patch.swing ?? {})
    //             },
    //             contact: {
    //                 ...baseTuning.contact,
    //                 ...(patch.contact ?? {})
    //             },
    //             running: {
    //                 ...baseTuning.running,
    //                 ...(patch.running ?? {})
    //             },
    //             meta: {
    //                 ...baseTuning.meta,
    //                 ...(patch.meta ?? {})
    //             }
    //         }
    //     }

    //     const baseline = evaluate("baseline", baseTuning)

    //     const candidates = [
    //         evaluate("defense-up", withPatch({
    //             meta: {
    //                 ...baseTuning.meta,
    //                 fullFielderDefenseBonus: baseTuning.meta.fullFielderDefenseBonus + 100
    //             }
    //         })),
    //         evaluate("defense-down", withPatch({
    //             meta: {
    //                 ...baseTuning.meta,
    //                 fullFielderDefenseBonus: baseTuning.meta.fullFielderDefenseBonus - 100
    //             }
    //         })),
    //         evaluate("hr-up", withPatch({
    //             contactQuality: {
    //                 ...baseTuning.contactQuality,
    //                 homeRunOutcomeScale: baseTuning.contactQuality.homeRunOutcomeScale + 0.15
    //             }
    //         })),
    //         evaluate("hr-down", withPatch({
    //             contactQuality: {
    //                 ...baseTuning.contactQuality,
    //                 homeRunOutcomeScale: baseTuning.contactQuality.homeRunOutcomeScale - 0.15
    //             }
    //         })),
    //         evaluate("bb-up-chase", withPatch({
    //             swing: {
    //                 ...baseTuning.swing,
    //                 pitchQualityChaseSwingEffect: baseTuning.swing.pitchQualityChaseSwingEffect - 8,
    //                 disciplineChaseSwingEffect: baseTuning.swing.disciplineChaseSwingEffect + 6
    //             }
    //         })),
    //         evaluate("bb-down-chase", withPatch({
    //             swing: {
    //                 ...baseTuning.swing,
    //                 pitchQualityChaseSwingEffect: baseTuning.swing.pitchQualityChaseSwingEffect + 8,
    //                 disciplineChaseSwingEffect: baseTuning.swing.disciplineChaseSwingEffect - 6
    //             }
    //         })),
    //         evaluate("contact-down", withPatch({
    //             contact: {
    //                 ...baseTuning.contact,
    //                 pitchQualityContactEffect: baseTuning.contact.pitchQualityContactEffect - 8,
    //                 contactSkillEffect: baseTuning.contact.contactSkillEffect - 4
    //             }
    //         })),
    //         evaluate("contact-up", withPatch({
    //             contact: {
    //                 ...baseTuning.contact,
    //                 pitchQualityContactEffect: baseTuning.contact.pitchQualityContactEffect + 8,
    //                 contactSkillEffect: baseTuning.contact.contactSkillEffect + 4
    //             }
    //         }))
    //     ]

    //     const diff = (candidate: any) => {
    //         return {
    //             label: candidate.label,
    //             runs: Number((candidate.runs - baseline.runs).toFixed(3)),
    //             avg: Number((candidate.avg - baseline.avg).toFixed(3)),
    //             obp: Number((candidate.obp - baseline.obp).toFixed(3)),
    //             slg: Number((candidate.slg - baseline.slg).toFixed(3)),
    //             ops: Number((candidate.ops - baseline.ops).toFixed(3)),
    //             babip: Number((candidate.babip - baseline.babip).toFixed(3)),
    //             bbPercent: Number((candidate.bbPercent - baseline.bbPercent).toFixed(3)),
    //             homeRunPercent: Number((candidate.homeRunPercent - baseline.homeRunPercent).toFixed(3)),
    //             teamHitsPerGame: Number((candidate.teamHitsPerGame - baseline.teamHitsPerGame).toFixed(3)),
    //             teamHomeRunsPerGame: Number((candidate.teamHomeRunsPerGame - baseline.teamHomeRunsPerGame).toFixed(3)),
    //             teamBBPerGame: Number((candidate.teamBBPerGame - baseline.teamBBPerGame).toFixed(3)),
    //             pitchesPerPA: Number((candidate.pitchesPerPA - baseline.pitchesPerPA).toFixed(3)),
    //             chase: Number((candidate.chase - baseline.chase).toFixed(3)),
    //             zSwing: Number((candidate.zSwing - baseline.zSwing).toFixed(3)),
    //             zContact: Number((candidate.zContact - baseline.zContact).toFixed(3)),
    //             chaseContact: Number((candidate.chaseContact - baseline.chaseContact).toFixed(3))
    //         }
    //     }

    //     console.log("=== TUNING KNOB SENSITIVITY BASELINE ===")
    //     console.log(baseline)

    //     console.log("=== TUNING KNOB SENSITIVITY DELTAS ===")
    //     for (const candidate of candidates) {
    //         console.log(diff(candidate))
    //     }

    //     assert.ok(candidates.length > 0)
    // })    

    // it("should print tuning decision report", () => {
    //     const base = playerImporterService.evaluatePitchEnvironment(
    //         pitchEnvironment,
    //         seedrandom("tuning-decision-report-base"),
    //         evaluationGames
    //     )

    //     const actual = base.actual
    //     const target = base.target
    //     const diff = base.diff

    //     const actualBipPerPA = 1 - actual.bbPercent - actual.soPercent - actual.hbpPercent
    //     const targetBipPerPA = 1 - target.bbPercent - target.soPercent - target.hbpPercent

    //     const actualHitPerBip = actualBipPerPA > 0 ? (actual.avg * (actualBipPerPA + actual.soPercent)) / actualBipPerPA : 0
    //     const targetHitPerBip = targetBipPerPA > 0 ? (target.avg * (targetBipPerPA + target.soPercent)) / targetBipPerPA : 0

    //     const actualHrPerBip = actualBipPerPA > 0 ? actual.homeRunPercent / actualBipPerPA : 0
    //     const targetHrPerBip = targetBipPerPA > 0 ? target.homeRunPercent / targetBipPerPA : 0

    //     const actualIso = actual.slg - actual.avg
    //     const targetIso = target.slg - target.avg

    //     const needsDefense = diff.babip > 0.01 || diff.teamHitsPerGame > 0.5 || actualHitPerBip - targetHitPerBip > 0.01
    //     const needsLessDefense = diff.babip < -0.01 || diff.teamHitsPerGame < -0.5 || actualHitPerBip - targetHitPerBip < -0.01
    //     const needsHomeRun = diff.homeRunPercent < -0.003 || diff.teamHomeRunsPerGame < -0.15 || actualHrPerBip - targetHrPerBip < -0.005
    //     const needsLessHomeRun = diff.homeRunPercent > 0.003 || diff.teamHomeRunsPerGame > 0.15 || actualHrPerBip - targetHrPerBip > 0.005
    //     const triplesHigh = actual.triplePercent - target.triplePercent > 0.003
    //     const triplesLow = actual.triplePercent - target.triplePercent < -0.003

    //     const report = {
    //         headline: {
    //             runs: { actual: actual.teamRunsPerGame, target: target.teamRunsPerGame, diff: diff.teamRunsPerGame },
    //             avg: { actual: actual.avg, target: target.avg, diff: diff.avg },
    //             obp: { actual: actual.obp, target: target.obp, diff: diff.obp },
    //             slg: { actual: actual.slg, target: target.slg, diff: diff.slg },
    //             ops: { actual: actual.ops, target: target.ops, diff: diff.ops },
    //             babip: { actual: actual.babip, target: target.babip, diff: diff.babip }
    //         },
    //         plateAppearanceShape: {
    //             bipPerPA: { actual: actualBipPerPA, target: targetBipPerPA, diff: actualBipPerPA - targetBipPerPA },
    //             bbPercent: { actual: actual.bbPercent, target: target.bbPercent, diff: diff.bbPercent },
    //             soPercent: { actual: actual.soPercent, target: target.soPercent, diff: actual.soPercent - target.soPercent },
    //             hbpPercent: { actual: actual.hbpPercent, target: target.hbpPercent, diff: actual.hbpPercent - target.hbpPercent },
    //             pitchesPerPA: { actual: actual.pitchesPerPA, target: target.pitchesPerPA, diff: diff.pitchesPerPA }
    //         },
    //         contactOutcomeShape: {
    //             hitPerBip: { actual: actualHitPerBip, target: targetHitPerBip, diff: actualHitPerBip - targetHitPerBip },
    //             hrPerBip: { actual: actualHrPerBip, target: targetHrPerBip, diff: actualHrPerBip - targetHrPerBip },
    //             iso: { actual: actualIso, target: targetIso, diff: actualIso - targetIso },
    //             singlePercent: { actual: actual.singlePercent, target: target.singlePercent, diff: diff.singlePercent },
    //             doublePercent: { actual: actual.doublePercent, target: target.doublePercent, diff: actual.doublePercent - target.doublePercent },
    //             triplePercent: { actual: actual.triplePercent, target: target.triplePercent, diff: actual.triplePercent - target.triplePercent },
    //             homeRunPercent: { actual: actual.homeRunPercent, target: target.homeRunPercent, diff: diff.homeRunPercent },
    //             hitsPerGame: { actual: actual.teamHitsPerGame, target: target.teamHitsPerGame, diff: diff.teamHitsPerGame },
    //             homeRunsPerGame: { actual: actual.teamHomeRunsPerGame, target: target.teamHomeRunsPerGame, diff: diff.teamHomeRunsPerGame }
    //         },
    //         processShape: {
    //             zoneSwing: { actual: actual.swingAtStrikesPercent, target: target.swingAtStrikesPercent, diff: diff.swingAtStrikesPercent },
    //             chase: { actual: actual.swingAtBallsPercent, target: target.swingAtBallsPercent, diff: diff.swingAtBallsPercent },
    //             zoneContact: { actual: actual.inZoneContactPercent, target: target.inZoneContactPercent, diff: diff.inZoneContactPercent },
    //             chaseContact: { actual: actual.outZoneContactPercent, target: target.outZoneContactPercent, diff: diff.outZoneContactPercent }
    //         },
    //         coupledOutcomeDiagnosis: {
    //             needsDefense,
    //             needsHomeRun,
    //             defenseWillAlsoSuppressHomeRuns: needsDefense && needsHomeRun,
    //             triplesHigh,
    //             triplesLow
    //         },
    //         suggestedDirection: {
    //             defense: needsDefense ? "increase moderately (primary BABIP/hitPerBip fix)" : needsLessDefense ? "decrease" : "hold",
    //             homeRunOutcomeScale: needsHomeRun ? needsDefense ? "increase significantly (counteract defense + low HR)" : "increase" : needsLessHomeRun ? "decrease" : "hold",
    //             contact: "hold",
    //             chase: diff.swingAtBallsPercent > 0.01 ? "decrease" : diff.swingAtBallsPercent < -0.01 ? "increase" : "hold",
    //             zoneSwing: diff.swingAtStrikesPercent < -0.01 ? "increase" : diff.swingAtStrikesPercent > 0.01 ? "decrease" : "hold",
    //             evLa: !needsDefense && needsHomeRun ? "increase EV/LA power path" : "hold",
    //             tripleOutcome: triplesHigh ? "reduce triples or convert some triple weight toward doubles/HR at outcome layer" : triplesLow ? "increase triples" : "hold"
    //         }
    //     }

    //     console.log("=== TUNING DECISION REPORT ===")
    //     console.log(JSON.stringify(report, null, 2))

    //     assert.ok(Number.isFinite(actual.teamRunsPerGame))
    // })

    it("should infer pitch environment tunings from target", async () => {

        tunedPitchEnvironment = await importPitchEnvironmentTarget(season, baseDataDir, options)

        console.log("=== FINAL TUNING ID ===")
        console.log(tunedPitchEnvironment.pitchEnvironmentTuning?._id)

        console.log("=== FINAL TUNED PITCH ENVIRONMENT ===")
        console.log(JSON.stringify(tunedPitchEnvironment.pitchEnvironmentTuning, null, 2))

        assert.ok(tunedPitchEnvironment)
        assert.ok(players)
    })

    it("should sim a game", async () => {
        const gameRng = new seedrandom(evaluationSeed)
        const startedGame: Game = playerImporterService.buildStartedBaselineGame(clone(tunedPitchEnvironment), "game-1")

        while (!startedGame.isComplete) {
            simService.simPitch(startedGame, gameRng)
        }

        assert.equal(startedGame.isComplete, true)
    })

    it("should print aggregate stats over 70 games", async () => {
        const evaluationRng = new seedrandom(evaluationSeed)

        const evaluation = playerImporterService.evaluatePitchEnvironment(tunedPitchEnvironment, evaluationRng, 70)

        console.log("=== CORE DIFFS ===")
        console.log({
            pitchesPerPA: evaluation.diff.pitchesPerPA,
            swingAtStrikesPercent: evaluation.diff.swingAtStrikesPercent,
            swingAtBallsPercent: evaluation.diff.swingAtBallsPercent,
            inZoneContactPercent: evaluation.diff.inZoneContactPercent,
            outZoneContactPercent: evaluation.diff.outZoneContactPercent,
            avg: evaluation.diff.avg,
            obp: evaluation.diff.obp,
            slg: evaluation.diff.slg,
            babip: evaluation.diff.babip,
            bbPercent: evaluation.diff.bbPercent,
            singlePercent: evaluation.diff.singlePercent,
            homeRunPercent: evaluation.diff.homeRunPercent,
            teamRunsPerGame: evaluation.diff.teamRunsPerGame,
            teamHitsPerGame: evaluation.diff.teamHitsPerGame,
            teamHomeRunsPerGame: evaluation.diff.teamHomeRunsPerGame,
            teamBBPerGame: evaluation.diff.teamBBPerGame
        })

        console.log("=== CORE ACTUAL ===")
        console.log({
            pitchesPerPA: evaluation.actual.pitchesPerPA,
            swingAtStrikesPercent: evaluation.actual.swingAtStrikesPercent,
            swingAtBallsPercent: evaluation.actual.swingAtBallsPercent,
            inZoneContactPercent: evaluation.actual.inZoneContactPercent,
            outZoneContactPercent: evaluation.actual.outZoneContactPercent,
            avg: evaluation.actual.avg,
            obp: evaluation.actual.obp,
            slg: evaluation.actual.slg,
            babip: evaluation.actual.babip,
            bbPercent: evaluation.actual.bbPercent,
            singlePercent: evaluation.actual.singlePercent,
            homeRunPercent: evaluation.actual.homeRunPercent,
            teamRunsPerGame: evaluation.actual.teamRunsPerGame,
            teamHitsPerGame: evaluation.actual.teamHitsPerGame,
            teamHomeRunsPerGame: evaluation.actual.teamHomeRunsPerGame,
            teamBBPerGame: evaluation.actual.teamBBPerGame,
            teamSBPerGame: evaluation.actual.teamSBPerGame,
            teamSBAttemptsPerGame: evaluation.actual.teamSBAttemptsPerGame
        })

        console.log("=== CORE TARGET ===")
        console.log({
            pitchesPerPA: evaluation.target.pitchesPerPA,
            swingAtStrikesPercent: evaluation.target.swingAtStrikesPercent,
            swingAtBallsPercent: evaluation.target.swingAtBallsPercent,
            inZoneContactPercent: evaluation.target.inZoneContactPercent,
            outZoneContactPercent: evaluation.target.outZoneContactPercent,
            avg: evaluation.target.avg,
            obp: evaluation.target.obp,
            slg: evaluation.target.slg,
            babip: evaluation.target.babip,
            bbPercent: evaluation.target.bbPercent,
            singlePercent: evaluation.target.singlePercent,
            homeRunPercent: evaluation.target.homeRunPercent,
            teamRunsPerGame: evaluation.target.teamRunsPerGame,
            teamHitsPerGame: evaluation.target.teamHitsPerGame,
            teamHomeRunsPerGame: evaluation.target.teamHomeRunsPerGame,
            teamBBPerGame: evaluation.target.teamBBPerGame,
            teamSBPerGame: evaluation.target.teamSBPerGame,
            teamSBAttemptsPerGame: evaluation.target.teamSBAttemptsPerGame
        })

        assert.ok(evaluation)
    })

    it("inning can end during runner events; stop further processing but keep events", async () => {
        const game = playerImporterService.buildStartedBaselineGame(tunedPitchEnvironment, "game-runner-events")
        const laRatings = game.pitchEnvironmentTarget

        const awayTeam = game.away
        const homeTeam = game.home

        const pitcher = homeTeam.players.find(p => p._id === homeTeam.currentPitcherId)!
        const fielder =
            homeTeam.players.find(p => p.currentPosition === Position.CENTER_FIELD) ??
            homeTeam.players.find(p => p.currentPosition === Position.RIGHT_FIELD) ??
            homeTeam.players.find(p => p.currentPosition === Position.LEFT_FIELD)!

        const hitter = awayTeam.players.find(p => awayTeam.lineupIds.includes(p._id))!
        const runner2B = awayTeam.players.find(p => p._id !== hitter._id)!

        const runnerResult: any = {
            first: undefined,
            second: runner2B._id,
            third: undefined,
            out: [],
            scored: []
        }

        const halfInningRunnerEvents: any[] = [
            { runner: { _id: "fakeOut1" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } },
            { runner: { _id: "fakeOut2" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } }
        ]

        const defensiveCredits: any[] = []

        const runnerActions = (simService as any).runnerActions
        const originalChance = runnerActions.getChanceRunnerSafe
        const originalThrow = runnerActions.gameRolls.getThrowResult

        runnerActions.getChanceRunnerSafe = () => 95
        runnerActions.gameRolls.getThrowResult = () => ({ roll: 100, result: ThrowResult.OUT })

        let inPlayRunnerEvents: any[] = []
        try {
            inPlayRunnerEvents = runnerActions.getRunnerEvents(
                () => 0.5,
                runnerResult,
                halfInningRunnerEvents,
                defensiveCredits,
                laRatings,
                PlayResult.SINGLE,
                Contact.LINE_DRIVE,
                ShallowDeep.NORMAL,
                hitter,
                fielder,
                undefined,
                runner2B,
                undefined,
                awayTeam,
                homeTeam,
                pitcher,
                0
            ) as any[]
        } finally {
            runnerActions.getChanceRunnerSafe = originalChance
            runnerActions.gameRolls.getThrowResult = originalThrow
        }

        const outs =
            halfInningRunnerEvents.filter(e => e?.movement?.isOut).length +
            inPlayRunnerEvents.filter(e => e?.movement?.isOut).length

        assert.equal(outs, 3)
        assert.ok(inPlayRunnerEvents.length > 0)

        const baseIds = [runnerResult.first, runnerResult.second, runnerResult.third].filter(Boolean)
        assert.equal(new Set(baseIds).size, baseIds.length)
    })

    it("Ground ball to infielder with runner on 3B and 2 outs must record the batter out at 1B (throw if needed), no run", async () => {
        const game = playerImporterService.buildStartedBaselineGame(tunedPitchEnvironment, "game-runner-events")
        const laRatings = game.pitchEnvironmentTarget

        const awayTeam = game.away
        const homeTeam = game.home

        const pitcher = homeTeam.players.find(p => p._id === homeTeam.currentPitcherId)
        assert.ok(pitcher)

        const infielder =
            homeTeam.players.find(p => p.currentPosition === Position.FIRST_BASE) ??
            homeTeam.players.find(p => p.currentPosition === Position.SECOND_BASE) ??
            homeTeam.players.find(p => p.currentPosition === Position.THIRD_BASE) ??
            homeTeam.players.find(p => p.currentPosition === Position.SHORTSTOP)

        assert.ok(infielder)

        const hitter = awayTeam.players.find(p => awayTeam.lineupIds?.includes(p._id)) ?? awayTeam.players[0]
        const runner3B = awayTeam.players.find(p => p._id !== hitter._id)!

        const runnerResult: any = {
            first: undefined,
            second: undefined,
            third: runner3B._id,
            out: [],
            scored: []
        }

        const halfInningRunnerEvents: any[] = [
            { runner: { _id: "out1" }, movement: { isOut: true } },
            { runner: { _id: "out2" }, movement: { isOut: true } }
        ]

        const defensiveCredits: any[] = []

        const runnerActions = (simService as any).runnerActions
        const originalChance = runnerActions.getChanceRunnerSafe
        const originalThrow = runnerActions.gameRolls.getThrowResult

        runnerActions.getChanceRunnerSafe = () => 95
        runnerActions.gameRolls.getThrowResult = () => ({ roll: 100, result: ThrowResult.OUT })

        let inPlayRunnerEvents: any[] = []
        try {
            inPlayRunnerEvents = runnerActions.getRunnerEvents(
                () => 0.5,
                runnerResult,
                halfInningRunnerEvents,
                defensiveCredits,
                laRatings,
                PlayResult.OUT,
                Contact.GROUNDBALL,
                ShallowDeep.NORMAL,
                hitter,
                infielder,
                undefined,
                undefined,
                runner3B,
                awayTeam,
                homeTeam,
                pitcher,
                2
            ) as any[]
        } finally {
            runnerActions.getChanceRunnerSafe = originalChance
            runnerActions.gameRolls.getThrowResult = originalThrow
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

    it("Ground ball to infielder with runner on 3B and 2 outs must record the batter out at 1B (throw if needed), no run", async () => {
        const game = playerImporterService.buildStartedBaselineGame(tunedPitchEnvironment, "game-runner-events")
        const laRatings = game.pitchEnvironmentTarget

        const awayTeam = game.away
        const homeTeam = game.home

        const pitcher = homeTeam.players.find(p => p._id === homeTeam.currentPitcherId)
        assert.ok(pitcher)

        const infielder =
            homeTeam.players.find(p => p.currentPosition === Position.FIRST_BASE) ??
            homeTeam.players.find(p => p.currentPosition === Position.SECOND_BASE) ??
            homeTeam.players.find(p => p.currentPosition === Position.THIRD_BASE) ??
            homeTeam.players.find(p => p.currentPosition === Position.SHORTSTOP)

        assert.ok(infielder)

        const hitter = awayTeam.players.find(p => awayTeam.lineupIds?.includes(p._id)) ?? awayTeam.players[0]
        const runner3B = awayTeam.players.find(p => p._id !== hitter._id)!

        const runnerResult: any = {
            first: undefined,
            second: undefined,
            third: runner3B._id,
            out: [],
            scored: []
        }

        const halfInningRunnerEvents: any[] = [
            { runner: { _id: "out1" }, movement: { isOut: true } },
            { runner: { _id: "out2" }, movement: { isOut: true } }
        ]

        const defensiveCredits: any[] = []

        const runnerActions = (simService as any).runnerActions
        const originalChance = runnerActions.getChanceRunnerSafe
        const originalThrow = runnerActions.gameRolls.getThrowResult

        runnerActions.getChanceRunnerSafe = () => 95
        runnerActions.gameRolls.getThrowResult = () => ({ roll: 100, result: ThrowResult.OUT })

        let inPlayRunnerEvents: any[] = []
        try {
            //@ts-ignore
            inPlayRunnerEvents = simService.runnerActions.getRunnerEvents(
                () => 0.5,
                runnerResult,
                halfInningRunnerEvents,
                defensiveCredits,
                laRatings,
                PlayResult.OUT,
                Contact.GROUNDBALL,
                ShallowDeep.NORMAL,
                hitter,
                infielder,
                undefined,
                undefined,
                runner3B,
                awayTeam,
                homeTeam,
                pitcher,
                2
            ) as any[]
        } finally {
            runnerActions.getChanceRunnerSafe = originalChance
            runnerActions.gameRolls.getThrowResult = originalThrow
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
