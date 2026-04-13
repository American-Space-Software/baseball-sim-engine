import assert from "assert"
import {
    StatService,
    PlayerImporterService,
    simService,
    BaseResult,
    Contact,
    Handedness,
    PitchType,
    PlayResult,
    Position,
    ShallowDeep,
    ThrowResult
} from "../src/index.js"
import seedrandom from "seedrandom"
import type {
    PitchEnvironmentTarget,
    PitchEnvironmentTuning,
    PlayerImportBaseline,
    Game,
    StartGameCommand,
    Player,
    Team,
    Lineup,
    RotationPitcher,
    HitResultCount,
    PitchResultCount
} from "../src/index.js"

import { DownloaderService } from "./service/downloader-service.js"


let rng = new seedrandom(4)
const statService = new StatService()
const downloaderservice = new DownloaderService("test/data", 1000)
let importBaseline:PlayerImportBaseline
let pitchEnvironment:PitchEnvironmentTarget
let pitchEnvironmentTuning: PitchEnvironmentTuning
let tunedPitchEnvironment: PitchEnvironmentTarget


let season = 2025


const players = await downloaderservice.buildSeasonPlayerImports(season, new Set([]))

const playerImporterService = new PlayerImporterService(simService, statService)

console.log(JSON.stringify(players.get("592450")))

