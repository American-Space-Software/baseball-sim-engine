import assert from "assert"
import seedrandom from "seedrandom"
import {
    StatService,
    simService,
    Position,
    PitchingRoleType,
    Handedness,
    GameInfo
} from "../src/sim/index.js"
import type {
    PitchEnvironmentTarget,
    Game,
    GamePlayer,
    TeamInfo,
    Lineup,
    Player,
    RotationPitcher,
    Team
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

const buildDHGame = (seed: string): Game => {
    const environment = clone(pitchEnvironment)

    environment.pitchEnvironmentTuning = pitchEnvironmentService.seedPitchEnvironmentTuning(environment)

    return baselineGameService.buildStartedBaselineGame(
        environment,
        seed,
        true
    )
}

const buildTwoWayDHGame = (seed: string): Game => {
    const environment = clone(pitchEnvironment)

    environment.pitchEnvironmentTuning =
        pitchEnvironmentService.seedPitchEnvironmentTuning(environment)

    const twoWayPlayer = baselineGameService.buildBaselinePlayer(
        "two-way-1",
        Position.PITCHER
    )

    twoWayPlayer.stamina = 1
    twoWayPlayer.maxPitchCount = 100

    const awayPlayers = baselineGameService.buildBaselinePlayers()
    const homePlayers = baselineGameService.buildBaselinePlayers()

    const awayStartingPitcherIndex = awayPlayers.findIndex(
        player => player._id === "sp-1"
    )

    if (awayStartingPitcherIndex < 0) {
        throw new Error("No away baseline starting pitcher found.")
    }

    awayPlayers[awayStartingPitcherIndex] = twoWayPlayer

    const awayLineup = baselineGameService.buildBaselineLineup(
        awayPlayers,
        true
    )

    const awayDHSpot = awayLineup.order.find(
        spot => spot.position === Position.DESIGNATED_HITTER
    )

    if (!awayDHSpot) {
        throw new Error("No away designated hitter spot found.")
    }

    awayDHSpot._id = twoWayPlayer._id

    const homeLineup = baselineGameService.buildBaselineLineup(
        homePlayers,
        true
    )

    const awayStartingPitcher: RotationPitcher = {
        _id: twoWayPlayer._id
    }

    const homeStartingPitcher: RotationPitcher = {
        _id: homePlayers.find(
            player => player.primaryPosition === Position.PITCHER
        )!._id
    }

    const buildAvailablePitchers = (rosterPlayers: Player[], startingPitcher: RotationPitcher) => {
        return rosterPlayers
            .filter(player =>
                player.primaryPosition === Position.PITCHER &&
                player._id !== startingPitcher._id
            )
            .map((player, index) => ({
                playerId: player._id,
                role:
                    index === 0 ? PitchingRoleType.CLOSER :
                    index <= 2 ? PitchingRoleType.SETUP :
                    index <= 4 ? PitchingRoleType.MIDDLE :
                    index <= 6 ? PitchingRoleType.LONG :
                    PitchingRoleType.MOP_UP,
                priority: index
            }))
    }

    const game = { _id: seed } as Game

    simService.initGame(game)

    return simService.startGame({
        game,

        away: {
            _id: `${seed}-away`,
            name: "Away",
            abbrev: "AWAY",
            colors: {
                color1: "#ff0000",
                color2: "#ffffff"
            }
        },

        awayTeamOptions: {},
        awayPlayers,
        awayLineup,
        awayStartingPitcher,
        awayAvailablePitchers: buildAvailablePitchers(
            awayPlayers,
            awayStartingPitcher
        ),

        home: {
            _id: `${seed}-home`,
            name: "Home",
            abbrev: "HOME",
            colors: {
                color1: "#0000ff",
                color2: "#ffffff"
            }
        },

        homeTeamOptions: {},
        homePlayers,
        homeLineup,
        homeStartingPitcher,
        homeAvailablePitchers: buildAvailablePitchers(
            homePlayers,
            homeStartingPitcher
        ),

        pitchEnvironmentTarget: environment,
        useDH: true,
        date: new Date()
    })
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
        assert.equal(game.useDH, false)

        assert.equal(game.away.lineupIds.length, 9)
        assert.equal(game.home.lineupIds.length, 9)

        assert.ok(game.away.currentPitcherId)
        assert.ok(game.home.currentPitcherId)

        const awayPitcher = game.away.players.find(p => p._id === game.away.currentPitcherId)
        const homePitcher = game.home.players.find(p => p._id === game.home.currentPitcherId)

        assert.ok(awayPitcher)
        assert.ok(homePitcher)

        assert.ok(game.away.lineupIds.includes(game.away.currentPitcherId))
        assert.ok(game.home.lineupIds.includes(game.home.currentPitcherId))

        assert.equal(awayPitcher.currentPosition, Position.PITCHER)
        assert.equal(homePitcher.currentPosition, Position.PITCHER)

        assert.ok(awayPitcher.lineupIndex !== undefined)
        assert.ok(homePitcher.lineupIndex !== undefined)
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

    it("should validate a DH lineup with no pitcher batting spot", () => {
    const rosterPlayers = baselineGameService.buildBaselinePlayers()
    const lineup = baselineGameService.buildBaselineLineup(rosterPlayers, true)

    const startingPitcher: RotationPitcher = {
        _id: rosterPlayers.find(player => player.primaryPosition === Position.PITCHER)!._id
    }

    assert.doesNotThrow(() => {
        GameInfo.validateGameLineup(
            rosterPlayers,
            lineup,
            startingPitcher,
            true
        )
    })

    assert.equal(
        lineup.order.filter(spot => spot.position === Position.DESIGNATED_HITTER).length,
        1
    )

    assert.equal(
        lineup.order.filter(spot => spot.position === Position.PITCHER).length,
        0
    )
    })

    it("should reject a DH lineup containing a pitcher batting spot", () => {
        const rosterPlayers = baselineGameService.buildBaselinePlayers()
        const lineup = baselineGameService.buildBaselineLineup(rosterPlayers, true)

        const startingPitcher: RotationPitcher = {
            _id: rosterPlayers.find(player => player.primaryPosition === Position.PITCHER)!._id
        }

        const designatedHitterSpot = lineup.order.find(
            spot => spot.position === Position.DESIGNATED_HITTER
        )

        assert.ok(designatedHitterSpot)

        designatedHitterSpot.position = Position.PITCHER

        assert.throws(
            () => GameInfo.validateGameLineup(
                rosterPlayers,
                lineup,
                startingPitcher,
                true
            ),
            /cannot contain a pitcher batting spot/i
        )
    })

    it("should reject a DH lineup without a designated hitter", () => {
        const rosterPlayers = baselineGameService.buildBaselinePlayers()
        const lineup = baselineGameService.buildBaselineLineup(rosterPlayers, true)

        const startingPitcher: RotationPitcher = {
            _id: rosterPlayers.find(player => player.primaryPosition === Position.PITCHER)!._id
        }

        const designatedHitterSpot = lineup.order.find(
            spot => spot.position === Position.DESIGNATED_HITTER
        )

        assert.ok(designatedHitterSpot)

        designatedHitterSpot.position = undefined

        assert.throws(
            () => GameInfo.validateGameLineup(
                rosterPlayers,
                lineup,
                startingPitcher,
                true
            ),
            /must contain exactly one designated hitter/i
        )
    })

    it("should reject a non-DH lineup containing a designated hitter", () => {
        const rosterPlayers = baselineGameService.buildBaselinePlayers()
        const lineup = baselineGameService.buildBaselineLineup(rosterPlayers, true)

        const startingPitcher: RotationPitcher = {
            _id: rosterPlayers.find(player => player.primaryPosition === Position.PITCHER)!._id
        }

        assert.throws(
            () => GameInfo.validateGameLineup(
                rosterPlayers,
                lineup,
                startingPitcher,
                false
            ),
            /cannot contain a designated hitter/i
        )
    })

    it("should reject a starting pitcher not found in the roster", () => {
        const rosterPlayers = baselineGameService.buildBaselinePlayers()
        const lineup = baselineGameService.buildBaselineLineup(rosterPlayers, true)

        const startingPitcher: RotationPitcher = {
            _id: "missing-starting-pitcher"
        }

        assert.throws(
            () => GameInfo.validateGameLineup(
                rosterPlayers,
                lineup,
                startingPitcher,
                true
            ),
            /starting pitcher.*not found in players list/i
        )
    })

    it("should start a DH game with separate batting and pitching assignments", () => {
        const environment = clone(pitchEnvironment)

        environment.pitchEnvironmentTuning =
            pitchEnvironmentService.seedPitchEnvironmentTuning(environment)

        const game = baselineGameService.buildStartedBaselineGame(
            environment,
            "start-dh-game",
            true
        )

        assert.equal(game.useDH, true)

        for (const team of [game.away, game.home]) {
            const pitcher = team.players.find(
                player => player._id === team.currentPitcherId
            )

            const designatedHitter = team.players.find(
                player => player.currentPosition === Position.DESIGNATED_HITTER
            )

            assert.ok(pitcher)
            assert.ok(designatedHitter)

            assert.equal(team.lineupIds.length, 9)

            assert.equal(
                team.lineupIds.includes(pitcher._id),
                false
            )

            assert.equal(
                team.lineupIds.includes(designatedHitter._id),
                true
            )

            assert.equal(
                pitcher.currentPosition,
                Position.PITCHER
            )

            assert.equal(
                pitcher.lineupIndex,
                undefined
            )

            assert.ok(
                designatedHitter.lineupIndex !== undefined
            )

            assert.equal(
                team.lineupIds[designatedHitter.lineupIndex],
                designatedHitter._id
            )
        }
    })

    it("should start a DH game with nine defenders and one designated hitter", () => {
        const environment = clone(pitchEnvironment)

        environment.pitchEnvironmentTuning =
            pitchEnvironmentService.seedPitchEnvironmentTuning(environment)

        const game = baselineGameService.buildStartedBaselineGame(
            environment,
            "dh-active-players",
            true
        )

        for (const team of [game.away, game.home]) {
            const activePlayers = team.players.filter(
                player => player.currentPosition !== undefined
            )

            const defenders = activePlayers.filter(
                player => player.currentPosition !== Position.DESIGNATED_HITTER
            )

            const designatedHitters = activePlayers.filter(
                player => player.currentPosition === Position.DESIGNATED_HITTER
            )

            assert.equal(activePlayers.length, 10)
            assert.equal(defenders.length, 9)
            assert.equal(designatedHitters.length, 1)

            assert.equal(
                defenders.filter(
                    player => player.currentPosition === Position.PITCHER
                ).length,
                1
            )

            assert.equal(
                new Set(
                    defenders.map(player => player.currentPosition)
                ).size,
                9
            )
        }
    })

    it("should change pitcher without changing the batting order in a DH game", () => {
        const game = buildDHGame("change-dh-pitcher")
        const team = game.home
        const playIndex = 1

        const originalLineupIds = [...team.lineupIds]
        const previousPitcherId = team.currentPitcherId
        const previousPitcher = team.players.find(p => p._id === previousPitcherId)
        const newPitcher = substitutionService.getAvailablePitchers(game, team)[0]

        assert.ok(previousPitcher)
        assert.ok(newPitcher)

        assert.equal(team.lineupIds.includes(previousPitcherId), false)
        assert.equal(team.lineupIds.includes(newPitcher._id), false)

        substitutionService.changePitcher(
            game,
            team,
            newPitcher._id,
            playIndex
        )

        assert.equal(team.currentPitcherId, newPitcher._id)
        assert.deepEqual(team.lineupIds, originalLineupIds)

        assert.equal(previousPitcher.currentPosition, undefined)
        assert.equal(previousPitcher.lineupIndex, undefined)

        assert.equal(newPitcher.currentPosition, Position.PITCHER)
        assert.equal(newPitcher.lineupIndex, undefined)
    })

    it("should log a DH pitching change without a batting-order index", () => {
        const game = buildDHGame("log-dh-pitching-change")
        const team = game.home
        const playIndex = 4

        const previousPitcherId = team.currentPitcherId
        const newPitcher = substitutionService.getAvailablePitchers(game, team)[0]

        assert.ok(newPitcher)

        substitutionService.changePitcher(
            game,
            team,
            newPitcher._id,
            playIndex
        )

        assert.equal(game.substitutions.length, 1)

        const substitution = game.substitutions[0]

        assert.equal(substitution.teamId, team._id)
        assert.equal(substitution.outPlayerId, previousPitcherId)
        assert.equal(substitution.inPlayerId, newPitcher._id)

        assert.equal(substitution.lineupIndex, undefined)
        assert.equal(substitution.fromPosition, Position.PITCHER)
        assert.equal(substitution.toPosition, Position.PITCHER)

        assert.equal(substitution.isPitchingChange, true)
        assert.equal(substitution.requiresPitcherChange, false)
        assert.equal(substitution.resolvedPitcherChange, undefined)
        assert.equal(substitution.playIndex, playIndex)
    })

    it("should preserve the DH batting order through multiple pitching changes", () => {
        const game = buildDHGame("multiple-dh-pitching-changes")
        const team = game.home

        const originalLineupIds = [...team.lineupIds]

        const secondPitcher = substitutionService.getAvailablePitchers(game, team)[0]

        assert.ok(secondPitcher)

        substitutionService.changePitcher(
            game,
            team,
            secondPitcher._id,
            1
        )

        assert.deepEqual(team.lineupIds, originalLineupIds)

        const thirdPitcher = substitutionService.getAvailablePitchers(game, team)[0]

        assert.ok(thirdPitcher)

        substitutionService.changePitcher(
            game,
            team,
            thirdPitcher._id,
            2
        )

        assert.equal(team.currentPitcherId, thirdPitcher._id)
        assert.deepEqual(team.lineupIds, originalLineupIds)

        assert.equal(secondPitcher.currentPosition, undefined)
        assert.equal(secondPitcher.lineupIndex, undefined)

        assert.equal(thirdPitcher.currentPosition, Position.PITCHER)
        assert.equal(thirdPitcher.lineupIndex, undefined)

        assert.equal(game.substitutions.length, 2)
    })

    it("should not allow a removed pitcher to re-enter a DH game", () => {
        const game = buildDHGame("dh-pitcher-re-entry")
        const team = game.home

        const firstPitcherId = team.currentPitcherId
        const secondPitcher = substitutionService.getAvailablePitchers(game, team)[0]

        assert.ok(secondPitcher)

        substitutionService.changePitcher(
            game,
            team,
            secondPitcher._id,
            1
        )

        assert.throws(
            () => substitutionService.changePitcher(
                game,
                team,
                firstPitcherId,
                2
            ),
            /already left this game/i
        )
    })    

    it("should automatically replace an exhausted pitcher without changing a DH lineup", () => {
        const game = buildDHGame("automatic-dh-pitching-change")
        const team = game.home

        const originalLineupIds = [...team.lineupIds]
        const previousPitcherId = team.currentPitcherId
        const previousPitcher = team.players.find(
            p => p._id === previousPitcherId
        )

        assert.ok(previousPitcher)

        previousPitcher.maxPitchCount = 30
        previousPitcher.stamina = 1
        previousPitcher.pitchResult.pitches = 30

        const changed = substitutionService.changePitcherIfNeeded(
            game,
            team,
            1
        )

        assert.equal(changed, true)
        assert.notEqual(team.currentPitcherId, previousPitcherId)
        assert.deepEqual(team.lineupIds, originalLineupIds)

        const newPitcher = team.players.find(
            p => p._id === team.currentPitcherId
        )

        assert.ok(newPitcher)
        assert.equal(newPitcher.currentPosition, Position.PITCHER)
        assert.equal(newPitcher.lineupIndex, undefined)

        assert.equal(previousPitcher.currentPosition, undefined)
        assert.equal(previousPitcher.lineupIndex, undefined)
    })

    it("should allow the starting pitcher to also occupy the designated hitter spot", () => {
        const rosterPlayers = baselineGameService.buildBaselinePlayers()
        const lineup = baselineGameService.buildBaselineLineup(
            rosterPlayers,
            true
        )

        const startingPitcher = rosterPlayers.find(
            player => player.primaryPosition === Position.PITCHER
        )

        const designatedHitterSpot = lineup.order.find(
            spot => spot.position === Position.DESIGNATED_HITTER
        )

        assert.ok(startingPitcher)
        assert.ok(designatedHitterSpot)

        designatedHitterSpot._id = startingPitcher._id

        assert.doesNotThrow(() => {
            GameInfo.validateGameLineup(
                rosterPlayers,
                lineup,
                { _id: startingPitcher._id },
                true
            )
        })
    })

    it("should start a two-way player as both pitcher and designated hitter", () => {
        const game = buildTwoWayDHGame("start-two-way-dh")
        const team = game.away
        const twoWayPlayer = team.players.find(
            player => player._id === team.currentPitcherId
        )

        assert.ok(twoWayPlayer)

        assert.equal(game.useDH, true)
        assert.equal(twoWayPlayer._id, "two-way-1")

        assert.equal(
            team.lineupIds.includes(twoWayPlayer._id),
            true
        )

        assert.equal(
            twoWayPlayer.currentPosition,
            Position.DESIGNATED_HITTER
        )

        assert.ok(twoWayPlayer.lineupIndex !== undefined)

        assert.equal(
            team.lineupIds[twoWayPlayer.lineupIndex],
            twoWayPlayer._id
        )
    })

    it("should log a two-way player's pitching change without removing their DH slot", () => {
        const game = buildTwoWayDHGame("log-two-way-pitching-change")
        const team = game.away
        const playIndex = 5

        const twoWayPlayerId = team.currentPitcherId
        const newPitcher = substitutionService.getAvailablePitchers(
            game,
            team
        )[0]

        assert.ok(newPitcher)

        substitutionService.changePitcher(
            game,
            team,
            newPitcher._id,
            playIndex
        )

        assert.equal(game.substitutions.length, 1)

        const substitution = game.substitutions[0]

        assert.equal(substitution.outPlayerId, twoWayPlayerId)
        assert.equal(substitution.inPlayerId, newPitcher._id)

        assert.equal(substitution.lineupIndex, undefined)
        assert.equal(substitution.fromPosition, Position.PITCHER)
        assert.equal(substitution.toPosition, Position.PITCHER)

        assert.equal(substitution.isPitchingChange, true)
        assert.equal(substitution.playIndex, playIndex)

        assert.equal(
            team.lineupIds.includes(twoWayPlayerId),
            true
        )
    })    

    it("should not allow a two-way player to return as pitcher after leaving the mound", () => {
        const game = buildTwoWayDHGame("two-way-pitcher-reentry")
        const team = game.away

        const twoWayPlayerId = team.currentPitcherId
        const secondPitcher = substitutionService.getAvailablePitchers(
            game,
            team
        )[0]

        assert.ok(secondPitcher)

        substitutionService.changePitcher(
            game,
            team,
            secondPitcher._id,
            1
        )

        assert.throws(
            () => substitutionService.changePitcher(
                game,
                team,
                twoWayPlayerId,
                2
            ),
            /already in the lineup/i
        )
    })    

    it("should automatically remove an exhausted two-way player as pitcher while keeping them as DH", () => {
        const game = buildTwoWayDHGame("automatic-two-way-change")
        const team = game.away

        const twoWayPlayer = team.players.find(
            player => player._id === team.currentPitcherId
        )

        assert.ok(twoWayPlayer)
        assert.ok(twoWayPlayer.lineupIndex !== undefined)

        const originalLineupIds = [...team.lineupIds]
        const originalLineupIndex = twoWayPlayer.lineupIndex

        twoWayPlayer.maxPitchCount = 30
        twoWayPlayer.stamina = 1
        twoWayPlayer.pitchResult.pitches = 30

        const changed = substitutionService.changePitcherIfNeeded(
            game,
            team,
            1
        )

        assert.equal(changed, true)
        assert.notEqual(team.currentPitcherId, twoWayPlayer._id)

        assert.deepEqual(team.lineupIds, originalLineupIds)

        assert.equal(
            twoWayPlayer.currentPosition,
            Position.DESIGNATED_HITTER
        )

        assert.equal(
            twoWayPlayer.lineupIndex,
            originalLineupIndex
        )

        assert.equal(
            team.lineupIds[originalLineupIndex],
            twoWayPlayer._id
        )
    })    

    it("should replace a designated hitter with a bench position player", () => {
        const game = buildDHGame("replace-designated-hitter")
        const team = game.away
        const playIndex = 1

        const designatedHitter = team.players.find(
            player => player.currentPosition === Position.DESIGNATED_HITTER
        )

        const incomingHitter = getBenchPositionPlayer(team)

        assert.ok(designatedHitter)
        assert.ok(incomingHitter)
        assert.ok(designatedHitter.lineupIndex !== undefined)

        const lineupIndex = designatedHitter.lineupIndex
        const pitcherId = team.currentPitcherId

        assert.equal(
            incomingHitter.positions.includes(Position.DESIGNATED_HITTER),
            false
        )

        substitutionService.changeHitter(
            game,
            team,
            designatedHitter._id,
            incomingHitter._id,
            playIndex
        )

        assert.equal(
            team.lineupIds[lineupIndex],
            incomingHitter._id
        )

        assert.equal(
            team.currentPitcherId,
            pitcherId
        )

        assert.equal(
            designatedHitter.currentPosition,
            undefined
        )

        assert.equal(
            designatedHitter.lineupIndex,
            undefined
        )

        assert.equal(
            incomingHitter.currentPosition,
            Position.DESIGNATED_HITTER
        )

        assert.equal(
            incomingHitter.lineupIndex,
            lineupIndex
        )
    })

    it("should get a late-game pinch hitter for the designated hitter", () => {
        const game = buildDHGame("next-hitter-for-dh")
        const offense = game.away
        const defense = game.home

        const designatedHitter = offense.players.find(
            player => player.currentPosition === Position.DESIGNATED_HITTER
        )

        const defensivePitcher = defense.players.find(
            player => player._id === defense.currentPitcherId
        )

        const benchHitter = getBenchPositionPlayer(offense)

        assert.ok(designatedHitter)
        assert.ok(defensivePitcher)
        assert.ok(benchHitter)
        assert.ok(designatedHitter.lineupIndex !== undefined)

        offense.currentHitterIndex = designatedHitter.lineupIndex

        game.currentInning = 8
        game.score.away = 2
        game.score.home = 4

        for (const player of offense.players) {
            if (offense.lineupIds.includes(player._id)) continue
            if (player._id === offense.currentPitcherId) continue
            if (player.positions.includes(Position.PITCHER)) continue

            setHitterMatchupRatings(
                player,
                defensivePitcher,
                1
            )
        }

        setHitterMatchupRatings(
            designatedHitter,
            defensivePitcher,
            40
        )

        setHitterMatchupRatings(
            benchHitter,
            defensivePitcher,
            70
        )

        const nextHitter = substitutionService.getNextHitter(
            game,
            offense,
            defense
        )

        assert.ok(nextHitter)
        assert.equal(nextHitter._id, benchHitter._id)
    })    

    it("should automatically replace the DH without changing pitchers", () => {
        const game = buildDHGame("automatic-dh-change")
        const offense = game.away
        const defense = game.home

        const designatedHitter = offense.players.find(
            player => player.currentPosition === Position.DESIGNATED_HITTER
        )

        const defensivePitcher = defense.players.find(
            player => player._id === defense.currentPitcherId
        )

        const benchHitter = getBenchPositionPlayer(offense)

        assert.ok(designatedHitter)
        assert.ok(defensivePitcher)
        assert.ok(benchHitter)
        assert.ok(designatedHitter.lineupIndex !== undefined)

        offense.currentHitterIndex = designatedHitter.lineupIndex

        game.currentInning = 8
        game.score.away = 2
        game.score.home = 4

        for (const player of offense.players) {
            if (offense.lineupIds.includes(player._id)) continue
            if (player._id === offense.currentPitcherId) continue
            if (player.positions.includes(Position.PITCHER)) continue

            setHitterMatchupRatings(
                player,
                defensivePitcher,
                1
            )
        }

        setHitterMatchupRatings(
            designatedHitter,
            defensivePitcher,
            40
        )

        setHitterMatchupRatings(
            benchHitter,
            defensivePitcher,
            70
        )

        const originalPitcherId = offense.currentPitcherId
        const lineupIndex = designatedHitter.lineupIndex

        const nextHitter = substitutionService.getNextHitter(
            game,
            offense,
            defense
        )

        assert.ok(nextHitter)

        substitutionService.changeHitter(
            game,
            offense,
            designatedHitter._id,
            nextHitter._id,
            1
        )

        assert.equal(
            offense.currentPitcherId,
            originalPitcherId
        )

        assert.equal(
            offense.lineupIds[lineupIndex],
            benchHitter._id
        )

        assert.equal(
            benchHitter.currentPosition,
            Position.DESIGNATED_HITTER
        )

        assert.equal(
            game.substitutions[0].requiresPitcherChange,
            false
        )
    })

    it("should not allow a pitcher to replace the designated hitter", () => {
        const game = buildDHGame("pitcher-cannot-replace-dh")
        const team = game.away

        const designatedHitter = team.players.find(
            player => player.currentPosition === Position.DESIGNATED_HITTER
        )

        const benchPitcher = substitutionService.getAvailablePitchers(
            game,
            team
        )[0]

        assert.ok(designatedHitter)
        assert.ok(benchPitcher)

        assert.throws(
            () => substitutionService.changeHitter(
                game,
                team,
                designatedHitter._id,
                benchPitcher._id,
                1
            ),
            /cannot play DH./i
        )
    })

    it("should complete a full DH game without either starting pitcher batting", () => {
        const game = buildDHGame("complete-full-dh-game")
        const rng = seedrandom("complete-full-dh-game")

        const awayStartingPitcherId = game.away.currentPitcherId
        const homeStartingPitcherId = game.home.currentPitcherId

        let steps = 0

        while (!game.isComplete && steps < 5000) {
            simService.simPitch(game, rng)
            steps++
        }

        assert.equal(game.isComplete, true)
        assert.ok(steps > 0)
        assert.ok(steps < 5000)

        const awayStartingPitcher = game.away.players.find(
            player => player._id === awayStartingPitcherId
        )

        const homeStartingPitcher = game.home.players.find(
            player => player._id === homeStartingPitcherId
        )

        assert.ok(awayStartingPitcher)
        assert.ok(homeStartingPitcher)

        assert.equal(awayStartingPitcher.hitResult.pa, 0)
        assert.equal(homeStartingPitcher.hitResult.pa, 0)

        assert.equal(game.away.lineupIds.includes(awayStartingPitcherId), false)
        assert.equal(game.home.lineupIds.includes(homeStartingPitcherId), false)

        assert.equal(game.away.lineupIds.length, 9)
        assert.equal(game.home.lineupIds.length, 9)
    })

    it("should complete a full DH game without either starting pitcher batting", () => {
        const game = buildDHGame("complete-full-dh-game")
        const rng = seedrandom("complete-full-dh-game")

        const awayStartingPitcherId = game.away.currentPitcherId
        const homeStartingPitcherId = game.home.currentPitcherId

        let steps = 0

        while (!game.isComplete && steps < 5000) {
            simService.simPitch(game, rng)
            steps++
        }

        assert.equal(game.isComplete, true)
        assert.ok(steps > 0)
        assert.ok(steps < 5000)

        const awayStartingPitcher = game.away.players.find(
            player => player._id === awayStartingPitcherId
        )

        const homeStartingPitcher = game.home.players.find(
            player => player._id === homeStartingPitcherId
        )

        assert.ok(awayStartingPitcher)
        assert.ok(homeStartingPitcher)

        assert.equal(awayStartingPitcher.hitResult.pa, 0)
        assert.equal(homeStartingPitcher.hitResult.pa, 0)

        assert.equal(game.away.lineupIds.includes(awayStartingPitcherId), false)
        assert.equal(game.home.lineupIds.includes(homeStartingPitcherId), false)

        assert.equal(game.away.lineupIds.length, 9)
        assert.equal(game.home.lineupIds.length, 9)
    })

    it("should maintain a valid defensive pitcher throughout a DH game", () => {
        const game = buildDHGame("dh-valid-defense")
        const rng = seedrandom("dh-valid-defense")

        let steps = 0

        while (!game.isComplete && steps < 5000) {
            const defense = game.isTopInning
                ? game.home
                : game.away

            const pitcher = defense.players.find(
                player => player._id === defense.currentPitcherId
            )

            assert.ok(pitcher)
            assert.ok(pitcher.pitchRatings)

            const nonPitcherDefenders = defense.players.filter(player =>
                player.currentPosition !== undefined &&
                player.currentPosition !== Position.DESIGNATED_HITTER &&
                player._id !== defense.currentPitcherId
            )

            assert.equal(nonPitcherDefenders.length, 8)

            assert.equal(
                nonPitcherDefenders.some(
                    player => player.currentPosition === Position.DESIGNATED_HITTER
                ),
                false
            )

            simService.simPitch(game, rng)
            steps++
        }

        assert.equal(game.isComplete, true)
        assert.ok(steps < 5000)
    })

    it("should let a two-way starter accumulate both hitting and pitching stats", () => {
        const game = buildTwoWayDHGame("two-way-hitting-and-pitching")
        const rng = seedrandom("two-way-hitting-and-pitching")

        const twoWayPlayer = game.away.players.find(
            player => player._id === "two-way-1"
        )

        assert.ok(twoWayPlayer)
        assert.equal(game.away.currentPitcherId, twoWayPlayer._id)
        assert.equal(twoWayPlayer.currentPosition, Position.DESIGNATED_HITTER)

        let steps = 0

        while (!game.isComplete && steps < 5000) {
            simService.simPitch(game, rng)
            steps++
        }

        assert.equal(game.isComplete, true)

        assert.ok(twoWayPlayer.hitResult.pa > 0)
        assert.ok(twoWayPlayer.pitchResult.battersFaced > 0)
        assert.ok(twoWayPlayer.pitchResult.pitches > 0)
    })

    it("should award the win to a pitcher of record who is currently the designated hitter", () => {
        const game = buildTwoWayDHGame("two-way-winning-pitcher")
        const twoWayPlayer = game.away.players.find(
            player => player._id === game.away.currentPitcherId
        )

        assert.ok(twoWayPlayer)
        assert.equal(twoWayPlayer.currentPosition, Position.DESIGNATED_HITTER)

        for (const player of game.away.players) {
            player.isPitcherOfRecord = false
        }

        for (const player of game.home.players) {
            player.isPitcherOfRecord = false
        }

        twoWayPlayer.isPitcherOfRecord = true

        const losingPitcher = game.home.players.find(
            player => player._id === game.home.currentPitcherId
        )

        assert.ok(losingPitcher)

        losingPitcher.isPitcherOfRecord = true

        game.score.away = 5
        game.score.home = 3

        simService.finishGame(game)

        assert.equal(game.winningTeamId, game.away._id)
        assert.equal(game.losingTeamId, game.home._id)

        assert.equal(game.winningPitcherId, twoWayPlayer._id)
        assert.equal(game.losingPitcherId, losingPitcher._id)

        assert.equal(twoWayPlayer.pitchResult.wins, 1)
        assert.equal(losingPitcher.pitchResult.losses, 1)

        assert.equal(game.isFinished, true)
    })

    it("should award the loss to a pitcher of record who is currently the designated hitter", () => {
        const game = buildTwoWayDHGame("two-way-losing-pitcher")
        const twoWayPlayer = game.away.players.find(
            player => player._id === game.away.currentPitcherId
        )

        assert.ok(twoWayPlayer)
        assert.equal(twoWayPlayer.currentPosition, Position.DESIGNATED_HITTER)

        for (const player of game.away.players) {
            player.isPitcherOfRecord = false
        }

        for (const player of game.home.players) {
            player.isPitcherOfRecord = false
        }

        twoWayPlayer.isPitcherOfRecord = true

        const winningPitcher = game.home.players.find(
            player => player._id === game.home.currentPitcherId
        )

        assert.ok(winningPitcher)

        winningPitcher.isPitcherOfRecord = true

        game.score.away = 2
        game.score.home = 4

        simService.finishGame(game)

        assert.equal(game.winningTeamId, game.home._id)
        assert.equal(game.losingTeamId, game.away._id)

        assert.equal(game.winningPitcherId, winningPitcher._id)
        assert.equal(game.losingPitcherId, twoWayPlayer._id)

        assert.equal(winningPitcher.pitchResult.wins, 1)
        assert.equal(twoWayPlayer.pitchResult.losses, 1)

        assert.equal(game.isFinished, true)
    })    

})