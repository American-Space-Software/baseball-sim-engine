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
        const ctx = this.createTuningContext(pitchEnvironment, rng, params)

        log("TUNING START", `mode=minimal`, `workers=${ctx.workers}`, `games=${ctx.gamesPerIteration}`, `finalGames=${ctx.finalGamesPerIteration}`)

        let candidate = this.normalizeTuningShape(ctx.bestCandidate)
        let accepted = await this.evaluateAcceptedCandidate(candidate, ctx, ctx.gamesPerIteration, "seed")

        candidate = accepted.candidate
        ctx.printDiagnostic("seed", -1, ctx.gamesPerIteration, accepted.candidate, accepted.result)

        for (let iteration = 0; iteration < ctx.maxIterations; iteration++) {
            const trial = await this.solveDefense(candidate, accepted.result, ctx, ctx.gamesPerIteration)
            accepted = await this.evaluateAcceptedCandidate(trial, ctx, ctx.gamesPerIteration, `accepted-${iteration}`)

            candidate = accepted.candidate
            ctx.printDiagnostic("accepted", iteration, ctx.gamesPerIteration, accepted.candidate, accepted.result)

            if (this.isCloseEnough(accepted.result)) {
                break
            }
        }

        accepted = await this.evaluateAcceptedCandidate(candidate, ctx, ctx.finalGamesPerIteration, "final")

        ctx.printDiagnostic("final", ctx.maxIterations, ctx.finalGamesPerIteration, accepted.candidate, accepted.result)

        log("DONE", `R=${accepted.result.actual.teamRunsPerGame.toFixed(3)}`, `HR=${accepted.result.actual.teamHomeRunsPerGame.toFixed(3)}`, `SB=${accepted.result.actual.teamSBPerGame.toFixed(3)}`)

        return accepted.candidate
    }

    private static async evaluateAcceptedCandidate(candidate: PitchEnvironmentTuning, ctx: any, games: number, label: string): Promise<{ candidate: PitchEnvironmentTuning, result: any }> {
        let accepted = await this.enforceDirectConstraints(candidate, ctx, games, label)

        for (let i = 0; i < ctx.directIterations; i++) {
            const next = await this.enforceDirectConstraints(accepted.candidate, ctx, games, `${label}-fixed-${i}`)

            const currentError =
                Math.abs(Number(accepted.result.actual?.teamSBAttemptsPerGame ?? 0) - Number(accepted.result.target?.teamSBAttemptsPerGame ?? 0)) +
                Math.abs(Number(accepted.result.actual?.teamHomeRunsPerGame ?? 0) - Number(accepted.result.target?.teamHomeRunsPerGame ?? 0)) +
                Math.abs(Number(accepted.result.actual?.bbPercent ?? 0) - Number(accepted.result.target?.bbPercent ?? 0))

            const nextError =
                Math.abs(Number(next.result.actual?.teamSBAttemptsPerGame ?? 0) - Number(next.result.target?.teamSBAttemptsPerGame ?? 0)) +
                Math.abs(Number(next.result.actual?.teamHomeRunsPerGame ?? 0) - Number(next.result.target?.teamHomeRunsPerGame ?? 0)) +
                Math.abs(Number(next.result.actual?.bbPercent ?? 0) - Number(next.result.target?.bbPercent ?? 0))

            if (nextError >= currentError) break

            accepted = next

            if (nextError <= 0.04) break
        }

        return accepted
    }

    private static async enforceDirectConstraints(candidate: PitchEnvironmentTuning, ctx: any, games: number, label: string): Promise<{ candidate: PitchEnvironmentTuning, result: any }> {
        const baseCandidate = this.normalizeTuningShape(candidate)

        const specs = [
            {
                name: "sba",
                min: ctx.stealMin,
                max: ctx.stealMax,
                tolerance: 0.005,
                getActual: (result: any) => Number(result.actual?.teamSBAttemptsPerGame ?? 0),
                getTarget: (result: any) => Number(result.target?.teamSBAttemptsPerGame ?? 0),
                getValue: (candidate: PitchEnvironmentTuning) => Number(candidate.tuning!.running.stealAttemptAggressionScale ?? 0),
                setValue: (candidate: PitchEnvironmentTuning, value: number) => candidate.tuning!.running.stealAttemptAggressionScale = value
            },
            {
                name: "2b",
                min: ctx.doubleMin,
                max: ctx.doubleMax,
                tolerance: 0.002,
                getActual: (result: any) => Number(result.actual?.doublePercent ?? 0),
                getTarget: (result: any) => Number(result.target?.doublePercent ?? 0),
                getValue: (candidate: PitchEnvironmentTuning) => Number(candidate.tuning!.contactQuality.doubleOutcomeScale ?? 0),
                setValue: (candidate: PitchEnvironmentTuning, value: number) => candidate.tuning!.contactQuality.doubleOutcomeScale = value
            },
            {
                name: "3b",
                min: ctx.tripleMin,
                max: ctx.tripleMax,
                tolerance: 0.00075,
                getActual: (result: any) => Number(result.actual?.triplePercent ?? 0),
                getTarget: (result: any) => Number(result.target?.triplePercent ?? 0),
                getValue: (candidate: PitchEnvironmentTuning) => Number(candidate.tuning!.contactQuality.tripleOutcomeScale ?? 0),
                setValue: (candidate: PitchEnvironmentTuning, value: number) => candidate.tuning!.contactQuality.tripleOutcomeScale = value
            },
            {
                name: "hr",
                min: ctx.homeRunMin,
                max: ctx.homeRunMax,
                tolerance: 0.002,
                getActual: (result: any) => Number(result.actual?.homeRunPercent ?? 0),
                getTarget: (result: any) => Number(result.target?.homeRunPercent ?? 0),
                getValue: (candidate: PitchEnvironmentTuning) => Number(candidate.tuning!.contactQuality.homeRunOutcomeScale ?? 0),
                setValue: (candidate: PitchEnvironmentTuning, value: number) => candidate.tuning!.contactQuality.homeRunOutcomeScale = value
            },
            {
                name: "bb",
                min: ctx.walkMin,
                max: ctx.walkMax,
                tolerance: 0.002,
                getActual: (result: any) => Number(result.actual?.bbPercent ?? 0),
                getTarget: (result: any) => Number(result.target?.bbPercent ?? 0),
                getValue: (candidate: PitchEnvironmentTuning) => Number(candidate.tuning!.swing.walkRateScale ?? 0),
                setValue: (candidate: PitchEnvironmentTuning, value: number) => candidate.tuning!.swing.walkRateScale = value
            }
        ]

        const baselineBatch = await ctx.evaluateBatch([baseCandidate], games, `${label}-direct-baseline`)
        const baselineResult = ctx.applyScore(baselineBatch[0].result)

        const calculated = specs
            .map(spec => {
                const baseValue = this.clamp(Number(spec.getValue(baseCandidate)), spec.min, spec.max)
                const actual = Number(spec.getActual(baselineResult))
                const target = Number(spec.getTarget(baselineResult))
                const error = Math.abs(actual - target)

                if (error <= spec.tolerance || target <= 0 || actual <= 0) {
                    return undefined
                }

                const baseMultiplier = Math.max(0.01, 1 + baseValue)
                const targetMultiplier = baseMultiplier * (target / actual)
                const nextValue = this.clamp(targetMultiplier - 1, spec.min, spec.max)

                if (nextValue === baseValue) {
                    return undefined
                }

                const trial = this.normalizeTuningShape(baseCandidate)
                spec.setValue(trial, nextValue)
                trial._id = uuidv4()

                return {
                    spec,
                    candidate: trial,
                    baseValue,
                    trialValue: nextValue,
                    baselineActual: actual,
                    target,
                    baselineError: error
                }
            })
            .filter(row => row !== undefined)

        const bestByName = new Map<string, { spec: any, candidate: PitchEnvironmentTuning, result: any, value: number, error: number, baseValue: number, trialValue: number, baselineActual: number, target: number }>()

        for (const spec of specs) {
            const baseValue = this.clamp(Number(spec.getValue(baseCandidate)), spec.min, spec.max)

            bestByName.set(spec.name, {
                spec,
                candidate: baseCandidate,
                result: baselineResult,
                value: baseValue,
                error: Math.abs(Number(spec.getActual(baselineResult)) - Number(spec.getTarget(baselineResult))),
                baseValue,
                trialValue: baseValue,
                baselineActual: Number(spec.getActual(baselineResult)),
                target: Number(spec.getTarget(baselineResult))
            })
        }

        if (calculated.length > 0) {
            const calculatedBatch = await ctx.evaluateBatch(calculated.map(row => row.candidate), games, `${label}-direct-calculated`)
            const calculatedResults = calculatedBatch.map((message: any) => ctx.applyScore(message.result))

            for (let i = 0; i < calculated.length; i++) {
                const row = calculated[i]
                const result = calculatedResults[i]
                const error = Math.abs(Number(row.spec.getActual(result)) - row.target)
                const best = bestByName.get(row.spec.name)

                if (!best || error < best.error) {
                    bestByName.set(row.spec.name, {
                        spec: row.spec,
                        candidate: row.candidate,
                        result,
                        value: row.trialValue,
                        error,
                        baseValue: row.baseValue,
                        trialValue: row.trialValue,
                        baselineActual: row.baselineActual,
                        target: row.target
                    })
                }
            }

            const corrected = calculated
                .map((row, index) => {
                    const result = calculatedResults[index]
                    const actual = Number(row.spec.getActual(result))
                    const error = Math.abs(actual - row.target)

                    if (error <= row.spec.tolerance || actual <= 0) {
                        return undefined
                    }

                    const observedSlope = (actual - row.baselineActual) / (row.trialValue - row.baseValue)

                    if (!Number.isFinite(observedSlope) || observedSlope === 0) {
                        return undefined
                    }

                    const correctedValue = this.clamp(row.trialValue + ((row.target - actual) / observedSlope), row.spec.min, row.spec.max)

                    if (correctedValue === row.trialValue || correctedValue === row.baseValue) {
                        return undefined
                    }

                    const trial = this.normalizeTuningShape(baseCandidate)
                    row.spec.setValue(trial, correctedValue)
                    trial._id = uuidv4()

                    return {
                        spec: row.spec,
                        candidate: trial,
                        value: correctedValue,
                        target: row.target,
                        baseValue: row.baseValue,
                        trialValue: row.trialValue,
                        baselineActual: row.baselineActual
                    }
                })
                .filter(row => row !== undefined)

            if (corrected.length > 0) {
                const correctedBatch = await ctx.evaluateBatch(corrected.map(row => row.candidate), games, `${label}-direct-corrected`)
                const correctedResults = correctedBatch.map((message: any) => ctx.applyScore(message.result))

                for (let i = 0; i < corrected.length; i++) {
                    const row = corrected[i]
                    const result = correctedResults[i]
                    const error = Math.abs(Number(row.spec.getActual(result)) - row.target)
                    const best = bestByName.get(row.spec.name)

                    if (!best || error < best.error) {
                        bestByName.set(row.spec.name, {
                            spec: row.spec,
                            candidate: row.candidate,
                            result,
                            value: row.value,
                            error,
                            baseValue: row.baseValue,
                            trialValue: row.trialValue,
                            baselineActual: row.baselineActual,
                            target: row.target
                        })
                    }
                }
            }
        }

        const merged = this.normalizeTuningShape(baseCandidate)
        let changed = false

        for (const spec of specs) {
            const best = bestByName.get(spec.name)
            if (!best) continue

            const currentValue = this.clamp(Number(spec.getValue(merged)), spec.min, spec.max)
            const nextValue = this.clamp(Number(best.value), spec.min, spec.max)

            if (nextValue !== currentValue) {
                spec.setValue(merged, nextValue)
                changed = true
            }
        }

        if (!changed) {
            return {
                candidate: baseCandidate,
                result: baselineResult
            }
        }

        merged._id = uuidv4()

        const mergedBatch = await ctx.evaluateBatch([merged], games, `${label}-direct-merged`)
        const mergedResult = ctx.applyScore(mergedBatch[0].result)

        return {
            candidate: this.normalizeTuningShape(merged),
            result: mergedResult
        }
    }


    private static async solveDefense(candidate: PitchEnvironmentTuning, result: any, ctx: any, games: number): Promise<PitchEnvironmentTuning> {
        const baseCandidate = this.normalizeTuningShape(candidate)
        const currentDefense = Number(baseCandidate.tuning!.meta.fullFielderDefenseBonus ?? 0)

        const defenseValues = Array.from(new Set([
            ctx.defenseMin,
            (ctx.defenseMin + currentDefense) / 2,
            currentDefense,
            (currentDefense + ctx.defenseMax) / 2,
            ctx.defenseMax
        ].map(value => this.clamp(value, ctx.defenseMin, ctx.defenseMax))))

        const candidates = defenseValues.map(value => this.withDefense(baseCandidate, value))
        const evaluated = await ctx.evaluateBatch(candidates, games, "defense")
        const results = evaluated.map((message: any) => ctx.applyScore(message.result))

        let bestCandidate = baseCandidate
        let bestScore = this.getShapeError(result)

        for (let i = 0; i < results.length; i++) {
            const score = this.getShapeError(results[i])

            if (score < bestScore) {
                bestCandidate = candidates[i]
                bestScore = score
            }
        }

        return this.normalizeTuningShape(bestCandidate)
    }

    private static withDefense(candidate: PitchEnvironmentTuning, defenseValue: number): PitchEnvironmentTuning {
        const c = this.normalizeTuningShape(candidate)

        c.tuning!.meta.fullTeamDefenseBonus = 0
        c.tuning!.meta.fullFielderDefenseBonus = defenseValue
        c._id = uuidv4()

        return this.normalizeTuningShape(c)
    }

    private static getShapeError(result: any): number {
        const relative = (key: string): number => {
            const actual = Number(result.actual?.[key] ?? 0)
            const target = Number(result.target?.[key] ?? 0)

            if (target === 0) {
                return Math.abs(actual)
            }

            return Math.abs((actual - target) / target)
        }

        return [
            "teamRunsPerGame",
            "teamHitsPerGame",
            "avg",
            "obp",
            "slg",
            "ops",
            "babip",
            "bbPercent",
            "teamBBPerGame"
        ].reduce((total, key) => total + relative(key), 0)
    }

    private static createTuningContext(pitchEnvironment: PitchEnvironmentTarget, rng: Function, params?: any): any {
        const baseSeed = String(rng())
        const gamesPerIteration = params?.gamesPerIteration ?? 100
        const workers = Math.max(1, params?.workers ?? 1)
        const printDiagnostics = params?.printDiagnostics ?? true
        const maxIterations = params?.maxIterations ?? 5
        const bestCandidate = this.normalizeTuningShape(params?.startingCandidate ?? playerImporterService.seedPitchEnvironmentTuning(pitchEnvironment))

        const evaluateBatch = async (candidates: PitchEnvironmentTuning[], games: number, tagPrefix: string) => {
            log("BATCH START", tagPrefix, `games=${games}`, `candidates=${candidates.length}`, `workers=${workers}`)

            if (workers > 1) {
                const results = await evaluateCandidatesWithWorkers(pitchEnvironment, candidates, games, workers, tagPrefix)
                log("BATCH DONE", tagPrefix, `results=${results.length}`)
                return results
            }

            const results = candidates.map(candidate => ({
                ok: true as const,
                candidate,
                result: evaluateCandidateLocal(
                    pitchEnvironment,
                    candidate,
                    games,
                    `${tagPrefix}:${candidate._id}`,
                    currentBaseDataDir
                )
            }))

            log("BATCH DONE", tagPrefix, `results=${results.length}`)
            return results
        }

        const applyScore = (rawResult: { actual: any, target: any, diff: any, score: number }) => rawResult

        return {
            pitchEnvironment,
            baseSeed,
            bestCandidate,
            maxIterations,
            gamesPerIteration,
            finalGamesPerIteration: params?.finalGamesPerIteration ?? Math.max(gamesPerIteration, 250),
            directIterations: params?.directIterations ?? 2,
            directConstraintIterations: params?.directConstraintIterations ?? 2,
            directStep: params?.directStep ?? 0.1,
            defenseIterations: params?.defenseIterations ?? 1,
            workers,
            stealMin: -0.99,
            stealMax: 4,
            advancementMin: -0.5,
            advancementMax: 1,
            walkMin: -0.5,
            walkMax: 0.5,
            doubleMin: -0.75,
            doubleMax: 1.5,
            tripleMin: -0.75,
            tripleMax: 2.5,
            homeRunMin: -0.75,
            homeRunMax: 0.75,
            defenseMin: -400,
            defenseMax: 400,
            evaluateBatch,
            applyScore,
            printDiagnostic: (stage: string, iteration: number, games: number, candidate: PitchEnvironmentTuning, result: any) => {
                if (!printDiagnostics) return
                playerImporterService.printPitchEnvironmentIterationDiagnostics(stage, iteration, maxIterations, games, candidate, result)
            }
        }
    }

    private static normalizeTuningShape(candidate: PitchEnvironmentTuning): PitchEnvironmentTuning {
        const c = JSON.parse(JSON.stringify(candidate)) as PitchEnvironmentTuning

        c._id = c._id ?? uuidv4()
        c.tuning = c.tuning ?? {} as any

        const t: any = c.tuning

        t.contactQuality = t.contactQuality ?? {}
        t.swing = t.swing ?? {}
        t.contact = t.contact ?? {}
        t.running = t.running ?? {}
        t.meta = t.meta ?? {}

        t.contactQuality.evScale = 0
        t.contactQuality.laScale = 0
        t.contactQuality.distanceScale = 0
        t.contactQuality.homeRunOutcomeScale = this.clamp(Number(t.contactQuality.homeRunOutcomeScale ?? 0), -0.75, 0.75)

        t.swing.pitchQualityZoneSwingEffect = 0
        t.swing.pitchQualityChaseSwingEffect = 0
        t.swing.disciplineZoneSwingEffect = 0
        t.swing.disciplineChaseSwingEffect = 0
        t.swing.walkRateScale = this.clamp(Number(t.swing.walkRateScale ?? 0), -0.5, 0.5)

        t.contact.pitchQualityContactEffect = 0
        t.contact.contactSkillEffect = 0

        t.running.stealAttemptAggressionScale = this.clamp(Number(t.running.stealAttemptAggressionScale ?? 0), -0.99, 4)
        t.running.advancementAggressionScale = this.clamp(Number(t.running.advancementAggressionScale ?? 0), -0.5, 1)

        t.meta.fullPitchQualityBonus = 0
        t.meta.fullTeamDefenseBonus = 0
        t.meta.fullFielderDefenseBonus = this.clamp(Number(t.meta.fullFielderDefenseBonus ?? 0), -400, 400)

        return c
    }

    private static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value))
    }

    private static isCloseEnough(result: any): boolean {
        const diff = (key: string): number => Math.abs(Number(result.actual?.[key] ?? 0) - Number(result.target?.[key] ?? 0))

        return (
            diff("teamRunsPerGame") <= 0.1 &&
            diff("ops") <= 0.007 &&
            diff("obp") <= 0.004 &&
            diff("slg") <= 0.003 &&
            diff("avg") <= 0.02 &&
            diff("babip") <= 0.005 &&
            diff("teamHitsPerGame") <= 0.10 &&
            diff("teamHomeRunsPerGame") <= 0.03 &&
            diff("teamBBPerGame") <= 0.04 &&
            diff("teamSBPerGame") <= 0.01 &&
            diff("teamSBAttemptsPerGame") <= 0.06
        )
    }

}


export {
    importPitchEnvironmentTarget
}

export type {
    ImportPitchEnvironmentTargetResult
}