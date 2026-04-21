import { Worker } from "worker_threads"
import seedrandom from "seedrandom"
import { Pitch, PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerImportRaw } from "../sim/service/interfaces.js"
import { RollChartService } from "../sim/service/roll-chart-service.js"
import { GameInfo, GamePlayers, RunnerActions, SimRolls, SimService } from "../sim/service/sim-service.js"
import { StatService } from "../sim/service/stat-service.js"
import { DownloaderService } from "./service/downloader-service.js"
import { PlayerImporterService } from "./service/player-importer-service.js"
import { v4 as uuidv4 } from 'uuid'
import path from "path"
import fs from "fs"

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

async function importPitchEnvironmentTarget(season: number, baseDataDir: string, options?: any): Promise<PitchEnvironmentTarget> {

    const existingPitchEnvironmentTargetPath = path.join(baseDataDir, String(season), `_pitch_environment_target.json`)

    const readJson = async (filePath: string): Promise<any> => {
        const text = await fs.promises.readFile(filePath, "utf8")
        return JSON.parse(text)
    }

    const writeJson = async (filePath: string, data: any): Promise<void> => {
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8")
    }

    const fileExists = async (filePath: string): Promise<boolean> => {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK)
            return true
        } catch {
            return false
        }
    }

    const readExistingFile = async (filePath: string): Promise<PitchEnvironmentTarget | undefined> => {
        if (!await fileExists(filePath)) return undefined
        return readJson(filePath)
    }

    const importer = getPlayerImporterService(baseDataDir)
    const players = await downloaderService!.buildSeasonPlayerImports(season, new Set([]))
    const pitchEnvironment = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)
    const existingPitchEnvironmentTarget = await readExistingFile(existingPitchEnvironmentTargetPath)
    const rng = seedrandom(String(season))

    ;(importer as any).evaluateCandidateLocal = (candidatePitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, gamesPerIteration: number, rngSeed: string) => {
        return evaluateCandidateLocal(candidatePitchEnvironment, candidate, gamesPerIteration, rngSeed, baseDataDir)
    }

    ;(importer as any).evaluateCandidatesWithWorkers = evaluateCandidatesWithWorkers

    const pitchEnvironmentTuning = await PitchEnvironmentTuner.getTunings(
        pitchEnvironment,
        rng,
        {
            ...options,
            startingCandidate: existingPitchEnvironmentTarget?.pitchEnvironmentTuning
        }
    )

    const fullPitchEnvironment: PitchEnvironmentTarget = {
        ...pitchEnvironment,
        pitchEnvironmentTuning
    }

    await writeJson(existingPitchEnvironmentTargetPath, fullPitchEnvironment)

    return fullPitchEnvironment
}

class PitchEnvironmentTuner {

