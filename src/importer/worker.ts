import { parentPort, workerData, isMainThread } from "worker_threads"
import seedrandom from "seedrandom"
import { PitchEnvironmentTarget, PitchEnvironmentTuning } from "../sim/service/interfaces.js"
import { RollChartService } from "../sim/service/roll-chart-service.js"
import { GameInfo, GamePlayers, RunnerActions, SimRolls, SimService } from "../sim/service/sim-service.js"
import { StatService } from "../sim/service/stat-service.js"
import { DownloaderService } from "./service/downloader-service.js"
import { PlayerImporterService } from "./service/player-importer-service.js"

type TuningWorkerInput = {
    pitchEnvironment: PitchEnvironmentTarget
    candidate: PitchEnvironmentTuning
    gamesPerIteration: number
    rngSeed: string
}

type TuningWorkerSuccess = {
    ok: true
    candidate: PitchEnvironmentTuning
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

const simRolls = new SimRolls(rollChartService)
const gamePlayers = new GamePlayers(rollChartService)
const runnerActions = new RunnerActions(rollChartService, simRolls)
const gameInfo = new GameInfo(gamePlayers)

const defaultPitchEnvironmentTarget = {} as PitchEnvironmentTarget

const simService = new SimService(rollChartService, simRolls, runnerActions, gameInfo, defaultPitchEnvironmentTarget)

const playerImporterService = new PlayerImporterService(simService, statService, downloaderService)

const buildCandidatePitchEnvironment = (pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning): PitchEnvironmentTarget => {
    return JSON.parse(JSON.stringify({
        ...pitchEnvironment,
        pitchEnvironmentTuning: candidate
    }))
}

const run = (): void => {
    const input = workerData as TuningWorkerInput

    try {
        const candidatePitchEnvironment = buildCandidatePitchEnvironment(input.pitchEnvironment, input.candidate)
        const rng = seedrandom(input.rngSeed)
        const result = playerImporterService.evaluatePitchEnvironment(candidatePitchEnvironment, rng, input.gamesPerIteration)

        const message: TuningWorkerSuccess = {
            ok: true,
            candidate: input.candidate,
            result
        }

        parentPort?.postMessage(message)
    } catch (ex: any) {
        const message: TuningWorkerFailure = {
            ok: false,
            error: ex?.message ?? String(ex),
            stack: ex?.stack
        }

        parentPort?.postMessage(message)
    }
}

if (!isMainThread) {
    run()
}