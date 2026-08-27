import { strict as assert } from "assert"

import { describe, it } from "mocha"

import type seedrandom from "seedrandom"

import type {
    Game,
    StartGameCommand
} from "../src/sim/service/interfaces.js"

import {
    GamePlaybackService
} from "../src/presentation/services/game-playback-service.js"

import {
    SimService
} from "../src/sim/service/sim-service.js"


describe("GamePlaybackService", function () {

    it("initializes and starts a new game with a UUID", function () {
        const command = buildCommand()
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        const game = service.start(command, {
            automatic: false
        })

        assert.match(game._id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        assert.equal(service.getGame(), game)
        assert.equal(simService.initGameCalls.length, 1)
        assert.equal(simService.initGameCalls[0], game)
        assert.equal(simService.startGameCalls.length, 1)
        assert.equal(simService.startGameCalls[0].game, game)
        assert.notEqual(game, command.game)
    })

    it("calls the initial update callback when the game starts", function () {
        const updates: Game[] = []
        const service = new GamePlaybackService(buildSimService())

        const game = service.start(buildCommand(), {
            automatic: false,
            onUpdate: updatedGame => updates.push(updatedGame)
        })

        assert.deepEqual(updates, [game])
    })

    it("is automatic by default", function () {
        const service = new GamePlaybackService(buildSimService())

        service.start(buildCommand(), {
            pitchIntervalMs: 100000
        })

        assert.equal(service.isAutomatic(), true)

        service.stop()
    })

    it("can start in manual mode", function () {
        const service = new GamePlaybackService(buildSimService())

        service.start(buildCommand(), {
            automatic: false
        })

        assert.equal(service.isAutomatic(), false)
    })

    it("advances the game by one pitch", function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        const game = service.start(buildCommand(), {
            automatic: false
        })

        const result = service.advance()

        assert.equal(result, game)
        assert.equal(simService.simPitchCalls.length, 1)
        assert.equal(simService.simPitchCalls[0].game, game)
        assert.ok(simService.simPitchCalls[0].rng)
    })

    it("uses the supplied random number generator", function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)
        const rng = (() => 0.5) as seedrandom.PRNG

        service.start(buildCommand(), {
            automatic: false,
            rng
        })

        service.advance()

        assert.equal(simService.simPitchCalls[0].rng, rng)
    })

    it("uses a seeded random number generator when one is not supplied", function () {
        const firstSimService = buildSimService()
        const secondSimService = buildSimService()
        const firstService = new GamePlaybackService(firstSimService)
        const secondService = new GamePlaybackService(secondSimService)

        firstService.start(buildCommand(), {
            automatic: false,
            seed: "test-seed"
        })

        secondService.start(buildCommand(), {
            automatic: false,
            seed: "test-seed"
        })

        firstService.advance()
        secondService.advance()

        assert.equal(firstSimService.simPitchCalls[0].rng(), secondSimService.simPitchCalls[0].rng())
    })

    it("calls the update callback after advancing", function () {
        const updates: Game[] = []
        const service = new GamePlaybackService(buildSimService())

        const game = service.start(buildCommand(), {
            automatic: false,
            onUpdate: updatedGame => updates.push(updatedGame)
        })

        service.advance()

        assert.deepEqual(updates, [
            game,
            game
        ])
    })

    it("finishes the game when the simulated pitch completes it", function () {
        const simService = buildSimService({
            simPitch: game => {
                game.isComplete = true
            },
            finishGame: game => {
                game.isFinished = true
            }
        })

        const service = new GamePlaybackService(simService)

        const game = service.start(buildCommand(), {
            automatic: false
        })

        service.advance()

        assert.equal(simService.simPitchCalls.length, 1)
        assert.equal(simService.finishGameCalls.length, 1)
        assert.equal(simService.finishGameCalls[0], game)
        assert.equal(game.isComplete, true)
        assert.equal(game.isFinished, true)
    })

    it("calls the completion callback after finishing the game", function () {
        const completedGames: Game[] = []

        const simService = buildSimService({
            simPitch: game => {
                game.isComplete = true
            },
            finishGame: game => {
                game.isFinished = true
            }
        })

        const service = new GamePlaybackService(simService)

        const game = service.start(buildCommand(), {
            automatic: false,
            onComplete: completedGame => completedGames.push(completedGame)
        })

        service.advance()

        assert.deepEqual(completedGames, [game])
    })

    it("finishes a complete game without simulating another pitch", function () {
        const simService = buildSimService({
            startGame: command => {
                command.game.isStarted = true
                command.game.isComplete = true
                command.game.isFinished = false

                return command.game
            },
            finishGame: game => {
                game.isFinished = true
            }
        })

        const service = new GamePlaybackService(simService)

        service.start(buildCommand(), {
            automatic: false
        })

        service.advance()

        assert.equal(simService.simPitchCalls.length, 0)
        assert.equal(simService.finishGameCalls.length, 1)
    })

    it("does not advance an already finished game", function () {
        const simService = buildSimService({
            startGame: command => {
                command.game.isStarted = true
                command.game.isComplete = true
                command.game.isFinished = true

                return command.game
            }
        })

        const service = new GamePlaybackService(simService)

        const game = service.start(buildCommand(), {
            automatic: false
        })

        const result = service.advance()

        assert.equal(result, game)
        assert.equal(simService.simPitchCalls.length, 0)
        assert.equal(simService.finishGameCalls.length, 0)
    })

    it("throws when advancing before playback has started", function () {
        const service = new GamePlaybackService(buildSimService())

        assert.throws(
            () => service.advance(),
            /Game playback has not been started/
        )
    })

    it("automatically advances after the configured interval", async function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        service.start(buildCommand(), {
            pitchIntervalMs: 5
        })

        await waitFor(() => simService.simPitchCalls.length >= 1)

        service.stop()

        assert.equal(simService.simPitchCalls.length >= 1, true)
    })

    it("continues automatically until the game finishes", async function () {
        let pitches = 0

        const simService = buildSimService({
            simPitch: game => {
                pitches++

                if (pitches === 3) {
                    game.isComplete = true
                }
            },
            finishGame: game => {
                game.isFinished = true
            }
        })

        const service = new GamePlaybackService(simService)

        const game = service.start(buildCommand(), {
            pitchIntervalMs: 1
        })

        await waitFor(() => game.isFinished)

        assert.equal(simService.simPitchCalls.length, 3)
        assert.equal(simService.finishGameCalls.length, 1)
        assert.equal(service.getGame(), game)
    })

    it("pauses automatic playback", async function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        service.start(buildCommand(), {
            pitchIntervalMs: 20
        })

        service.pause()

        await delay(40)

        assert.equal(service.isPaused(), true)
        assert.equal(simService.simPitchCalls.length, 0)

        service.stop()
    })

    it("resumes automatic playback", async function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        service.start(buildCommand(), {
            pitchIntervalMs: 5
        })

        service.pause()

        assert.equal(service.isPaused(), true)

        service.resume()

        assert.equal(service.isPaused(), false)

        await waitFor(() => simService.simPitchCalls.length >= 1)

        service.stop()
    })

    it("does not resume a finished game", async function () {
        const simService = buildSimService({
            startGame: command => {
                command.game.isStarted = true
                command.game.isComplete = true
                command.game.isFinished = true

                return command.game
            }
        })

        const service = new GamePlaybackService(simService)

        service.start(buildCommand(), {
            pitchIntervalMs: 1
        })

        service.pause()
        service.resume()

        await delay(10)

        assert.equal(simService.simPitchCalls.length, 0)
    })

    it("does not resume automatic playback when automatic mode is disabled", async function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        service.start(buildCommand(), {
            automatic: false,
            pitchIntervalMs: 1
        })

        service.pause()
        service.resume()

        await delay(10)

        assert.equal(simService.simPitchCalls.length, 0)
    })

    it("stops automatic playback without discarding the game", async function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        const game = service.start(buildCommand(), {
            pitchIntervalMs: 20
        })

        service.stop()

        await delay(40)

        assert.equal(service.getGame(), game)
        assert.equal(service.isAutomatic(), false)
        assert.equal(service.isPaused(), false)
        assert.equal(simService.simPitchCalls.length, 0)
    })

    it("allows manual advancement after automatic playback is stopped", function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        const game = service.start(buildCommand(), {
            pitchIntervalMs: 100000
        })

        service.stop()
        service.advance()

        assert.equal(simService.simPitchCalls.length, 1)
        assert.equal(service.getGame(), game)
    })

    it("enables automatic playback after starting manually", async function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        service.start(buildCommand(), {
            automatic: false,
            pitchIntervalMs: 5
        })

        service.setAutomatic(true)

        await waitFor(() => simService.simPitchCalls.length >= 1)

        service.stop()

        assert.equal(service.isAutomatic(), false)
    })

    it("disables automatic playback", async function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        const game = service.start(buildCommand(), {
            pitchIntervalMs: 20
        })

        service.setAutomatic(false)

        await delay(40)

        assert.equal(service.isAutomatic(), false)
        assert.equal(simService.simPitchCalls.length, 0)
        assert.equal(service.getGame(), game)
    })

    it("changes the automatic pitch interval", async function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        service.start(buildCommand(), {
            pitchIntervalMs: 100000
        })

        service.setPitchInterval(1)

        await waitFor(() => simService.simPitchCalls.length >= 1)

        service.stop()
    })

    it("rejects an invalid pitch interval", function () {
        const service = new GamePlaybackService(buildSimService())

        assert.throws(
            () => service.setPitchInterval(-1),
            /Invalid game playback interval/
        )

        assert.throws(
            () => service.setPitchInterval(Number.NaN),
            /Invalid game playback interval/
        )
    })

    it("reset discards the current game", function () {
        const service = new GamePlaybackService(buildSimService())

        const game = service.start(buildCommand(), {
            automatic: false
        })

        assert.equal(service.getGame(), game)

        service.reset()

        assert.equal(service.getGame(), undefined)
        assert.equal(service.isAutomatic(), true)
        assert.equal(service.isPaused(), false)
    })

    it("reset stops scheduled playback", async function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        service.start(buildCommand(), {
            pitchIntervalMs: 20
        })

        service.reset()

        await delay(40)

        assert.equal(simService.simPitchCalls.length, 0)
        assert.equal(service.getGame(), undefined)
    })

    it("starting another game resets the previous playback", function () {
        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        const firstGame = service.start(buildCommand(), {
            automatic: false
        })

        const secondGame = service.start(buildCommand(), {
            automatic: false
        })

        assert.notEqual(firstGame._id, secondGame._id)
        assert.equal(service.getGame(), secondGame)
        assert.equal(simService.initGameCalls.length, 2)
        assert.equal(simService.startGameCalls.length, 2)
    })


    it("returns the current random number generator state", function () {
        const service = new GamePlaybackService(buildSimService())

        service.start(buildCommand(), {
            automatic: false,
            seed: "test-seed"
        })

        const state = service.getPlaybackState()

        assert.ok(state.rngState)
    })

    it("throws when getting playback state before playback has started", function () {
        const service = new GamePlaybackService(buildSimService())

        assert.throws(
            () => service.getPlaybackState(),
            /Game playback has not been started/
        )
    })

    it("loads an existing game without initializing or starting it", function () {
        const sourceService = new GamePlaybackService(buildSimService())

        const game = sourceService.start(buildCommand(), {
            automatic: false,
            seed: "test-seed"
        })

        sourceService.advance()

        const playbackState = sourceService.getPlaybackState()

        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        const result = service.load(
            game,
            playbackState,
            {
                automatic: false
            }
        )

        assert.equal(result, game)
        assert.equal(service.getGame(), game)
        assert.equal(simService.initGameCalls.length, 0)
        assert.equal(simService.startGameCalls.length, 0)
    })

    it("calls the update callback when loading an existing game", function () {
        const sourceService = new GamePlaybackService(buildSimService())

        const game = sourceService.start(buildCommand(), {
            automatic: false,
            seed: "test-seed"
        })

        const playbackState = sourceService.getPlaybackState()
        const updates: Game[] = []

        const service = new GamePlaybackService(buildSimService())

        service.load(
            game,
            playbackState,
            {
                automatic: false,
                onUpdate: updatedGame => updates.push(updatedGame)
            }
        )

        assert.deepEqual(updates, [
            game
        ])
    })

    it("continues the same random number sequence after loading", function () {
        const firstSimService = buildSimService()
        const firstService = new GamePlaybackService(firstSimService)

        const firstGame = firstService.start(buildCommand(), {
            automatic: false,
            seed: "test-seed"
        })

        firstService.advance()
        firstService.advance()

        const playbackState = firstService.getPlaybackState()
        const savedGame = structuredClone(firstGame)

        firstService.advance()

        const expectedRng = firstSimService.simPitchCalls[2].rng
        const expectedValue = expectedRng()

        const secondSimService = buildSimService()
        const secondService = new GamePlaybackService(secondSimService)

        secondService.load(
            savedGame,
            playbackState,
            {
                automatic: false
            }
        )

        secondService.advance()

        const actualRng = secondSimService.simPitchCalls[0].rng
        const actualValue = actualRng()

        assert.equal(actualValue, expectedValue)
    })

    it("restores playback state in another service instance", function () {
        const firstValues: number[] = []

        const firstSimService = buildSimService({
            simPitch: (game, rng) => {
                firstValues.push(rng())
            }
        })

        const firstService = new GamePlaybackService(firstSimService)

        const game = firstService.start(buildCommand(), {
            automatic: false,
            seed: "cross-browser-seed"
        })

        firstService.advance()
        firstService.advance()

        const playbackState = firstService.getPlaybackState()
        const savedGame = structuredClone(game)

        firstService.advance()

        const expectedValue = firstValues[2]

        const secondValues: number[] = []

        const secondSimService = buildSimService({
            simPitch: (loadedGame, rng) => {
                secondValues.push(rng())
            }
        })

        const secondService = new GamePlaybackService(secondSimService)

        secondService.load(
            savedGame,
            playbackState,
            {
                automatic: false
            }
        )

        secondService.advance()

        assert.equal(secondValues[0], expectedValue)
    })

    it("automatically continues a loaded game", async function () {
        const sourceService = new GamePlaybackService(buildSimService())

        const game = sourceService.start(buildCommand(), {
            automatic: false,
            seed: "test-seed"
        })

        const playbackState = sourceService.getPlaybackState()

        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        service.load(
            game,
            playbackState,
            {
                pitchIntervalMs: 1
            }
        )

        await waitFor(() => simService.simPitchCalls.length >= 1)

        service.stop()

        assert.equal(simService.simPitchCalls.length >= 1, true)
    })

    it("does not automatically continue a finished loaded game", async function () {
        const sourceService = new GamePlaybackService(buildSimService())

        const game = sourceService.start(buildCommand(), {
            automatic: false,
            seed: "test-seed"
        })

        const playbackState = sourceService.getPlaybackState()

        game.isComplete = true
        game.isFinished = true

        const simService = buildSimService()
        const service = new GamePlaybackService(simService)

        service.load(
            game,
            playbackState,
            {
                pitchIntervalMs: 1
            }
        )

        await delay(10)

        assert.equal(simService.simPitchCalls.length, 0)
    })



})


