import assert from "assert"
import {
    StatService,
    simService,
    BaseResult,
    Contact,
    PlayResult,
    Position,
    ShallowDeep,
    ThrowResult
} from "../src/sim/index.js"
import seedrandom from "seedrandom"
import type {
    PitchEnvironmentTarget,
    PitchEnvironmentTuning,
    PlayerImportBaseline,
    Game,
    PlayerImportRaw
} from "../src/sim/index.js"

import { PlayerImporterService } from "../src/importer/service/player-importer-service.js"
import { importPitchEnvironmentTarget } from "../src/importer/index.js"
import { DownloaderService } from "../src/importer/service/downloader-service.js"

const statService = new StatService()
let pitchEnvironment: PitchEnvironmentTarget
let tunedPitchEnvironment: PitchEnvironmentTarget

let season = 2025
let baseDataDir = "data"

const playerImporterService = new PlayerImporterService(simService, statService, {} as any)
const downloaderservice = new DownloaderService("data", 1000)

const players = await downloaderservice.buildSeasonPlayerImports(season, new Set([]))

// console.log(JSON.stringify(players.get("677951")))

const evaluationSeed = 4
const evaluationGames = 70

let options = { 
    workers: 25,
    gamesPerIteration: evaluationGames,
    
 }

describe("Baseball Sim Engine", async () => {

    it("should calculate pitch environment target for season", async () => {

        pitchEnvironment = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)

        // console.log(pitchEnvironment)

        assert.ok(pitchEnvironment)

        // console.log("=== PITCH ENVIRONMENT TARGET ===")
        // console.log(JSON.stringify(pitchEnvironment))
    })

    // it("direct contact quality path should show whether pitchQualityChange can raise offense", () => {
    //     const sampleCount = 10000

    //     const makePitchEnvironment = (fullPitchQualityBonus: number, evScale: number, laScale: number, distanceScale: number): PitchEnvironmentTarget => {
    //         const testPitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify(pitchEnvironment))

    //         testPitchEnvironment.pitchEnvironmentTuning = {
    //             tuning: {
    //                 pitch: {
    //                     velocityToQualityScale: 0,
    //                     movementToQualityScale: 0,
    //                     controlToQualityScale: 0
    //                 },
    //                 swing: {
    //                     pitchQualityZoneSwingEffect: 0,
    //                     pitchQualityChaseSwingEffect: 0,
    //                     disciplineZoneSwingEffect: 0,
    //                     disciplineChaseSwingEffect: 0
    //                 },
    //                 contact: {
    //                     pitchQualityContactEffect: 0,
    //                     contactSkillEffect: 0
    //                 },
    //                 contactQuality: {
    //                     evScale,
    //                     laScale,
    //                     distanceScale,
    //                 },
    //                 meta: {
    //                     fullTeamDefenseBonus: 0,
    //                     fullFielderDefenseBonus: 0,
    //                     fullPitchQualityBonus
    //                 },
    //                 running: {
    //                     stealAttemptAggressionScale: 1
    //                 }
    //             }
    //         } as PitchEnvironmentTuning

    //         return testPitchEnvironment
    //     }

    //     const evaluate = (label: string, testPitchEnvironment: PitchEnvironmentTarget, pitchQualityChange: number) => {
    //         const contactWeights = [
    //             {
    //                 contact: Contact.GROUNDBALL,
    //                 name: "GROUNDBALL",
    //                 weight: testPitchEnvironment.battedBall.contactRollInput.groundball
    //             },
    //             {
    //                 contact: Contact.LINE_DRIVE,
    //                 name: "LINE_DRIVE",
    //                 weight: testPitchEnvironment.battedBall.contactRollInput.lineDrive
    //             },
    //             {
    //                 contact: Contact.FLY_BALL,
    //                 name: "FLY_BALL",
    //                 weight: testPitchEnvironment.battedBall.contactRollInput.flyBall
    //             }
    //         ]

    //         const totalWeight = contactWeights.reduce((sum, row) => sum + row.weight, 0)

    //         let weightedOut = 0
    //         let weightedSingle = 0
    //         let weightedDouble = 0
    //         let weightedTriple = 0
    //         let weightedHr = 0
    //         let weightedEv = 0
    //         let weightedLa = 0
    //         let weightedDistance = 0

    //         for (const row of contactWeights) {
    //             const rng = seedrandom(`${label}-${row.name}-${pitchQualityChange}`)

    //             let contactOut = 0
    //             let contactSingle = 0
    //             let contactDouble = 0
    //             let contactTriple = 0
    //             let contactHr = 0
    //             let contactEv = 0
    //             let contactLa = 0
    //             let contactDistance = 0

    //             for (let i = 0; i < sampleCount; i++) {
    //                 //@ts-ignore
    //                 const hitQuality = simService.gameRolls.getHitQuality(
    //                     rng,
    //                     testPitchEnvironment,
    //                     pitchQualityChange,
    //                     false,
    //                     row.contact
    //                 )

    //                 const model = (simService as any).getOutcomeModelForContactQuality(
    //                     testPitchEnvironment,
    //                     hitQuality,
    //                     row.contact,
    //                     pitchQualityChange
    //                 )

    //                 const modelTotal = model.out + model.single + model.double + model.triple + model.hr

    //                 contactOut += model.out / modelTotal
    //                 contactSingle += model.single / modelTotal
    //                 contactDouble += model.double / modelTotal
    //                 contactTriple += model.triple / modelTotal
    //                 contactHr += model.hr / modelTotal
    //                 contactEv += hitQuality.exitVelocity
    //                 contactLa += hitQuality.launchAngle
    //                 contactDistance += hitQuality.distance
    //             }

    //             contactOut /= sampleCount
    //             contactSingle /= sampleCount
    //             contactDouble /= sampleCount
    //             contactTriple /= sampleCount
    //             contactHr /= sampleCount
    //             contactEv /= sampleCount
    //             contactLa /= sampleCount
    //             contactDistance /= sampleCount

    //             const share = row.weight / totalWeight

    //             weightedOut += contactOut * share
    //             weightedSingle += contactSingle * share
    //             weightedDouble += contactDouble * share
    //             weightedTriple += contactTriple * share
    //             weightedHr += contactHr * share
    //             weightedEv += contactEv * share
    //             weightedLa += contactLa * share
    //             weightedDistance += contactDistance * share
    //         }

    //         const weightedBip = weightedOut + weightedSingle + weightedDouble + weightedTriple
    //         const weightedBabip = weightedBip > 0 ? (weightedSingle + weightedDouble + weightedTriple) / weightedBip : 0
    //         const weightedAvg = weightedSingle + weightedDouble + weightedTriple + weightedHr
    //         const weightedSlg = weightedSingle + (weightedDouble * 2) + (weightedTriple * 3) + (weightedHr * 4)

    //         const result = {
    //             label,
    //             pitchQualityChange,
    //             out: Number(weightedOut.toFixed(3)),
    //             single: Number(weightedSingle.toFixed(3)),
    //             double: Number(weightedDouble.toFixed(3)),
    //             triple: Number(weightedTriple.toFixed(3)),
    //             hr: Number(weightedHr.toFixed(3)),
    //             avgOnContact: Number(weightedAvg.toFixed(3)),
    //             slgOnContact: Number(weightedSlg.toFixed(3)),
    //             babip: Number(weightedBabip.toFixed(3)),
    //             avgEv: Number(weightedEv.toFixed(3)),
    //             avgLa: Number(weightedLa.toFixed(3)),
    //             avgDistance: Number(weightedDistance.toFixed(3))
    //         }

    //         console.log("[DIRECT CONTACT QUALITY SENSITIVITY]", result)

    //         return result
    //     }

    //     const zeroTuning = makePitchEnvironment(0, 0, 0, 0)
    //     const aggressiveTuning = makePitchEnvironment(500, 20, 8, 35)

    //     const zeroNeutral = evaluate("zero-neutral", zeroTuning, 0)
    //     const aggressiveBadPitch = evaluate("aggressive-bad-pitch", aggressiveTuning, -0.5)
    //     const aggressiveNeutral = evaluate("aggressive-neutral", aggressiveTuning, 0)
    //     const aggressiveGoodPitch = evaluate("aggressive-good-pitch", aggressiveTuning, 0.5)

    //     assert.ok(aggressiveBadPitch.avgOnContact > zeroNeutral.avgOnContact)
    //     assert.ok(aggressiveBadPitch.slgOnContact > zeroNeutral.slgOnContact)
    //     assert.ok(aggressiveBadPitch.hr >= zeroNeutral.hr)
    //     assert.ok(aggressiveGoodPitch.avgOnContact < aggressiveNeutral.avgOnContact)
    // })

    // it("zero vs high offense should print pitch quality change distribution on balls in play", () => {
    //     const makePitchEnvironment = (label: string): PitchEnvironmentTarget => {
    //         const testPitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify(pitchEnvironment))

    //         if (label === "zero") {
    //             testPitchEnvironment.pitchEnvironmentTuning = {
    //                 tuning: {
    //                     pitch: {
    //                         velocityToQualityScale: 0,
    //                         movementToQualityScale: 0,
    //                         controlToQualityScale: 0
    //                     },
    //                     swing: {
    //                         pitchQualityZoneSwingEffect: 0,
    //                         pitchQualityChaseSwingEffect: 0,
    //                         disciplineZoneSwingEffect: 0,
    //                         disciplineChaseSwingEffect: 0
    //                     },
    //                     contact: {
    //                         pitchQualityContactEffect: 0,
    //                         contactSkillEffect: 0
    //                     },
    //                     contactQuality: {
    //                         evScale: 0,
    //                         laScale: 0,
    //                         distanceScale: 0,
    //                     },
    //                     meta: {
    //                         fullTeamDefenseBonus: 0,
    //                         fullFielderDefenseBonus: 0,
    //                         fullPitchQualityBonus: 0
    //                     },
    //                     running: {
    //                         stealAttemptAggressionScale: 1
    //                     }
    //                 }
    //             } as PitchEnvironmentTuning
    //         }

    //         if (label === "high") {
    //             testPitchEnvironment.pitchEnvironmentTuning = {
    //                 tuning: {
    //                     pitch: {
    //                         velocityToQualityScale: 0,
    //                         movementToQualityScale: 0,
    //                         controlToQualityScale: 0
    //                     },
    //                     swing: {
    //                         pitchQualityZoneSwingEffect: 0,
    //                         pitchQualityChaseSwingEffect: 0,
    //                         disciplineZoneSwingEffect: 0,
    //                         disciplineChaseSwingEffect: 0
    //                     },
    //                     contact: {
    //                         pitchQualityContactEffect: 0,
    //                         contactSkillEffect: 0
    //                     },
    //                     contactQuality: {
    //                         evScale: 20,
    //                         laScale: 8,
    //                         distanceScale: 35
                            
    //                     },
    //                     meta: {
    //                         fullTeamDefenseBonus: 0,
    //                         fullFielderDefenseBonus: 0,
    //                         fullPitchQualityBonus: 500
    //                     },
    //                     running: {
    //                         stealAttemptAggressionScale: 1
    //                     }
    //                 }
    //             } as PitchEnvironmentTuning
    //         }

    //         return testPitchEnvironment
    //     }

    //     const evaluate = (label: string) => {
    //         const testPitchEnvironment = makePitchEnvironment(label)
    //         const rng = seedrandom(`pitch-quality-change-report-${label}`)
    //         const games = evaluationGames

    //         const pitchQualityChanges: number[] = []
    //         const overallQualities: number[] = []
    //         const evs: number[] = []
    //         const las: number[] = []
    //         const distances: number[] = []

    //         const resultCounts = {
    //             out: 0,
    //             single: 0,
    //             double: 0,
    //             triple: 0,
    //             hr: 0,
    //             bb: 0,
    //             so: 0,
    //             hbp: 0
    //         }

    //         let runs = 0
    //         let pa = 0
    //         let ab = 0
    //         let hits = 0
    //         let totalBases = 0

    //         for (let gameIndex = 0; gameIndex < games; gameIndex++) {
    //             const game = playerImporterService.buildStartedBaselineGame(
    //                 JSON.parse(JSON.stringify(testPitchEnvironment)),
    //                 `pitch-quality-change-report-${label}-${gameIndex}`
    //             )

    //             while (!game.isComplete) {
    //                 simService.simPitch(game, rng)
    //             }

    //             runs += game.score.away + game.score.home

    //             const plays = game.halfInnings.flatMap(halfInning => halfInning.plays)

    //             for (const play of plays) {
    //                 pa++

    //                 if (play.result === PlayResult.OUT) {
    //                     resultCounts.out++
    //                     ab++
    //                 }

    //                 if (play.result === PlayResult.SINGLE) {
    //                     resultCounts.single++
    //                     hits++
    //                     ab++
    //                     totalBases += 1
    //                 }

    //                 if (play.result === PlayResult.DOUBLE) {
    //                     resultCounts.double++
    //                     hits++
    //                     ab++
    //                     totalBases += 2
    //                 }

    //                 if (play.result === PlayResult.TRIPLE) {
    //                     resultCounts.triple++
    //                     hits++
    //                     ab++
    //                     totalBases += 3
    //                 }

    //                 if (play.result === PlayResult.HR) {
    //                     resultCounts.hr++
    //                     hits++
    //                     ab++
    //                     totalBases += 4
    //                 }

    //                 if (play.result === PlayResult.BB) {
    //                     resultCounts.bb++
    //                 }

    //                 if (play.result === PlayResult.STRIKEOUT) {
    //                     resultCounts.so++
    //                     ab++
    //                 }

    //                 if (play.result === PlayResult.HIT_BY_PITCH) {
    //                     resultCounts.hbp++
    //                 }

    //                 const ballInPlay = play.pitchLog?.pitches?.find((pitch: any) => pitch.contactQuality)
    //                 if (ballInPlay?.contactQuality) {
    //                     const pitchQualityChange = ((ballInPlay.overallQuality / 50) * 100 - 100) / 100

    //                     pitchQualityChanges.push(pitchQualityChange)
    //                     overallQualities.push(ballInPlay.overallQuality)
    //                     evs.push(ballInPlay.contactQuality.exitVelocity)
    //                     las.push(ballInPlay.contactQuality.launchAngle)
    //                     distances.push(ballInPlay.contactQuality.distance)
    //                 }
    //             }
    //         }

    //         const avg = (values: number[]) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    //         const min = (values: number[]) => values.length > 0 ? Math.min(...values) : 0
    //         const max = (values: number[]) => values.length > 0 ? Math.max(...values) : 0

    //         const countWhere = (values: number[], predicate: (value: number) => boolean) => values.filter(predicate).length
    //         const pctWhere = (values: number[], predicate: (value: number) => boolean) => values.length > 0 ? countWhere(values, predicate) / values.length : 0

    //         const babipDenominator = resultCounts.out + resultCounts.single + resultCounts.double + resultCounts.triple
    //         const babipNumerator = resultCounts.single + resultCounts.double + resultCounts.triple

    //         const report = {
    //             label,
    //             games,
    //             runsPerGame: runs / games / 2,
    //             avg: ab > 0 ? hits / ab : 0,
    //             obp: pa > 0 ? (hits + resultCounts.bb + resultCounts.hbp) / pa : 0,
    //             slg: ab > 0 ? totalBases / ab : 0,
    //             babip: babipDenominator > 0 ? babipNumerator / babipDenominator : 0,
    //             hrPerPA: pa > 0 ? resultCounts.hr / pa : 0,
    //             ballsInPlay: pitchQualityChanges.length,
    //             pitchQualityChangeAvg: avg(pitchQualityChanges),
    //             pitchQualityChangeMin: min(pitchQualityChanges),
    //             pitchQualityChangeMax: max(pitchQualityChanges),
    //             pitchQualityChangeNegativePct: pctWhere(pitchQualityChanges, value => value < 0),
    //             pitchQualityChangeBelowNegativePoint10Pct: pctWhere(pitchQualityChanges, value => value <= -0.10),
    //             pitchQualityChangeBelowNegativePoint25Pct: pctWhere(pitchQualityChanges, value => value <= -0.25),
    //             pitchQualityChangePositivePct: pctWhere(pitchQualityChanges, value => value > 0),
    //             pitchQualityChangeAbovePoint10Pct: pctWhere(pitchQualityChanges, value => value >= 0.10),
    //             pitchQualityChangeAbovePoint25Pct: pctWhere(pitchQualityChanges, value => value >= 0.25),
    //             overallQualityAvg: avg(overallQualities),
    //             overallQualityMin: min(overallQualities),
    //             overallQualityMax: max(overallQualities),
    //             avgEv: avg(evs),
    //             avgLa: avg(las),
    //             avgDistance: avg(distances),
    //             resultCounts
    //         }

    //         console.log("[BIP PITCH QUALITY CHANGE REPORT]", report)

    //         return report
    //     }

    //     const zero = evaluate("zero")
    //     const high = evaluate("high")

    //     assert.ok(zero.ballsInPlay > 0)
    //     assert.ok(high.ballsInPlay > 0)
    // })

    // it("zero vs bad-pitch offense should print pitch quality change distribution on balls in play", () => {
    //     const makePitchEnvironment = (label: string): PitchEnvironmentTarget => {
    //         const testPitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify(pitchEnvironment))

    //         if (label === "zero") {
    //             testPitchEnvironment.pitchEnvironmentTuning = {
    //                 tuning: {
    //                     pitch: {
    //                         velocityToQualityScale: 0,
    //                         movementToQualityScale: 0,
    //                         controlToQualityScale: 0
    //                     },
    //                     swing: {
    //                         pitchQualityZoneSwingEffect: 0,
    //                         pitchQualityChaseSwingEffect: 0,
    //                         disciplineZoneSwingEffect: 0,
    //                         disciplineChaseSwingEffect: 0
    //                     },
    //                     contact: {
    //                         pitchQualityContactEffect: 0,
    //                         contactSkillEffect: 0
    //                     },
    //                     contactQuality: {
    //                         evScale: 0,
    //                         laScale: 0,
    //                         distanceScale: 0,
                            
    //                     },
    //                     meta: {
    //                         fullTeamDefenseBonus: 0,
    //                         fullFielderDefenseBonus: 0,
    //                         fullPitchQualityBonus: 0
    //                     },
    //                     running: {
    //                         stealAttemptAggressionScale: 1
    //                     }
    //                 }
    //             } as PitchEnvironmentTuning
    //         }

    //         if (label === "badPitch") {
    //             testPitchEnvironment.pitchEnvironmentTuning = {
    //                 tuning: {
    //                     pitch: {
    //                         velocityToQualityScale: 0,
    //                         movementToQualityScale: -120,
    //                         controlToQualityScale: 0
    //                     },
    //                     swing: {
    //                         pitchQualityZoneSwingEffect: 0,
    //                         pitchQualityChaseSwingEffect: 0,
    //                         disciplineZoneSwingEffect: 0,
    //                         disciplineChaseSwingEffect: 0
    //                     },
    //                     contact: {
    //                         pitchQualityContactEffect: 0,
    //                         contactSkillEffect: 0
    //                     },
    //                     contactQuality: {
    //                         evScale: 20,
    //                         laScale: 8,
    //                         distanceScale: 35,
                            
    //                     },
    //                     meta: {
    //                         fullTeamDefenseBonus: 0,
    //                         fullFielderDefenseBonus: 0,
    //                         fullPitchQualityBonus: 500
    //                     },
    //                     running: {
    //                         stealAttemptAggressionScale: 1
    //                     }
    //                 }
    //             } as PitchEnvironmentTuning
    //         }

    //         return testPitchEnvironment
    //     }

    //     const evaluate = (label: string) => {
    //         const testPitchEnvironment = makePitchEnvironment(label)
    //         const rng = seedrandom(`pitch-quality-change-report-${label}`)
    //         const games = evaluationGames

    //         const pitchQualityChanges: number[] = []
    //         const overallQualities: number[] = []
    //         const evs: number[] = []
    //         const las: number[] = []
    //         const distances: number[] = []

    //         const resultCounts = {
    //             out: 0,
    //             single: 0,
    //             double: 0,
    //             triple: 0,
    //             hr: 0,
    //             bb: 0,
    //             so: 0,
    //             hbp: 0
    //         }

    //         let runs = 0
    //         let pa = 0
    //         let ab = 0
    //         let hits = 0
    //         let totalBases = 0

    //         for (let gameIndex = 0; gameIndex < games; gameIndex++) {
    //             const game = playerImporterService.buildStartedBaselineGame(
    //                 JSON.parse(JSON.stringify(testPitchEnvironment)),
    //                 `pitch-quality-change-report-${label}-${gameIndex}`
    //             )

    //             while (!game.isComplete) {
    //                 simService.simPitch(game, rng)
    //             }

    //             runs += game.score.away + game.score.home

    //             const plays = game.halfInnings.flatMap(halfInning => halfInning.plays)

    //             for (const play of plays) {
    //                 pa++

    //                 if (play.result === PlayResult.OUT) {
    //                     resultCounts.out++
    //                     ab++
    //                 }

    //                 if (play.result === PlayResult.SINGLE) {
    //                     resultCounts.single++
    //                     hits++
    //                     ab++
    //                     totalBases += 1
    //                 }

    //                 if (play.result === PlayResult.DOUBLE) {
    //                     resultCounts.double++
    //                     hits++
    //                     ab++
    //                     totalBases += 2
    //                 }

    //                 if (play.result === PlayResult.TRIPLE) {
    //                     resultCounts.triple++
    //                     hits++
    //                     ab++
    //                     totalBases += 3
    //                 }

    //                 if (play.result === PlayResult.HR) {
    //                     resultCounts.hr++
    //                     hits++
    //                     ab++
    //                     totalBases += 4
    //                 }

    //                 if (play.result === PlayResult.BB) {
    //                     resultCounts.bb++
    //                 }

    //                 if (play.result === PlayResult.STRIKEOUT) {
    //                     resultCounts.so++
    //                     ab++
    //                 }

    //                 if (play.result === PlayResult.HIT_BY_PITCH) {
    //                     resultCounts.hbp++
    //                 }

    //                 const ballInPlay = play.pitchLog?.pitches?.find((pitch: any) => pitch.contactQuality)

    //                 if (ballInPlay?.contactQuality) {
    //                     const pitchQualityChange = ((ballInPlay.overallQuality / 50 * 100) - 100) / 100

    //                     pitchQualityChanges.push(pitchQualityChange)
    //                     overallQualities.push(ballInPlay.overallQuality)
    //                     evs.push(ballInPlay.contactQuality.exitVelocity)
    //                     las.push(ballInPlay.contactQuality.launchAngle)
    //                     distances.push(ballInPlay.contactQuality.distance)
    //                 }
    //             }
    //         }

    //         const avg = (values: number[]) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    //         const min = (values: number[]) => values.length > 0 ? Math.min(...values) : 0
    //         const max = (values: number[]) => values.length > 0 ? Math.max(...values) : 0

    //         const countWhere = (values: number[], predicate: (value: number) => boolean) => values.filter(predicate).length
    //         const pctWhere = (values: number[], predicate: (value: number) => boolean) => values.length > 0 ? countWhere(values, predicate) / values.length : 0

    //         const babipDenominator = resultCounts.out + resultCounts.single + resultCounts.double + resultCounts.triple
    //         const babipNumerator = resultCounts.single + resultCounts.double + resultCounts.triple

    //         const report = {
    //             label,
    //             games,
    //             runsPerGame: runs / games / 2,
    //             avg: ab > 0 ? hits / ab : 0,
    //             obp: pa > 0 ? (hits + resultCounts.bb + resultCounts.hbp) / pa : 0,
    //             slg: ab > 0 ? totalBases / ab : 0,
    //             babip: babipDenominator > 0 ? babipNumerator / babipDenominator : 0,
    //             hrPerPA: pa > 0 ? resultCounts.hr / pa : 0,
    //             ballsInPlay: pitchQualityChanges.length,
    //             pitchQualityChangeAvg: avg(pitchQualityChanges),
    //             pitchQualityChangeMin: min(pitchQualityChanges),
    //             pitchQualityChangeMax: max(pitchQualityChanges),
    //             pitchQualityChangeNegativePct: pctWhere(pitchQualityChanges, value => value < 0),
    //             pitchQualityChangeBelowNegativePoint10Pct: pctWhere(pitchQualityChanges, value => value <= -0.10),
    //             pitchQualityChangeBelowNegativePoint25Pct: pctWhere(pitchQualityChanges, value => value <= -0.25),
    //             pitchQualityChangePositivePct: pctWhere(pitchQualityChanges, value => value > 0),
    //             pitchQualityChangeAbovePoint10Pct: pctWhere(pitchQualityChanges, value => value >= 0.10),
    //             pitchQualityChangeAbovePoint25Pct: pctWhere(pitchQualityChanges, value => value >= 0.25),
    //             overallQualityAvg: avg(overallQualities),
    //             overallQualityMin: min(overallQualities),
    //             overallQualityMax: max(overallQualities),
    //             avgEv: avg(evs),
    //             avgLa: avg(las),
    //             avgDistance: avg(distances),
    //             resultCounts
    //         }

    //         console.log("[BIP PITCH QUALITY CHANGE REPORT]", report)

    //         return report
    //     }

    //     const zero = evaluate("zero")
    //     const badPitch = evaluate("badPitch")

    //     assert.ok(zero.ballsInPlay > 0)
    //     assert.ok(badPitch.ballsInPlay > 0)
    //     assert.ok(badPitch.pitchQualityChangeAvg < zero.pitchQualityChangeAvg)
    //     assert.ok(badPitch.runsPerGame > zero.runsPerGame)
    // })   

    // it("generated contact quality should print full EV LA bucket report", () => {
    //     const testPitchEnvironment = JSON.parse(JSON.stringify(pitchEnvironment))

    //     testPitchEnvironment.pitchEnvironmentTuning = {
    //         tuning: {
    //             contactQuality: {
    //                 evScale: 0,
    //                 laScale: 0,
    //                 distanceScale: 0,
                    
    //             },
    //             pitch: {
    //                 velocityToQualityScale: 0,
    //                 movementToQualityScale: 0,
    //                 controlToQualityScale: 0
    //             },
    //             swing: {
    //                 pitchQualityZoneSwingEffect: 0,
    //                 pitchQualityChaseSwingEffect: 0,
    //                 disciplineZoneSwingEffect: 0,
    //                 disciplineChaseSwingEffect: 0
    //             },
    //             contact: {
    //                 pitchQualityContactEffect: 0,
    //                 contactSkillEffect: 0
    //             },
    //             running: {
    //                 stealAttemptAggressionScale: 1
    //             },
    //             meta: {
    //                 fullTeamDefenseBonus: 0,
    //                 fullFielderDefenseBonus: 0,
    //                 fullPitchQualityBonus: 0
    //             }
    //         }
    //     }

    //     const sampleCount = 5000
    //     const contacts = [Contact.GROUNDBALL, Contact.LINE_DRIVE, Contact.FLY_BALL]

    //     const buckets = new Map<string, any>()

    //     for (const contact of contacts) {
    //         const rng = seedrandom(`bucket-report-${contact}`)

    //         for (let i = 0; i < sampleCount; i++) {
    //             //@ts-ignore
    //             const hitQuality = simService.gameRolls.getHitQuality(
    //                 rng,
    //                 testPitchEnvironment,
    //                 0,
    //                 false,
    //                 contact
    //             )

    //             const model = (simService as any).getOutcomeModelForContactQuality(
    //                 testPitchEnvironment,
    //                 hitQuality,
    //                 contact
    //             )

    //             const key = `${contact}:${model.evBin}:${model.laBin}`

    //             if (!buckets.has(key)) {
    //                 buckets.set(key, {
    //                     contact,
    //                     evBin: model.evBin,
    //                     laBin: model.laBin,
    //                     samples: 0,
    //                     out: 0,
    //                     single: 0,
    //                     double: 0,
    //                     triple: 0,
    //                     hr: 0
    //                 })
    //             }

    //             const bucket = buckets.get(key)!
    //             const total = model.out + model.single + model.double + model.triple + model.hr

    //             bucket.samples++
    //             bucket.out += model.out / total
    //             bucket.single += model.single / total
    //             bucket.double += model.double / total
    //             bucket.triple += model.triple / total
    //             bucket.hr += model.hr / total
    //         }
    //     }

    //     const rows = Array.from(buckets.values()).map(b => {
    //         const out = b.out / b.samples
    //         const single = b.single / b.samples
    //         const double = b.double / b.samples
    //         const triple = b.triple / b.samples
    //         const hr = b.hr / b.samples
    //         const bip = out + single + double + triple
    //         const babip = bip > 0 ? (single + double + triple) / bip : 0

    //         return {
    //             ...b,
    //             out,
    //             single,
    //             double,
    //             triple,
    //             hr,
    //             babip
    //         }
    //     })

    //     // === GLOBAL TOP BUCKETS ===
    //     console.log("\n=== TOP BUCKETS (ALL) ===")
    //     rows
    //         .sort((a, b) => b.samples - a.samples)
    //         .slice(0, 50)
    //         .forEach(r => {
    //             console.log(
    //                 `[${r.contact}] EV=${r.evBin} LA=${r.laBin} N=${r.samples} ` +
    //                 `OUT=${r.out.toFixed(3)} 1B=${r.single.toFixed(3)} ` +
    //                 `2B=${r.double.toFixed(3)} 3B=${r.triple.toFixed(3)} ` +
    //                 `HR=${r.hr.toFixed(3)} BABIP=${r.babip.toFixed(3)}`
    //             )
    //         })

    //     // === PER CONTACT SUMMARY ===
    //     for (const contact of contacts) {
    //         const contactRows = rows.filter(r => r.contact === contact)

    //         const totalSamples = contactRows.reduce((sum, r) => sum + r.samples, 0)

    //         const avgEv = contactRows.reduce((sum, r) => sum + (r.evBin * r.samples), 0) / totalSamples
    //         const avgLa = contactRows.reduce((sum, r) => sum + (r.laBin * r.samples), 0) / totalSamples

    //         const hrRate = contactRows.reduce((sum, r) => sum + (r.hr * r.samples), 0) / totalSamples
    //         const babip = contactRows.reduce((sum, r) => sum + (r.babip * r.samples), 0) / totalSamples

    //         console.log(`\n=== ${contact} SUMMARY ===`)
    //         console.log({
    //             totalSamples,
    //             avgEv: avgEv.toFixed(2),
    //             avgLa: avgLa.toFixed(2),
    //             hrRate: hrRate.toFixed(3),
    //             babip: babip.toFixed(3)
    //         })

    //         // show top HR buckets
    //         console.log(`--- TOP HR BUCKETS (${contact}) ---`)
    //         contactRows
    //             .sort((a, b) => (b.hr - a.hr))
    //             .slice(0, 10)
    //             .forEach(r => {
    //                 console.log(
    //                     `EV=${r.evBin} LA=${r.laBin} HR=${r.hr.toFixed(3)} N=${r.samples}`
    //                 )
    //             })
    //     }

    //     assert.ok(rows.length > 0)
    // })  

    // it("direct getHitQuality should match in-game contact quality distribution by contact type", () => {
    //     const testPitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify(pitchEnvironment))

    //     testPitchEnvironment.pitchEnvironmentTuning = {
    //         tuning: {
    //             pitch: {
    //                 velocityToQualityScale: 0,
    //                 movementToQualityScale: 0,
    //                 controlToQualityScale: 0
    //             },
    //             swing: {
    //                 pitchQualityZoneSwingEffect: 0,
    //                 pitchQualityChaseSwingEffect: 0,
    //                 disciplineZoneSwingEffect: 0,
    //                 disciplineChaseSwingEffect: 0
    //             },
    //             contact: {
    //                 pitchQualityContactEffect: 0,
    //                 contactSkillEffect: 0
    //             },
    //             contactQuality: {
    //                 evScale: 0,
    //                 laScale: 0,
    //                 distanceScale: 0,
                    
    //             },
    //             meta: {
    //                 fullTeamDefenseBonus: 0,
    //                 fullFielderDefenseBonus: 0,
    //                 fullPitchQualityBonus: 0
    //             },
    //             running: {
    //                 stealAttemptAggressionScale: 1
    //             }
    //         }
    //     } as PitchEnvironmentTuning

    //     const avg = (values: number[]): number => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

    //     const direct = {
    //         groundBall: { ev: [] as number[], la: [] as number[], distance: [] as number[] },
    //         lineDrive: { ev: [] as number[], la: [] as number[], distance: [] as number[] },
    //         flyBall: { ev: [] as number[], la: [] as number[], distance: [] as number[] }
    //     }

    //     const game = {
    //         groundBall: { ev: [] as number[], la: [] as number[], distance: [] as number[] },
    //         lineDrive: { ev: [] as number[], la: [] as number[], distance: [] as number[] },
    //         flyBall: { ev: [] as number[], la: [] as number[], distance: [] as number[] }
    //     }

    //     const add = (bucket: { ev: number[], la: number[], distance: number[] }, contactQuality: any): void => {
    //         bucket.ev.push(contactQuality.exitVelocity)
    //         bucket.la.push(contactQuality.launchAngle)
    //         bucket.distance.push(contactQuality.distance)
    //     }

    //     const sampleCount = 10000

    //     const directSamples = [
    //         { contact: Contact.GROUNDBALL, key: "groundBall" as const },
    //         { contact: Contact.LINE_DRIVE, key: "lineDrive" as const },
    //         { contact: Contact.FLY_BALL, key: "flyBall" as const }
    //     ]

    //     for (const row of directSamples) {
    //         const rng = seedrandom(`direct-contact-quality-${row.key}`)

    //         for (let i = 0; i < sampleCount; i++) {
    //             const contactQuality = (simService as any).gameRolls.getHitQuality(
    //                 rng,
    //                 testPitchEnvironment,
    //                 0,
    //                 false,
    //                 row.contact
    //             )

    //             add(direct[row.key], contactQuality)
    //         }
    //     }

    //     const rng = seedrandom("game-contact-quality-distribution")
    //     const games = evaluationGames

    //     for (let gameIndex = 0; gameIndex < games; gameIndex++) {
    //         const simulatedGame = playerImporterService.buildStartedBaselineGame(
    //             JSON.parse(JSON.stringify(testPitchEnvironment)),
    //             `game-contact-quality-distribution-${gameIndex}`
    //         )

    //         while (!simulatedGame.isComplete) {
    //             simService.simPitch(simulatedGame, rng)
    //         }

    //         for (const play of simulatedGame.halfInnings.flatMap(halfInning => halfInning.plays)) {
    //             const pitch = play.pitchLog?.pitches?.find((p: any) => p.contactQuality)

    //             if (!pitch?.contactQuality) continue

    //             if (play.contact === Contact.GROUNDBALL) add(game.groundBall, pitch.contactQuality)
    //             if (play.contact === Contact.LINE_DRIVE) add(game.lineDrive, pitch.contactQuality)
    //             if (play.contact === Contact.FLY_BALL) add(game.flyBall, pitch.contactQuality)
    //         }
    //     }

    //     const report = {
    //         groundBall: {
    //             directCount: direct.groundBall.la.length,
    //             gameCount: game.groundBall.la.length,
    //             directEv: avg(direct.groundBall.ev),
    //             gameEv: avg(game.groundBall.ev),
    //             directLa: avg(direct.groundBall.la),
    //             gameLa: avg(game.groundBall.la),
    //             directDistance: avg(direct.groundBall.distance),
    //             gameDistance: avg(game.groundBall.distance)
    //         },
    //         lineDrive: {
    //             directCount: direct.lineDrive.la.length,
    //             gameCount: game.lineDrive.la.length,
    //             directEv: avg(direct.lineDrive.ev),
    //             gameEv: avg(game.lineDrive.ev),
    //             directLa: avg(direct.lineDrive.la),
    //             gameLa: avg(game.lineDrive.la),
    //             directDistance: avg(direct.lineDrive.distance),
    //             gameDistance: avg(game.lineDrive.distance)
    //         },
    //         flyBall: {
    //             directCount: direct.flyBall.la.length,
    //             gameCount: game.flyBall.la.length,
    //             directEv: avg(direct.flyBall.ev),
    //             gameEv: avg(game.flyBall.ev),
    //             directLa: avg(direct.flyBall.la),
    //             gameLa: avg(game.flyBall.la),
    //             directDistance: avg(direct.flyBall.distance),
    //             gameDistance: avg(game.flyBall.distance)
    //         }
    //     }

    //     console.log("[CONTACT QUALITY DIRECT VS GAME]", report)

    //     assert.ok(game.groundBall.la.length > 1000)
    //     assert.ok(game.lineDrive.la.length > 1000)
    //     assert.ok(game.flyBall.la.length > 1000)

    //     assert.ok(Math.abs(report.groundBall.directLa - report.groundBall.gameLa) < 1.5)
    //     assert.ok(Math.abs(report.lineDrive.directLa - report.lineDrive.gameLa) < 1.5)
    //     assert.ok(Math.abs(report.flyBall.directLa - report.flyBall.gameLa) < 1.5)

    //     assert.ok(Math.abs(report.groundBall.directEv - report.groundBall.gameEv) < 1.5)
    //     assert.ok(Math.abs(report.lineDrive.directEv - report.lineDrive.gameEv) < 1.5)
    //     assert.ok(Math.abs(report.flyBall.directEv - report.flyBall.gameEv) < 1.5)
    // })

    // it("zero tuning should print expected vs actual in-game contact and EV LA report", () => {
    //     const zeroTuning: PitchEnvironmentTuning = {
    //         tuning: {
    //             pitch: {
    //                 velocityToQualityScale: 0,
    //                 movementToQualityScale: 0,
    //                 controlToQualityScale: 0
    //             },
    //             swing: {
    //                 pitchQualityZoneSwingEffect: 0,
    //                 pitchQualityChaseSwingEffect: 0,
    //                 disciplineZoneSwingEffect: 0,
    //                 disciplineChaseSwingEffect: 0
    //             },
    //             contact: {
    //                 pitchQualityContactEffect: 0,
    //                 contactSkillEffect: 0
    //             },
    //             contactQuality: {
    //                 evScale: 0,
    //                 laScale: 0,
    //                 distanceScale: 0,
    //             },
    //             meta: {
    //                 fullTeamDefenseBonus: 0,
    //                 fullFielderDefenseBonus: 0,
    //                 fullPitchQualityBonus: 0
    //             },
    //             running: {
    //                 stealAttemptAggressionScale: 1
    //             }
    //         }
    //     } as PitchEnvironmentTuning

    //     const testPitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify(pitchEnvironment))
    //     testPitchEnvironment.pitchEnvironmentTuning = zeroTuning

    //     const rng = seedrandom("zero-tuning-live-game-contact-report")
    //     const games = evaluationGames

    //     const contactCounts = {
    //         groundBall: 0,
    //         lineDrive: 0,
    //         flyBall: 0,
    //         none: 0
    //     }

    //     const resultCounts = {
    //         out: 0,
    //         single: 0,
    //         double: 0,
    //         triple: 0,
    //         hr: 0,
    //         bb: 0,
    //         hbp: 0,
    //         so: 0,
    //         other: 0
    //     }

    //     const evBuckets = new Map<number, number>()
    //     const laBuckets = new Map<number, number>()
    //     const evLaBuckets = new Map<string, { evBin: number, laBin: number, count: number, hr: number, hits: number, outs: number }>()

    //     let totalRuns = 0
    //     let totalPlays = 0
    //     let totalBallsInPlay = 0
    //     let totalEv = 0
    //     let totalLa = 0
    //     let totalDistance = 0
    //     let totalContactQuality = 0

    //     for (let gameIndex = 0; gameIndex < games; gameIndex++) {
    //         const game = playerImporterService.buildStartedBaselineGame(
    //             JSON.parse(JSON.stringify(testPitchEnvironment)),
    //             `zero-contact-report-${gameIndex}`
    //         )

    //         while (!game.isComplete) {
    //             simService.simPitch(game, rng)
    //         }

    //         totalRuns += game.score.away + game.score.home

    //         const plays = game.halfInnings.flatMap(halfInning => halfInning.plays)
    //         totalPlays += plays.length

    //         for (const play of plays) {
    //             if (play.contact === Contact.GROUNDBALL) contactCounts.groundBall++
    //             else if (play.contact === Contact.LINE_DRIVE) contactCounts.lineDrive++
    //             else if (play.contact === Contact.FLY_BALL) contactCounts.flyBall++
    //             else contactCounts.none++

    //             switch (play.result) {
    //                 case PlayResult.OUT:
    //                     resultCounts.out++
    //                     break
    //                 case PlayResult.SINGLE:
    //                     resultCounts.single++
    //                     break
    //                 case PlayResult.DOUBLE:
    //                     resultCounts.double++
    //                     break
    //                 case PlayResult.TRIPLE:
    //                     resultCounts.triple++
    //                     break
    //                 case PlayResult.HR:
    //                     resultCounts.hr++
    //                     break
    //                 case PlayResult.BB:
    //                     resultCounts.bb++
    //                     break
    //                 case PlayResult.HIT_BY_PITCH:
    //                     resultCounts.hbp++
    //                     break
    //                 case PlayResult.STRIKEOUT:
    //                     resultCounts.so++
    //                     break
    //                 default:
    //                     resultCounts.other++
    //                     break
    //             }

    //             const pitchWithContactQuality = play.pitchLog?.pitches?.find((pitch: any) => pitch.contactQuality)

    //             if (pitchWithContactQuality?.contactQuality) {
    //                 const hitQuality = pitchWithContactQuality.contactQuality

    //                 totalBallsInPlay++
    //                 totalContactQuality++
    //                 totalEv += hitQuality.exitVelocity
    //                 totalLa += hitQuality.launchAngle
    //                 totalDistance += hitQuality.distance

    //                 const evBin = Math.floor(hitQuality.exitVelocity / 2) * 2
    //                 const laBin = Math.floor(hitQuality.launchAngle / 2) * 2
    //                 const key = `${evBin}:${laBin}`

    //                 evBuckets.set(evBin, (evBuckets.get(evBin) ?? 0) + 1)
    //                 laBuckets.set(laBin, (laBuckets.get(laBin) ?? 0) + 1)

    //                 if (!evLaBuckets.has(key)) {
    //                     evLaBuckets.set(key, {
    //                         evBin,
    //                         laBin,
    //                         count: 0,
    //                         hr: 0,
    //                         hits: 0,
    //                         outs: 0
    //                     })
    //                 }

    //                 const bucket = evLaBuckets.get(key)!
    //                 bucket.count++

    //                 if (play.result === PlayResult.HR) bucket.hr++
    //                 if (
    //                     play.result === PlayResult.SINGLE ||
    //                     play.result === PlayResult.DOUBLE ||
    //                     play.result === PlayResult.TRIPLE ||
    //                     play.result === PlayResult.HR
    //                 ) {
    //                     bucket.hits++
    //                 }
    //                 if (play.result === PlayResult.OUT) bucket.outs++
    //             }
    //         }
    //     }

    //     const contactTotal = contactCounts.groundBall + contactCounts.lineDrive + contactCounts.flyBall
    //     const hitTotal = resultCounts.single + resultCounts.double + resultCounts.triple + resultCounts.hr
    //     const abTotal = resultCounts.out + hitTotal + resultCounts.so
    //     const babipDenominator = resultCounts.out + resultCounts.single + resultCounts.double + resultCounts.triple
    //     const babipNumerator = resultCounts.single + resultCounts.double + resultCounts.triple
    //     const totalBases = resultCounts.single + (resultCounts.double * 2) + (resultCounts.triple * 3) + (resultCounts.hr * 4)

    //     const expectedContact = testPitchEnvironment.battedBall.contactRollInput
    //     const expectedTotal = expectedContact.groundball + expectedContact.lineDrive + expectedContact.flyBall

    //     console.log("\n=== ZERO TUNING EXPECTED CONTACT MIX ===")
    //     console.log({
    //         groundBall: expectedContact.groundball / expectedTotal,
    //         lineDrive: expectedContact.lineDrive / expectedTotal,
    //         flyBall: expectedContact.flyBall / expectedTotal,
    //         raw: expectedContact
    //     })

    //     console.log("\n=== ZERO TUNING ACTUAL CONTACT MIX ===")
    //     console.log({
    //         groundBall: contactCounts.groundBall / contactTotal,
    //         lineDrive: contactCounts.lineDrive / contactTotal,
    //         flyBall: contactCounts.flyBall / contactTotal,
    //         none: contactCounts.none,
    //         raw: contactCounts
    //     })

    //     console.log("\n=== ZERO TUNING GAME OUTCOME REPORT ===")
    //     console.log({
    //         games,
    //         runsPerGame: totalRuns / games / 2,
    //         pa: totalPlays,
    //         ab: abTotal,
    //         avg: abTotal > 0 ? hitTotal / abTotal : 0,
    //         obp: totalPlays > 0 ? (hitTotal + resultCounts.bb + resultCounts.hbp) / totalPlays : 0,
    //         slg: abTotal > 0 ? totalBases / abTotal : 0,
    //         babip: babipDenominator > 0 ? babipNumerator / babipDenominator : 0,
    //         hrPerPA: totalPlays > 0 ? resultCounts.hr / totalPlays : 0,
    //         bbPerPA: totalPlays > 0 ? resultCounts.bb / totalPlays : 0,
    //         soPerPA: totalPlays > 0 ? resultCounts.so / totalPlays : 0,
    //         ballsInPlayPerPA: totalPlays > 0 ? totalBallsInPlay / totalPlays : 0,
    //         resultCounts
    //     })

    //     console.log("\n=== ZERO TUNING CONTACT QUALITY SUMMARY ===")
    //     console.log({
    //         ballsInPlay: totalBallsInPlay,
    //         avgEv: totalContactQuality > 0 ? totalEv / totalContactQuality : 0,
    //         avgLa: totalContactQuality > 0 ? totalLa / totalContactQuality : 0,
    //         avgDistance: totalContactQuality > 0 ? totalDistance / totalContactQuality : 0
    //     })

    //     console.log("\n=== ZERO TUNING TOP EV BUCKETS ===")
    //     Array.from(evBuckets.entries())
    //         .sort((a, b) => b[1] - a[1])
    //         .slice(0, 25)
    //         .forEach(([evBin, count]) => {
    //             console.log(`[EV] ${evBin} N=${count} PCT=${(count / totalBallsInPlay).toFixed(3)}`)
    //         })

    //     console.log("\n=== ZERO TUNING TOP LA BUCKETS ===")
    //     Array.from(laBuckets.entries())
    //         .sort((a, b) => b[1] - a[1])
    //         .slice(0, 35)
    //         .forEach(([laBin, count]) => {
    //             console.log(`[LA] ${laBin} N=${count} PCT=${(count / totalBallsInPlay).toFixed(3)}`)
    //         })

    //     console.log("\n=== ZERO TUNING TOP LIVE EV/LA BUCKETS ===")
    //     Array.from(evLaBuckets.values())
    //         .sort((a, b) => b.count - a.count)
    //         .slice(0, 50)
    //         .forEach(bucket => {
    //             console.log(
    //                 `[LIVE EVLA] EV=${bucket.evBin} LA=${bucket.laBin} N=${bucket.count} ` +
    //                 `H=${(bucket.hits / bucket.count).toFixed(3)} ` +
    //                 `HR=${(bucket.hr / bucket.count).toFixed(3)} ` +
    //                 `OUT=${(bucket.outs / bucket.count).toFixed(3)}`
    //             )
    //         })

    //     assert.ok(contactTotal > 0)
    //     assert.ok(totalBallsInPlay > 0)
    // })

    // it("zero tuning should print baseline offense", () => {
    //     const zeroTuning: PitchEnvironmentTuning = {
    //         tuning: {
    //             pitch: {
    //                 velocityToQualityScale: 0,
    //                 movementToQualityScale: 0,
    //                 controlToQualityScale: 0
    //             },
    //             swing: {
    //                 pitchQualityZoneSwingEffect: 0,
    //                 pitchQualityChaseSwingEffect: 0,
    //                 disciplineZoneSwingEffect: 0,
    //                 disciplineChaseSwingEffect: 0
    //             },
    //             contact: {
    //                 pitchQualityContactEffect: 0,
    //                 contactSkillEffect: 0
    //             },
    //             contactQuality: {
    //                 evScale: 0,
    //                 laScale: 0,
    //                 distanceScale: 0,
    //             },
    //             meta: {
    //                 fullTeamDefenseBonus: 0,
    //                 fullFielderDefenseBonus: 0,
    //                 fullPitchQualityBonus: 0
    //             },
    //             running: {
    //                 stealAttemptAggressionScale: 1
    //             }
    //         }
    //     } as PitchEnvironmentTuning

    //     const testPitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify(pitchEnvironment))
    //     testPitchEnvironment.pitchEnvironmentTuning = zeroTuning

    //     const evaluation = playerImporterService.evaluatePitchEnvironment(
    //         testPitchEnvironment,
    //         seedrandom("zero-tuning-baseline-250"),
    //         evaluationGames
    //     )

    //     console.log("[ZERO TUNING BASELINE]", {
    //         runs: evaluation.actual.teamRunsPerGame,
    //         targetRuns: evaluation.target.teamRunsPerGame,
    //         avg: evaluation.actual.avg,
    //         targetAvg: evaluation.target.avg,
    //         obp: evaluation.actual.obp,
    //         targetObp: evaluation.target.obp,
    //         slg: evaluation.actual.slg,
    //         targetSlg: evaluation.target.slg,
    //         babip: evaluation.actual.babip,
    //         targetBabip: evaluation.target.babip,
    //         soPercent: evaluation.actual.soPercent,
    //         targetSoPercent: evaluation.target.soPercent,
    //         bbPercent: evaluation.actual.bbPercent,
    //         targetBbPercent: evaluation.target.bbPercent,
    //         homeRunPercent: evaluation.actual.homeRunPercent,
    //         targetHomeRunPercent: evaluation.target.homeRunPercent,
    //         pitchesPerPA: evaluation.actual.pitchesPerPA,
    //         targetPitchesPerPA: evaluation.target.pitchesPerPA
    //     })

    //     assert.ok(evaluation.actual.teamRunsPerGame > 0)
    //     assert.ok(Number.isFinite(evaluation.actual.teamRunsPerGame))
    //     assert.ok(Number.isFinite(evaluation.actual.avg))
    //     assert.ok(Number.isFinite(evaluation.actual.obp))
    //     assert.ok(Number.isFinite(evaluation.actual.slg))
    // })

    // it("zero tuning should print sampled trajectory vs final logged contact", () => {
    //     const zeroTuning: PitchEnvironmentTuning = {
    //         tuning: {
    //             pitch: {
    //                 velocityToQualityScale: 0,
    //                 movementToQualityScale: 0,
    //                 controlToQualityScale: 0
    //             },
    //             swing: {
    //                 pitchQualityZoneSwingEffect: 0,
    //                 pitchQualityChaseSwingEffect: 0,
    //                 disciplineZoneSwingEffect: 0,
    //                 disciplineChaseSwingEffect: 0
    //             },
    //             contact: {
    //                 pitchQualityContactEffect: 0,
    //                 contactSkillEffect: 0
    //             },
    //             contactQuality: {
    //                 evScale: 0,
    //                 laScale: 0,
    //                 distanceScale: 0,
                    
    //             },
    //             meta: {
    //                 fullTeamDefenseBonus: 0,
    //                 fullFielderDefenseBonus: 0,
    //                 fullPitchQualityBonus: 0
    //             },
    //             running: {
    //                 stealAttemptAggressionScale: 1
    //             }
    //         }
    //     } as PitchEnvironmentTuning

    //     const testPitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify(pitchEnvironment))
    //     testPitchEnvironment.pitchEnvironmentTuning = zeroTuning

    //     const rng = seedrandom("zero-sampled-vs-final-contact")
    //     const games = evaluationGames

    //     const getSampledTrajectory = (hitQuality: any): string => {
    //         const evBin = Math.floor(hitQuality.exitVelocity / 2) * 2
    //         const laBin = Math.floor(hitQuality.launchAngle / 2) * 2

    //         const matches = testPitchEnvironment.battedBall.xy.byTrajectoryEvLa.filter((row: any) =>
    //             Number(row.evBin) === evBin &&
    //             Number(row.laBin) === laBin
    //         )

    //         if (matches.length === 1) return matches[0].trajectory

    //         const trajectoryCounts = matches.reduce((acc: any, row: any) => {
    //             acc[row.trajectory] = (acc[row.trajectory] ?? 0) + Number(row.count ?? 0)
    //             return acc
    //         }, {})

    //         const best = Object.entries(trajectoryCounts)
    //             .sort((a: any, b: any) => b[1] - a[1])[0]

    //         if (best) return best[0] as string

    //         if (laBin < 0) return "groundBall"
    //         if (laBin < 24) return "lineDrive"
    //         return "flyBall"
    //     }

    //     const report = new Map<string, {
    //         count: number
    //         out: number
    //         single: number
    //         double: number
    //         triple: number
    //         hr: number
    //     }>()

    //     const bump = (key: string, result: PlayResult) => {
    //         if (!report.has(key)) {
    //             report.set(key, {
    //                 count: 0,
    //                 out: 0,
    //                 single: 0,
    //                 double: 0,
    //                 triple: 0,
    //                 hr: 0
    //             })
    //         }

    //         const row = report.get(key)!
    //         row.count++

    //         if (result === PlayResult.OUT) row.out++
    //         else if (result === PlayResult.SINGLE) row.single++
    //         else if (result === PlayResult.DOUBLE) row.double++
    //         else if (result === PlayResult.TRIPLE) row.triple++
    //         else if (result === PlayResult.HR) row.hr++
    //     }

    //     for (let gameIndex = 0; gameIndex < games; gameIndex++) {
    //         const game = playerImporterService.buildStartedBaselineGame(
    //             JSON.parse(JSON.stringify(testPitchEnvironment)),
    //             `zero-sampled-vs-final-contact-${gameIndex}`
    //         )

    //         while (!game.isComplete) {
    //             simService.simPitch(game, rng)
    //         }

    //         for (const play of game.halfInnings.flatMap(halfInning => halfInning.plays)) {
    //             const pitchWithContactQuality = play.pitchLog?.pitches?.find((pitch: any) => pitch.contactQuality)

    //             if (!pitchWithContactQuality?.contactQuality) continue

    //             const sampledTrajectory = getSampledTrajectory(pitchWithContactQuality.contactQuality)
    //             const finalContact = play.contact

    //             bump(`${sampledTrajectory} -> ${finalContact}`, play.result)
    //         }
    //     }

    //     console.log("\n=== SAMPLED TRAJECTORY VS FINAL CONTACT ===")

    //     Array.from(report.entries())
    //         .sort((a, b) => b[1].count - a[1].count)
    //         .forEach(([key, row]) => {
    //             const hit = row.single + row.double + row.triple + row.hr
    //             const bip = row.out + row.single + row.double + row.triple
    //             const babip = bip > 0 ? (row.single + row.double + row.triple) / bip : 0
    //             const hrRate = row.hr / row.count

    //             console.log(`[${key}]`, {
    //                 count: row.count,
    //                 out: Number((row.out / row.count).toFixed(3)),
    //                 hit: Number((hit / row.count).toFixed(3)),
    //                 hr: Number(hrRate.toFixed(3)),
    //                 babip: Number(babip.toFixed(3)),
    //                 raw: row
    //             })
    //         })

    //     assert.ok(report.size > 0)
    // })

    // const HIGH_OFFENSE_TUNING = {
    //     contactQuality: {
    //         evScale: 28,
    //         laScale: 9,
    //         distanceScale: 30,
    //     },
    //     pitch: {
    //         velocityToQualityScale: 0,
    //         movementToQualityScale: -55,
    //         controlToQualityScale: 0
    //     },
    //     swing: {
    //         pitchQualityZoneSwingEffect: 10,
    //         pitchQualityChaseSwingEffect: 10,
    //         disciplineZoneSwingEffect: 20,
    //         disciplineChaseSwingEffect: 20
    //     },
    //     contact: {
    //         pitchQualityContactEffect: -24,
    //         contactSkillEffect: -28
    //     },
    //     running: {
    //         stealAttemptAggressionScale: 2
    //     },
    //     meta: {
    //         fullPitchQualityBonus: 650,
    //         fullTeamDefenseBonus: -60,
    //         fullFielderDefenseBonus: -60
    //     }
    // }

    // it("manual high-offense full game should print available evaluation pipeline rates", () => {
    //     const evaluation = evaluateManualTuning("high-offense-debug", HIGH_OFFENSE_TUNING)
    //     const actual = evaluation.actual

    //     console.log("[HIGH OFFENSE PIPELINE]", {
    //         runs: actual.teamRunsPerGame,
    //         avg: actual.avg,
    //         obp: actual.obp,
    //         slg: actual.slg,
    //         ops: actual.ops,
    //         babip: actual.babip,
    //         pitchesPerPA: actual.pitchesPerPA,
    //         soPercent: actual.soPercent,
    //         bbPercent: actual.bbPercent,
    //         hbpPercent: actual.hbpPercent,
    //         singlePercent: actual.singlePercent,
    //         doublePercent: actual.doublePercent,
    //         triplePercent: actual.triplePercent,
    //         homeRunPercent: actual.homeRunPercent,
    //         teamHitsPerGame: actual.teamHitsPerGame,
    //         teamHomeRunsPerGame: actual.teamHomeRunsPerGame,
    //         teamBBPerGame: actual.teamBBPerGame,
    //         teamSOPerGame: actual.teamSOPerGame,
    //         targetRuns: evaluation.target.teamRunsPerGame
    //     })

    //     assert.ok(Number.isFinite(actual.teamRunsPerGame))
    //     assert.ok(Number.isFinite(actual.avg))
    //     assert.ok(Number.isFinite(actual.babip))
    //     assert.ok(Number.isFinite(actual.soPercent))
    //     assert.ok(Number.isFinite(actual.homeRunPercent))
    // })

    // it("manual high-offense tuning should be able to clear target runs", () => {

    //     const evaluation = evaluateManualTuning("high-offense", HIGH_OFFENSE_TUNING)

    //     assert.ok(
    //         evaluation.actual.teamRunsPerGame > evaluation.target.teamRunsPerGame,
    //         `Expected high-offense tuning to clear target R/G. actual=${evaluation.actual.teamRunsPerGame} target=${evaluation.target.teamRunsPerGame}`
    //     )
    // })

    // it("manual low-offense tuning should be able to stay at least two runs below target", () => {
    //     const evaluation = evaluateManualTuning("low-offense", {
    //         contactQuality: {
    //             evScale: 36,
    //             laScale: 16,
    //             distanceScale: 45,
                
    //         },
    //         pitch: {
    //             velocityToQualityScale: 110,
    //             movementToQualityScale: 110,
    //             controlToQualityScale: 120
    //         },
    //         swing: {
    //             pitchQualityZoneSwingEffect: -40,
    //             pitchQualityChaseSwingEffect: 70,
    //             disciplineZoneSwingEffect: -25,
    //             disciplineChaseSwingEffect: 25
    //         },
    //         contact: {
    //             pitchQualityContactEffect: 110,
    //             contactSkillEffect: 95
    //         },
    //         running: {
    //             stealAttemptAggressionScale: 0.1
    //         },
    //         meta: {
    //             fullTeamDefenseBonus: 160,
    //             fullFielderDefenseBonus: 160,
    //             fullPitchQualityBonus: 650
    //         }
    //     })

    //     console.log("[MANUAL LOW-OFFENSE]", {
    //         runs: evaluation.actual.teamRunsPerGame,
    //         avg: evaluation.actual.avg,
    //         obp: evaluation.actual.obp,
    //         slg: evaluation.actual.slg,
    //         ops: evaluation.actual.ops,
    //         babip: evaluation.actual.babip,
    //         pitchesPerPA: evaluation.actual.pitchesPerPA,
    //         zSwing: evaluation.actual.swingAtStrikesPercent,
    //         chase: evaluation.actual.swingAtBallsPercent,
    //         zContact: evaluation.actual.inZoneContactPercent,
    //         chaseContact: evaluation.actual.outZoneContactPercent,
    //         bbPercent: evaluation.actual.bbPercent,
    //         soPercent: evaluation.actual.soPercent,
    //         targetRuns: evaluation.target.teamRunsPerGame
    //     })

    //     assert.ok(
    //         evaluation.actual.teamRunsPerGame < evaluation.target.teamRunsPerGame - 2,
    //         `Expected low-offense tuning to be at least 2 R/G below target. actual=${evaluation.actual.teamRunsPerGame} target=${evaluation.target.teamRunsPerGame}`
    //     )
    // })

    // it("forced line-drive contact should break the offense ceiling", () => {
    //     const testPitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify(pitchEnvironment))

    //     testPitchEnvironment.pitchEnvironmentTuning = {
    //         tuning: HIGH_OFFENSE_TUNING
    //     } as PitchEnvironmentTuning

    //     testPitchEnvironment.battedBall.contactRollInput = {
    //         groundball: 0,
    //         flyBall: 0,
    //         lineDrive: 100
    //     }

    //     const evaluation = playerImporterService.evaluatePitchEnvironment(
    //         testPitchEnvironment,
    //         seedrandom("manual-forced-line-drive-250"),
    //         evaluationGames
    //     )

    //     console.log("[FORCED LD OFFENSE]", {
    //         runs: evaluation.actual.teamRunsPerGame,
    //         avg: evaluation.actual.avg,
    //         obp: evaluation.actual.obp,
    //         slg: evaluation.actual.slg,
    //         ops: evaluation.actual.ops,
    //         babip: evaluation.actual.babip,
    //         homeRunPercent: evaluation.actual.homeRunPercent,
    //         targetRuns: evaluation.target.teamRunsPerGame
    //     })

    //     assert.ok(
    //         evaluation.actual.teamRunsPerGame > evaluation.target.teamRunsPerGame,
    //         `Expected forced LD contact to clear target R/G. actual=${evaluation.actual.teamRunsPerGame} target=${evaluation.target.teamRunsPerGame}`
    //     )
    // })

    // it("getOutcomeModelForContactQuality should return the exact EV/LA bucket when powerRollInput is missing", () => {
    //     const pitchEnvironmentTarget = {
    //         pitchEnvironmentTuning: {
    //             tuning: {
    //                 contactQuality: {
    //                     evScale: 0,
    //                     laScale: 0,
    //                     distanceScale: 0
    //                 },
    //                 pitch: {
    //                     velocityToQualityScale: 0,
    //                     movementToQualityScale: 0,
    //                     controlToQualityScale: 0
    //                 },
    //                 swing: {
    //                     pitchQualityZoneSwingEffect: 0,
    //                     pitchQualityChaseSwingEffect: 0,
    //                     disciplineZoneSwingEffect: 0,
    //                     disciplineChaseSwingEffect: 0
    //                 },
    //                 contact: {
    //                     pitchQualityContactEffect: 0,
    //                     contactSkillEffect: 0
    //                 },
    //                 running: {
    //                     stealAttemptAggressionScale: 1
    //                 },
    //                 meta: {
    //                     fullTeamDefenseBonus: 0,
    //                     fullFielderDefenseBonus: 0,
    //                     fullPitchQualityBonus: 0
    //                 }
    //             }
    //         },
    //         battedBall: {
    //             outcomeByEvLa: [
    //                 { evBin: 100, laBin: 20, count: 10, out: 4, single: 3, double: 2, triple: 0, hr: 1 }
    //             ]
    //         }
    //     } as any

    //     const contactQuality = {
    //         exitVelocity: 101.9,
    //         launchAngle: 21.9
    //     } as any

    //     const model = (simService as any).getOutcomeModelForContactQuality(
    //         pitchEnvironmentTarget,
    //         contactQuality,
    //         Contact.LINE_DRIVE
    //     )

    //     assert.strictEqual(model.evBin, 100)
    //     assert.strictEqual(model.laBin, 20)
    //     assert.strictEqual(model.count, 10)
    //     assert.strictEqual(model.out, 4)
    //     assert.strictEqual(model.single, 3)
    //     assert.strictEqual(model.double, 2)
    //     assert.strictEqual(model.triple, 0)
    //     assert.strictEqual(model.hr, 1)
    //     assert.strictEqual(model.expectedBases, (3 + (2 * 2) + (1 * 4)) / 10)
    // })

    // it("getOutcomeModelForContactQuality should use the nearest EV/LA bucket when the exact bucket is missing", () => {
    //     const pitchEnvironmentTarget = {
    //         pitchEnvironmentTuning: {
    //             tuning: {
    //                 contactQuality: {
    //                     evScale: 0,
    //                     laScale: 0,
    //                     distanceScale: 0
    //                 },
    //                 pitch: {
    //                     velocityToQualityScale: 0,
    //                     movementToQualityScale: 0,
    //                     controlToQualityScale: 0
    //                 },
    //                 swing: {
    //                     pitchQualityZoneSwingEffect: 0,
    //                     pitchQualityChaseSwingEffect: 0,
    //                     disciplineZoneSwingEffect: 0,
    //                     disciplineChaseSwingEffect: 0
    //                 },
    //                 contact: {
    //                     pitchQualityContactEffect: 0,
    //                     contactSkillEffect: 0
    //                 },
    //                 running: {
    //                     stealAttemptAggressionScale: 1
    //                 },
    //                 meta: {
    //                     fullTeamDefenseBonus: 0,
    //                     fullFielderDefenseBonus: 0,
    //                     fullPitchQualityBonus: 0
    //                 }
    //             }
    //         },
    //         battedBall: {
    //             outcomeByEvLa: [
    //                 { evBin: 98, laBin: 18, count: 10, out: 5, single: 3, double: 1, triple: 0, hr: 1 }
    //             ]
    //         }
    //     } as any

    //     const contactQuality = {
    //         exitVelocity: 101.0,
    //         launchAngle: 21.0
    //     } as any

    //     const model = (simService as any).getOutcomeModelForContactQuality(
    //         pitchEnvironmentTarget,
    //         contactQuality,
    //         Contact.LINE_DRIVE,
    //         0
    //     )

    //     assert.strictEqual(model.evBin, 98)
    //     assert.strictEqual(model.laBin, 18)
    //     assert.strictEqual(model.count, 10)
    //     assert.strictEqual(model.out, 5)
    //     assert.strictEqual(model.single, 3)
    //     assert.strictEqual(model.double, 1)
    //     assert.strictEqual(model.triple, 0)
    //     assert.strictEqual(model.hr, 1)
    // })

    // it("getPlayResultFromOutcomeModel should map cumulative ranges exactly", () => {
    //     const model = {
    //         count: 10,
    //         out: 2,
    //         single: 3,
    //         double: 2,
    //         triple: 1,
    //         hr: 2
    //     }

    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.0), PlayResult.OUT)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.199999), PlayResult.OUT)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.2), PlayResult.SINGLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.499999), PlayResult.SINGLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.5), PlayResult.DOUBLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.699999), PlayResult.DOUBLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.7), PlayResult.TRIPLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.799999), PlayResult.TRIPLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.8), PlayResult.HR)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.999999), PlayResult.HR)
    // })

    // it("getPlayResultFromOutcomeModel should support fractional outcome weights", () => {
    //     const model = {
    //         count: 1,
    //         out: 0.5,
    //         single: 0.25,
    //         double: 0.125,
    //         triple: 0.075,
    //         hr: 0.05
    //     }

    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.0), PlayResult.OUT)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.499999), PlayResult.OUT)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.5), PlayResult.SINGLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.749999), PlayResult.SINGLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.75), PlayResult.DOUBLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.874999), PlayResult.DOUBLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.875), PlayResult.TRIPLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.949999), PlayResult.TRIPLE)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.95), PlayResult.HR)
    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.999999), PlayResult.HR)
    // })    

    // it("getPlayResultFromOutcomeModel should return OUT when total is zero", () => {
    //     const model = {
    //         count: 0,
    //         out: 0,
    //         single: 0,
    //         double: 0,
    //         triple: 0,
    //         hr: 0
    //     }

    //     assert.strictEqual((simService as any).getPlayResultFromOutcomeModel(model, () => 0.5), PlayResult.OUT)
    // })

    // it("getHitQuality should produce a deterministic ground ball profile with zero tuning", () => {
    //     const pitchEnvironmentTarget = {
    //         pitchEnvironmentTuning: {
    //             tuning: {
    //                 contactQuality: {
    //                     evScale: 0,
    //                     laScale: 0,
    //                     distanceScale: 0,

    //                 },
    //                 pitch: {
    //                     velocityToQualityScale: 0,
    //                     movementToQualityScale: 0,
    //                     controlToQualityScale: 0
    //                 },
    //                 swing: {
    //                     pitchQualityZoneSwingEffect: 0,
    //                     pitchQualityChaseSwingEffect: 0,
    //                     disciplineZoneSwingEffect: 0,
    //                     disciplineChaseSwingEffect: 0
    //                 },
    //                 contact: {
    //                     pitchQualityContactEffect: 0,
    //                     contactSkillEffect: 0
    //                 },
    //                 running: {
    //                     stealAttemptAggressionScale: 1
    //                 },
    //                 meta: {
    //                     fullTeamDefenseBonus: 0,
    //                     fullFielderDefenseBonus: 0,
    //                     fullPitchQualityBonus: 0
    //                 }
    //             }
    //         },
    //         importReference: {
    //             hitter: {
    //                 physics: {
    //                     exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
    //                     launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
    //                     distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
    //                     byTrajectory: {
    //                         groundBall: {
    //                             exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
    //                             launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
    //                             distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
    //                         },
    //                         lineDrive: {
    //                             exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
    //                             launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
    //                             distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
    //                         },
    //                         flyBall: {
    //                             exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
    //                             launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
    //                             distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
    //                         }
    //                     }
    //                 }
    //             }
    //         },
    //         battedBall: {
    //             xy: {
    //                 byTrajectoryEvLa: [
    //                     { trajectory: "groundBall", evBin: 84, laBin: -6, xBin: 20, yBin: 60, count: 10 },
    //                     { trajectory: "groundBall", evBin: 84, laBin: -4, xBin: 10, yBin: 70, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 94, laBin: 12, xBin: 0, yBin: 180, count: 10 },
    //                     { trajectory: "flyBall", evBin: 92, laBin: 32, xBin: 5, yBin: 260, count: 10 }
    //                 ],
    //                 byTrajectory: [
    //                     { trajectory: "groundBall", xBin: 15, yBin: 65, count: 50 },
    //                     { trajectory: "lineDrive", xBin: 0, yBin: 185, count: 50 },
    //                     { trajectory: "flyBall", xBin: 0, yBin: 255, count: 50 }
    //                 ]
    //             },
    //             spray: {
    //                 byTrajectoryEvLa: [
    //                     { trajectory: "groundBall", evBin: 84, laBin: -6, sprayBin: 12, count: 10 },
    //                     { trajectory: "groundBall", evBin: 84, laBin: -4, sprayBin: 8, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: 0, count: 10 },
    //                     { trajectory: "flyBall", evBin: 92, laBin: 32, sprayBin: 2, count: 10 }
    //                 ],
    //                 byTrajectory: [
    //                     { trajectory: "groundBall", sprayBin: 10, count: 50 },
    //                     { trajectory: "lineDrive", sprayBin: 0, count: 50 },
    //                     { trajectory: "flyBall", sprayBin: 0, count: 50 }
    //                 ]
    //             }
    //         }
    //     } as any

    //     //@ts-ignore
    //     const result = simService.gameRolls.getHitQuality(() => 0.5, pitchEnvironmentTarget, 0, false, Contact.GROUNDBALL)

    //     assert.ok(Number.isFinite(result.exitVelocity))
    //     assert.ok(Number.isFinite(result.launchAngle))
    //     assert.ok(Number.isFinite(result.distance))
    //     assert.ok(Number.isFinite(result.coordX))
    //     assert.ok(Number.isFinite(result.coordY))
    //     assert.ok(result.launchAngle < 5)
    //     assert.ok(result.distance < 150)

    //     const evBin = Math.floor(result.exitVelocity / 2) * 2
    //     const laBin = Math.floor(result.launchAngle / 2) * 2

    //     assert.ok(evBin === 84 || evBin === 86)
    //     assert.ok(laBin === -6 || laBin === -4)
    // })

    // it("getHitQuality should produce a deterministic line drive profile with zero tuning", () => {
    //     const pitchEnvironmentTarget = {
    //         pitchEnvironmentTuning: {
    //             tuning: {
    //                 contactQuality: {
    //                     evScale: 0,
    //                     laScale: 0,
    //                     distanceScale: 0
    //                 },
    //                 pitch: {
    //                     velocityToQualityScale: 0,
    //                     movementToQualityScale: 0,
    //                     controlToQualityScale: 0
    //                 },
    //                 swing: {
    //                     pitchQualityZoneSwingEffect: 0,
    //                     pitchQualityChaseSwingEffect: 0,
    //                     disciplineZoneSwingEffect: 0,
    //                     disciplineChaseSwingEffect: 0
    //                 },
    //                 contact: {
    //                     pitchQualityContactEffect: 0,
    //                     contactSkillEffect: 0
    //                 },
    //                 running: {
    //                     stealAttemptAggressionScale: 1
    //                 },
    //                 meta: {
    //                     fullTeamDefenseBonus: 0,
    //                     fullFielderDefenseBonus: 0,
    //                     fullPitchQualityBonus: 0
    //                 }
    //             }
    //         },
    //         importReference: {
    //             hitter: {
    //                 physics: {
    //                     exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
    //                     launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
    //                     distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
    //                     byTrajectory: {
    //                         groundBall: {
    //                             exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
    //                             launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
    //                             distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
    //                         },
    //                         lineDrive: {
    //                             exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
    //                             launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
    //                             distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
    //                         },
    //                         flyBall: {
    //                             exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
    //                             launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
    //                             distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
    //                         }
    //                     }
    //                 }
    //             }
    //         },
    //         battedBall: {
    //             xy: {
    //                 byTrajectoryEvLa: [
    //                     { trajectory: "groundBall", evBin: 84, laBin: -6, xBin: 20, yBin: 60, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 94, laBin: 12, xBin: -10, yBin: 180, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 96, laBin: 12, xBin: 0, yBin: 190, count: 10 },
    //                     { trajectory: "flyBall", evBin: 92, laBin: 32, xBin: 5, yBin: 260, count: 10 }
    //                 ],
    //                 byTrajectory: [
    //                     { trajectory: "groundBall", xBin: 15, yBin: 65, count: 50 },
    //                     { trajectory: "lineDrive", xBin: 0, yBin: 185, count: 50 },
    //                     { trajectory: "flyBall", xBin: 0, yBin: 255, count: 50 }
    //                 ]
    //             },
    //             spray: {
    //                 byTrajectoryEvLa: [
    //                     { trajectory: "groundBall", evBin: 84, laBin: -6, sprayBin: 12, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: -5, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 96, laBin: 12, sprayBin: 0, count: 10 },
    //                     { trajectory: "flyBall", evBin: 92, laBin: 32, sprayBin: 2, count: 10 }
    //                 ],
    //                 byTrajectory: [
    //                     { trajectory: "groundBall", sprayBin: 10, count: 50 },
    //                     { trajectory: "lineDrive", sprayBin: 0, count: 50 },
    //                     { trajectory: "flyBall", sprayBin: 0, count: 50 }
    //                 ]
    //             }
    //         }
    //     } as any

    //     //@ts-ignore
    //     const result = simService.gameRolls.getHitQuality(() => 0.5, pitchEnvironmentTarget, 0, false, Contact.LINE_DRIVE)

    //     assert.ok(Number.isFinite(result.exitVelocity))
    //     assert.ok(Number.isFinite(result.launchAngle))
    //     assert.ok(Number.isFinite(result.distance))
    //     assert.ok(Number.isFinite(result.coordX))
    //     assert.ok(Number.isFinite(result.coordY))
    //     assert.ok(result.launchAngle > 5)
    //     assert.ok(result.launchAngle < 20)
    //     assert.ok(result.distance > 150)

    //     const evBin = Math.floor(result.exitVelocity / 2) * 2
    //     const laBin = Math.floor(result.launchAngle / 2) * 2

    //     assert.ok(evBin === 94 || evBin === 96)
    //     assert.strictEqual(laBin, 12)
    // })

    // it("getHitQuality should produce a deterministic fly ball profile with zero tuning", () => {
    //     const pitchEnvironmentTarget = {
    //         pitchEnvironmentTuning: {
    //             tuning: {
    //                 contactQuality: {
    //                     evScale: 0,
    //                     laScale: 0,
    //                     distanceScale: 0,
    //                 },
    //                 pitch: {
    //                     velocityToQualityScale: 0,
    //                     movementToQualityScale: 0,
    //                     controlToQualityScale: 0
    //                 },
    //                 swing: {
    //                     pitchQualityZoneSwingEffect: 0,
    //                     pitchQualityChaseSwingEffect: 0,
    //                     disciplineZoneSwingEffect: 0,
    //                     disciplineChaseSwingEffect: 0
    //                 },
    //                 contact: {
    //                     pitchQualityContactEffect: 0,
    //                     contactSkillEffect: 0
    //                 },
    //                 running: {
    //                     stealAttemptAggressionScale: 1
    //                 },
    //                 meta: {
    //                     fullTeamDefenseBonus: 0,
    //                     fullFielderDefenseBonus: 0,
    //                     fullPitchQualityBonus: 0
    //                 }
    //             }
    //         },
    //         importReference: {
    //             hitter: {
    //                 physics: {
    //                     exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
    //                     launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
    //                     distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
    //                     byTrajectory: {
    //                         groundBall: {
    //                             exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
    //                             launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
    //                             distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
    //                         },
    //                         lineDrive: {
    //                             exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
    //                             launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
    //                             distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
    //                         },
    //                         flyBall: {
    //                             exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
    //                             launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
    //                             distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
    //                         }
    //                     }
    //                 }
    //             }
    //         },
    //         battedBall: {
    //             xy: {
    //                 byTrajectoryEvLa: [
    //                     { trajectory: "groundBall", evBin: 84, laBin: -6, xBin: 20, yBin: 60, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 94, laBin: 12, xBin: -10, yBin: 180, count: 10 },
    //                     { trajectory: "flyBall", evBin: 92, laBin: 32, xBin: 5, yBin: 260, count: 10 },
    //                     { trajectory: "flyBall", evBin: 94, laBin: 32, xBin: 0, yBin: 270, count: 10 }
    //                 ],
    //                 byTrajectory: [
    //                     { trajectory: "groundBall", xBin: 15, yBin: 65, count: 50 },
    //                     { trajectory: "lineDrive", xBin: 0, yBin: 185, count: 50 },
    //                     { trajectory: "flyBall", xBin: 0, yBin: 255, count: 50 }
    //                 ]
    //             },
    //             spray: {
    //                 byTrajectoryEvLa: [
    //                     { trajectory: "groundBall", evBin: 84, laBin: -6, sprayBin: 12, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: -5, count: 10 },
    //                     { trajectory: "flyBall", evBin: 92, laBin: 32, sprayBin: 2, count: 10 },
    //                     { trajectory: "flyBall", evBin: 94, laBin: 32, sprayBin: 0, count: 10 }
    //                 ],
    //                 byTrajectory: [
    //                     { trajectory: "groundBall", sprayBin: 10, count: 50 },
    //                     { trajectory: "lineDrive", sprayBin: 0, count: 50 },
    //                     { trajectory: "flyBall", sprayBin: 0, count: 50 }
    //                 ]
    //             }
    //         }
    //     } as any

    //     //@ts-ignore
    //     const result = simService.gameRolls.getHitQuality(() => 0.5, pitchEnvironmentTarget, 0, false, Contact.FLY_BALL)

    //     assert.ok(Number.isFinite(result.exitVelocity))
    //     assert.ok(Number.isFinite(result.launchAngle))
    //     assert.ok(Number.isFinite(result.distance))
    //     assert.ok(Number.isFinite(result.coordX))
    //     assert.ok(Number.isFinite(result.coordY))
    //     assert.ok(result.launchAngle > 20)
    //     assert.ok(result.distance > 220)
    //     assert.ok(result.coordY > 200)

    //     const evBin = Math.floor(result.exitVelocity / 2) * 2
    //     const laBin = Math.floor(result.launchAngle / 2) * 2

    //     assert.ok(evBin === 92 || evBin === 94)
    //     assert.strictEqual(laBin, 32)
    // })

    // it("getHitQuality should use spray fallback when xy data is missing", () => {
    //     const pitchEnvironmentTarget = {
    //         pitchEnvironmentTuning: {
    //             tuning: {
    //                 contactQuality: {
    //                     evScale: 0,
    //                     laScale: 0,
    //                     distanceScale: 0
    //                 },
    //                 pitch: {
    //                     velocityToQualityScale: 0,
    //                     movementToQualityScale: 0,
    //                     controlToQualityScale: 0
    //                 },
    //                 swing: {
    //                     pitchQualityZoneSwingEffect: 0,
    //                     pitchQualityChaseSwingEffect: 0,
    //                     disciplineZoneSwingEffect: 0,
    //                     disciplineChaseSwingEffect: 0
    //                 },
    //                 contact: {
    //                     pitchQualityContactEffect: 0,
    //                     contactSkillEffect: 0
    //                 },
    //                 running: {
    //                     stealAttemptAggressionScale: 1
    //                 },
    //                 meta: {
    //                     fullTeamDefenseBonus: 0,
    //                     fullFielderDefenseBonus: 0,
    //                     fullPitchQualityBonus: 0                        
    //                 }
    //             }
    //         },
    //         importReference: {
    //             hitter: {
    //                 physics: {
    //                     exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
    //                     launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
    //                     distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
    //                     byTrajectory: {
    //                         groundBall: {
    //                             exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
    //                             launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
    //                             distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
    //                         },
    //                         lineDrive: {
    //                             exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
    //                             launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
    //                             distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
    //                         },
    //                         flyBall: {
    //                             exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
    //                             launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
    //                             distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
    //                         }
    //                     }
    //                 }
    //             }
    //         },
    //         battedBall: {
    //             xy: {
    //                 byTrajectoryEvLa: [],
    //                 byTrajectory: []
    //             },
    //             spray: {
    //                 byTrajectoryEvLa: [
    //                     { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: 30, count: 10 }
    //                 ],
    //                 byTrajectory: [
    //                     { trajectory: "lineDrive", sprayBin: 30, count: 50 }
    //                 ]
    //             }
    //         }
    //     } as any

    //     //@ts-ignore
    //     const result = simService.gameRolls.getHitQuality(() => 0.5, pitchEnvironmentTarget, 0, false, Contact.LINE_DRIVE)

    //     assert.ok(Number.isFinite(result.coordX))
    //     assert.ok(Number.isFinite(result.coordY))
    //     assert.ok(result.coordX > 0)
    //     assert.ok(result.coordY > 0)

    //     const reconstructedDistance = Math.sqrt((result.coordX * result.coordX) + (result.coordY * result.coordY))
    //     assert.ok(Math.abs(result.distance - reconstructedDistance) < 1e-9)
    // })

    // it("getHitQuality should not change EV LA or distance from tuning when pitchQualityChange is zero and guessPitch is false", () => {
    //     const basePitchEnvironmentTarget = {
    //         pitchEnvironmentTuning: {
    //             tuning: {
    //                 contactQuality: {
    //                     evScale: 0,
    //                     laScale: 0,
    //                     distanceScale: 0
    //                 },
    //                 pitch: {
    //                     velocityToQualityScale: 0,
    //                     movementToQualityScale: 0,
    //                     controlToQualityScale: 0
    //                 },
    //                 swing: {
    //                     pitchQualityZoneSwingEffect: 0,
    //                     pitchQualityChaseSwingEffect: 0,
    //                     disciplineZoneSwingEffect: 0,
    //                     disciplineChaseSwingEffect: 0
    //                 },
    //                 contact: {
    //                     pitchQualityContactEffect: 0,
    //                     contactSkillEffect: 0
    //                 },
    //                 running: {
    //                     stealAttemptAggressionScale: 1
    //                 },
    //                 meta: {
    //                     fullTeamDefenseBonus: 0,
    //                     fullFielderDefenseBonus: 0,
    //                     fullPitchQualityBonus: 0
    //                 }
    //             }
    //         },
    //         importReference: {
    //             hitter: {
    //                 physics: {
    //                     exitVelocity: { count: 100, total: 9000, totalSquared: 812500, avg: 90 },
    //                     launchAngle: { count: 100, total: 1500, totalSquared: 32500, avg: 15 },
    //                     distance: { count: 100, total: 22000, totalSquared: 4900000, avg: 220 },
    //                     byTrajectory: {
    //                         groundBall: {
    //                             exitVelocity: { count: 100, total: 8500, totalSquared: 724900, avg: 85 },
    //                             launchAngle: { count: 100, total: -500, totalSquared: 12500, avg: -5 },
    //                             distance: { count: 100, total: 9000, totalSquared: 832500, avg: 90 }
    //                         },
    //                         lineDrive: {
    //                             exitVelocity: { count: 100, total: 9500, totalSquared: 906100, avg: 95 },
    //                             launchAngle: { count: 100, total: 1200, totalSquared: 18000, avg: 12 },
    //                             distance: { count: 100, total: 24000, totalSquared: 5796000, avg: 240 }
    //                         },
    //                         flyBall: {
    //                             exitVelocity: { count: 100, total: 9200, totalSquared: 848900, avg: 92 },
    //                             launchAngle: { count: 100, total: 3200, totalSquared: 104900, avg: 32 },
    //                             distance: { count: 100, total: 29000, totalSquared: 8464000, avg: 290 }
    //                         }
    //                     }
    //                 }
    //             }
    //         },
    //         battedBall: {
    //             xy: {
    //                 byTrajectoryEvLa: [
    //                     { trajectory: "lineDrive", evBin: 94, laBin: 12, xBin: 0, yBin: 190, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 96, laBin: 12, xBin: 0, yBin: 200, count: 10 }
    //                 ],
    //                 byTrajectory: [
    //                     { trajectory: "lineDrive", xBin: 0, yBin: 185, count: 50 }
    //                 ]
    //             },
    //             spray: {
    //                 byTrajectoryEvLa: [
    //                     { trajectory: "lineDrive", evBin: 94, laBin: 12, sprayBin: 0, count: 10 },
    //                     { trajectory: "lineDrive", evBin: 96, laBin: 12, sprayBin: 0, count: 10 }
    //                 ],
    //                 byTrajectory: [
    //                     { trajectory: "lineDrive", sprayBin: 0, count: 50 }
    //                 ]
    //             }
    //         }
    //     } as any

    //     const boostedPitchEnvironmentTarget = JSON.parse(JSON.stringify(basePitchEnvironmentTarget))
    //     boostedPitchEnvironmentTarget.pitchEnvironmentTuning.tuning.contactQuality.evScale = 3
    //     boostedPitchEnvironmentTarget.pitchEnvironmentTuning.tuning.contactQuality.laScale = 3
    //     boostedPitchEnvironmentTarget.pitchEnvironmentTuning.tuning.contactQuality.distanceScale = 3

    //     //@ts-ignore
    //     const baseResult = simService.gameRolls.getHitQuality(() => 0.5, basePitchEnvironmentTarget, 0, false, Contact.LINE_DRIVE)
    //     //@ts-ignore        
    //     const boostedResult = simService.gameRolls.getHitQuality(() => 0.5, boostedPitchEnvironmentTarget, 0, false, Contact.LINE_DRIVE)

    //     assert.strictEqual(boostedResult.exitVelocity, baseResult.exitVelocity)
    //     assert.strictEqual(boostedResult.launchAngle, baseResult.launchAngle)
    //     assert.strictEqual(boostedResult.distance, baseResult.distance)
    // })

    // it("generated contact quality outcome models should print weighted expected offense from contact mix", () => {
    //     const testPitchEnvironment = JSON.parse(JSON.stringify(pitchEnvironment))

    //     testPitchEnvironment.pitchEnvironmentTuning = {
    //         tuning: {
    //             contactQuality: {
    //                 evScale: 0,
    //                 laScale: 0,
    //                 distanceScale: 0,
    //             },
    //             pitch: {
    //                 velocityToQualityScale: 0,
    //                 movementToQualityScale: 0,
    //                 controlToQualityScale: 0
    //             },
    //             swing: {
    //                 pitchQualityZoneSwingEffect: 0,
    //                 pitchQualityChaseSwingEffect: 0,
    //                 disciplineZoneSwingEffect: 0,
    //                 disciplineChaseSwingEffect: 0
    //             },
    //             contact: {
    //                 pitchQualityContactEffect: 0,
    //                 contactSkillEffect: 0
    //             },
    //             running: {
    //                 stealAttemptAggressionScale: 1
    //             },
    //             meta: {
    //                 fullTeamDefenseBonus: 0,
    //                 fullFielderDefenseBonus: 0,
    //                 fullPitchQualityBonus: 0
    //             }
    //         }
    //     }

    //     const sampleCount = 10000

    //     const contactWeights = [
    //         {
    //             contact: Contact.GROUNDBALL,
    //             name: "GROUNDBALL",
    //             weight: testPitchEnvironment.battedBall.contactRollInput.groundball
    //         },
    //         {
    //             contact: Contact.LINE_DRIVE,
    //             name: "LINE_DRIVE",
    //             weight: testPitchEnvironment.battedBall.contactRollInput.lineDrive
    //         },
    //         {
    //             contact: Contact.FLY_BALL,
    //             name: "FLY_BALL",
    //             weight: testPitchEnvironment.battedBall.contactRollInput.flyBall
    //         }
    //     ]

    //     const totalWeight = contactWeights.reduce((sum, row) => sum + row.weight, 0)

    //     let weightedOut = 0
    //     let weightedSingle = 0
    //     let weightedDouble = 0
    //     let weightedTriple = 0
    //     let weightedHr = 0

    //     for (const row of contactWeights) {
    //         const rng = seedrandom(`weighted-contact-quality-model-${row.name}`)

    //         let contactOut = 0
    //         let contactSingle = 0
    //         let contactDouble = 0
    //         let contactTriple = 0
    //         let contactHr = 0

    //         for (let i = 0; i < sampleCount; i++) {
    //             //@ts-ignore
    //             const hitQuality = simService.gameRolls.getHitQuality(
    //                 rng,
    //                 testPitchEnvironment,
    //                 0,
    //                 false,
    //                 row.contact
    //             )

    //             const model = (simService as any).getOutcomeModelForContactQuality(
    //                 testPitchEnvironment,
    //                 hitQuality,
    //                 row.contact,
    //                 0
    //             )

    //             const modelTotal = model.out + model.single + model.double + model.triple + model.hr

    //             contactOut += model.out / modelTotal
    //             contactSingle += model.single / modelTotal
    //             contactDouble += model.double / modelTotal
    //             contactTriple += model.triple / modelTotal
    //             contactHr += model.hr / modelTotal
    //         }

    //         contactOut /= sampleCount
    //         contactSingle /= sampleCount
    //         contactDouble /= sampleCount
    //         contactTriple /= sampleCount
    //         contactHr /= sampleCount

    //         const contactBip = contactOut + contactSingle + contactDouble + contactTriple
    //         const contactBabip = contactBip > 0 ? (contactSingle + contactDouble + contactTriple) / contactBip : 0
    //         const contactAvg = contactSingle + contactDouble + contactTriple + contactHr
    //         const contactSlg = contactSingle + (contactDouble * 2) + (contactTriple * 3) + (contactHr * 4)

    //         const share = row.weight / totalWeight

    //         weightedOut += contactOut * share
    //         weightedSingle += contactSingle * share
    //         weightedDouble += contactDouble * share
    //         weightedTriple += contactTriple * share
    //         weightedHr += contactHr * share

    //         console.log(
    //             `[CONTACT MODEL WEIGHTED INPUT] ${row.name} ` +
    //             `WEIGHT=${row.weight} SHARE=${share.toFixed(3)} ` +
    //             `OUT=${contactOut.toFixed(3)} ` +
    //             `1B=${contactSingle.toFixed(3)} ` +
    //             `2B=${contactDouble.toFixed(3)} ` +
    //             `3B=${contactTriple.toFixed(3)} ` +
    //             `HR=${contactHr.toFixed(3)} ` +
    //             `AVG=${contactAvg.toFixed(3)} ` +
    //             `SLG=${contactSlg.toFixed(3)} ` +
    //             `BABIP=${contactBabip.toFixed(3)}`
    //         )
    //     }

    //     const weightedBip = weightedOut + weightedSingle + weightedDouble + weightedTriple
    //     const weightedBabip = weightedBip > 0 ? (weightedSingle + weightedDouble + weightedTriple) / weightedBip : 0
    //     const weightedAvg = weightedSingle + weightedDouble + weightedTriple + weightedHr
    //     const weightedSlg = weightedSingle + (weightedDouble * 2) + (weightedTriple * 3) + (weightedHr * 4)

    //     console.log("[CONTACT MODEL WEIGHTED TOTAL]", {
    //         contactRollInput: testPitchEnvironment.battedBall.contactRollInput,
    //         out: Number(weightedOut.toFixed(3)),
    //         single: Number(weightedSingle.toFixed(3)),
    //         double: Number(weightedDouble.toFixed(3)),
    //         triple: Number(weightedTriple.toFixed(3)),
    //         hr: Number(weightedHr.toFixed(3)),
    //         avgOnContact: Number(weightedAvg.toFixed(3)),
    //         slgOnContact: Number(weightedSlg.toFixed(3)),
    //         babip: Number(weightedBabip.toFixed(3)),
    //         targetBabip: testPitchEnvironment.babip,
    //         targetAvg: testPitchEnvironment.avg,
    //         targetSlg: testPitchEnvironment.slg,
    //         targetHomeRunPercent: testPitchEnvironment.homeRunPercent
    //     })

    //     assert.ok(weightedBabip > 0)
    // })

    // it("pitch environment trajectory physics should keep ground balls out of line-drive launch angles", () => {
    //     const physics = pitchEnvironment.importReference.hitter.physics.byTrajectory

    //     const rows = [
    //         { name: "groundBall", stats: physics.groundBall },
    //         { name: "lineDrive", stats: physics.lineDrive },
    //         { name: "flyBall", stats: physics.flyBall }
    //     ]

    //     for (const row of rows) {
    //         console.log(
    //             `[TRAJECTORY PHYSICS] ${row.name} ` +
    //             `EV avg=${row.stats.avgExitVelocity.toFixed(2)} ` +
    //             `LA avg=${row.stats.avgLaunchAngle.toFixed(2)} ` +
    //             `DIST avg=${row.stats.avgDistance.toFixed(2)} ` +
    //             `count=${row.stats.count}`
    //         )
    //     }

    //     assert.ok(physics.groundBall.avgLaunchAngle < 5)
    //     assert.ok(physics.lineDrive.avgLaunchAngle > physics.groundBall.avgLaunchAngle)
    //     assert.ok(physics.flyBall.avgLaunchAngle > physics.lineDrive.avgLaunchAngle)
    // })

    // it("getHitQuality ground balls should mostly sample ground-ball launch angles", () => {
    //     const testPitchEnvironment = JSON.parse(JSON.stringify(pitchEnvironment))

    //     testPitchEnvironment.pitchEnvironmentTuning = {
    //         tuning: {
    //             contactQuality: {
    //                 evScale: 0,
    //                 laScale: 0,
    //                 distanceScale: 0
    //             },
    //             pitch: {
    //                 velocityToQualityScale: 0,
    //                 movementToQualityScale: 0,
    //                 controlToQualityScale: 0
    //             },
    //             swing: {
    //                 pitchQualityZoneSwingEffect: 0,
    //                 pitchQualityChaseSwingEffect: 0,
    //                 disciplineZoneSwingEffect: 0,
    //                 disciplineChaseSwingEffect: 0
    //             },
    //             contact: {
    //                 pitchQualityContactEffect: 0,
    //                 contactSkillEffect: 0
    //             },
    //             running: {
    //                 stealAttemptAggressionScale: 1
    //             },
    //             meta: {
    //                 fullTeamDefenseBonus: 0,
    //                 fullFielderDefenseBonus: 0,
    //                 fullPitchQualityBonus: 0

    //             }
    //         }
    //     }

    //     const sampleCount = 5000
    //     const rng = seedrandom("ground-ball-launch-angle-distribution")

    //     let belowZero = 0
    //     let zeroToFive = 0
    //     let fiveToTen = 0
    //     let tenToTwenty = 0
    //     let twentyPlus = 0
    //     let totalLaunchAngle = 0

    //     const buckets = new Map<number, number>()

    //     for (let i = 0; i < sampleCount; i++) {
    //         //@ts-ignore            
    //         const hitQuality = simService.gameRolls.getHitQuality(
    //             rng,
    //             testPitchEnvironment,
    //             0,
    //             false,
    //             Contact.GROUNDBALL
    //         )

    //         totalLaunchAngle += hitQuality.launchAngle

    //         if (hitQuality.launchAngle < 0) belowZero++
    //         else if (hitQuality.launchAngle < 5) zeroToFive++
    //         else if (hitQuality.launchAngle < 10) fiveToTen++
    //         else if (hitQuality.launchAngle < 20) tenToTwenty++
    //         else twentyPlus++

    //         const laBin = Math.floor(hitQuality.launchAngle / 2) * 2
    //         buckets.set(laBin, (buckets.get(laBin) ?? 0) + 1)
    //     }

    //     const avgLaunchAngle = totalLaunchAngle / sampleCount
    //     const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20)

    //     console.log(
    //         `[GROUND BALL LA DIST] avg=${avgLaunchAngle.toFixed(2)} ` +
    //         `<0=${(belowZero / sampleCount).toFixed(3)} ` +
    //         `0-5=${(zeroToFive / sampleCount).toFixed(3)} ` +
    //         `5-10=${(fiveToTen / sampleCount).toFixed(3)} ` +
    //         `10-20=${(tenToTwenty / sampleCount).toFixed(3)} ` +
    //         `20+=${(twentyPlus / sampleCount).toFixed(3)}`
    //     )

    //     for (const [laBin, count] of sortedBuckets) {
    //         console.log(`[GROUND BALL LA BUCKET] LA=${laBin} N=${count}`)
    //     }

    //     assert.ok(avgLaunchAngle < 5)
    //     assert.ok((tenToTwenty + twentyPlus) / sampleCount < 0.15)
    // })

    // it("getOutcomeModelForContactQuality should allow ground ball triples but not ground ball home runs", () => {
    //     const pitchEnvironmentTarget = {
    //         pitchEnvironmentTuning: {
    //             tuning: {
    //                 contactQuality: {
    //                     evScale: 0,
    //                     laScale: 0,
    //                     distanceScale: 0
    //                 },
    //                 pitch: {
    //                     velocityToQualityScale: 0,
    //                     movementToQualityScale: 0,
    //                     controlToQualityScale: 0
    //                 },
    //                 swing: {
    //                     pitchQualityZoneSwingEffect: 0,
    //                     pitchQualityChaseSwingEffect: 0,
    //                     disciplineZoneSwingEffect: 0,
    //                     disciplineChaseSwingEffect: 0
    //                 },
    //                 contact: {
    //                     pitchQualityContactEffect: 0,
    //                     contactSkillEffect: 0
    //                 },
    //                 running: {
    //                     stealAttemptAggressionScale: 1
    //                 },
    //                 meta: {
    //                     fullTeamDefenseBonus: 0,
    //                     fullFielderDefenseBonus: 0,
                        
    //                 }
    //             }
    //         },
    //         battedBall: {
    //             outcomeByEvLa: [
    //                 { evBin: 90, laBin: -10, count: 100, out: 70, single: 15, double: 5, triple: 4, hr: 6 }
    //             ]
    //         }
    //     } as any

    //     const contactQuality = {
    //         exitVelocity: 90,
    //         launchAngle: -10
    //     } as any

    //     const model = (simService as any).getOutcomeModelForContactQuality(
    //         pitchEnvironmentTarget,
    //         contactQuality,
    //         Contact.GROUNDBALL,
    //         0
    //     )

    //     assert.strictEqual(model.hr, 0)
    //     assert.strictEqual(model.triple, 10)
    //     assert.strictEqual(model.out, 70)
    //     assert.strictEqual(model.single, 15)
    //     assert.strictEqual(model.double, 5)
    //     assert.strictEqual(model.count, 100)
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
        const startedGame: Game = playerImporterService.buildStartedBaselineGame(JSON.parse(JSON.stringify(tunedPitchEnvironment)), "game-1")

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
            teamBBPerGame: evaluation.diff.teamBBPerGame,
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
            scored: [],
        }

        const halfInningRunnerEvents: any[] = [
            { runner: { _id: "fakeOut1" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } },
            { runner: { _id: "fakeOut2" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } },
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
            scored: [],
        }

        const halfInningRunnerEvents: any[] = [
            { runner: { _id: "out1" }, movement: { isOut: true } },
            { runner: { _id: "out2" }, movement: { isOut: true } },
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


const evaluateManualTuning = (name: string, tuning: PitchEnvironmentTuning["tuning"]) => {
    const testPitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify(pitchEnvironment))

    testPitchEnvironment.pitchEnvironmentTuning = {
        _id: `manual-${name}`,
        tuning
    }

    const evaluation = playerImporterService.evaluatePitchEnvironment(
        testPitchEnvironment,
        seedrandom(`manual-${name}-${evaluationGames}`),
        evaluationGames
    )

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
        targetRuns: evaluation.target.teamRunsPerGame
    })

    return evaluation
}