    public static async getTunings(pitchEnvironment: PitchEnvironmentTarget, rng: Function, params?: any): Promise<PitchEnvironmentTuning> {
        const baseSeed = String(rng())

        const startingCandidate = params?.startingCandidate as PitchEnvironmentTuning | undefined
        const options = params ?? {}

        let bestCandidate = startingCandidate
            ? JSON.parse(JSON.stringify(startingCandidate)) as PitchEnvironmentTuning
            : playerImporterService.seedPitchEnvironmentTuning(pitchEnvironment)

        if (!bestCandidate._id) {
            bestCandidate._id = uuidv4()
        }

        const maxIterations = options?.maxIterations ?? 20000
        const minIterations = options?.minIterations ?? Math.min(80, maxIterations)
        const gamesPerIteration = options?.gamesPerIteration ?? 100
        const printDiagnostics = options?.printDiagnostics ?? true
        const maxStallIterations = options?.maxStallIterations ?? 80
        const workers = Math.max(1, options?.workers ?? 1)
        const heartbeatEvery = Math.max(1, options?.heartbeatEvery ?? 25)

        const baselineGamesPerIteration = Math.max(gamesPerIteration, gamesPerIteration * 5)

        const knobGroups = this.getKnobGroups()
        const metricToGroups = this.getMetricToGroups()
        const topLevelMetricOrder = this.getTopLevelMetricOrder()

        const supportMetricWeights = [
            ...this.getSupportMetricWeights(),
            { key: "teamSBAttemptsPerGame", scoreWeight: 12500 },
            { key: "teamSBPerGame", scoreWeight: 3500 }
        ]

        const trackedEffectMetrics = Array.from(new Set([
            ...topLevelMetricOrder.map((metric: any) => metric.key),
            ...supportMetricWeights.map((metric: any) => metric.key)
        ]))
        const { trackTrialEffects } = this.createEffectTracker(trackedEffectMetrics, false)

        const allKnobs = knobGroups.flatMap(group => group.knobs.map((knob: any) => ({ groupName: group.group, knob })))
        let currentKnobIndex = 0

        const applyScore = (rawResult: { actual: any, target: any, diff: any, score: number }, focusBaseResult: { diff: any }) =>
            this.applyFocusedScore(rawResult, focusBaseResult, topLevelMetricOrder, supportMetricWeights)

        const seedRaw = this.evaluateSeedCandidate(pitchEnvironment, bestCandidate, `seed:${baseSeed}:0`, gamesPerIteration)
        let bestResult = applyScore(seedRaw, { diff: seedRaw.diff })

        const startBaselineRaw = this.evaluateSeedCandidate(pitchEnvironment, bestCandidate, `start-baseline:${baseSeed}:0`, baselineGamesPerIteration)
        const startBaselineResult = applyScore(startBaselineRaw, { diff: startBaselineRaw.diff })

        if (printDiagnostics) {
            playerImporterService.printPitchEnvironmentIterationDiagnostics("seed", -1, maxIterations, gamesPerIteration, bestCandidate, bestResult)
            playerImporterService.printPitchEnvironmentIterationDiagnostics("baseline", -1, maxIterations, baselineGamesPerIteration, bestCandidate, startBaselineResult)
        }

        let stallIterations = 0
        let acceptedIterations = 0
        let lastHeartbeatAccepted = 0

        const offenseDirections = new Map<string, number>([
            ["contactQuality.evScale", 1],
            ["contactQuality.laScale", 1],
            ["contactQuality.fullPitchQualityBonus", 1],
            ["contact.pitchQualityContactEffect", 1],
            ["contact.contactSkillEffect", 1],
            ["defense.fullTeamDefenseBonus", -1],
            ["defense.fullFielderDefenseBonus", -1]
        ])

        const runningDirections = new Map<string, number>([
            ["running.stealAttemptAggressionScale", 1]
        ])

        const offenseKnobEntries = allKnobs.filter(entry => offenseDirections.has(entry.knob.path))
        const runningKnobEntries = allKnobs.filter(entry => runningDirections.has(entry.knob.path))

        const pushUniqueCandidate = (list: PitchEnvironmentTuning[], seen: Set<string>, candidate: PitchEnvironmentTuning | undefined): void => {
            if (!candidate) return
            const signature = JSON.stringify(candidate.tuning)
            if (seen.has(signature)) return
            seen.add(signature)
            list.push(candidate)
        }

        const getMagnitudeSet = (isAggressive: boolean, isMedium: boolean): number[] => {
            if (isAggressive) return [1, 2, 3, 4, 6, 8]
            if (isMedium) return [0.5, 1, 2, 3, 4]
            return [0.5, 1, 2, 3]
        }

        const buildDirectionalTrial = (base: PitchEnvironmentTuning, entry: any, direction: number, magnitude: number): PitchEnvironmentTuning | undefined =>
            this.mutateSingleKnobTrial(
                base,
                entry.groupName,
                entry.knob,
                direction,
                1,
                magnitude,
                bestResult,
                knobGroups,
                metricToGroups,
                topLevelMetricOrder,
                supportMetricWeights
            )

        const buildTwoKnobTrial = (base: PitchEnvironmentTuning, firstEntry: any, firstDirection: number, firstMagnitude: number, secondEntry: any, secondDirection: number, secondMagnitude: number): PitchEnvironmentTuning | undefined => {
            const first = buildDirectionalTrial(base, firstEntry, firstDirection, firstMagnitude)
            if (!first) return undefined
            return buildDirectionalTrial(first, secondEntry, secondDirection, secondMagnitude)
        }

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            const focusBaseResult = bestResult
            const candidates: PitchEnvironmentTuning[] = []
            const seen = new Set<string>()

            const knobEntry = allKnobs[currentKnobIndex % allKnobs.length]
            currentKnobIndex++

            const runsDiff = focusBaseResult.diff.teamRunsPerGame ?? 0
            const sbAttemptsDiff = focusBaseResult.diff.teamSBAttemptsPerGame ?? 0

            const lowRunsAggressive = runsDiff <= -0.75
            const lowRunsMedium = !lowRunsAggressive && runsDiff <= -0.35

            const lowSbAttemptsAggressive = sbAttemptsDiff <= -0.20
            const lowSbAttemptsMedium = !lowSbAttemptsAggressive && sbAttemptsDiff <= -0.08

            const baseMagnitudes = getMagnitudeSet(lowRunsAggressive || stallIterations >= 35, lowRunsMedium || stallIterations >= 15)

            for (const direction of [-1, 1]) {
                for (const magnitude of baseMagnitudes) {
                    pushUniqueCandidate(candidates, seen, buildDirectionalTrial(bestCandidate, knobEntry, direction, magnitude))
                }
            }

            const currentValue = this.getNested(bestCandidate.tuning, knobEntry.knob.path)
            const minValue = this.round(knobEntry.knob.min, knobEntry.knob.digits)
            const maxValue = this.round(knobEntry.knob.max, knobEntry.knob.digits)

            if (minValue !== currentValue) {
                const minTrial = this.cloneCandidate(bestCandidate)
                this.setNested(minTrial.tuning, knobEntry.knob.path, minValue)
                pushUniqueCandidate(candidates, seen, minTrial)
            }

            if (maxValue !== currentValue) {
                const maxTrial = this.cloneCandidate(bestCandidate)
                this.setNested(maxTrial.tuning, knobEntry.knob.path, maxValue)
                pushUniqueCandidate(candidates, seen, maxTrial)
            }

            if (lowRunsAggressive || lowRunsMedium || stallIterations >= 12) {
                const runMagnitudes = lowRunsAggressive ? [2, 4, 6, 8, 10] : [1, 2, 3, 4, 6]

                for (const entry of offenseKnobEntries) {
                    const direction = offenseDirections.get(entry.knob.path) ?? 1
                    for (const magnitude of runMagnitudes) {
                        pushUniqueCandidate(candidates, seen, buildDirectionalTrial(bestCandidate, entry, direction, magnitude))
                    }
                }

                const offenseByPath = new Map(offenseKnobEntries.map(entry => [entry.knob.path, entry]))

                const runCombos = [
                    ["contactQuality.evScale", "contactQuality.laScale"],
                    ["contactQuality.evScale", "contact.pitchQualityContactEffect"],
                    ["contactQuality.evScale", "contact.contactSkillEffect"],
                    ["contactQuality.laScale", "contact.contactSkillEffect"],
                    ["contact.pitchQualityContactEffect", "contact.contactSkillEffect"],
                    ["contactQuality.fullPitchQualityBonus", "contact.pitchQualityContactEffect"],
                    ["contactQuality.fullPitchQualityBonus", "contact.contactSkillEffect"],
                    ["contactQuality.evScale", "defense.fullTeamDefenseBonus"],
                    ["contactQuality.laScale", "defense.fullFielderDefenseBonus"]
                ]

                for (const [firstPath, secondPath] of runCombos) {
                    const firstEntry = offenseByPath.get(firstPath)
                    const secondEntry = offenseByPath.get(secondPath)

                    if (!firstEntry || !secondEntry) continue

                    const firstDirection = offenseDirections.get(firstPath) ?? 1
                    const secondDirection = offenseDirections.get(secondPath) ?? 1
                    const comboMagnitude = lowRunsAggressive ? 4 : 2

                    pushUniqueCandidate(candidates, seen, buildTwoKnobTrial(bestCandidate, firstEntry, firstDirection, comboMagnitude, secondEntry, secondDirection, comboMagnitude))

                    if (lowRunsAggressive || stallIterations >= 25) {
                        pushUniqueCandidate(candidates, seen, buildTwoKnobTrial(bestCandidate, firstEntry, firstDirection, comboMagnitude + 2, secondEntry, secondDirection, comboMagnitude + 1))
                    }
                }
            }

            if (lowSbAttemptsAggressive || lowSbAttemptsMedium || stallIterations >= 12) {
                const sbMagnitudes = lowSbAttemptsAggressive ? [1, 2, 3, 4, 5] : [0.5, 1, 2, 3, 4]

                for (const entry of runningKnobEntries) {
                    const direction = runningDirections.get(entry.knob.path) ?? 1
                    for (const magnitude of sbMagnitudes) {
                        pushUniqueCandidate(candidates, seen, buildDirectionalTrial(bestCandidate, entry, direction, magnitude))
                    }
                }

                for (const runningEntry of runningKnobEntries) {
                    const runningDirection = runningDirections.get(runningEntry.knob.path) ?? 1
                    for (const offenseEntry of offenseKnobEntries) {
                        const offenseDirection = offenseDirections.get(offenseEntry.knob.path) ?? 1
                        const comboMagnitude = lowSbAttemptsAggressive ? 2 : 1
                        pushUniqueCandidate(candidates, seen, buildTwoKnobTrial(bestCandidate, runningEntry, runningDirection, comboMagnitude, offenseEntry, offenseDirection, comboMagnitude))
                    }
                }
            }

            if (candidates.length === 0) {
                continue
            }

            const evaluated = workers > 1
                ? await evaluateCandidatesWithWorkers(pitchEnvironment, candidates, gamesPerIteration, workers, `iter:${baseSeed}:${iteration}`)
                : candidates.map(candidate => ({
                    ok: true as const,
                    candidate,
                    result: evaluateCandidateLocal(
                        pitchEnvironment,
                        candidate,
                        gamesPerIteration,
                        `iter:${baseSeed}:${iteration}:${candidate._id}`,
                        currentBaseDataDir
                    )
                }))

            const scored = evaluated.map(message => ({
                candidate: message.candidate,
                rawResult: message.result,
                result: applyScore(message.result, focusBaseResult)
            }))

            for (const scoredCandidate of scored) {
                trackTrialEffects(
                    bestCandidate,
                    scoredCandidate.candidate,
                    bestResult,
                    scoredCandidate.result
                )
            }

            scored.sort((a, b) => a.result.score - b.result.score)

            const winner = scored[0]

            if (printDiagnostics) {
                playerImporterService.printPitchEnvironmentIterationDiagnostics("trial", iteration, maxIterations, gamesPerIteration, winner.candidate, winner.result)
            }

            if (winner.result.score < bestResult.score) {
                bestCandidate = JSON.parse(JSON.stringify(winner.candidate))
                bestResult = winner.result
                stallIterations = 0
                acceptedIterations++

                if (printDiagnostics) {
                    playerImporterService.printPitchEnvironmentIterationDiagnostics("accepted", iteration, maxIterations, gamesPerIteration, bestCandidate, bestResult)
                }

                if (iteration + 1 >= minIterations && playerImporterService.isPitchEnvironmentCloseEnough(bestResult.diff)) {
                    if (printDiagnostics) {
                        playerImporterService.printPitchEnvironmentIterationDiagnostics("close-enough", iteration, maxIterations, gamesPerIteration, bestCandidate, bestResult)
                    }
                    break
                }
            } else {
                stallIterations++
            }

            if (printDiagnostics && ((iteration + 1) % heartbeatEvery === 0)) {
                const acceptedSinceHeartbeat = acceptedIterations - lastHeartbeatAccepted
                lastHeartbeatAccepted = acceptedIterations
                log("HEARTBEAT", `iter=${iteration + 1}/${maxIterations}`, `best=${bestResult.score.toFixed(1)}`, `stall=${stallIterations}`, `accepted=${acceptedIterations}`, `acceptedSinceHeartbeat=${acceptedSinceHeartbeat}`)
            }

            if (stallIterations >= maxStallIterations && iteration + 1 >= minIterations) {
                if (printDiagnostics) {
                    playerImporterService.printPitchEnvironmentIterationDiagnostics("stopped", iteration, maxIterations, gamesPerIteration, bestCandidate, bestResult)
                }
                break
            }
        }

