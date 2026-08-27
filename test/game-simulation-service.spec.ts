import { strict as assert } from "assert"

import { describe, it } from "mocha"

import {
    GameSimulationService
} from "../src/presentation/services/game-simulation-service.js"

import type {
    Game,
    StartGameCommand
} from "../src/sim/service/interfaces.js"


describe("GameSimulationService", function () {

    it("creates a started game with a UUID without simulating it", function () {
        const service = createService()
        const command = createCommand()

        const game = service.createGame(command)

        assert.match(
            game._id,
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        )

        assert.equal(game.isComplete, false)
        assert.equal(game.away._id, "away")
        assert.equal(game.home._id, "home")
        assert.equal(game.away.players.length, 2)
        assert.equal(game.home.players.length, 2)
    })

    it("simulates games and builds the aggregate summary", function () {
        const service = createService()
        const command = createCommand()

        const result = service.simulateMany(command, 3)

        assert.equal(result.summary.gameId, "game")
        assert.equal(result.summary.simulations, 3)
        assert.equal(result.summary.awayWins, 2)
        assert.equal(result.summary.homeWins, 1)
        assert.equal(result.summary.awayWinPercent, 2 / 3)
        assert.equal(result.summary.homeWinPercent, 1 / 3)
        assert.equal(result.summary.averageAwayScore, 4)
        assert.equal(result.summary.averageHomeScore, 10 / 3)
        assert.equal(result.summary.averageInnings, 9)
        assert.equal(result.summary.awayTeamId, "away")
        assert.equal(result.summary.homeTeamId, "home")

        const hitter = result.summary.players.find(player => player.playerId === "away-hitter")
        const pitcher = result.summary.players.find(player => player.playerId === "away-pitcher")

        assert.ok(hitter)
        assert.ok(pitcher)

        assert.equal(hitter.hittingGames, 3)
        assert.equal(hitter.homeRunGames, 2)
        assert.equal(hitter.hitting.pa, 12)
        assert.equal(hitter.hitting.hits, 3)
        assert.equal(hitter.hitting.homeRuns, 2)

        assert.equal(pitcher.pitchingGames, 3)
        assert.equal(pitcher.pitching.pitches, 60)
        assert.equal(pitcher.pitching.battersFaced, 15)

        assert.equal(result.games, undefined)
    })

    it("retains completed games with unique UUIDs when requested", function () {
        const service = createService()
        const command = createCommand()

        const result = service.simulateMany(command, 3, {
            retainGames: true
        })

        assert.ok(result.games)
        assert.equal(result.games.length, 3)

        for (const game of result.games) {
            assert.match(
                game._id,
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            )

            assert.equal(game.isComplete, true)
        }

        assert.equal(
            new Set(result.games.map(game => game._id)).size,
            3
        )
    })

    it("merges partial summaries from separate simulation batches", function () {
        const service = createService()
        const command = createCommand()

        const first = service.simulateIndexes(command, [0, 2], {
            gameId: "game",
            seedPrefix: "test"
        })

        const second = service.simulateIndexes(command, [1, 3], {
            gameId: "game",
            seedPrefix: "test"
        })

        const summary = service.mergePartialSummaries(
            command,
            "game",
            4,
            [
                first.summary,
                second.summary
            ]
        )

        assert.equal(summary.simulations, 4)
        assert.equal(summary.awayWins, 2)
        assert.equal(summary.homeWins, 2)
        assert.equal(summary.awayWinPercent, 0.5)
        assert.equal(summary.homeWinPercent, 0.5)
        assert.equal(summary.averageAwayScore, 3.5)
        assert.equal(summary.averageHomeScore, 3.5)

        const hitter = summary.players.find(player => player.playerId === "away-hitter")

        assert.ok(hitter)
        assert.equal(hitter.hittingGames, 4)
        assert.equal(hitter.homeRunGames, 2)
        assert.equal(hitter.hitting.pa, 16)
    })

    it("rejects an invalid simulation count", function () {
        const service = createService()
        const command = createCommand()

        assert.throws(
            () => service.simulateMany(command, 0),
            /Simulation count must be a positive integer/
        )

        assert.throws(
            () => service.simulateMany(command, 1.5),
            /Simulation count must be a positive integer/
        )
    })

})


function createService(): GameSimulationService {
    return new GameSimulationService(
        new TestSimService() as any
    )
}


function createCommand(): StartGameCommand {
    return {
        game: {
            _id: "game"
        } as Game,

        away: {
            _id: "away",
            name: "Away Team",
            abbrev: "AWY"
        } as any,

        awayTeamOptions: {},

        awayPlayers: [
            {
                _id: "away-hitter",
                fullName: "Away Hitter",
                primaryPosition: "RF",
                hittingRatings: {
                    speed: 100
                }
            },
            {
                _id: "away-pitcher",
                fullName: "Away Pitcher",
                primaryPosition: "P",
                pitchRatings: {
                    power: 100
                }
            }
        ] as any,

        awayLineup: {
            order: []
        } as any,

        awayStartingPitcher: {
            _id: "away-pitcher"
        } as any,

        awayAvailablePitchers: [],

        home: {
            _id: "home",
            name: "Home Team",
            abbrev: "HME"
        } as any,

        homeTeamOptions: {},

        homePlayers: [
            {
                _id: "home-hitter",
                fullName: "Home Hitter",
                primaryPosition: "1B",
                hittingRatings: {
                    speed: 100
                }
            },
            {
                _id: "home-pitcher",
                fullName: "Home Pitcher",
                primaryPosition: "P",
                pitchRatings: {
                    power: 100
                }
            }
        ] as any,

        homeLineup: {
            order: []
        } as any,

        homeStartingPitcher: {
            _id: "home-pitcher"
        } as any,

        homeAvailablePitchers: [],

        pitchEnvironmentTarget: {} as any,

        useDH: true,
        date: new Date("2026-08-24T12:00:00.000Z")
    }
}


class TestSimService {

    private simulationIndex = 0


    public initGame(game: any): void {
        game.score = {
            away: 0,
            home: 0
        }

        game.currentInning = 1
        game.isComplete = false
    }


    public startGame(command: any): void {
        const game = command.game

        game.away = {
            ...structuredClone(command.away),
            players: structuredClone(command.awayPlayers)
        }

        game.home = {
            ...structuredClone(command.home),
            players: structuredClone(command.homePlayers)
        }

        game.testSimulationIndex = this.simulationIndex++
    }


    public simPitch(game: any): void {
        const simulationIndex = game.testSimulationIndex

        if (simulationIndex % 2 === 0) {
            game.score.away = 5
            game.score.home = 3
        } else {
            game.score.away = 2
            game.score.home = 4
        }

        game.currentInning = 9

        const awayHitter = game.away.players.find(player => player._id === "away-hitter")
        const awayPitcher = game.away.players.find(player => player._id === "away-pitcher")
        const homeHitter = game.home.players.find(player => player._id === "home-hitter")
        const homePitcher = game.home.players.find(player => player._id === "home-pitcher")

        awayHitter.hitResult = {
            pa: 4,
            hits: 1,
            homeRuns: simulationIndex % 2 === 0 ? 1 : 0
        }

        homeHitter.hitResult = {
            pa: 4,
            hits: 1,
            homeRuns: 0
        }

        awayPitcher.pitchResult = {
            pitches: 20,
            battersFaced: 5,
            so: 2
        }

        homePitcher.pitchResult = {
            pitches: 20,
            battersFaced: 5,
            so: 2
        }

        game.isComplete = true
    }


    public finishGame(_game: any): void {}

}