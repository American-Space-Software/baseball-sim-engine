import { Worker } from "worker_threads"
import seedrandom from "seedrandom"
import { PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerImportRaw } from "../sim/service/interfaces.js"
import { RollChartService } from "../sim/service/roll-chart-service.js"
import { GameInfo, GamePlayers, RunnerActions, SimRolls, SimService } from "../sim/service/sim-service.js"
import { StatService } from "../sim/service/stat-service.js"
import { DownloaderService } from "./service/downloader-service.js"
import { PlayerImporterService } from "./service/player-importer-service.js"
import { v4 as uuidv4 } from 'uuid'

const log = (...args: any[]) => {
    console.log("[IMPORTER]", ...args)
}

interface TuningWorkerInput {
    pitchEnvironment: PitchEnvironmentTarget
    candidate: PitchEnvironmentTuning
    gamesPerIteration: number
    rngSeed: string
}

interface TuningWorkerSuccess {
    ok: true
    candidate: PitchEnvironmentTuning
    result: { actual: any, target: any, diff: any, score: number }
}

interface TuningWorkerFailure {
    ok: false
    error: string
    stack?: string
}

type TuningWorkerOutput = TuningWorkerSuccess | TuningWorkerFailure

interface ImportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget
    players: Map<string, PlayerImportRaw>
}

const rollChartService = new RollChartService()
const statService = new StatService()
const simRolls = new SimRolls(rollChartService)
const gamePlayers = new GamePlayers(rollChartService)
const runnerActions = new RunnerActions(rollChartService, simRolls)
const gameInfo = new GameInfo(gamePlayers)
const simService = new SimService(rollChartService, simRolls, runnerActions, gameInfo, {} as PitchEnvironmentTarget)

let downloaderService: DownloaderService 
let playerImporterService: PlayerImporterService
let currentBaseDataDir: string

const getPlayerImporterService = (baseDataDir: string): PlayerImporterService => {

    if (!downloaderService || !playerImporterService || currentBaseDataDir !== baseDataDir) {
        downloaderService = new DownloaderService(baseDataDir, 1000)
        playerImporterService = new PlayerImporterService(simService, statService, downloaderService)
        currentBaseDataDir = baseDataDir
    }

    return playerImporterService
}

const buildCandidatePitchEnvironment = (pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning): PitchEnvironmentTarget => {
    return JSON.parse(JSON.stringify({
        ...pitchEnvironment,
        pitchEnvironmentTuning: candidate
    }))
}

const evaluateCandidateLocal = (pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, gamesPerIteration: number, rngSeed: string, baseDataDir: string): { actual: any, target: any, diff: any, score: number } => {
    const importer = getPlayerImporterService(baseDataDir)
    const candidatePitchEnvironment = buildCandidatePitchEnvironment(pitchEnvironment, candidate)
    const rng = seedrandom(rngSeed)
    return importer.evaluatePitchEnvironment(candidatePitchEnvironment, rng, gamesPerIteration)
}

const runWorker = (input: TuningWorkerInput): Promise<TuningWorkerSuccess> => {
    return new Promise((resolve, reject) => {
        const start = Date.now()

        // log("SPAWN", input.candidate._id)

        const worker = new Worker(new URL("./worker.js", import.meta.url), {
            workerData: input,
            execArgv: [...process.execArgv, "--no-warnings"]
        })

        worker.once("message", (message: TuningWorkerOutput) => {
            const ms = Date.now() - start

            if (message.ok) {
                // log("DONE", input.candidate._id, "score=", message.result.score, `${ms}ms`)
                resolve(message)
                return
            }

            const failure = message as TuningWorkerFailure
            log("FAIL", input.candidate._id, failure.error, `${ms}ms`)
            reject(new Error(failure.stack ? `${failure.error}\n${failure.stack}` : failure.error))
        })

        worker.once("error", (err) => {
            log("WORKER ERROR", input.candidate._id, err)
            reject(err)
        })

        worker.once("exit", code => {
            if (code !== 0) {
                log("WORKER EXIT", input.candidate._id, code)
                reject(new Error(`Worker stopped with exit code ${code}`))
            }
        })
    })
}