interface SimServiceOverrides {
    initGame?: (game: Game) => void
    startGame?: (command: StartGameCommand) => Game
    simPitch?: (game: Game, rng: seedrandom.PRNG) => void
    finishGame?: (game: Game) => void
}


interface SimServiceStub extends SimService {
    initGameCalls: Game[]
    startGameCalls: StartGameCommand[]
    simPitchCalls: Array<{
        game: Game
        rng: seedrandom.PRNG
    }>
    finishGameCalls: Game[]
}


function buildSimService(overrides: SimServiceOverrides = {}): SimServiceStub {
    const initGameCalls: Game[] = []
    const startGameCalls: StartGameCommand[] = []
    const simPitchCalls: Array<{ game: Game, rng: seedrandom.PRNG }> = []
    const finishGameCalls: Game[] = []

    return {
        initGameCalls,
        startGameCalls,
        simPitchCalls,
        finishGameCalls,

        initGame(game: Game): void {
            initGameCalls.push(game)
            overrides.initGame?.(game)
        },

        startGame(command: StartGameCommand): Game {
            startGameCalls.push(command)

            if (overrides.startGame) {
                return overrides.startGame(command)
            }

            command.game.isStarted = true
            command.game.isComplete = false
            command.game.isFinished = false

            return command.game
        },

        simPitch(game: Game, rng: seedrandom.PRNG): void {
            simPitchCalls.push({
                game,
                rng
            })

            overrides.simPitch?.(game, rng)
        },

        finishGame(game: Game): void {
            finishGameCalls.push(game)

            if (overrides.finishGame) {
                overrides.finishGame(game)
                return
            }

            game.isFinished = true
        }
    } as unknown as SimServiceStub
}


function buildCommand(): StartGameCommand {
    return {
        game: {
            _id: "source-game"
        } as Game,

        home: {
            _id: "home"
        },
        homeTeamOptions: {},
        homePlayers: [],
        homeLineup: {
            order: [],
            valid: true
        },
        homeStartingPitcher: {
            _id: "home-pitcher"
        },
        homeAvailablePitchers: [],

        away: {
            _id: "away"
        },
        awayTeamOptions: {},
        awayPlayers: [],
        awayLineup: {
            order: [],
            valid: true
        },
        awayStartingPitcher: {
            _id: "away-pitcher"
        },
        awayAvailablePitchers: [],

        useDH: true,
        date: new Date("2026-08-21T12:00:00.000Z")
    } as StartGameCommand
}


async function waitFor(condition: () => boolean, timeout = 500): Promise<void> {
    const start = Date.now()

    while (!condition()) {
        if (Date.now() - start > timeout) {
            throw new Error("Timed out waiting for condition.")
        }

        await delay(1)
    }
}


async function delay(milliseconds: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, milliseconds))
}