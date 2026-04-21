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
const evaluationGames = 50

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