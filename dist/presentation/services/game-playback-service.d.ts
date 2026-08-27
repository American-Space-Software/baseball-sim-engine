import seedrandom from "seedrandom";
import type { Game, StartGameCommand } from "../../sim/service/interfaces.js";
import { SimService } from "../../sim/service/sim-service.js";
declare class GamePlaybackService {
    private readonly simService;
    private game?;
    private rng?;
    private timer?;
    private pitchIntervalMs;
    private automatic;
    private paused;
    private onUpdate?;
    private onComplete?;
    constructor(simService: SimService);
    start(command: StartGameCommand, options?: GamePlaybackOptions): Game;
    load(game: Game, playbackState: GamePlaybackState, options?: GamePlaybackOptions): Game;
    advance(): Game;
    pause(): void;
    resume(): void;
    stop(): void;
    reset(): void;
    setAutomatic(automatic: boolean): void;
    setPitchInterval(milliseconds: number): void;
    setCallbacks(onUpdate?: GamePlaybackUpdate, onComplete?: GamePlaybackComplete): void;
    getGame(): Game | undefined;
    getPlaybackState(): GamePlaybackState;
    isAutomatic(): boolean;
    isPaused(): boolean;
    private scheduleNextPitch;
    private clearTimer;
}
interface GamePlaybackState {
    rngState: seedrandom.State;
}
interface GamePlaybackOptions {
    automatic?: boolean;
    pitchIntervalMs?: number;
    seed?: string;
    rng?: seedrandom.PRNG;
    onUpdate?: GamePlaybackUpdate;
    onComplete?: GamePlaybackComplete;
}
type GamePlaybackUpdate = (game: Game) => void;
type GamePlaybackComplete = (game: Game) => void;
export { GamePlaybackService };
export type { GamePlaybackComplete, GamePlaybackOptions, GamePlaybackState, GamePlaybackUpdate };
