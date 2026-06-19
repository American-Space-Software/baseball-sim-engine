import { parentPort, workerData, isMainThread } from "worker_threads"
import seedrandom from "seedrandom"
import { PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerImportRaw, RatingTuning } from "../sim/service/interfaces.js"
import { RollChartService } from "../sim/service/roll-chart-service.js"
import { GameInfo, GamePlayers, SimRolls, SimService } from "../sim/service/sim-service.js"
import { StatService } from "../sim/service/stat-service.js"
import { DownloaderService } from "./service/downloader-service.js"
import { PitchEnvironmentService } from "./service/pitch-environment-service.js"
import { PlayerRatingService } from "./service/player-rating-service.js"
import { BaselineGameService } from "./service/baseline-game-service.js"
import { RunnerService } from "../sim/service/runner-service.js"
import { SubstitutionService } from "../sim/service/substitution-service.js"

type PitchEnvironmentWorkerInput = {
    kind: "pitchEnvironment"
    pitchEnvironment: PitchEnvironmentTarget
    candidate: PitchEnvironmentTuning
    gamesPerIteration: number
    rngSeed: string
}

type RatingWorkerInput = {
    kind: "rating"
    pitchEnvironment: PitchEnvironmentTarget
    candidate: RatingTuning
    players: PlayerImportRaw[]
    gamesPerPlayer: number
    rngSeed: string
}

type TuningWorkerInput = PitchEnvironmentWorkerInput | RatingWorkerInput

type TuningWorkerSuccess = {
    ok: true
    candidate: PitchEnvironmentTuning | RatingTuning
    result: { actual: any, target: any, diff: any, score: number }
}

type TuningWorkerFailure = {
    ok: false
    error: string
    stack?: string
}

const rollChartService = new RollChartService()
const statService = new StatService()
const downloaderService = {} as DownloaderService
const substitutionService = new SubstitutionService()

const simRolls = new SimRolls(rollChartService)
const gamePlayers = new GamePlayers()
const runnerService = new RunnerService(simRolls)
const gameInfo = new GameInfo(gamePlayers)

const defaultPitchEnvironmentTarget = {} as PitchEnvironmentTarget

const simService = new SimService(rollChartService, simRolls, runnerService, gameInfo, substitutionService, defaultPitchEnvironmentTarget)
const baselineGameService = new BaselineGameService(simService)

const pitchEnvironmentService = new PitchEnvironmentService(simService, statService, baselineGameService)
const playerRatingService = new PlayerRatingService(simService, statService, baselineGameService)

const buildCandidatePitchEnvironment = (pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning): PitchEnvironmentTarget => {
    return JSON.parse(JSON.stringify({
        ...pitchEnvironment,
        pitchEnvironmentTuning: candidate
    }))
}

const runPitchEnvironment = (input: PitchEnvironmentWorkerInput): TuningWorkerSuccess => {
    const candidatePitchEnvironment = buildCandidatePitchEnvironment(input.pitchEnvironment, input.candidate)
    const rng = seedrandom(input.rngSeed)
    const result = pitchEnvironmentService.evaluatePitchEnvironment(candidatePitchEnvironment, rng, input.gamesPerIteration)

    return {
        ok: true,
        candidate: input.candidate,
        result
    }
}

const runRating = (input: RatingWorkerInput): TuningWorkerSuccess => {
    const rng = seedrandom(input.rngSeed)

    const result = playerRatingService.evaluatePlayerRatings(
        input.pitchEnvironment,
        input.candidate,
        input.players,
        rng,
        input.gamesPerPlayer
    )

    return {
        ok: true,
        candidate: input.candidate,
        result
    }
}

const run = (): void => {
    const input = workerData as TuningWorkerInput

    try {
        const message =
            input.kind === "rating"
                ? runRating(input)
                : runPitchEnvironment(input)

        parentPort?.postMessage(message)
    } catch (ex: any) {
        parentPort?.postMessage({
            ok: false,
            error: ex?.message ?? String(ex),
            stack: ex?.stack
        })
    }
}





if (!isMainThread) {
    run()
}