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
import { clamp } from "../util.js"

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

        type Stage = {
            name: string
            historyKey: string
            maxLoops: number
            min: number
            max: number
            tolerance: number
            hardLock: boolean
            actual: (result: any) => number
            target: (result: any) => number
            isLocked: (result: any) => boolean
            getValue: (candidate: PitchEnvironmentTuning) => number
            setValue: (candidate: PitchEnvironmentTuning, value: number) => void
            fallback: (result: any, currentValue: number) => number
        }

        const stages: Stage[] = [
            {
                name: "BB%",
                historyKey: "bb",
                maxLoops: 10,
                min: ctx.walkMin,
                max: ctx.walkMax,
                tolerance: 0.002,
                hardLock: true,
                actual: result => Number(result.actual?.bbPercent ?? 0),
                target: result => Number(result.target?.bbPercent ?? 0),
                isLocked: result => Math.abs(Number(result.actual?.bbPercent ?? 0) - Number(result.target?.bbPercent ?? 0)) <= 0.002,
                getValue: candidate => Number(candidate.tuning?.swing.walkRateScale ?? 0),
                setValue: (candidate, value) => { candidate.tuning!.swing.walkRateScale = value },
                fallback: (result, currentValue) => this.calculateWalkRateScale(Number(result.actual?.bbPercent ?? 0), Number(result.target?.bbPercent ?? 0), ctx)
            },
            {
                name: "SO%",
                historyKey: "so",
                maxLoops: 10,
                min: ctx.contactMin,
                max: ctx.contactMax,
                tolerance: 0.0045,
                hardLock: true,
                actual: result => Number(result.actual?.soPercent ?? 0),
                target: result => Number(result.target?.soPercent ?? 0),
                isLocked: result => Math.abs(Number(result.actual?.soPercent ?? 0) - Number(result.target?.soPercent ?? 0)) <= 0.0045,
                getValue: candidate => Number(candidate.tuning?.contact.pitchQualityContactEffect ?? 0),
                setValue: (candidate, value) => {
                    candidate.tuning!.contact.pitchQualityContactEffect = value
                    candidate.tuning!.contact.contactSkillEffect = value
                },
                fallback: (result, currentValue) => this.calculateStrikeoutContactEffect(Number(result.actual?.soPercent ?? 0), Number(result.target?.soPercent ?? 0), ctx)
            },
            {
                name: "AVG/BABIP",
                historyKey: "out",
                maxLoops: 12,
                min: ctx.outMin,
                max: ctx.outMax,
                tolerance: 0.003,
                hardLock: true,
                actual: result => Number(result.actual?.babip ?? 0),
                target: result => Number(result.target?.babip ?? 0),
                isLocked: result => (
                    Math.abs(Number(result.actual?.avg ?? 0) - Number(result.target?.avg ?? 0)) <= 0.003 &&
                    Math.abs(Number(result.actual?.babip ?? 0) - Number(result.target?.babip ?? 0)) <= 0.003
                ),
                getValue: candidate => Number(candidate.tuning?.contactQuality.outOutcomeScale ?? 0),
                setValue: (candidate, value) => { candidate.tuning!.contactQuality.outOutcomeScale = value },
                fallback: (result, currentValue) => this.calculateOutOutcomeScale([{ value: currentValue, actual: Number(result.actual?.babip ?? 0), target: Number(result.target?.babip ?? 0) }], ctx)
            },
            {
                name: "HR%",
                historyKey: "hr",
                maxLoops: 10,
                min: ctx.homeRunMin,
                max: ctx.homeRunMax,
                tolerance: 0.001,
                hardLock: true,
                actual: result => Number(result.actual?.homeRunPercent ?? 0),
                target: result => Number(result.target?.homeRunPercent ?? 0),
                isLocked: result => Math.abs(Number(result.actual?.homeRunPercent ?? 0) - Number(result.target?.homeRunPercent ?? 0)) <= 0.001,
                getValue: candidate => Number(candidate.tuning?.contactQuality.homeRunOutcomeScale ?? 0),
                setValue: (candidate, value) => { candidate.tuning!.contactQuality.homeRunOutcomeScale = value },
                fallback: (result, currentValue) => this.calculateOutcomeScale([{ value: currentValue, actual: Number(result.actual?.homeRunPercent ?? 0), target: Number(result.target?.homeRunPercent ?? 0) }], ctx.homeRunMin, ctx.homeRunMax)
            },
            {
                name: "2B%",
                historyKey: "double",
                maxLoops: 12,
                min: ctx.doubleMin,
                max: ctx.doubleMax,
                tolerance: 0.002,
                hardLock: true,
                actual: result => Number(result.actual?.doublePercent ?? 0),
                target: result => Number(result.target?.doublePercent ?? 0),
                isLocked: result => Math.abs(Number(result.actual?.doublePercent ?? 0) - Number(result.target?.doublePercent ?? 0)) <= 0.002,
                getValue: candidate => Number(candidate.tuning?.contactQuality.doubleOutcomeScale ?? 0),
                setValue: (candidate, value) => { candidate.tuning!.contactQuality.doubleOutcomeScale = value },
                fallback: (result, currentValue) => this.calculateOutcomeScale([{ value: currentValue, actual: Number(result.actual?.doublePercent ?? 0), target: Number(result.target?.doublePercent ?? 0) }], ctx.doubleMin, ctx.doubleMax)
            },
            {
                name: "3B%",
                historyKey: "triple",
                maxLoops: 10,
                min: ctx.tripleMin,
                max: ctx.tripleMax,
                tolerance: 0.0005,
                hardLock: true,
                actual: result => Number(result.actual?.triplePercent ?? 0),
                target: result => Number(result.target?.triplePercent ?? 0),
                isLocked: result => Math.abs(Number(result.actual?.triplePercent ?? 0) - Number(result.target?.triplePercent ?? 0)) <= 0.0005,
                getValue: candidate => Number(candidate.tuning?.contactQuality.tripleOutcomeScale ?? 0),
                setValue: (candidate, value) => { candidate.tuning!.contactQuality.tripleOutcomeScale = value },
                fallback: (result, currentValue) => this.calculateOutcomeScale([{ value: currentValue, actual: Number(result.actual?.triplePercent ?? 0), target: Number(result.target?.triplePercent ?? 0) }], ctx.tripleMin, ctx.tripleMax)
            },
            {
                name: "SBA/G",
                historyKey: "sb",
                maxLoops: 8,
                min: ctx.stealMin,
                max: ctx.stealMax,
                tolerance: 0.06,
                hardLock: false,
                actual: result => Number(result.actual?.teamSBAttemptsPerGame ?? 0),
                target: result => Number(result.target?.teamSBAttemptsPerGame ?? 0),
                isLocked: result => Math.abs(Number(result.actual?.teamSBAttemptsPerGame ?? 0) - Number(result.target?.teamSBAttemptsPerGame ?? 0)) <= 0.06,
                getValue: candidate => Number(candidate.tuning?.running.stealAttemptAggressionScale ?? 0),
                setValue: (candidate, value) => { candidate.tuning!.running.stealAttemptAggressionScale = value },
                fallback: (result, currentValue) => this.calculateOutcomeScale([{ value: currentValue, actual: Number(result.actual?.teamSBAttemptsPerGame ?? 0), target: Number(result.target?.teamSBAttemptsPerGame ?? 0) }], ctx.stealMin, ctx.stealMax)
            },
            {
                name: "R/G",
                historyKey: "br",
                maxLoops: 12,
                min: ctx.advancementMin,
                max: ctx.advancementMax,
                tolerance: 0.01,
                hardLock: false,
                actual: result => this.getNonHrRunConversion(result, "actual"),
                target: result => this.getNonHrRunConversion(result, "target"),
                isLocked: result => Math.abs(Number(result.actual?.teamRunsPerGame ?? 0) - Number(result.target?.teamRunsPerGame ?? 0)) <= 0.1,
                getValue: candidate => Number(candidate.tuning?.running.advancementAggressionScale ?? 0),
                setValue: (candidate, value) => { candidate.tuning!.running.advancementAggressionScale = value },
                fallback: (result, currentValue) => this.calculateOutcomeScale([{ value: currentValue, actual: this.getNonHrRunConversion(result, "actual"), target: this.getNonHrRunConversion(result, "target") }], ctx.advancementMin, ctx.advancementMax)
            }
        ]

        const clampStage = (value: number, stage: Stage): number => clamp(value, stage.min, stage.max)

        const stageRows = (history: any, stage: Stage): { value: number, actual: number, target: number }[] => {
            return (history[stage.historyKey] ?? []).filter((row: any) =>
                Number.isFinite(row.value) &&
                Number.isFinite(row.actual) &&
                Number.isFinite(row.target)
            )
        }

        const calculateNextValue = (history: any, stage: Stage, result: any, currentValue: number): number => {
            const rows = stageRows(history, stage)
            const unique = new Map<string, { value: number, actual: number, target: number }>()

            for (const row of rows) {
                unique.set(row.value.toFixed(6), row)
            }

            const sorted = Array.from(unique.values()).sort((a, b) => a.value - b.value)

            for (let i = 0; i < sorted.length; i++) {
                for (let j = i + 1; j < sorted.length; j++) {
                    const a = sorted[i]
                    const b = sorted[j]
                    const aDiff = a.actual - a.target
                    const bDiff = b.actual - b.target

                    if (Math.abs(aDiff) <= stage.tolerance) return clampStage(a.value, stage)
                    if (Math.abs(bDiff) <= stage.tolerance) return clampStage(b.value, stage)

                    if (aDiff * bDiff < 0) {
                        const slope = (b.actual - a.actual) / (b.value - a.value)

                        if (Number.isFinite(slope) && Math.abs(slope) > 0.000000001) {
                            return clampStage(a.value + ((a.target - a.actual) / slope), stage)
                        }

                        return clampStage((a.value + b.value) / 2, stage)
                    }
                }
            }

            const fallback = stage.fallback(result, currentValue)

            if (Number.isFinite(fallback) && Math.abs(fallback - currentValue) > 0.000001) {
                return clampStage(fallback, stage)
            }

            const actual = stage.actual(result)
            const target = stage.target(result)

            if (!Number.isFinite(actual) || !Number.isFinite(target)) {
                return currentValue
            }

            if (actual < target) return clampStage(currentValue + ((stage.max - currentValue) / 2), stage)
            if (actual > target) return clampStage(currentValue - ((currentValue - stage.min) / 2), stage)

            return currentValue
        }

        log("TUNING START", "mode=staged-residual-singles", `games=${ctx.gamesPerIteration}`, `verifyGames=${ctx.finalGamesPerIteration}`)

        let candidate = this.normalizeTuningShape(params?.startingCandidate ?? playerImporterService.seedPitchEnvironmentTuning(pitchEnvironment))
        let result = await this.evaluateOne(candidate, ctx, ctx.gamesPerIteration, "baseline")

        this.printStatus("baseline", 0, ctx.gamesPerIteration, candidate, result)

        for (const stage of stages) {
            log("STAGE START", stage.name)

            const history = this.createHistory()
            this.addHistoryRows(history, candidate, result)

            for (let i = 1; i <= stage.maxLoops; i++) {
                if (stage.isLocked(result)) {
                    log("STAGE 🔒", stage.name, `i=${i - 1}`)
                    break
                }

                const currentValue = stage.getValue(candidate)
                const nextValue = calculateNextValue(history, stage, result, currentValue)

                log("STAGE", stage.name, `i=${i}`, `rows=${stageRows(history, stage).length}`, `current=${this.f(currentValue)}`, `next=${this.f(nextValue)}`, `actual=${this.f(stage.actual(result))}`, `target=${this.f(stage.target(result))}`, `diff=${this.f(stage.actual(result) - stage.target(result))}`, `tol=${this.f(stage.tolerance)}`)

                if (!Number.isFinite(nextValue)) {
                    this.printToleranceFailures(`STAGE FAILED ${stage.name}`, result)
                    throw new Error(`PitchEnvironmentTuner stage ${stage.name} produced non-finite value`)
                }

                if (Math.abs(nextValue - currentValue) < 0.000001) {
                    if (stage.hardLock) {
                        this.printToleranceFailures(`STAGE FAILED ${stage.name}`, result)
                        throw new Error(`PitchEnvironmentTuner stage ${stage.name} could not lock; value=${this.f(currentValue)} actual=${this.f(stage.actual(result))} target=${this.f(stage.target(result))}`)
                    }

                    log("STAGE SOFT STOP", stage.name, `i=${i}`, `value=${this.f(currentValue)}`, `actual=${this.f(stage.actual(result))}`, `target=${this.f(stage.target(result))}`)
                    break
                }

                const nextCandidate = this.normalizeTuningShape(candidate)
                stage.setValue(nextCandidate, nextValue)

                candidate = this.normalizeTuningShape(nextCandidate)
                result = await this.evaluateOne(candidate, ctx, ctx.gamesPerIteration, `stage-${stage.name}-${i}`)

                this.addHistoryRows(history, candidate, result)
                this.printStatus(stage.isLocked(result) ? `${stage.name} 🔒` : stage.name, i, ctx.gamesPerIteration, candidate, result)
            }

            if (!stage.isLocked(result)) {
                if (stage.hardLock) {
                    this.printToleranceFailures(`STAGE FAILED ${stage.name}`, result)
                    throw new Error(`PitchEnvironmentTuner stage ${stage.name} failed to lock before moving on`)
                }

                log("STAGE SOFT UNLOCKED", stage.name, `actual=${this.f(stage.actual(result))}`, `target=${this.f(stage.target(result))}`)
            }
        }

        const verified = await this.evaluateOne(candidate, ctx, ctx.finalGamesPerIteration, "verify")

        this.printStatus("verify", stages.length + 1, ctx.finalGamesPerIteration, candidate, verified)

        if (!this.isCloseEnough(verified)) {
            this.printToleranceFailures("VERIFY FAILED", verified)
            throw new Error("PitchEnvironmentTuner residual-singles candidate failed verification")
        }

        return candidate
    }

    private static calculateOutcomeScale(rows: { value: number, actual: number, target: number }[], min: number, max: number): number {
        const usable = rows
            .filter(row =>
                Number.isFinite(row.value) &&
                Number.isFinite(row.actual) &&
                Number.isFinite(row.target)
            )
            .sort((a, b) => a.value - b.value)

        if (usable.length === 0) {
            return 0
        }

        let bestPair: { a: any, b: any, width: number } | undefined

        for (let i = 0; i < usable.length; i++) {
            for (let j = i + 1; j < usable.length; j++) {
                const a = usable[i]
                const b = usable[j]

                const aDiff = a.actual - a.target
                const bDiff = b.actual - b.target

                if (aDiff === 0) return clamp(a.value, min, max)
                if (bDiff === 0) return clamp(b.value, min, max)

                if (aDiff * bDiff < 0) {
                    const width = Math.abs(a.value - b.value)

                    if (!bestPair || width < bestPair.width) {
                        bestPair = { a, b, width }
                    }
                }
            }
        }

        if (bestPair) {
            const { a, b } = bestPair

            const slope = (b.actual - a.actual) / (b.value - a.value)

            if (Number.isFinite(slope) && Math.abs(slope) > 0.000000001) {
                const solved = a.value + ((a.target - a.actual) / slope)
                return clamp(solved, min, max)
            }

            return clamp((a.value + b.value) / 2, min, max)
        }

        const latest = usable[usable.length - 1]

        const current = latest.value
        const actual = latest.actual
        const target = latest.target

        if (actual === 0 && target > 0) {
            return clamp(current + ((max - current) / 2), min, max)
        }

        if (actual > 0 && target > 0) {
            const ratio = target / actual
            const next = ((1 + current) * ratio) - 1

            if (Number.isFinite(next) && Math.abs(next - current) > 0.000001) {
                return clamp(next, min, max)
            }
        }

        if (actual < target) {
            return clamp(current + ((max - current) / 2), min, max)
        }

        if (actual > target) {
            return clamp(current - ((current - min) / 2), min, max)
        }

        return clamp(current, min, max)
    }

    private static calculateOutOutcomeScale(rows: { value: number, actual: number, target: number }[], ctx: any): number {
        const usable = rows
            .filter(row =>
                Number.isFinite(row.value) &&
                Number.isFinite(row.actual) &&
                Number.isFinite(row.target)
            )
            .sort((a, b) => a.value - b.value)

        if (usable.length === 0) {
            return 0
        }

        let bestPair: { a: any, b: any, width: number } | undefined

        for (let i = 0; i < usable.length; i++) {
            for (let j = i + 1; j < usable.length; j++) {
                const a = usable[i]
                const b = usable[j]

                const aDiff = a.actual - a.target
                const bDiff = b.actual - b.target

                if (Math.abs(aDiff) <= 0.000001) {
                    return clamp(a.value, ctx.outMin, ctx.outMax)
                }

                if (Math.abs(bDiff) <= 0.000001) {
                    return clamp(b.value, ctx.outMin, ctx.outMax)
                }

                if (aDiff * bDiff < 0) {
                    const width = Math.abs(a.value - b.value)

                    if (!bestPair || width < bestPair.width) {
                        bestPair = { a, b, width }
                    }
                }
            }
        }

        if (bestPair) {
            const { a, b } = bestPair

            const slope = (b.actual - a.actual) / (b.value - a.value)

            if (Number.isFinite(slope) && Math.abs(slope) > 0.000000001) {
                const solved = a.value + ((a.target - a.actual) / slope)
                return clamp(solved, ctx.outMin, ctx.outMax)
            }

            return clamp((a.value + b.value) / 2, ctx.outMin, ctx.outMax)
        }

        const latest = usable[usable.length - 1]

        const current = latest.value
        const actual = latest.actual
        const targetValue = latest.target

        if (!Number.isFinite(actual) || !Number.isFinite(targetValue)) {
            return clamp(current, ctx.outMin, ctx.outMax)
        }

        const diff = actual - targetValue

        if (Math.abs(diff) <= 0.001) {
            return clamp(current, ctx.outMin, ctx.outMax)
        }

        const avgDiff = Number(ctx.latestResult?.actual?.avg ?? 0) - Number(ctx.latestResult?.target?.avg ?? 0)

        const scale = Math.max(0.005, Math.abs(diff) * 1.5)

        if (diff > 0 || avgDiff > 0) {
            return clamp(current + scale, ctx.outMin, ctx.outMax)
        }

        return clamp(current - scale, ctx.outMin, ctx.outMax)
    }

    private static calculateLinearKnob(rows: { value: number, actual: number, target: number }[], min: number, max: number, fallback: number): number {
        const usable = rows
            .filter(row =>
                Number.isFinite(row.value) &&
                Number.isFinite(row.actual) &&
                Number.isFinite(row.target)
            )
            .sort((a, b) => a.value - b.value)

        if (usable.length < 2) {
            return Number.isFinite(fallback)
                ? clamp(fallback, min, max)
                : fallback
        }

        let best: { a: any, b: any, strength: number } | undefined

        for (let i = 0; i < usable.length; i++) {
            for (let j = i + 1; j < usable.length; j++) {
                const a = usable[i]
                const b = usable[j]

                const dx = b.value - a.value
                const dy = b.actual - a.actual

                if (Math.abs(dx) < 1e-9 || Math.abs(dy) < 1e-9) {
                    continue
                }

                const strength = Math.abs(dx) * Math.abs(dy)

                if (!best || strength > best.strength) {
                    best = { a, b, strength }
                }
            }
        }

        if (!best) {
            return Number.isFinite(fallback)
                ? clamp(fallback, min, max)
                : fallback
        }

        const target = usable[usable.length - 1].target

        const slope = (best.b.actual - best.a.actual) / (best.b.value - best.a.value)

        if (!Number.isFinite(slope) || Math.abs(slope) < 1e-9) {
            return Number.isFinite(fallback)
                ? clamp(fallback, min, max)
                : fallback
        }

        const latest = usable[usable.length - 1]

        const rawSolved = latest.value + ((target - latest.actual) / slope)

        const maxStep =
            Math.abs(latest.value) >= 2 ? 0.25 :
            Math.abs(latest.value) >= 1 ? 0.18 :
            Math.abs(latest.value) >= 0.5 ? 0.12 :
            0.08

        const step = clamp(rawSolved - latest.value, -maxStep, maxStep)

        const solved = latest.value + step

        return clamp(solved, min, max)
    }

    private static calculateWalkRateScale(actual: number, target: number, ctx: any): number {
        const safeActual = Number(actual)
        const safeTarget = Number(target)

        if (!Number.isFinite(safeActual) || !Number.isFinite(safeTarget)) {
            return 0
        }

        const diff = safeTarget - safeActual

        if (Math.abs(diff) <= 0.000001) {
            return 0
        }

        const scale = diff * 2

        return clamp(scale, ctx.walkMin, ctx.walkMax)
    }

    private static calculateStrikeoutContactEffect(actual: number, target: number, ctx: any): number {
        if (actual <= 0 || target <= 0) return 0
        return clamp((actual - target) / 0.0015, ctx.contactMin, ctx.contactMax)
    }

    private static createHistory(): any {
        return {
            bb: [],
            so: [],
            out: [],
            double: [],
            triple: [],
            hr: [],
            sb: [],
            br: []
        }
    }

    private static addHistoryRows(history: any, candidate: PitchEnvironmentTuning, result: any): void {
        const actual = result.actual ?? {}
        const target = result.target ?? {}

        history.bb.push({ value: Number(candidate.tuning?.swing.walkRateScale ?? 0), actual: Number(actual.bbPercent ?? 0), target: Number(target.bbPercent ?? 0) })
        history.so.push({ value: Number(candidate.tuning?.contact.pitchQualityContactEffect ?? 0), actual: Number(actual.soPercent ?? 0), target: Number(target.soPercent ?? 0) })
        history.out.push({ value: Number(candidate.tuning?.contactQuality.outOutcomeScale ?? 0), actual: Number(actual.babip ?? 0), target: Number(target.babip ?? 0) })
        history.double.push({ value: Number(candidate.tuning?.contactQuality.doubleOutcomeScale ?? 0), actual: Number(actual.doublePercent ?? 0), target: Number(target.doublePercent ?? 0) })
        history.triple.push({ value: Number(candidate.tuning?.contactQuality.tripleOutcomeScale ?? 0), actual: Number(actual.triplePercent ?? 0), target: Number(target.triplePercent ?? 0) })
        history.hr.push({ value: Number(candidate.tuning?.contactQuality.homeRunOutcomeScale ?? 0), actual: Number(actual.homeRunPercent ?? 0), target: Number(target.homeRunPercent ?? 0) })
        history.sb.push({ value: Number(candidate.tuning?.running.stealAttemptAggressionScale ?? 0), actual: Number(actual.teamSBAttemptsPerGame ?? 0), target: Number(target.teamSBAttemptsPerGame ?? 0) })
        history.br.push({ value: Number(candidate.tuning?.running.advancementAggressionScale ?? 0), actual: this.getNonHrRunConversion(result, "actual"), target: this.getNonHrRunConversion(result, "target") })
    }

    private static async evaluateOne(candidate: PitchEnvironmentTuning, ctx: any, games: number, label: string): Promise<any> {
        const normalizedCandidate = this.normalizeTuningShape(candidate)
        const sampleCount = Math.max(1, Number(ctx.workers ?? 1))
        const candidates = new Array(sampleCount)
            .fill(0)
            .map(() => this.normalizeTuningShape(JSON.parse(JSON.stringify(normalizedCandidate))))

        const evaluated = await ctx.evaluateBatch(candidates, games, label)
        const results = evaluated
            .filter((row: any) => row?.ok && row?.result)
            .map((row: any) => ctx.applyScore(row.result))

        if (results.length === 0) {
            throw new Error(`evaluateOne produced no results for ${label}`)
        }

        const first = results[0]

        const actualKeys = Object.keys(first.actual ?? {})
        const targetKeys = Object.keys(first.target ?? {})
        const diffKeys = Object.keys(first.diff ?? {})

        const totalGames = games * results.length

        const averageBlock = (key: "actual" | "target" | "diff", keys: string[]): any => {
            const block: any = {}

            for (const metric of keys) {
                let total = 0
                let count = 0

                for (const result of results) {
                    const value = Number(result[key]?.[metric])

                    if (Number.isFinite(value)) {
                        total += value
                        count++
                    }
                }

                block[metric] = count > 0 ? total / count : 0
            }

            return block
        }

        const actual = averageBlock("actual", actualKeys)
        const target = averageBlock("target", targetKeys)
        const diff: any = {}

        for (const metric of diffKeys) {
            const actualValue = Number(actual[metric])
            const targetValue = Number(target[metric])

            if (Number.isFinite(actualValue) && Number.isFinite(targetValue)) {
                diff[metric] = actualValue - targetValue
            } else {
                let total = 0
                let count = 0

                for (const result of results) {
                    const value = Number(result.diff?.[metric])

                    if (Number.isFinite(value)) {
                        total += value
                        count++
                    }
                }

                diff[metric] = count > 0 ? total / count : 0
            }
        }

        let score = 0
        let scoreCount = 0

        for (const result of results) {
            const value = Number(result.score)

            if (Number.isFinite(value)) {
                score += value
                scoreCount++
            }
        }

        score = scoreCount > 0 ? score / scoreCount : Number.MAX_SAFE_INTEGER

        log(
            "EVAL SAMPLE",
            label,
            `workers=${sampleCount}`,
            `gamesEach=${games}`,
            `totalGames=${totalGames}`
        )

        return {
            actual,
            target,
            diff,
            score
        }
    }

    private static createTuningContext(pitchEnvironment: PitchEnvironmentTarget, rng: Function, params?: any): any {
        const baseSeed = String(rng())
        const gamesPerIteration = params?.gamesPerIteration ?? 30
        const finalGamesPerIteration = params?.finalGamesPerIteration ?? 500
        const workers = Math.max(1, params?.workers ?? 1)

        const evaluateBatch = async (candidates: PitchEnvironmentTuning[], games: number, tagPrefix: string) => {
            log("BATCH START", tagPrefix, `games=${games}`, `candidates=${candidates.length}`, `workers=${workers}`)

            if (workers > 1) {
                const results = await evaluateCandidatesWithWorkers(pitchEnvironment, candidates, games, workers, `${baseSeed}:${tagPrefix}`)
                log("BATCH DONE", tagPrefix, `results=${results.length}`)
                return results
            }

            const results = candidates.map(candidate => ({
                ok: true as const,
                candidate,
                result: evaluateCandidateLocal(pitchEnvironment, candidate, games, `${baseSeed}:${tagPrefix}:${candidate._id}`, currentBaseDataDir)
            }))

            log("BATCH DONE", tagPrefix, `results=${results.length}`)
            return results
        }

        return {
            pitchEnvironment,
            baseSeed,
            gamesPerIteration,
            finalGamesPerIteration,
            workers,
            maxLoops: params?.maxLoops ?? 20,
            outMin: -0.95,
            outMax: 0.95,
            singleMin: -0.95,
            singleMax: 0.95,
            doubleMin: -0.95,
            doubleMax: 0.95,
            tripleMin: -0.95,
            tripleMax: 0.95,
            homeRunMin: -0.95,
            homeRunMax: 0.95,
            walkMin: -1,
            walkMax: 1,
            stealMin: -0.99,
            stealMax: 4,
            advancementMin: -0.99,
            advancementMax: 4,
            contactMin: -250,
            contactMax: 250,
            evaluateBatch,
            applyScore: (rawResult: { actual: any, target: any, diff: any, score: number }) => this.normalizeHitTypeRatesToAtBats(rawResult)
        }
    }

    private static normalizeTuningShape(candidate: PitchEnvironmentTuning): PitchEnvironmentTuning {
        const c = JSON.parse(JSON.stringify(candidate ?? {}))

        c._id ??= uuidv4()
        c.tuning ??= {} as any
        c.tuning.contactQuality ??= {} as any
        c.tuning.swing ??= {} as any
        c.tuning.contact ??= {} as any
        c.tuning.running ??= {} as any
        c.tuning.meta ??= {} as any

        const q = c.tuning.contactQuality
        const s = c.tuning.swing
        const ct = c.tuning.contact
        const r = c.tuning.running
        const m = c.tuning.meta

        q.evScale = clamp(Number(q.evScale ?? 0), -50, 50)
        q.laScale = clamp(Number(q.laScale ?? 0), -50, 50)
        q.distanceScale = clamp(Number(q.distanceScale ?? 0), -75, 75)
        q.outOutcomeScale = clamp(Number(q.outOutcomeScale ?? 0), -0.75, 3)
        q.singleOutcomeScale = 0
        q.doubleOutcomeScale = clamp(Number(q.doubleOutcomeScale ?? 0), -0.75, 1.5)
        q.tripleOutcomeScale = clamp(Number(q.tripleOutcomeScale ?? 0), -0.75, 2.5)
        q.homeRunOutcomeScale = clamp(Number(q.homeRunOutcomeScale ?? 0), -0.75, 1.5)

        s.pitchQualityZoneSwingEffect = clamp(Number(s.pitchQualityZoneSwingEffect ?? 0), -200, 200)
        s.pitchQualityChaseSwingEffect = clamp(Number(s.pitchQualityChaseSwingEffect ?? 0), -200, 200)
        s.disciplineZoneSwingEffect = clamp(Number(s.disciplineZoneSwingEffect ?? 0), -200, 200)
        s.disciplineChaseSwingEffect = clamp(Number(s.disciplineChaseSwingEffect ?? 0), -200, 200)
        s.walkRateScale = clamp(Number(s.walkRateScale ?? 0), -0.9, 8)

        ct.pitchQualityContactEffect = clamp(Number(ct.pitchQualityContactEffect ?? 0), -250, 250)
        ct.contactSkillEffect = clamp(Number(ct.contactSkillEffect ?? 0), -250, 250)

        r.stealAttemptAggressionScale = clamp(Number(r.stealAttemptAggressionScale ?? 0), -0.99, 4)
        r.advancementAggressionScale = clamp(Number(r.advancementAggressionScale ?? 0), -1, 2)

        m.fullPitchQualityBonus = clamp(Number(m.fullPitchQualityBonus ?? 0), -1000, 1000)
        m.fullTeamDefenseBonus = clamp(Number(m.fullTeamDefenseBonus ?? 0), -400, 400)
        m.fullFielderDefenseBonus = clamp(Number(m.fullFielderDefenseBonus ?? 0), -400, 400)

        return c
    }


    private static normalizeHitTypeRatesToAtBats(result: { actual: any, target: any, diff: any, score: number }): { actual: any, target: any, diff: any, score: number } {
        const normalized = JSON.parse(JSON.stringify(result ?? {}))

        const normalizeBlock = (block: any): void => {
            if (!block) return

            const avg = Number(block.avg ?? 0)
            const single = Number(block.singlePercent ?? 0)
            const double = Number(block.doublePercent ?? 0)
            const triple = Number(block.triplePercent ?? 0)
            const homeRun = Number(block.homeRunPercent ?? 0)
            const hitTypeTotal = single + double + triple + homeRun

            if (!Number.isFinite(avg) || avg <= 0) return
            if (!Number.isFinite(hitTypeTotal) || hitTypeTotal <= 0) return

            const scale = avg / hitTypeTotal

            block.singlePercent = single * scale
            block.doublePercent = double * scale
            block.triplePercent = triple * scale
            block.homeRunPercent = homeRun * scale
        }

        normalizeBlock(normalized.actual)
        normalizeBlock(normalized.target)

        normalized.diff ??= {}

        for (const key of new Set([...Object.keys(normalized.actual ?? {}), ...Object.keys(normalized.target ?? {})])) {
            const actual = Number(normalized.actual?.[key])
            const target = Number(normalized.target?.[key])

            if (Number.isFinite(actual) && Number.isFinite(target)) {
                normalized.diff[key] = actual - target
            }
        }

        return normalized
    }

    private static isCloseEnough(result: any): boolean {
        return this.getToleranceReport(result).every(row => row.ok)
    }

    private static getToleranceReport(result: any): any[] {
        return [
            ["teamRunsPerGame", 0.10],
            ["ops", 0.007],
            ["obp", 0.004],
            ["slg", 0.003],
            ["avg", 0.02],
            ["babip", 0.005],
            ["teamHitsPerGame", 0.10],
            ["teamHomeRunsPerGame", 0.03],
            ["teamBBPerGame", 0.04],
            ["teamSBPerGame", 0.01],
            ["teamSBAttemptsPerGame", 0.06],
            ["bbPercent", 0.002],
            ["soPercent", 0.004],
            ["singlePercent", 0.003],
            ["doublePercent", 0.002],
            ["triplePercent", 0.00075],
            ["homeRunPercent", 0.002]
        ].map(([key, tolerance]: any[]) => {
            const actual = Number(result.actual?.[key] ?? 0)
            const target = Number(result.target?.[key] ?? 0)
            const diff = Math.abs(actual - target)

            return { key, actual, target, diff, tolerance, ok: diff <= tolerance }
        })
    }

    private static getNonHrRunConversion(result: any, side: "actual" | "target"): number {
        const row = result[side] ?? {}
        const runs = Number(row.teamRunsPerGame ?? 0)
        const hits = Number(row.teamHitsPerGame ?? 0)
        const walks = Number(row.teamBBPerGame ?? 0)
        const homeRuns = Number(row.teamHomeRunsPerGame ?? 0)
        const nonHrRuns = Math.max(0, runs - homeRuns)
        const nonHrTimesOnBase = Math.max(1e-9, hits + walks - homeRuns)

        return nonHrRuns / nonHrTimesOnBase
    }

    private static printFormulaDebug(loop: number, history: any, candidate: PitchEnvironmentTuning, nextCandidate: PitchEnvironmentTuning, result: any): void {
        const print = (name: string, rows: any[], current: number, next: number) => {
            const latest = rows[rows.length - 1]
            log("FORMULA", `loop=${loop}`, name, `rows=${rows.length}`, `actual=${this.f(latest.actual)}`, `target=${this.f(latest.target)}`, `current=${this.f(current)}`, `next=${this.f(next)}`)
        }

        print("bb", history.bb, Number(candidate.tuning?.swing.walkRateScale ?? 0), Number(nextCandidate.tuning?.swing.walkRateScale ?? 0))
        print("so", history.so, Number(candidate.tuning?.contact.pitchQualityContactEffect ?? 0), Number(nextCandidate.tuning?.contact.pitchQualityContactEffect ?? 0))
        print("out", history.out, Number(candidate.tuning?.contactQuality.outOutcomeScale ?? 0), Number(nextCandidate.tuning?.contactQuality.outOutcomeScale ?? 0))
        print("2b", history.double, Number(candidate.tuning?.contactQuality.doubleOutcomeScale ?? 0), Number(nextCandidate.tuning?.contactQuality.doubleOutcomeScale ?? 0))
        print("3b", history.triple, Number(candidate.tuning?.contactQuality.tripleOutcomeScale ?? 0), Number(nextCandidate.tuning?.contactQuality.tripleOutcomeScale ?? 0))
        print("hr", history.hr, Number(candidate.tuning?.contactQuality.homeRunOutcomeScale ?? 0), Number(nextCandidate.tuning?.contactQuality.homeRunOutcomeScale ?? 0))
        print("sb", history.sb, Number(candidate.tuning?.running.stealAttemptAggressionScale ?? 0), Number(nextCandidate.tuning?.running.stealAttemptAggressionScale ?? 0))
        print("br", history.br, Number(candidate.tuning?.running.advancementAggressionScale ?? 0), Number(nextCandidate.tuning?.running.advancementAggressionScale ?? 0))
    }

    private static printStatus(label: string, loop: number, games: number, candidate: PitchEnvironmentTuning, result: any): void {
        const actual = result.actual ?? {}
        const target = result.target ?? {}

        const actualHitSum = Number(actual.singlePercent ?? 0) + Number(actual.doublePercent ?? 0) + Number(actual.triplePercent ?? 0) + Number(actual.homeRunPercent ?? 0)
        const targetHitSum = Number(target.singlePercent ?? 0) + Number(target.doublePercent ?? 0) + Number(target.triplePercent ?? 0) + Number(target.homeRunPercent ?? 0)
        const actualXbh = Number(actual.doublePercent ?? 0) + Number(actual.triplePercent ?? 0) + Number(actual.homeRunPercent ?? 0)
        const targetXbh = Number(target.doublePercent ?? 0) + Number(target.triplePercent ?? 0) + Number(target.homeRunPercent ?? 0)

        log(
            "RESULT",
            label,
            `i=${loop}`,
            `G=${games}`,
            `R=${this.f(actual.teamRunsPerGame)}/${this.f(target.teamRunsPerGame)}`,
            `AVG=${this.f(actual.avg)}/${this.f(target.avg)}`,
            `HITSUM=${this.f(actualHitSum)}/${this.f(targetHitSum)}`,
            `BABIP=${this.f(actual.babip)}/${this.f(target.babip)}`,
            `1B=${this.f(actual.singlePercent)}/${this.f(target.singlePercent)}`,
            `2B=${this.f(actual.doublePercent)}/${this.f(target.doublePercent)}`,
            `3B=${this.f(actual.triplePercent)}/${this.f(target.triplePercent)}`,
            `HR=${this.f(actual.homeRunPercent)}/${this.f(target.homeRunPercent)}`,
            `XBH=${this.f(actualXbh)}/${this.f(targetXbh)}`,
            `BB%=${this.f(actual.bbPercent)}/${this.f(target.bbPercent)}`,
            `SO%=${this.f(actual.soPercent)}/${this.f(target.soPercent)}`,
            `SBA=${this.f(actual.teamSBAttemptsPerGame)}/${this.f(target.teamSBAttemptsPerGame)}`,
            `T[O=${this.f(candidate.tuning?.contactQuality.outOutcomeScale)} 1b=${this.f(candidate.tuning?.contactQuality.singleOutcomeScale)} 2b=${this.f(candidate.tuning?.contactQuality.doubleOutcomeScale)} 3b=${this.f(candidate.tuning?.contactQuality.tripleOutcomeScale)} hr=${this.f(candidate.tuning?.contactQuality.homeRunOutcomeScale)} bb=${this.f(candidate.tuning?.swing.walkRateScale)} so=${this.f(candidate.tuning?.contact.pitchQualityContactEffect)} sb=${this.f(candidate.tuning?.running.stealAttemptAggressionScale)} br=${this.f(candidate.tuning?.running.advancementAggressionScale)}]`
        )
    }

    private static printToleranceFailures(label: string, result: any): void {
        log(label, this.getToleranceReport(result).filter((row: any) => !row.ok))
    }

    private static f(value: any): string {
        const num = Number(value ?? 0)
        if (!Number.isFinite(num)) return "0"
        return Number(num.toFixed(3)).toString()
    }
}


export {
    importPitchEnvironmentTarget
}

export type {
    ImportPitchEnvironmentTargetResult
}