import assert from "assert"
import seedrandom from "seedrandom"
import {
    StatService,
    simService,
    Position,
    PitchingRoleType,
    Handedness
} from "../src/sim/index.js"
import type {
    PitchEnvironmentTarget,
    Game,
    GamePlayer,
    TeamInfo
} from "../src/sim/index.js"

import { PitchEnvironmentService } from "../src/importer/service/pitch-environment-service.js"
import { DownloaderService } from "../src/importer/service/downloader-service.js"
import { BaselineGameService } from "../src/importer/service/baseline-game-service.js"

const statService = new StatService()
let pitchEnvironment: PitchEnvironmentTarget

const season = 2025

const baselineGameService = new BaselineGameService(simService)
const pitchEnvironmentService = new PitchEnvironmentService(simService, statService, baselineGameService)

const downloaderService = new DownloaderService("data", 1000)

const players = await downloaderService.buildSeasonPlayerImports(season, new Set([]))

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const buildGame = (seed: string): Game => {
    const environment = clone(pitchEnvironment)

    environment.pitchEnvironmentTuning = pitchEnvironmentService.seedPitchEnvironmentTuning(environment)

    return baselineGameService.buildStartedBaselineGame(
        environment,
        seed
    )
}



const getBenchPlayerForPosition = (team: TeamInfo, position: Position): GamePlayer => {
    const player = team.players.find(p =>
        !team.lineupIds.includes(p._id) &&
        p._id !== team.currentPitcherId &&
        team.runner1BId !== p._id &&
        team.runner2BId !== p._id &&
        team.runner3BId !== p._id &&
        p.positions.includes(position)
    )

    if (!player) {
        throw new Error(`No bench player found for ${position}.`)
    }

    return player
}

const getBenchPositionPlayer = (team: TeamInfo): GamePlayer => {
    const player = team.players.find(p =>
        !team.lineupIds.includes(p._id) &&
        p._id !== team.currentPitcherId &&
        team.runner1BId !== p._id &&
        team.runner2BId !== p._id &&
        team.runner3BId !== p._id &&
        !p.positions.includes(Position.PITCHER)
    )

    if (!player) {
        throw new Error("No bench position player found.")
    }

    return player
}

const setHitterMatchupRatings = (player: GamePlayer, pitcher: GamePlayer, value: number): void => {
    const ratings = pitcher.throws === Handedness.L ? player.hittingRatings.vsL : player.hittingRatings.vsR

    ratings.contact = value
    ratings.plateDiscipline = value
    ratings.gapPower = value
    ratings.homerunPower = value
}

const setAllBenchHittersForPosition = (team: TeamInfo, pitcher: GamePlayer, position: Position, value: number): void => {
    for (const player of team.players) {
        if (team.lineupIds.includes(player._id)) continue
        if (player._id === team.currentPitcherId) continue
        if (team.runner1BId === player._id) continue
        if (team.runner2BId === player._id) continue
        if (team.runner3BId === player._id) continue
        if (!player.positions.includes(position)) continue

        setHitterMatchupRatings(player, pitcher, value)
    }
}

//@ts-ignore
const substitutionService = simService.substitutionService