describe("PlayerImporter", async () => {


    it("should calculate pitch environment target for season", async () => {
        
        pitchEnvironment = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)

        console.log("=== GENERATED PITCH ENVIRONMENT TARGET ===")
        console.log(JSON.stringify(pitchEnvironment, null, 2))

        assert.ok(pitchEnvironment)
    })

    it("should infer pitch environment tunings from target", async () => {

        pitchEnvironmentTuning = playerImporterService.getTuningsForPitchEnvironment(pitchEnvironment, rng, {
            maxIterations: 10,
            gamesPerIteration: 250
        })

        
        tunedPitchEnvironment = {
            ...pitchEnvironment,
            pitchEnvironmentTuning
        }

        console.log("=== INFERRED PITCH ENVIRONMENT TUNING ===")
        console.log(JSON.stringify(pitchEnvironmentTuning, null, 2))

        // console.log("=== TUNED PITCH ENVIRONMENT ===")
        // console.log(JSON.stringify(tunedPitchEnvironment, null, 2))

        assert.ok(pitchEnvironmentTuning)
        assert.ok(tunedPitchEnvironment)
    })

    it("should sim a game", async () => {

        const startedGame: Game = playerImporterService.buildStartedBaselineGame(tunedPitchEnvironment, "game-1")

        while (!startedGame.isComplete) {
            simService.simPitch(startedGame, rng)
        }

        assert.equal(startedGame.isComplete, true)
    })

    it("should print aggregate stats over 250 games", async () => {

        const aggregateRng = new seedrandom(4)
        const NUM_GAMES = 250
        const target = tunedPitchEnvironment

        let totalHit: HitResultCount = {} as any
        let totalPitch: PitchResultCount = {} as any

        let paLengthCounts: Record<number, number> = {}
        let paTotal = 0

        let countStateCounts: Record<string, number> = {}
        let countStateTerminal: Record<string, number> = {}
        // ----------------------------

        const normalize = (v: number) => v / 100

        for (let i = 0; i < NUM_GAMES; i++) {

            const game = playerImporterService.buildStartedBaselineGame(target, `aggregate-${i}`)

            while (!game.isComplete) {
                simService.simPitch(game, aggregateRng)
            }

            simService.finishGame(game)

            const players = [
                ...game.away.players,
                ...game.home.players
            ]

            for (const p of players) {
                if (p.hitResult) {
                    totalHit = mergeHitResults(totalHit, p.hitResult)
                }

                if (p.pitchResult) {
                    totalPitch = mergePitchResults(totalPitch, p.pitchResult)
                }
            }

            const allPlays = game.halfInnings.flatMap(h => h.plays)

            for (const play of allPlays) {

                const pitches = play.pitchLog?.pitches || []
                const pitchCount = pitches.length

                if (pitchCount > 0) {
                    paLengthCounts[pitchCount] = (paLengthCounts[pitchCount] || 0) + 1
                    paTotal++
                }

                // track all count states seen
                for (const pitch of pitches) {
                    const c = pitch.count
                    if (!c) continue

                    const key = `${c.balls}-${c.strikes}`
                    countStateCounts[key] = (countStateCounts[key] || 0) + 1
                }

                // track terminal count
                const finalPitch = pitches[pitches.length - 1]
                if (finalPitch?.count) {
                    const key = `${finalPitch.count.balls}-${finalPitch.count.strikes}`
                    countStateTerminal[key] = (countStateTerminal[key] || 0) + 1
                }
            }
            // --------------------------------
        }

        const hitterStatLine = statService.hitResultToHitterStatLine(totalHit)
        const pitcherStatLine = statService.pitchResultToPitcherStatLine(totalPitch)

        const totalTeamGames = hitterStatLine.games / 9

        const teamRunsPerGame = hitterStatLine.runs / totalTeamGames
        const teamHitsPerGame = hitterStatLine.hits / totalTeamGames
        const teamHomeRunsPerGame = hitterStatLine.homeRuns / totalTeamGames
        const teamBBPerGame = hitterStatLine.bb / totalTeamGames
        const teamSOPerGame = hitterStatLine.so / totalTeamGames

        const sbSuccessPercent = hitterStatLine.sbAttempts > 0 ? hitterStatLine.sb / hitterStatLine.sbAttempts : 0
        const csPercent = (hitterStatLine.csDefense + hitterStatLine.cs) > 0 ? hitterStatLine.csDefense / (hitterStatLine.csDefense + hitterStatLine.cs) : 0

        console.log("=== TARGET PITCH ENVIRONMENT ===")
        console.log(JSON.stringify(target, null, 2))

        console.log("=== TARGET PITCH ===")
        console.log({
            inZonePercent: target.pitch.inZonePercent,
            strikePercent: target.pitch.strikePercent,
            ballPercent: target.pitch.ballPercent,
            swingPercent: target.pitch.swingPercent,
            foulContactPercent: target.pitch.foulContactPercent,
            pitchesPerPA: target.pitch.pitchesPerPA
        })

        console.log("=== TARGET SWING ===")
        console.log({
            swingAtStrikesPercent: target.swing.swingAtStrikesPercent,
            swingAtBallsPercent: target.swing.swingAtBallsPercent,
            inZoneContactPercent: target.swing.inZoneContactPercent,
            outZoneContactPercent: target.swing.outZoneContactPercent
        })

        console.log("=== ACTUAL PITCH ===")
        console.log({
            inZonePercent: hitterStatLine.inZonePercent,
            strikePercent: hitterStatLine.strikePercent,
            ballPercent: hitterStatLine.ballPercent,
            swingPercent: hitterStatLine.swingPercent,
            foulContactPercent: pitcherStatLine.foulContactPercent,
            pitchesPerPA: hitterStatLine.pitchesPerPA
        })

        console.log("=== ACTUAL SWING ===")
        console.log({
            calledStrikesPercent: hitterStatLine.calledStrikesPercent,
            swingingStrikesPercent: hitterStatLine.swingingStrikesPercent,
            swingAtStrikesPercent: hitterStatLine.swingAtStrikesPercent,
            swingAtBallsPercent: hitterStatLine.swingAtBallsPercent,
            inZoneContactPercent: hitterStatLine.inZoneContactPercent,
            outZoneContactPercent: hitterStatLine.outZoneContactPercent
        })

        console.log("=== ACTUAL HITS ===")
        console.log({
            singlePercent: hitterStatLine.singlePercent,
            doublePercent: hitterStatLine.doublePercent,
            triplePercent: hitterStatLine.triplePercent,
            homeRunPercent: hitterStatLine.homeRunPercent,
            bbPercent: hitterStatLine.bbPercent,
            soPercent: hitterStatLine.soPercent,
            hbpPercent: hitterStatLine.hbpPercent,
            groundBallPercent: hitterStatLine.groundBallPercent,
            flyBallPercent: hitterStatLine.flyBallPercent,
            ldPercent: hitterStatLine.ldPercent,
            sbPerGame: hitterStatLine.sbPerGame,
            sbAttemptsPerGame: hitterStatLine.sbAttemptsPerGame,
            sbSuccessPercent
        })

        console.log("=== ACTUAL RUNNING ===")
        console.log({
            sb: hitterStatLine.sb,
            cs: hitterStatLine.cs,
            sbAttempts: hitterStatLine.sbAttempts,
            sbSuccessPercent
        })

        console.log("=== ACTUAL DEFENSE ===")
        console.log({
            errors: hitterStatLine.e,
            assists: hitterStatLine.assists,
            putouts: hitterStatLine.po,
            doublePlays: hitterStatLine.doublePlays,
            outfieldAssists: hitterStatLine.outfieldAssists,
            catcherCaughtStealing: hitterStatLine.csDefense,
            catcherCSPercent: csPercent,
            passedBalls: hitterStatLine.passedBalls
        })

        console.log("=== PA LENGTH DISTRIBUTION ===")
        const sortedPALengths = Object.entries(paLengthCounts)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([len, count]) => ({
                pitches: Number(len),
                percent: (count / paTotal)
            }))
        console.log(sortedPALengths)

        console.log("=== COUNT STATE FREQUENCY ===")
        console.log(countStateCounts)

        console.log("=== TERMINAL COUNT STATES ===")
        console.log(countStateTerminal)
        // ---------------------------

        console.log("=== TARGET TEAM ===")
        console.log(target.team)

        console.log("=== TEAM PER GAME ===")
        console.log({
            teamRunsPerGame,
            teamHitsPerGame,
            teamHomeRunsPerGame,
            teamBBPerGame,
            teamSOPerGame
        })

        const round3 = (n: number) => Number(n.toFixed(3))

        console.log("=== TARGET OFFENSE ===")
        console.log({
            avg: round3(target.outcome.avg),
            obp: round3(target.outcome.obp),
            slg: round3(target.outcome.slg),
            ops: round3(target.outcome.ops),
            babip: round3(target.outcome.babip)
        })

        console.log("=== ACTUAL OFFENSE ===")
        console.log({
            avg: round3(hitterStatLine.avg),
            obp: round3(hitterStatLine.obp),
            slg: round3(hitterStatLine.slg),
            ops: round3(hitterStatLine.ops),
            babip: round3(hitterStatLine.babip)
        })
    })

    it("inning can end during runner events; stop further processing but keep events", async () => {
        const game = playerImporterService.buildStartedBaselineGame(tunedPitchEnvironment, "game-runner-events")
        const laRatings = game.leagueAverages

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
        const laRatings = game.leagueAverages

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


        // it("should calculate player import baseline based on pitch environment", async () => {
    
        //     pitchEnvironment = PlayerImporterService.getPitchEnvironmentTargetForSeason(2025)
    
        //     importBaseline = simService.getPlayerImportBaseline(pitchEnvironment, rng)
    
        //     assert.ok(importBaseline)
    
        //     console.log(importBaseline)
    
        // })
    
        // it("should download 2025 stats and build import data for listed players", async () => {
    
        //     for (let playerId of playerIds) {
        //         getPlayerImport(playerId)
        //     }
    
        // })
    
    
    
        // it("should download 2025 stats and build import data for all players", async () => {
    
        //     const players = await downloaderservice.buildSeasonPlayerImports(2025, undefined, true)
    
        //     assert.ok(players.size > 0)
        //     console.log(players.size)
        // })

})

function mergeHitResults(total: any, current: any): any {
    total = total || {}

    for (const key of Object.keys(current)) {
        if (typeof current[key] === "number") {
            total[key] = (total[key] || 0) + current[key]
        }
    }

    return total
}

function mergePitchResults(total: any, current: any): any {
    total = total || {}

    for (const key of Object.keys(current)) {
        if (typeof current[key] === "number") {
            total[key] = (total[key] || 0) + current[key]
        }
    }

    return total
}
