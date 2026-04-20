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

    const pitchEnvironmentTuning = await PitchEnvironmentTuner.getTunings(pitchEnvironment, rng, options)
    const fullPitchEnvironment: PitchEnvironmentTarget = {
        ...pitchEnvironment,
        pitchEnvironmentTuning
    }

    return fullPitchEnvironment
}

class PitchEnvironmentTuner {

    public static async getTunings(pitchEnvironment: PitchEnvironmentTarget, rng: Function, options?: any): Promise<PitchEnvironmentTuning> {
        let candidate = playerImporterService.seedPitchEnvironmentTuning(pitchEnvironment)
        let bestCandidate = JSON.parse(JSON.stringify(candidate)) as PitchEnvironmentTuning

        const maxIterations = options?.maxIterations ?? 20000
        const minIterations = options?.minIterations ?? Math.min(80, maxIterations)
        const gamesPerIteration = options?.gamesPerIteration ?? 100
        const printDiagnostics = options?.printDiagnostics ?? true
        const maxStallIterations = options?.maxStallIterations ?? 60
        const workers = Math.max(1, options?.workers ?? 1)
        const heartbeatEvery = Math.max(1, options?.heartbeatEvery ?? 25)

        const baselineGamesPerIteration = Math.max(gamesPerIteration, gamesPerIteration * 5)

        const knobGroups = this.getKnobGroups()
        const metricToGroups = this.getMetricToGroups()
        const topLevelMetricOrder = this.getTopLevelMetricOrder()
        const supportMetricWeights = this.getSupportMetricWeights()
        const trackedEffectMetrics = Array.from(new Set([...topLevelMetricOrder, ...Object.keys(supportMetricWeights)]))
        const { trackTrialEffects } = this.createEffectTracker(trackedEffectMetrics, false)

        const allKnobs = knobGroups.flatMap(group => group.knobs.map((knob: any) => ({ groupName: group.group, knob })))
        let currentKnobIndex = 0

        const applyScore = (rawResult: { actual: any, target: any, diff: any, score: number }, focusBaseResult: { diff: any }) =>
            this.applyFocusedScore(rawResult, focusBaseResult, topLevelMetricOrder, supportMetricWeights)

        const seedRaw = this.evaluateSeedCandidate(pitchEnvironment, candidate, "seed:0", gamesPerIteration)
        let bestResult = applyScore(seedRaw, { diff: seedRaw.diff })

        const startBaselineRaw = this.evaluateSeedCandidate(pitchEnvironment, candidate, "start-baseline:0", baselineGamesPerIteration)
        const startBaselineResult = applyScore(startBaselineRaw, { diff: startBaselineRaw.diff })

        const startScore = startBaselineResult.score
        let bestScore = startBaselineResult.score
        let bestIteration = -1
        let stallIterations = 0
        let iterationsSinceImprovement = 0

        if (printDiagnostics) {
            playerImporterService.printPitchEnvironmentIterationDiagnostics("baseline", -1, maxIterations, baselineGamesPerIteration, candidate, startBaselineResult)
            log(
                "TUNING START",
                "workers=", workers,
                "gamesPerIteration=", gamesPerIteration,
                "baselineGamesPerIteration=", baselineGamesPerIteration,
                "maxIterations=", maxIterations,
                "maxStallIterations=", maxStallIterations,
                "startScore=", startScore.toFixed(1)
            )
        }

        if (bestResult.score < bestScore) {
            bestCandidate = JSON.parse(JSON.stringify(candidate))
            bestScore = bestResult.score
            bestIteration = -1

            if (printDiagnostics) {
                playerImporterService.printPitchEnvironmentIterationDiagnostics("accepted", -1, maxIterations, gamesPerIteration, candidate, bestResult)
                log(
                    "NEW BEST",
                    "iteration=", -1,
                    "score=", bestScore.toFixed(1),
                    "deltaStart=", (startScore - bestScore).toFixed(1)
                )
            }
        }

        const sweepCandidates = this.buildSweepCandidates(candidate, knobGroups)

        const evaluatedSweepTrials = await this.evaluateCandidateBatch(
            pitchEnvironment,
            sweepCandidates,
            gamesPerIteration,
            workers,
            "sweep",
            (raw: any) => applyScore(raw, bestResult)
        )

        let bestSweepCandidate: PitchEnvironmentTuning | undefined
        let bestSweepResult: { actual: any, target: any, diff: any, score: number } | undefined

        for (const evaluated of evaluatedSweepTrials) {
            trackTrialEffects(candidate, evaluated.candidate, bestResult, evaluated.result)

            if (!bestSweepResult || evaluated.result.score < bestSweepResult.score) {
                bestSweepCandidate = evaluated.candidate
                bestSweepResult = evaluated.result
            }
        }

        if (bestSweepCandidate && bestSweepResult && bestSweepResult.score < bestScore) {
            candidate = bestSweepCandidate
            bestCandidate = JSON.parse(JSON.stringify(bestSweepCandidate))
            bestResult = bestSweepResult
            bestScore = bestSweepResult.score
            bestIteration = 0
            stallIterations = 0
            iterationsSinceImprovement = 0

            if (printDiagnostics) {
                playerImporterService.printPitchEnvironmentIterationDiagnostics("accepted", 0, maxIterations, gamesPerIteration, candidate, bestResult)
                log(
                    "NEW BEST",
                    "iteration=", 0,
                    "score=", bestScore.toFixed(1),
                    "deltaStart=", (startScore - bestScore).toFixed(1)
                )
            }
        }

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            if (iteration >= minIterations && playerImporterService.isPitchEnvironmentCloseEnough(bestResult.diff)) {
                if (printDiagnostics) {
                    playerImporterService.printPitchEnvironmentIterationDiagnostics("close-enough", iteration, maxIterations, gamesPerIteration, bestCandidate, bestResult)
                    log(
                        "BEST SUMMARY",
                        "bestIteration=", bestIteration,
                        "bestScore=", bestScore.toFixed(1),
                        "deltaStart=", (startScore - bestScore).toFixed(1)
                    )
                }
                break
            }

            const activeKnob = allKnobs[currentKnobIndex % allKnobs.length]
            currentKnobIndex++

            const trials = this.buildSingleKnobBatch(candidate, activeKnob.groupName, activeKnob.knob, bestResult, knobGroups, metricToGroups, topLevelMetricOrder, supportMetricWeights)

            const evaluatedTrials = await this.evaluateCandidateBatch(
                pitchEnvironment,
                trials,
                gamesPerIteration,
                workers,
                `iter:${iteration}`,
                (raw: any) => applyScore(raw, bestResult)
            )

            let iterationBestCandidate: PitchEnvironmentTuning | undefined
            let iterationBestResult: { actual: any, target: any, diff: any, score: number } | undefined

            for (const evaluated of evaluatedTrials) {
                trackTrialEffects(candidate, evaluated.candidate, bestResult, evaluated.result)

                if (!iterationBestResult || evaluated.result.score < iterationBestResult.score) {
                    iterationBestCandidate = evaluated.candidate
                    iterationBestResult = evaluated.result
                }
            }

            if (iterationBestCandidate && iterationBestResult && iterationBestResult.score < bestScore) {
                candidate = iterationBestCandidate
                bestCandidate = JSON.parse(JSON.stringify(iterationBestCandidate))
                bestResult = iterationBestResult
                bestScore = iterationBestResult.score
                bestIteration = iteration
                stallIterations = 0
                iterationsSinceImprovement = 0

                if (printDiagnostics) {
                    playerImporterService.printPitchEnvironmentIterationDiagnostics("accepted", iteration, maxIterations, gamesPerIteration, candidate, bestResult)
                    log(
                        "NEW BEST",
                        "iteration=", iteration,
                        "knob=", `${activeKnob.groupName}.${String(activeKnob.knob.path[1])}`,
                        "score=", bestScore.toFixed(1),
                        "deltaStart=", (startScore - bestScore).toFixed(1)
                    )
                }

                continue
            }

            stallIterations++
            iterationsSinceImprovement++

            if (printDiagnostics && iterationsSinceImprovement > 0 && (iterationsSinceImprovement % heartbeatEvery === 0)) {
                log(
                    "STILL RUNNING",
                    "iteration=", iteration,
                    "bestScore=", bestScore.toFixed(1),
                    "deltaStart=", (startScore - bestScore).toFixed(1),
                    "bestIteration=", bestIteration,
                    "sinceImprovement=", iterationsSinceImprovement,
                    "stallIterations=", stallIterations,
                    "knob=", `${activeKnob.groupName}.${String(activeKnob.knob.path[1])}`
                )
            }

            if (stallIterations >= maxStallIterations) {
                if (printDiagnostics) {
                    playerImporterService.printPitchEnvironmentIterationDiagnostics("stopped", iteration, maxIterations, gamesPerIteration, bestCandidate, bestResult)
                    log(
                        "BEST SUMMARY",
                        "bestIteration=", bestIteration,
                        "bestScore=", bestScore.toFixed(1),
                        "deltaStart=", (startScore - bestScore).toFixed(1)
                    )
                }
                break
            }
        }