        const finalBaselineRaw = this.evaluateSeedCandidate(pitchEnvironment, bestCandidate, `final-baseline:${baseSeed}:0`, baselineGamesPerIteration)
        const finalBaselineResult = applyScore(finalBaselineRaw, { diff: finalBaselineRaw.diff })

        if (printDiagnostics) {
            playerImporterService.printPitchEnvironmentIterationDiagnostics("final", maxIterations, maxIterations, baselineGamesPerIteration, bestCandidate, finalBaselineResult)
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

        const abs = (value: number): number => Math.abs(Number.isFinite(value) ? value : 0)
        const safeRatioError = (actualValue: number, targetValue: number): number => {
            if (!Number.isFinite(actualValue) || !Number.isFinite(targetValue) || targetValue === 0) return 0
            return Math.abs(actualValue - targetValue) / Math.abs(targetValue)
        }
        const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
        const roundTier = (value: number, scale: number): number => clamp(Math.round(value * scale), 0, 999)

        const runsTier = roundTier(abs(actual.teamRunsPerGame - target.teamRunsPerGame), 100)
        const opsTier = roundTier(safeRatioError(actual.ops, target.ops), 1000)
        const obpTier = roundTier(safeRatioError(actual.obp, target.obp), 1000)
        const slgTier = roundTier(safeRatioError(actual.slg, target.slg), 1000)
        const avgTier = roundTier(safeRatioError(actual.avg, target.avg), 1000)
        const babipTier = roundTier(safeRatioError(actual.babip, target.babip), 1000)

        const supportTier = roundTier(
            safeRatioError(actual.teamHitsPerGame, target.teamHitsPerGame) +
            safeRatioError(actual.teamHomeRunsPerGame, target.teamHomeRunsPerGame) +
            safeRatioError(actual.teamBBPerGame, target.teamBBPerGame),
            100
        )

        const score =
            runsTier +
            (opsTier / 1_000) +
            (obpTier / 1_000_000) +
            (slgTier / 1_000_000_000) +
            (avgTier / 1_000_000_000_000) +
            (babipTier / 1_000_000_000_000_000) +
            (supportTier / 1_000_000_000_000_000_000)

        return {
            actual,
            target,
            diff: rawResult.diff,
            score: Number(score.toFixed(18))
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