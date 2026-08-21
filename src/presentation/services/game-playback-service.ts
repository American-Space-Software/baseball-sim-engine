import seedrandom from "seedrandom"

import type {
    Game,
    StartGameCommand
} from "../../sim/service/interfaces.js"

import {
    SimService
} from "../../sim/service/sim-service.js"


const DEFAULT_PITCH_INTERVAL_MS = 15000


class GamePlaybackService {

    private game?: Game
    private rng?: seedrandom.PRNG
    private timer?: ReturnType<typeof setTimeout>
    private pitchIntervalMs = DEFAULT_PITCH_INTERVAL_MS
    private automatic = true
    private paused = false
    private onUpdate?: GamePlaybackUpdate
    private onComplete?: GamePlaybackComplete

    public constructor(private readonly simService: SimService) {}

    public start(command: StartGameCommand, options: GamePlaybackOptions = {}): Game {
        this.reset()

        this.pitchIntervalMs = options.pitchIntervalMs ?? DEFAULT_PITCH_INTERVAL_MS
        this.automatic = options.automatic ?? true
        this.paused = false
        this.onUpdate = options.onUpdate
        this.onComplete = options.onComplete
        this.rng = options.rng ?? seedrandom(options.seed)

        this.simService.initGame(command.game)
        this.game = this.simService.startGame(command)

        this.onUpdate?.(this.game)

        if (this.automatic) {
            this.scheduleNextPitch()
        }

        return this.game
    }

    public advance(): Game {
        if (!this.game || !this.rng) {
            throw new Error("Game playback has not been started.")
        }

        if (this.game.isFinished) {
            return this.game
        }

        if (!this.game.isComplete) {
            this.simService.simPitch(this.game, this.rng)
        }

        if (this.game.isComplete && !this.game.isFinished) {
            this.simService.finishGame(this.game)
        }

        this.onUpdate?.(this.game)

        if (this.game.isFinished) {
            this.clearTimer()
            this.onComplete?.(this.game)
        }

        return this.game
    }

    public pause(): void {
        this.paused = true
        this.clearTimer()
    }

    public resume(): void {
        if (!this.game || this.game.isFinished || !this.automatic) {
            return
        }

        this.paused = false
        this.scheduleNextPitch()
    }

    public stop(): void {
        this.clearTimer()
        this.automatic = false
        this.paused = false
    }

    public reset(): void {
        this.clearTimer()
        this.game = undefined
        this.rng = undefined
        this.onUpdate = undefined
        this.onComplete = undefined
        this.pitchIntervalMs = DEFAULT_PITCH_INTERVAL_MS
        this.automatic = true
        this.paused = false
    }

    public setAutomatic(automatic: boolean): void {
        this.automatic = automatic
        this.clearTimer()

        if (automatic && this.game && !this.game.isFinished && !this.paused) {
            this.scheduleNextPitch()
        }
    }

    public setPitchInterval(milliseconds: number): void {
        if (!Number.isFinite(milliseconds) || milliseconds < 0) {
            throw new Error(`Invalid game playback interval: ${milliseconds}.`)
        }

        this.pitchIntervalMs = milliseconds

        if (this.automatic && this.game && !this.game.isFinished && !this.paused) {
            this.clearTimer()
            this.scheduleNextPitch()
        }
    }

    public getGame(): Game | undefined {
        return this.game
    }

    public isAutomatic(): boolean {
        return this.automatic
    }

    public isPaused(): boolean {
        return this.paused
    }

    private scheduleNextPitch(): void {
        if (!this.game || this.game.isFinished || this.paused || !this.automatic || this.timer) {
            return
        }

        this.timer = setTimeout(() => {
            this.timer = undefined
            this.advance()

            if (this.game && !this.game.isFinished && !this.paused && this.automatic) {
                this.scheduleNextPitch()
            }
        }, this.pitchIntervalMs)
    }

    private clearTimer(): void {
        if (this.timer === undefined) {
            return
        }

        clearTimeout(this.timer)
        this.timer = undefined
    }

}


interface GamePlaybackOptions {
    automatic?: boolean
    pitchIntervalMs?: number
    seed?: string
    rng?: seedrandom.PRNG
    onUpdate?: GamePlaybackUpdate
    onComplete?: GamePlaybackComplete
}


type GamePlaybackUpdate = (game: Game) => void
type GamePlaybackComplete = (game: Game) => void


export {
    GamePlaybackService
}


export type {
    GamePlaybackComplete,
    GamePlaybackOptions,
    GamePlaybackUpdate
}