const evaluateCandidatesWithWorkers = async (pitchEnvironment: PitchEnvironmentTarget, candidates: PitchEnvironmentTuning[], gamesPerIteration: number, workers: number, rngSeedBase: string): Promise<TuningWorkerSuccess[]> => {
    if (candidates.length === 0) {
        return []
    }

    const concurrency = Math.max(1, Math.min(workers, candidates.length))
    const results: TuningWorkerSuccess[] = new Array(candidates.length)
    let nextIndex = 0

    const consume = async (): Promise<void> => {
        while (true) {
            const index = nextIndex++
            if (index >= candidates.length) {
                return
            }

            results[index] = await runWorker({
                pitchEnvironment,
                candidate: candidates[index],
                gamesPerIteration,
                rngSeed: `${rngSeedBase}:${index}:${candidates[index]._id}`
            })
        }
    }

    await Promise.all(new Array(concurrency).fill(0).map(() => consume()))

    return results
}

async function importPitchEnvironmentTarget(season: number, baseDataDir: string, options?:any): Promise<PitchEnvironmentTarget> {

    const importer = getPlayerImporterService(baseDataDir)
    const players = await downloaderService!.buildSeasonPlayerImports(season, new Set([]))
    const pitchEnvironment = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)
    const rng = seedrandom(String(season))

    ;(importer as any).evaluateCandidateLocal = (candidatePitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, gamesPerIteration: number, rngSeed: string) => {
        return evaluateCandidateLocal(candidatePitchEnvironment, candidate, gamesPerIteration, rngSeed, baseDataDir)
    }

    ;(importer as any).evaluateCandidatesWithWorkers = evaluateCandidatesWithWorkers

    const pitchEnvironmentTuning = await getTuningsForPitchEnvironment(pitchEnvironment, rng, options)
    const fullPitchEnvironment: PitchEnvironmentTarget = {
        ...pitchEnvironment,
        pitchEnvironmentTuning
    }

    return fullPitchEnvironment
}

