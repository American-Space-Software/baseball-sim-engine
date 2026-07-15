import {
    isMainThread,
    parentPort,
    workerData
} from "worker_threads"

import seedrandom from "seedrandom"

import type {
    PitchEnvironmentTarget,
    PitchEnvironmentTuning
} from "../sim/service/interfaces.js"

import { RollChartService } from "../sim/service/roll-chart-service.js"
import {
    GameInfo,
    GamePlayers,
    SimRolls,
    SimService
} from "../sim/service/sim-service.js"

import { StatService } from "../sim/service/stat-service.js"
import { RunnerService } from "../sim/service/runner-service.js"
import { SubstitutionService } from "../sim/service/substitution-service.js"
import { PitchEnvironmentService } from "./service/pitch-environment-service.js"
import { BaselineGameService } from "./service/baseline-game-service.js"

type PitchEnvironmentWorkerInput = {
    pitchEnvironment: PitchEnvironmentTarget
    candidate: PitchEnvironmentTuning
    gamesPerIteration: number
    rngSeed: string
}

type TuningWorkerSuccess = {
    ok: true
    candidate: PitchEnvironmentTuning
    result: {
        actual: any
        target: any
        diff: any
        score: number
    }
}

type TuningWorkerFailure = {
    ok: false
    error: string
    stack?: string
}

type TuningWorkerResponse =
    | TuningWorkerSuccess
    | TuningWorkerFailure

const rollChartService = new RollChartService()
const statService = new StatService()
const substitutionService = new SubstitutionService()

const simRolls = new SimRolls(
    rollChartService
)

const gamePlayers = new GamePlayers()

const runnerService = new RunnerService(
    simRolls
)

const gameInfo = new GameInfo(
    gamePlayers
)

const defaultPitchEnvironmentTarget =
    {} as PitchEnvironmentTarget

const simService = new SimService(
    rollChartService,
    simRolls,
    runnerService,
    gameInfo,
    substitutionService,
    defaultPitchEnvironmentTarget
)

const baselineGameService = new BaselineGameService(
    simService
)

const pitchEnvironmentService = new PitchEnvironmentService(
    simService,
    statService,
    baselineGameService
)

const buildCandidatePitchEnvironment = (pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning): PitchEnvironmentTarget => {
    return structuredClone({
        ...pitchEnvironment,
        pitchEnvironmentTuning: candidate
    })
}

const runPitchEnvironment = (input: PitchEnvironmentWorkerInput): TuningWorkerSuccess => {
    const candidatePitchEnvironment =
        buildCandidatePitchEnvironment(
            input.pitchEnvironment,
            input.candidate
        )

    const rng = seedrandom(
        input.rngSeed
    )

    const result =
        pitchEnvironmentService.evaluatePitchEnvironment(
            candidatePitchEnvironment,
            rng,
            input.gamesPerIteration
        )

    return {
        ok: true,
        candidate: input.candidate,
        result
    }
}

const run = (): void => {
    const input =
        workerData as PitchEnvironmentWorkerInput

    try {
        const response =
            runPitchEnvironment(
                input
            )

        parentPort?.postMessage(
            response
        )
    } catch (error: unknown) {
        const response: TuningWorkerFailure = {
            ok: false,
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
            stack:
                error instanceof Error
                    ? error.stack
                    : undefined
        }

        parentPort?.postMessage(
            response
        )
    }
}

if (!isMainThread) {
    run()
}

export type {
    PitchEnvironmentWorkerInput,
    TuningWorkerFailure,
    TuningWorkerResponse,
    TuningWorkerSuccess
}