describe("Baseball Sim Engine Substitutions", async () => {
    it("should calculate pitch environment target for season", async () => {
        pitchEnvironment = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(season, players)
        assert.ok(pitchEnvironment)
    })

    it("should start a baseline game", () => {
        const game = buildGame("start-baseline-game")

        assert.ok(game)
        assert.ok(game.away)
        assert.ok(game.home)

        assert.equal(game.isStarted, true)
        assert.equal(game.currentInning, 1)
        assert.equal(game.isTopInning, true)

        assert.equal(game.away.lineupIds.length, 9)
        assert.equal(game.home.lineupIds.length, 9)

        assert.ok(game.away.currentPitcherId)
        assert.ok(game.home.currentPitcherId)

        assert.ok(game.away.players.find(p => p._id === game.away.currentPitcherId))
        assert.ok(game.home.players.find(p => p._id === game.home.currentPitcherId))
    })

    it("should get available pitchers", () => {
        const game = buildGame("get-available-pitchers")
        const team = game.home

        const pitchers = substitutionService.getAvailablePitchers(game, team)

        assert.ok(pitchers.length > 0)
        assert.ok(pitchers.every(p => p.positions.includes(Position.PITCHER)))
        assert.ok(pitchers.every(p => p._id !== team.currentPitcherId))
        assert.ok(pitchers.every(p => !team.lineupIds.includes(p._id)))
        assert.ok(pitchers.every(p => substitutionService.getPitcherPitchesRemaining(p) > 0))

        const usedPitcherIds = new Set(
            game.substitutions
                .filter(s =>
                    s.teamId === team._id &&
                    s.isPitchingChange &&
                    s.outPlayerId
                )
                .map(s => s.outPlayerId)
        )

        assert.ok(pitchers.every(p => !usedPitcherIds.has(p._id)))
    })

    it("should get next pitcher by matching bullpen role first", () => {
        const game = buildGame("get-next-pitcher-role")
        const team = game.home

        game.currentInning = 9
        game.score.home = 3
        game.score.away = 1

        const closerRole = team.availablePitchers.find(p => p.role === PitchingRoleType.CLOSER)
        assert.ok(closerRole)

        const nextPitcher = substitutionService.getNextPitcher(game, team)

        assert.ok(nextPitcher)
        assert.equal(nextPitcher._id, closerRole.playerId)
    })

    it("should fall back to a position player when no pitchers are available", () => {
        const game = buildGame("get-next-pitcher-position-player")
        const team = game.home

        for (const pitcher of substitutionService.getAvailablePitchers(game, team)) {
            pitcher.maxPitchCount = 30
            pitcher.stamina = 1
            pitcher.pitchResult.pitches = 30
        }

        const nextPitcher = substitutionService.getNextPitcher(game, team)

        assert.ok(nextPitcher)
        assert.equal(nextPitcher.positions.includes(Position.PITCHER), false)
        assert.equal(nextPitcher._id !== team.currentPitcherId, true)
        assert.equal(team.lineupIds.includes(nextPitcher._id), false)
        assert.equal(team.runner1BId !== nextPitcher._id, true)
        assert.equal(team.runner2BId !== nextPitcher._id, true)
        assert.equal(team.runner3BId !== nextPitcher._id, true)
        assert.ok(nextPitcher.pitchRatings)
    })

    it("should calculate pitcher pitches remaining from max pitch count, stamina, and pitch result", () => {
        const game = buildGame("pitcher-pitches-remaining")
        const pitcher = game.home.players.find(p => p._id === game.home.currentPitcherId)

        assert.ok(pitcher)

        pitcher.maxPitchCount = 80
        pitcher.stamina = 0.75
        pitcher.pitchResult.pitches = 12

        assert.equal(substitutionService.getPitcherPitchesRemaining(pitcher), 48)
    })

    it("should not allow pitcher with stamina but no remaining pitches to enter", () => {
        const game = buildGame("change-pitcher-no-pitches-remaining")
        const team = game.home

        const newPitcher = substitutionService.getAvailablePitchers(game, team)[0]
        assert.ok(newPitcher)

        newPitcher.maxPitchCount = 30
        newPitcher.stamina = 1
        newPitcher.pitchResult.pitches = 30

        assert.throws(
            () => substitutionService.changePitcher(game, team, newPitcher._id, 1),
            /pitches remaining/i
        )
    })

    it("should not allow pitcher with no stamina to enter", () => {
        const game = buildGame("change-pitcher-no-stamina")
        const team = game.home

        const newPitcher = substitutionService.getAvailablePitchers(game, team)[0]
        assert.ok(newPitcher)

        newPitcher.stamina = 0

        assert.throws(
            () => substitutionService.changePitcher(game, team, newPitcher._id, 1),
            /pitches remaining/i
        )
    })


    it("should return 100 pitches remaining for a position player pitcher", () => {
        const game = buildGame("position-player-pitches-remaining")
        const team = game.home
        const positionPlayer = getBenchPositionPlayer(team)

        positionPlayer.stamina = 0
        positionPlayer.pitchResult.pitches = 99

        assert.equal(substitutionService.getPitcherPitchesRemaining(positionPlayer), 100)
    })

    it("should change pitcher", () => {
        const game = buildGame("change-pitcher")
        const team = game.home
        const playIndex = 1

        const previousPitcherId = team.currentPitcherId
        const previousPitcher = team.players.find(p => p._id === previousPitcherId)
        const newPitcher = substitutionService.getAvailablePitchers(game, team)[0]
        const lineupIndex = team.lineupIds.findIndex(id => id === previousPitcherId)

        assert.ok(previousPitcher)
        assert.ok(newPitcher)

        substitutionService.changePitcher(game, team, newPitcher._id, playIndex)

        assert.equal(team.currentPitcherId, newPitcher._id)
        assert.equal(team.lineupIds[lineupIndex], newPitcher._id)

        assert.equal(previousPitcher.currentPosition, undefined)
        assert.equal(previousPitcher.lineupIndex, undefined)

        assert.equal(newPitcher.currentPosition, Position.PITCHER)
        assert.equal(newPitcher.lineupIndex, lineupIndex)

        assert.equal(game.substitutions.length, 1)
        assert.equal(game.substitutions[0].teamId, team._id)
        assert.equal(game.substitutions[0].outPlayerId, previousPitcherId)
        assert.equal(game.substitutions[0].inPlayerId, newPitcher._id)
        assert.equal(game.substitutions[0].lineupIndex, lineupIndex)
        assert.equal(game.substitutions[0].toPosition, Position.PITCHER)
        assert.equal(game.substitutions[0].isPitchingChange, true)
        assert.equal(game.substitutions[0].playIndex, playIndex)
    })

    it("should not allow current pitcher to re-enter as the new pitcher", () => {
        const game = buildGame("change-pitcher-current-pitcher")
        const team = game.home

        assert.throws(
            () => substitutionService.changePitcher(game, team, team.currentPitcherId, 1),
            /already the current pitcher/i
        )
    })

    it("should not allow a removed pitcher to re-enter", () => {
        const game = buildGame("change-pitcher-re-entry")
        const team = game.home

        const firstPitcherId = team.currentPitcherId
        const secondPitcher = substitutionService.getAvailablePitchers(game, team)[0]

        assert.ok(secondPitcher)

        substitutionService.changePitcher(game, team, secondPitcher._id, 1)

        assert.throws(
            () => substitutionService.changePitcher(game, team, firstPitcherId, 2),
            /already left this game/i
        )
    })

    it("should manually move a game forward one pitch at a time", () => {
        const game = buildGame("manual-pitch-by-pitch")
        const rng = seedrandom("manual-pitch-by-pitch")

        let previousInning = game.currentInning
        let previousTop = game.isTopInning
        let steps = 0

        while (!game.isComplete && steps < 5000) {
            const defense = game.isTopInning ? game.home : game.away
            const pitcher = defense.players.find(p => p._id === defense.currentPitcherId)

            assert.ok(pitcher)

            simService.simPitch(game, rng)

            if (game.currentInning !== previousInning || game.isTopInning !== previousTop || game.isComplete) {
                console.log(
                    `END ${previousTop ? "TOP" : "BOTTOM"} ${previousInning}: ${pitcher.displayName} pitches=${pitcher.pitchResult.pitches} remaining=${substitutionService.getPitcherPitchesRemaining(pitcher)}`
                )

                previousInning = game.currentInning
                previousTop = game.isTopInning
            }

            steps++
        }

        assert.ok(steps > 0)
        assert.ok(steps < 5000)
    })

    it("should change hitter", () => {
        const game = buildGame("change-hitter")
        const team = game.away
        const playIndex = 1
        const outPlayerId = team.lineupIds[team.currentHitterIndex]
        const outPlayer = team.players.find(p => p._id === outPlayerId)

        assert.ok(outPlayer)

        const outPosition = outPlayer.currentPosition
        const inPlayer = getBenchPlayerForPosition(team, outPosition)
        const lineupIndex = team.lineupIds.findIndex(id => id === outPlayerId)

        substitutionService.changeHitter(game, team, outPlayerId, inPlayer._id, playIndex)

        assert.equal(team.lineupIds[lineupIndex], inPlayer._id)
        assert.equal(outPlayer.currentPosition, undefined)
        assert.equal(outPlayer.lineupIndex, undefined)
        assert.equal(inPlayer.currentPosition, outPosition)
        assert.equal(inPlayer.lineupIndex, lineupIndex)
        assert.equal(game.substitutions.length, 1)
        assert.equal(game.substitutions[0].outPlayerId, outPlayerId)
        assert.equal(game.substitutions[0].inPlayerId, inPlayer._id)
        assert.equal(game.substitutions[0].isPitchingChange, false)
        assert.equal(game.substitutions[0].playIndex, playIndex)
    })

    it("should change fielder", () => {
        const game = buildGame("change-fielder")
        const team = game.home
        const playIndex = 1

        const outPlayer = team.players.find(p =>
            team.lineupIds.includes(p._id) &&
            p.currentPosition &&
            team.players.some(bp =>
                !team.lineupIds.includes(bp._id) &&
                bp._id !== team.currentPitcherId &&
                bp.positions.includes(p.currentPosition)
            )
        )

        assert.ok(outPlayer)

        const outPosition = outPlayer.currentPosition
        const inPlayer = getBenchPlayerForPosition(team, outPosition)
        const lineupIndex = team.lineupIds.findIndex(id => id === outPlayer._id)

        substitutionService.changeFielder(game, team, outPlayer._id, inPlayer._id, outPosition, playIndex)

        assert.equal(team.lineupIds[lineupIndex], inPlayer._id)
        assert.equal(outPlayer.currentPosition, undefined)
        assert.equal(outPlayer.lineupIndex, undefined)
        assert.equal(inPlayer.currentPosition, outPosition)
        assert.equal(inPlayer.lineupIndex, lineupIndex)
        assert.equal(game.substitutions.length, 1)
        assert.equal(game.substitutions[0].outPlayerId, outPlayer._id)
        assert.equal(game.substitutions[0].inPlayerId, inPlayer._id)
        assert.equal(game.substitutions[0].toPosition, outPosition)
        assert.equal(game.substitutions[0].playIndex, playIndex)
    })

    it("should change runner", () => {
        const game = buildGame("change-runner")
        const team = game.away
        const playIndex = 1
        const outPlayerId = team.lineupIds[0]
        const outPlayer = team.players.find(p => p._id === outPlayerId)

        assert.ok(outPlayer)

        const outPosition = outPlayer.currentPosition
        const inPlayer = getBenchPlayerForPosition(team, outPosition)
        const lineupIndex = team.lineupIds.findIndex(id => id === outPlayerId)

        team.runner1BId = outPlayerId

        substitutionService.changeRunner(game, team, outPlayerId, inPlayer._id, playIndex)

        assert.equal(team.runner1BId, inPlayer._id)
        assert.equal(team.lineupIds[lineupIndex], inPlayer._id)
        assert.equal(outPlayer.currentPosition, undefined)
        assert.equal(outPlayer.lineupIndex, undefined)
        assert.equal(inPlayer.currentPosition, outPosition)
        assert.equal(inPlayer.lineupIndex, lineupIndex)
        assert.equal(game.substitutions.length, 1)
        assert.equal(game.substitutions[0].outPlayerId, outPlayerId)
        assert.equal(game.substitutions[0].inPlayerId, inPlayer._id)
        assert.equal(game.substitutions[0].playIndex, playIndex)
    })

    it("should not change runner when outgoing player is not on base", () => {
        const game = buildGame("change-runner-not-on-base")
        const team = game.away
        const outPlayerId = team.lineupIds[0]
        const outPlayer = team.players.find(p => p._id === outPlayerId)

        assert.ok(outPlayer)

        const inPlayer = getBenchPlayerForPosition(team, outPlayer.currentPosition)

        assert.throws(
            () => substitutionService.changeRunner(game, team, outPlayerId, inPlayer._id, 1),
            /not currently on base/i
        )
    })

    it("should not allow an active player to enter as a substitution", () => {
        const game = buildGame("active-player-sub")
        const team = game.away
        const outPlayerId = team.lineupIds[0]
        const activePlayerId = team.lineupIds[1]

        assert.throws(
            () => substitutionService.changeHitter(game, team, outPlayerId, activePlayerId, 1),
            /already in the lineup/i
        )
    })

    it("should not allow a removed player to re-enter", () => {
        const game = buildGame("removed-player-re-entry")
        const team = game.away
        const outPlayerId = team.lineupIds[0]
        const outPlayer = team.players.find(p => p._id === outPlayerId)

        assert.ok(outPlayer)

        const outPosition = outPlayer.currentPosition
        const firstBenchPlayer = getBenchPlayerForPosition(team, outPosition)

        substitutionService.changeHitter(game, team, outPlayerId, firstBenchPlayer._id, 1)

        assert.throws(
            () => substitutionService.changeHitter(game, team, firstBenchPlayer._id, outPlayerId, 2),
            /already left this game/i
        )
    })

    it("should allow a position player to enter as pitcher", () => {
        const game = buildGame("position-player-pitcher")
        const team = game.home
        const playIndex = 1
        const previousPitcherId = team.currentPitcherId
        const previousPitcher = team.players.find(p => p._id === previousPitcherId)
        const positionPlayer = getBenchPositionPlayer(team)
        const lineupIndex = team.lineupIds.findIndex(id => id === previousPitcherId)

        assert.ok(previousPitcher)
        assert.ok(positionPlayer)

        substitutionService.changePitcher(game, team, positionPlayer._id, playIndex)

        assert.equal(team.currentPitcherId, positionPlayer._id)
        assert.equal(team.lineupIds[lineupIndex], positionPlayer._id)
        assert.equal(previousPitcher.currentPosition, undefined)
        assert.equal(previousPitcher.lineupIndex, undefined)
        assert.equal(positionPlayer.currentPosition, Position.PITCHER)
        assert.equal(positionPlayer.lineupIndex, lineupIndex)
        assert.equal(game.substitutions[0].isPitchingChange, true)
        assert.equal(game.substitutions[0].playIndex, playIndex)
    })

    it("should not get next hitter before the 7th inning", () => {
        const game = buildGame("next-hitter-before-seventh")
        const offense = game.away
        const defense = game.home
        const currentHitter = offense.players.find(p => p._id === offense.lineupIds[offense.currentHitterIndex])
        const pitcher = defense.players.find(p => p._id === defense.currentPitcherId)

        assert.ok(currentHitter)
        assert.ok(pitcher)

        const benchPlayer = getBenchPlayerForPosition(offense, currentHitter.currentPosition)

        game.currentInning = 6
        game.score.away = 2
        game.score.home = 4

        setHitterMatchupRatings(currentHitter, pitcher, 1)
        setHitterMatchupRatings(benchPlayer, pitcher, 100)

        const nextHitter = substitutionService.getNextHitter(game, offense, defense)

        assert.equal(nextHitter, undefined)
    })

    it("should get next hitter when late, close, same-position bench hitter is meaningfully better", () => {
        const game = buildGame("next-hitter-late-close")
        const offense = game.away
        const defense = game.home
        const currentHitter = offense.players.find(p => p._id === offense.lineupIds[offense.currentHitterIndex])
        const pitcher = defense.players.find(p => p._id === defense.currentPitcherId)

        assert.ok(currentHitter)
        assert.ok(pitcher)

        const benchPlayer = getBenchPlayerForPosition(offense, currentHitter.currentPosition)

        game.currentInning = 8
        game.score.away = 2
        game.score.home = 4

        setAllBenchHittersForPosition(offense, pitcher, currentHitter.currentPosition, 1)
        setHitterMatchupRatings(currentHitter, pitcher, 40)
        setHitterMatchupRatings(benchPlayer, pitcher, 60)

        const nextHitter = substitutionService.getNextHitter(game, offense, defense)

        assert.ok(nextHitter)
        assert.equal(nextHitter._id, benchPlayer._id)
    })

    it("should not get next hitter in a blowout", () => {
        const game = buildGame("next-hitter-blowout")
        const offense = game.away
        const defense = game.home
        const currentHitter = offense.players.find(p => p._id === offense.lineupIds[offense.currentHitterIndex])
        const pitcher = defense.players.find(p => p._id === defense.currentPitcherId)

        assert.ok(currentHitter)
        assert.ok(pitcher)

        const benchPlayer = getBenchPlayerForPosition(offense, currentHitter.currentPosition)

        game.currentInning = 9
        game.score.away = 1
        game.score.home = 8

        setHitterMatchupRatings(currentHitter, pitcher, 1)
        setHitterMatchupRatings(benchPlayer, pitcher, 100)

        const nextHitter = substitutionService.getNextHitter(game, offense, defense)

        assert.equal(nextHitter, undefined)
    })

    it("should not get next hitter when no same-position bench hitter is an upgrade", () => {
        const game = buildGame("next-hitter-position-filter")
        const offense = game.away
        const defense = game.home
        const currentHitter = offense.players.find(p => p._id === offense.lineupIds[offense.currentHitterIndex])
        const pitcher = defense.players.find(p => p._id === defense.currentPitcherId)

        assert.ok(currentHitter)
        assert.ok(pitcher)

        game.currentInning = 8
        game.score.away = 2
        game.score.home = 4

        setHitterMatchupRatings(currentHitter, pitcher, 50)
        setAllBenchHittersForPosition(offense, pitcher, currentHitter.currentPosition, 1)

        const nextHitter = substitutionService.getNextHitter(game, offense, defense)

        assert.equal(nextHitter, undefined)
    })

    it("should not get next hitter when improvement is too small", () => {
        const game = buildGame("next-hitter-small-improvement")
        const offense = game.away
        const defense = game.home
        const currentHitter = offense.players.find(p => p._id === offense.lineupIds[offense.currentHitterIndex])
        const pitcher = defense.players.find(p => p._id === defense.currentPitcherId)

        assert.ok(currentHitter)
        assert.ok(pitcher)

        const benchPlayer = getBenchPlayerForPosition(offense, currentHitter.currentPosition)

        game.currentInning = 8
        game.score.away = 2
        game.score.home = 4

        setAllBenchHittersForPosition(offense, pitcher, currentHitter.currentPosition, 1)
        setHitterMatchupRatings(currentHitter, pitcher, 50)
        setHitterMatchupRatings(benchPlayer, pitcher, 54)

        const nextHitter = substitutionService.getNextHitter(game, offense, defense)

        assert.equal(nextHitter, undefined)
    })

    it("should not get next hitter if the bench hitter already left the game", () => {
        const game = buildGame("next-hitter-used-player")
        const offense = game.away
        const defense = game.home
        const currentHitter = offense.players.find(p => p._id === offense.lineupIds[offense.currentHitterIndex])
        const pitcher = defense.players.find(p => p._id === defense.currentPitcherId)

        assert.ok(currentHitter)
        assert.ok(pitcher)

        const benchPlayer = getBenchPlayerForPosition(offense, currentHitter.currentPosition)

        game.currentInning = 8
        game.score.away = 2
        game.score.home = 4

        setAllBenchHittersForPosition(offense, pitcher, currentHitter.currentPosition, 1)
        setHitterMatchupRatings(currentHitter, pitcher, 1)
        setHitterMatchupRatings(benchPlayer, pitcher, 100)

        game.substitutions.push({
            inning: 7,
            top: true,
            teamId: offense._id,
            outPlayerId: benchPlayer._id,
            inPlayerId: "fake-player",
            lineupIndex: 0,
            fromPosition: currentHitter.currentPosition,
            toPosition: currentHitter.currentPosition,
            isPitchingChange: false,
            playIndex: 1
        })

        const nextHitter = substitutionService.getNextHitter(game, offense, defense)

        assert.equal(nextHitter, undefined)
    })


    it("should change hitter for pitcher slot and require later pitcher change", () => {
        const game = buildGame("change-hitter-for-pitcher")
        const team = game.away
        const playIndex = 1

        const outPlayerId = team.currentPitcherId
        const outPlayer = team.players.find(p => p._id === outPlayerId)
        const inPlayer = getBenchPositionPlayer(team)
        const lineupIndex = team.lineupIds.findIndex(id => id === outPlayerId)

        assert.ok(outPlayer)
        assert.ok(inPlayer)

        substitutionService.changeHitter(game, team, outPlayerId, inPlayer._id, playIndex)

        assert.equal(team.lineupIds[lineupIndex], inPlayer._id)
        assert.equal(team.currentPitcherId, outPlayerId)

        assert.equal(outPlayer.currentPosition, undefined)
        assert.equal(outPlayer.lineupIndex, undefined)

        assert.equal(inPlayer.currentPosition, undefined)
        assert.equal(inPlayer.lineupIndex, lineupIndex)

        assert.equal(game.substitutions.length, 1)
        assert.equal(game.substitutions[0].outPlayerId, outPlayerId)
        assert.equal(game.substitutions[0].inPlayerId, inPlayer._id)
        assert.equal(game.substitutions[0].lineupIndex, lineupIndex)
        assert.equal(game.substitutions[0].fromPosition, Position.PITCHER)
        assert.equal(game.substitutions[0].toPosition, undefined)
        assert.equal(game.substitutions[0].isPitchingChange, false)
        assert.equal(game.substitutions[0].requiresPitcherChange, true)
        assert.equal(game.substitutions[0].resolvedPitcherChange, false)
        assert.equal(game.substitutions[0].playIndex, playIndex)
    })

    it("should resolve pending pitcher change after pitcher is pinch hit for", () => {
        const game = buildGame("resolve-pending-pitcher-change")
        const team = game.away
        const playIndex = 1

        const oldPitcherId = team.currentPitcherId
        const oldPitcher = team.players.find(p => p._id === oldPitcherId)
        const pinchHitter = getBenchPositionPlayer(team)
        const lineupIndex = team.lineupIds.findIndex(id => id === oldPitcherId)

        assert.ok(oldPitcher)
        assert.ok(pinchHitter)

        substitutionService.changeHitter(game, team, oldPitcherId, pinchHitter._id, playIndex)

        const changed = substitutionService.changePitcherIfNeeded(game, team, playIndex + 1)

        assert.equal(changed, true)

        const pitcherSubstitution = game.substitutions[1]
        const nextPitcher = team.players.find(p => p._id === pitcherSubstitution.inPlayerId)

        assert.ok(nextPitcher)

        assert.equal(team.currentPitcherId, nextPitcher._id)
        assert.equal(team.lineupIds[lineupIndex], nextPitcher._id)

        assert.equal(oldPitcher.currentPosition, undefined)
        assert.equal(oldPitcher.lineupIndex, undefined)

        assert.equal(pinchHitter.currentPosition, undefined)
        assert.equal(pinchHitter.lineupIndex, undefined)

        assert.equal(nextPitcher.currentPosition, Position.PITCHER)
        assert.equal(nextPitcher.lineupIndex, lineupIndex)

        assert.equal(game.substitutions.length, 2)

        assert.equal(game.substitutions[0].outPlayerId, oldPitcherId)
        assert.equal(game.substitutions[0].inPlayerId, pinchHitter._id)
        assert.equal(game.substitutions[0].requiresPitcherChange, true)
        assert.equal(game.substitutions[0].resolvedPitcherChange, true)

        assert.equal(pitcherSubstitution.outPlayerId, pinchHitter._id)
        assert.equal(pitcherSubstitution.inPlayerId, nextPitcher._id)
        assert.equal(pitcherSubstitution.isPitchingChange, true)
        assert.equal(pitcherSubstitution.toPosition, Position.PITCHER)
        assert.equal(pitcherSubstitution.playIndex, playIndex + 1)
    })

    it("should get next hitter for pitcher slot from non-pitcher bench hitters", () => {
        const game = buildGame("next-hitter-pitcher-slot")
        const offense = game.away
        const defense = game.home

        const currentPitcher = offense.players.find(p => p._id === offense.currentPitcherId)
        const defensivePitcher = defense.players.find(p => p._id === defense.currentPitcherId)
        const benchHitter = getBenchPositionPlayer(offense)

        assert.ok(currentPitcher)
        assert.ok(defensivePitcher)
        assert.ok(benchHitter)

        offense.currentHitterIndex = offense.lineupIds.findIndex(id => id === offense.currentPitcherId)

        game.currentInning = 8
        game.score.away = 2
        game.score.home = 4

        setHitterMatchupRatings(currentPitcher, defensivePitcher, 1)
        setHitterMatchupRatings(benchHitter, defensivePitcher, 100)

        const nextHitter = substitutionService.getNextHitter(game, offense, defense)

        assert.ok(nextHitter)
        assert.equal(nextHitter._id, benchHitter._id)
        assert.equal(nextHitter.positions.includes(Position.PITCHER), false)
    })


})