async function getTuningsForPitchEnvironment(pitchEnvironment: PitchEnvironmentTarget, rng: Function, options?: any): Promise<PitchEnvironmentTuning> {
    void rng

    let candidate = playerImporterService.seedPitchEnvironmentTuning(pitchEnvironment)

    const maxIterations = options?.maxIterations ?? 1000
    const minIterations = options?.minIterations ?? Math.min(40, maxIterations)
    const gamesPerIteration = options?.gamesPerIteration ?? 50
    const printDiagnostics = options?.printDiagnostics ?? true
    const maxStallIterations = options?.maxStallIterations ?? 25
    const workers = Math.max(1, options?.workers ?? 1)

    const clamp = (num: number, min: number, max: number): number => Math.max(min, Math.min(max, num))
    const round = (num: number, digits: number = 2): number => Number(num.toFixed(digits))

    const knobs = [
        { key: "contactQualityEvScale", step: 0.05, min: 0, max: 5, digits: 3 },
        { key: "contactQualityLaScale", step: 0.05, min: 0, max: 5, digits: 3 },
        { key: "contactQualityDistanceScale", step: 0.05, min: 0, max: 5, digits: 3 },

        { key: "pitchQualityZoneSwingEffect", step: 0.25, min: 0, max: 20, digits: 2 },
        { key: "pitchQualityChaseSwingEffect", step: 0.25, min: 0, max: 20, digits: 2 },
        { key: "disciplineZoneSwingEffect", step: 0.25, min: 0, max: 20, digits: 2 },
        { key: "disciplineChaseSwingEffect", step: 0.25, min: 0, max: 20, digits: 2 },
        { key: "pitchQualityContactEffect", step: 0.25, min: 0, max: 20, digits: 2 },
        { key: "contactSkillEffect", step: 0.25, min: 0, max: 25, digits: 2 },

        { key: "groundballDoublePenalty", step: 0.2, min: 0, max: 20, digits: 2 },
        { key: "groundballTriplePenalty", step: 0.25, min: 0, max: 30, digits: 2 },
        { key: "groundballHRPenalty", step: 0.25, min: 0, max: 30, digits: 2 },
        { key: "groundballOutcomeBoost", step: 0.2, min: 0, max: 20, digits: 2 },
        { key: "flyballOutcomeBoost", step: 0.15, min: 0, max: 12, digits: 2 },
        { key: "lineDriveOutcomeBoost", step: 0.5, min: 0, max: 80, digits: 2 },
        { key: "flyballHRPenalty", step: 0.15, min: 0, max: 20, digits: 2 },
        { key: "lineDriveOutToSingleWindow", step: 1.0, min: 0, max: 150, digits: 2 },
        { key: "lineDriveOutToSingleBoost", step: 1.5, min: 0, max: 150, digits: 2 },
        { key: "lineDriveSingleToDoubleFactor", step: 0.015, min: 0, max: 1, digits: 3 },

        { key: "fullPitchQualityBonus", step: 2.0, min: 0, max: 200, digits: 2 },
        { key: "fullTeamDefenseBonus", step: 4.0, min: 0, max: 300, digits: 2 },
        { key: "fullFielderDefenseBonus", step: 2.0, min: 0, max: 200, digits: 2 }
    ]

    const evaluateSeedCandidate = (candidateToEvaluate: PitchEnvironmentTuning, seed: string): { actual: any, target: any, diff: any, score: number } => {
        return evaluateCandidateLocal(pitchEnvironment, candidateToEvaluate, gamesPerIteration, seed, currentBaseDataDir)
    }

    let bestCandidate: PitchEnvironmentTuning = JSON.parse(JSON.stringify(candidate))
    let bestResult = evaluateSeedCandidate(bestCandidate, "seed:0")
    let stallIterations = 0

    if (printDiagnostics) {
        playerImporterService.printPitchEnvironmentIterationDiagnostics("seed", -1, bestCandidate, bestResult)
        log("TUNING START", "workers=", workers, "gamesPerIteration=", gamesPerIteration)
    }

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        if (iteration >= minIterations && playerImporterService.isPitchEnvironmentCloseEnough(bestResult.diff)) {
            if (printDiagnostics) {
                playerImporterService.printPitchEnvironmentIterationDiagnostics("close-enough", iteration, bestCandidate, bestResult)
            }
            break
        }

        const decay = Math.max(0.35, 1 - (iteration / 120))
        const trials: PitchEnvironmentTuning[] = []

        for (const knob of knobs) {
            for (const direction of [-1, 1]) {
                const trial: PitchEnvironmentTuning = JSON.parse(JSON.stringify(bestCandidate))
                trial._id = uuidv4()

                const currentValue = (trial.tuning as any)[knob.key] as number
                const rawStep = knob.step * direction * decay
                const nextValue = round(clamp(currentValue + rawStep, knob.min, knob.max), knob.digits)

                if (nextValue === currentValue) {
                    continue
                }

                ;(trial.tuning as any)[knob.key] = nextValue
                trials.push(trial)
            }
        }

        let evaluatedTrials: { candidate: PitchEnvironmentTuning, result: { actual: any, target: any, diff: any, score: number } }[] = []

        if (workers > 1) {
            const workerResults = await evaluateCandidatesWithWorkers(
                pitchEnvironment,
                trials,
                gamesPerIteration,
                workers,
                `iter:${iteration}`
            )

            evaluatedTrials = workerResults.map(result => ({
                candidate: result.candidate,
                result: result.result
            }))
        } else {
            evaluatedTrials = trials.map((trial, index) => ({
                candidate: trial,
                result: evaluateSeedCandidate(trial, `iter:${iteration}:${index}:${trial._id}`)
            }))
        }

        let iterationBestCandidate: PitchEnvironmentTuning | undefined
        let iterationBestResult: { actual: any, target: any, diff: any, score: number } | undefined

        for (const evaluated of evaluatedTrials) {
            if (printDiagnostics) {
                playerImporterService.printPitchEnvironmentIterationDiagnostics("trial", iteration, evaluated.candidate, evaluated.result)
            }

            if (!iterationBestResult || evaluated.result.score < iterationBestResult.score) {
                iterationBestCandidate = evaluated.candidate
                iterationBestResult = evaluated.result
            }
        }

        if (iterationBestCandidate && iterationBestResult && iterationBestResult.score < bestResult.score) {
            bestCandidate = iterationBestCandidate
            bestResult = iterationBestResult
            stallIterations = 0

            if (printDiagnostics) {
                playerImporterService.printPitchEnvironmentIterationDiagnostics("accepted", iteration, bestCandidate, bestResult)
            }

            continue
        }

        stallIterations++

        if (printDiagnostics) {
            playerImporterService.printPitchEnvironmentIterationDiagnostics(`stall-${stallIterations}`, iteration, bestCandidate, bestResult)
        }

        if (iteration + 1 < minIterations) {
            continue
        }

        if (stallIterations >= maxStallIterations) {
            if (printDiagnostics) {
                playerImporterService.printPitchEnvironmentIterationDiagnostics("stopped", iteration, bestCandidate, bestResult)
            }
            break
        }
    }

    log("FINAL_TUNING_ID", bestCandidate._id)

    return bestCandidate
}



export {
    importPitchEnvironmentTarget
}

export type {
    ImportPitchEnvironmentTargetResult
}