        const finalBaselineRaw = this.evaluateSeedCandidate(pitchEnvironment, bestCandidate, "final-baseline:0", baselineGamesPerIteration)
        const finalBaselineResult = applyScore(finalBaselineRaw, { diff: finalBaselineRaw.diff })

        if (printDiagnostics) {
            playerImporterService.printPitchEnvironmentIterationDiagnostics("final", maxIterations, maxIterations, baselineGamesPerIteration, bestCandidate, finalBaselineResult)
            log(
                "FINAL COMPARE",
                "startScore=", startScore.toFixed(1),
                "bestScore=", bestScore.toFixed(1),
                "finalScore=", finalBaselineResult.score.toFixed(1),
                "bestDeltaStart=", (startScore - bestScore).toFixed(1),
                "finalDeltaStart=", (startScore - finalBaselineResult.score).toFixed(1),
                "bestIteration=", bestIteration
            )
        }

        return bestCandidate
    }

    private static createEffectTracker(trackedEffectMetrics: string[], printDiagnostics: boolean): { trackTrialEffects: (baseCandidate: PitchEnvironmentTuning, trialCandidate: PitchEnvironmentTuning, baseResult: { actual: any, target: any, diff: any, score: number }, trialResult: { actual: any, target: any, diff: any, score: number }) => void, printEffectStats: (stage: string) => void } {
        const createRunningStat = (): { n: number, mean: number, m2: number, pos: number, neg: number, zero: number } => ({
            n: 0,
            mean: 0,
            m2: 0,
            pos: 0,
            neg: 0,
            zero: 0
        })

        const updateRunningStat = (stat: { n: number, mean: number, m2: number, pos: number, neg: number, zero: number }, value: number): void => {
            stat.n++
            const delta = value - stat.mean
            stat.mean += delta / stat.n
            const delta2 = value - stat.mean
            stat.m2 += delta * delta2

            if (value > 0) stat.pos++
            else if (value < 0) stat.neg++
            else stat.zero++
        }

        const getRunningSd = (stat: { n: number, mean: number, m2: number }): number => stat.n > 1 ? Math.sqrt(stat.m2 / (stat.n - 1)) : 0

        const effectStats = new Map<string, {
            knob: string,
            group: string,
            samples: number,
            meanStep: number,
            m2Step: number,
            scoreDelta: { n: number, mean: number, m2: number, pos: number, neg: number, zero: number },
            metrics: Record<string, { n: number, mean: number, m2: number, pos: number, neg: number, zero: number }>
        }>()

        const ensureEffectEntry = (group: string, knob: string): {
            knob: string,
            group: string,
            samples: number,
            meanStep: number,
            m2Step: number,
            scoreDelta: { n: number, mean: number, m2: number, pos: number, neg: number, zero: number },
            metrics: Record<string, { n: number, mean: number, m2: number, pos: number, neg: number, zero: number }>
        } => {
            const key = `${group}.${knob}`
            let existing = effectStats.get(key)

            if (!existing) {
                existing = {
                    knob,
                    group,
                    samples: 0,
                    meanStep: 0,
                    m2Step: 0,
                    scoreDelta: createRunningStat(),
                    metrics: Object.fromEntries(trackedEffectMetrics.map(metric => [metric, createRunningStat()]))
                }
                effectStats.set(key, existing)
            }

            return existing
        }

        const updateStepMoments = (entry: { samples: number, meanStep: number, m2Step: number }, step: number): void => {
            entry.samples++
            const delta = step - entry.meanStep
            entry.meanStep += delta / entry.samples
            const delta2 = step - entry.meanStep
            entry.m2Step += delta * delta2
        }

        const trackTrialEffects = (baseCandidate: PitchEnvironmentTuning, trialCandidate: PitchEnvironmentTuning, baseResult: { actual: any, target: any, diff: any, score: number }, trialResult: { actual: any, target: any, diff: any, score: number }): void => {
            const changed = this.getSingleChangedKnob(baseCandidate, trialCandidate)
            if (!changed) return
            if (!Number.isFinite(changed.step) || changed.step === 0) return

            const entry = ensureEffectEntry(changed.group, changed.knob)
            updateStepMoments(entry, changed.step)

            const scoreDelta = Number(trialResult.score ?? 0) - Number(baseResult.score ?? 0)
            const scoreSlope = scoreDelta / changed.step
            updateRunningStat(entry.scoreDelta, scoreSlope)

            for (const metric of trackedEffectMetrics) {
                const baseMetric = this.getMetricValue(baseResult, metric)
                const trialMetric = this.getMetricValue(trialResult, metric)
                const metricDelta = trialMetric - baseMetric
                const slope = metricDelta / changed.step
                updateRunningStat(entry.metrics[metric], slope)
            }
        }

        const printEffectStats = (stage: string): void => {
            if (!printDiagnostics || effectStats.size === 0) return

            const entries = Array.from(effectStats.values())
                .sort((a, b) => {
                    const aSignal = a.scoreDelta.n > 0 ? Math.abs(a.scoreDelta.mean) : 0
                    const bSignal = b.scoreDelta.n > 0 ? Math.abs(b.scoreDelta.mean) : 0
                    if (bSignal !== aSignal) return bSignal - aSignal
                    return `${a.group}.${a.knob}`.localeCompare(`${b.group}.${b.knob}`)
                })

            log(`KNOB EFFECTS ${stage}`)

            for (const entry of entries) {
                const scoreSd = getRunningSd(entry.scoreDelta)
                log(
                    `${entry.group}.${entry.knob}`,
                    `n=${entry.samples}`,
                    `step=${entry.meanStep.toFixed(4)}`,
                    `scoreSlope=${entry.scoreDelta.mean.toFixed(3)}`,
                    `sd=${scoreSd.toFixed(3)}`,
                    `+=${entry.scoreDelta.pos}`,
                    `-=${entry.scoreDelta.neg}`
                )

                for (const metric of trackedEffectMetrics) {
                    const stat = entry.metrics[metric]
                    if (stat.n <= 0) continue

                    const sd = getRunningSd(stat)
                    log(
                        " ",
                        metric,
                        `mean=${stat.mean.toFixed(5)}`,
                        `sd=${sd.toFixed(5)}`,
                        `+=${stat.pos}`,
                        `-=${stat.neg}`
                    )
                }
            }
        }

        return {
            trackTrialEffects,
            printEffectStats
        }
    }

    private static buildSweepCandidates(candidate: PitchEnvironmentTuning, knobGroups: any[]): PitchEnvironmentTuning[] {
        const sweepCandidates: PitchEnvironmentTuning[] = []

        for (const group of knobGroups) {
            for (const knob of group.knobs) {
                const currentValue = this.getNested(candidate.tuning, knob.path)
                const sweepValues = [
                    this.round(this.clamp(currentValue - (knob.step * 2), knob.min, knob.max), knob.digits),
                    this.round(this.clamp(currentValue - knob.step, knob.min, knob.max), knob.digits),
                    currentValue,
                    this.round(this.clamp(currentValue + knob.step, knob.min, knob.max), knob.digits),
                    this.round(this.clamp(currentValue + (knob.step * 2), knob.min, knob.max), knob.digits),
                    this.round(knob.min, knob.digits),
                    this.round(knob.max, knob.digits)
                ]

                const uniqueSweepValues = Array.from(new Set(sweepValues))

                for (const sweepValue of uniqueSweepValues) {
                    if (sweepValue === currentValue) continue

                    const trial = this.cloneCandidate(candidate)
                    this.setNested(trial.tuning, knob.path, sweepValue)
                    sweepCandidates.push(trial)
                }
            }
        }

        const seenSweepSignatures = new Set<string>()
        return sweepCandidates.filter(trial => {
            const signature = JSON.stringify(trial.tuning)
            if (seenSweepSignatures.has(signature)) return false
            seenSweepSignatures.add(signature)
            return true
        })
    }

    private static async evaluateCandidateBatch(pitchEnvironment: PitchEnvironmentTarget, trials: PitchEnvironmentTuning[], gamesPerIteration: number, workers: number, batchKey: string, applyScore: Function): Promise<{ candidate: PitchEnvironmentTuning, result: { actual: any, target: any, diff: any, score: number } }[]> {
        if (workers > 1) {
            const workerResults = await evaluateCandidatesWithWorkers(
                pitchEnvironment,
                trials,
                gamesPerIteration,
                workers,
                batchKey
            )

            return workerResults.map(result => ({
                candidate: result.candidate,
                result: applyScore(result.result)
            }))
        }

        return trials.map((trial, index) => ({
            candidate: trial,
            result: applyScore(
                this.evaluateSeedCandidate(
                    pitchEnvironment,
                    trial,
                    `${batchKey}:${index}:${trial._id}`,
                    gamesPerIteration
                )
            )
        }))
    }

    private static buildSingleKnobBatch(baseCandidate: PitchEnvironmentTuning, groupName: string, knob: any, result: { diff: any }, knobGroups: any[], metricToGroups: Record<string, string[]>, topLevelMetricOrder: any[], supportMetricWeights: any[]): PitchEnvironmentTuning[] {
        const trials: PitchEnvironmentTuning[] = []
        const magnitudes = [0.5, 1, 2, 3]
        const directions = [-1, 1]

        const pushTrial = (trial?: PitchEnvironmentTuning): void => {
            if (!trial) return
            trials.push(trial)
        }

        for (const direction of directions) {
            for (const magnitude of magnitudes) {
                pushTrial(
                    this.mutateSingleKnobTrial(
                        baseCandidate,
                        groupName,
                        knob,
                        direction,
                        1,
                        magnitude,
                        result,
                        knobGroups,
                        metricToGroups,
                        topLevelMetricOrder,
                        supportMetricWeights
                    )
                )
            }
        }

        const currentValue = this.getNested(baseCandidate.tuning, knob.path)
        const minValue = this.round(knob.min, knob.digits)
        const maxValue = this.round(knob.max, knob.digits)

        if (minValue !== currentValue) {
            const minTrial = this.cloneCandidate(baseCandidate)
            this.setNested(minTrial.tuning, knob.path, minValue)
            pushTrial(minTrial)
        }

        if (maxValue !== currentValue) {
            const maxTrial = this.cloneCandidate(baseCandidate)
            this.setNested(maxTrial.tuning, knob.path, maxValue)
            pushTrial(maxTrial)
        }

        const seen = new Set<string>()
        return trials.filter(trial => {
            const signature = JSON.stringify(trial.tuning)
            if (seen.has(signature)) return false
            seen.add(signature)
            return true
        })
    }

    private static getSingleChangedKnob(beforeCandidate: PitchEnvironmentTuning, afterCandidate: PitchEnvironmentTuning): { group: string, knob: string, path: string[], before: number, after: number, step: number } | undefined {
        const beforeRows = this.flattenTuning(beforeCandidate.tuning)
        const afterRows = this.flattenTuning(afterCandidate.tuning)

        const beforeMap = new Map(beforeRows.map(row => [row.path.join("."), row]))
        const afterMap = new Map(afterRows.map(row => [row.path.join("."), row]))

        const changed: { group: string, knob: string, path: string[], before: number, after: number, step: number }[] = []

        for (const [pathKey, beforeRow] of beforeMap.entries()) {
            const afterRow = afterMap.get(pathKey)
            if (!afterRow) continue

            if (beforeRow.value !== afterRow.value) {
                changed.push({
                    group: String(beforeRow.path[0] ?? ""),
                    knob: String(beforeRow.path[1] ?? pathKey),
                    path: beforeRow.path,
                    before: beforeRow.value,
                    after: afterRow.value,
                    step: afterRow.value - beforeRow.value
                })
            }
        }

        if (changed.length !== 1) return undefined
        return changed[0]
    }

    private static flattenTuning(value: any, prefix: string[] = []): { path: string[], value: number }[] {
        if (value == null || typeof value !== "object") {
            return []
        }

        const rows: { path: string[], value: number }[] = []

        for (const [key, child] of Object.entries(value)) {
            const nextPath = [...prefix, key]

            if (child != null && typeof child === "object" && !Array.isArray(child)) {
                rows.push(...this.flattenTuning(child, nextPath))
                continue
            }

            if (typeof child === "number" && Number.isFinite(child)) {
                rows.push({ path: nextPath, value: child })
            }
        }

        return rows
    }    

    private static getKnobGroups(): any[] {
        return [
            {
                group: "contactQuality",
                knobs: [
                    { path: ["contactQuality", "evScale"], step: 0.05, min: -10, max: 10, digits: 3, offenseDirection: 1 },
                    { path: ["contactQuality", "laScale"], step: 0.05, min: -10, max: 10, digits: 3, offenseDirection: 1 },
                    { path: ["contactQuality", "distanceScale"], step: 0.05, min: -10, max: 10, digits: 3, offenseDirection: 1 },
                    { path: ["contactQuality", "fullPitchQualityBonus"], step: 2.0, min: -400, max: 400, digits: 2, offenseDirection: 1 }
                ]
            },
            {
                group: "swing",
                knobs: [
                    { path: ["swing", "pitchQualityZoneSwingEffect"], step: 0.25, min: -40, max: 40, digits: 2, offenseDirection: -1 },
                    { path: ["swing", "pitchQualityChaseSwingEffect"], step: 0.25, min: -40, max: 40, digits: 2, offenseDirection: -1 },
                    { path: ["swing", "disciplineZoneSwingEffect"], step: 0.25, min: -40, max: 40, digits: 2, offenseDirection: 1 },
                    { path: ["swing", "disciplineChaseSwingEffect"], step: 0.25, min: -40, max: 40, digits: 2, offenseDirection: 1 }
                ]
            },
            {
                group: "contact",
                knobs: [
                    { path: ["contact", "pitchQualityContactEffect"], step: 0.25, min: -40, max: 40, digits: 2, offenseDirection: -1 },
                    { path: ["contact", "contactSkillEffect"], step: 0.25, min: -50, max: 50, digits: 2, offenseDirection: 1 }
                ]
            },
            {
                group: "defense",
                knobs: [
                    { path: ["defense", "fullTeamDefenseBonus"], step: 4.0, min: -600, max: 600, digits: 2, offenseDirection: -1 },
                    { path: ["defense", "fullFielderDefenseBonus"], step: 2.0, min: -400, max: 400, digits: 2, offenseDirection: -1 }
                ]
            }
        ]
    }

    private static getMetricToGroups(): Record<string, string[]> {
        return {
            teamRunsPerGame: ["contactQuality", "swing", "contact", "defense"],
            ops: ["contactQuality", "swing", "contact", "defense"],
            obp: ["swing", "contact"],
            slg: ["contactQuality", "contact", "defense"],
            avg: ["contactQuality", "swing", "contact", "defense"],
            babip: ["contactQuality", "contact", "defense"],

            teamHitsPerGame: ["contactQuality", "swing", "contact", "defense"],
            teamHomeRunsPerGame: ["contactQuality", "contact", "defense"],
            teamBBPerGame: ["swing", "contact"],
            teamSOPerGame: ["swing", "contact"],

            singlePercent: ["contactQuality", "contact", "defense"],
            doublePercent: ["contactQuality", "contact", "defense"],
            triplePercent: ["contactQuality", "contact", "defense"],
            homeRunPercent: ["contactQuality", "contact", "defense"],

            bbPercent: ["swing", "contact"],
            soPercent: ["swing", "contact"],
            hbpPercent: ["swing", "contact"],

            pitchesPerPA: ["swing", "contact"],
            swingPercent: ["swing", "contact"],
            swingAtStrikesPercent: ["swing"],
            swingAtBallsPercent: ["swing"],
            inZoneContactPercent: ["contact"],
            outZoneContactPercent: ["contact"],
            foulContactPercent: ["contact"],

            inZonePercent: ["swing", "contact"],
            strikePercent: ["swing", "contact"],
            ballPercent: ["swing", "contact"],

            groundBallPercent: ["contactQuality", "contact"],
            flyBallPercent: ["contactQuality", "contact"],
            ldPercent: ["contactQuality", "contact"]
        }
    }

    private static getTopLevelMetricOrder(): any[] {
        return [
            { key: "teamRunsPerGame", closeEnough: 0.20, scoreWeight: 32000, lowSideWeight: 5000 },
            { key: "ops", closeEnough: 0.006, scoreWeight: 1800000, lowSideWeight: 240000 },
            { key: "obp", closeEnough: 0.002, scoreWeight: 900000, lowSideWeight: 140000 },
            { key: "slg", closeEnough: 0.004, scoreWeight: 700000, lowSideWeight: 100000 },
            { key: "avg", closeEnough: 0.002, scoreWeight: 350000, lowSideWeight: 50000 },
            { key: "babip", closeEnough: 0.004, scoreWeight: 220000, lowSideWeight: 30000 }
        ]
    }

    private static getSupportMetricWeights(): any[] {
        return [
            { key: "teamHitsPerGame", scoreWeight: 9000 },
            { key: "teamHomeRunsPerGame", scoreWeight: 14000 },
            { key: "teamBBPerGame", scoreWeight: 9000 },
            { key: "singlePercent", scoreWeight: 120000 },
            { key: "doublePercent", scoreWeight: 80000 },
            { key: "homeRunPercent", scoreWeight: 100000 },
            { key: "swingAtStrikesPercent", scoreWeight: 16000 },
            { key: "swingAtBallsPercent", scoreWeight: 16000 },
            { key: "inZoneContactPercent", scoreWeight: 18000 },
            { key: "outZoneContactPercent", scoreWeight: 18000 },
            { key: "pitchesPerPA", scoreWeight: 7000 }
        ]
    }

    private static evaluateSeedCandidate(pitchEnvironment: PitchEnvironmentTarget, candidateToEvaluate: PitchEnvironmentTuning, seed: string, candidateGamesPerIteration: number): { actual: any, target: any, diff: any, score: number } {
        return evaluateCandidateLocal(pitchEnvironment, candidateToEvaluate, candidateGamesPerIteration, seed, currentBaseDataDir)
    }

    private static applyFocusedScore(rawResult: { actual: any, target: any, diff: any, score: number }, focusBaseResult: { diff: any }, topLevelMetricOrder: any[], supportMetricWeights: any[]): { actual: any, target: any, diff: any, score: number } {
        const actual = rawResult.actual
        const target = rawResult.target

        const safeRatioError = (a: number, t: number): number => {
            if (t === 0) return 0
            return Math.abs(a - t) / t
        }

        const runs = safeRatioError(actual.teamRunsPerGame, target.teamRunsPerGame)
        const ops = safeRatioError(actual.ops, target.ops)
        const obp = safeRatioError(actual.obp, target.obp)
        const slg = safeRatioError(actual.slg, target.slg)
        const avg = safeRatioError(actual.avg, target.avg)
        const babip = safeRatioError(actual.babip, target.babip)

        const hrRate = safeRatioError(actual.homeRunPercent, target.homeRunPercent)
        const hrGame = safeRatioError(actual.teamHomeRunsPerGame, target.teamHomeRunsPerGame)

        const score =
            runs * 6 +
            ops * 5 +
            obp * 4 +
            slg * 4 +
            avg * 3 +
            babip * 2 +
            hrRate * 3 +
            hrGame * 3

        return {
            actual,
            target,
            diff: rawResult.diff,
            score
        }
    }

    private static getCurrentFocusIndex(result: { diff: any }, topLevelMetricOrder: any[]): number {
        for (let i = 0; i < topLevelMetricOrder.length; i++) {
            if (this.getMetricAbs(result, topLevelMetricOrder[i].key) > topLevelMetricOrder[i].closeEnough) return i
        }
        return topLevelMetricOrder.length - 1
    }

    private static getMetricAbs(result: { diff: any }, key: string): number {
        return this.abs(Number(result?.diff?.[key] ?? 0))
    }

    private static getMetricValue(result: { diff: any }, key: string): number {
        return Number(result?.diff?.[key] ?? 0)
    }


    private static mutateSingleKnobTrial(baseCandidate: PitchEnvironmentTuning, groupName: string, knob: any, baseDirection: number, decay: number, magnitude: number, result: { diff: any }, knobGroups: any[], metricToGroups: Record<string, string[]>, topLevelMetricOrder: any[], supportMetricWeights: any[]): PitchEnvironmentTuning | undefined {
        const trial = this.cloneCandidate(baseCandidate)

        const pressure = this.getGroupPressure(result, groupName, knobGroups, metricToGroups, topLevelMetricOrder, supportMetricWeights)
        const activePressures = knobGroups.map(g => this.getGroupPressure(result, g.group, knobGroups, metricToGroups, topLevelMetricOrder, supportMetricWeights)).sort((a, b) => b - a)
        const topPressure = activePressures[0] || 1
        const groupBoost = this.clamp(topPressure > 0 ? pressure / topPressure : 0, 0.35, 1.35)

        const currentValue = this.getNested(trial.tuning, knob.path)
        const knobDirection = baseDirection

        const rawStep = knob.step * decay * magnitude * groupBoost * knobDirection
        const nextValue = this.round(this.clamp(currentValue + rawStep, knob.min, knob.max), knob.digits)

        if (nextValue === currentValue) return undefined

        this.setNested(trial.tuning, knob.path, nextValue)
        return trial
    }

    private static getGroupPressure(result: { diff: any }, groupName: string, knobGroups: any[], metricToGroups: Record<string, string[]>, topLevelMetricOrder: any[], supportMetricWeights: any[]): number {
        let pressure = 0
        const focusIndex = this.getCurrentFocusIndex(result, topLevelMetricOrder)

        for (let i = 0; i < topLevelMetricOrder.length; i++) {
            const metric = topLevelMetricOrder[i]
            const diffValue = this.getMetricValue(result, metric.key)
            const absValue = this.abs(diffValue)

            if (!(metricToGroups[metric.key] ?? []).includes(groupName)) continue

            const proximityWeight =
                i === focusIndex ? 1 :
                i === focusIndex + 1 ? 0.6 :
                i === focusIndex + 2 ? 0.3 :
                0.12

            pressure += absValue * metric.scoreWeight * proximityWeight

            if (diffValue < 0) {
                pressure += absValue * metric.lowSideWeight * proximityWeight
            }
        }

        for (const metric of supportMetricWeights) {
            if (!(metricToGroups[metric.key] ?? []).includes(groupName)) continue
            pressure += this.abs(this.getMetricValue(result, metric.key)) * metric.scoreWeight * 0.15
        }

        return pressure
    }

    private static cloneCandidate(source: PitchEnvironmentTuning): PitchEnvironmentTuning {
        const cloned = JSON.parse(JSON.stringify(source))
        cloned._id = uuidv4()
        return cloned
    }

    private static getNested(obj: any, path: string[]): number {
        let current = obj
        for (const key of path) current = current?.[key]
        return current as number
    }

    private static setNested(obj: any, path: string[], value: number): void {
        let current = obj
        for (let i = 0; i < path.length - 1; i++) current = current[path[i]]
        current[path[path.length - 1]] = value
    }

    private static sq(v: number): number {
        return v * v
    }

    private static abs(v: number): number {
        return Math.abs(v)
    }

    private static sign(v: number): number {
        return v < 0 ? -1 : v > 0 ? 1 : 0
    }

    private static clamp(num: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, num))
    }

    private static round(num: number, digits: number = 2): number {
        return Number(num.toFixed(digits))
    }

}



export {
    importPitchEnvironmentTarget
}

export type {
    ImportPitchEnvironmentTargetResult
}