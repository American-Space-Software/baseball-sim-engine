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

        log("TUNING START", `mode=staged-hard-gates`, `workers=${ctx.workers}`, `games=${ctx.gamesPerIteration}`, `finalGames=${ctx.finalGamesPerIteration}`)

        let candidate = this.normalizeTuningShape(ctx.bestCandidate)
        let result = await this.evaluateOne(candidate, ctx, ctx.gamesPerIteration, "seed")

        ctx.printDiagnostic("seed", -1, ctx.gamesPerIteration, candidate, result)

        for (let pass = 0; pass < ctx.maxPasses; pass++) {
            log("PASS START", `pass=${pass}`, `games=${ctx.gamesPerIteration}`)

            const tuned = await this.runAllStages(candidate, result, ctx, ctx.gamesPerIteration, `pass-${pass}`)
            candidate = tuned.candidate
            result = tuned.result

            ctx.printDiagnostic("pass", pass, ctx.gamesPerIteration, candidate, result)

            if (this.isCloseEnough(result)) {
                log("PASS CLOSE ENOUGH", `pass=${pass}`)
                break
            }
        }

        result = await this.evaluateOne(candidate, ctx, ctx.finalGamesPerIteration, "final-start")
        ctx.printDiagnostic("final-start", ctx.maxPasses, ctx.finalGamesPerIteration, candidate, result)

        for (let pass = 0; pass < ctx.finalPasses; pass++) {
            if (this.isCloseEnough(result)) {
                break
            }

            log("FINAL PASS START", `pass=${pass}`, `games=${ctx.finalGamesPerIteration}`)

            const tuned = await this.runAllStages(candidate, result, ctx, ctx.finalGamesPerIteration, `final-${pass}`)
            candidate = tuned.candidate
            result = tuned.result

            ctx.printDiagnostic("final-pass", pass, ctx.finalGamesPerIteration, candidate, result)
        }

        if (!this.isCloseEnough(result)) {
            this.printToleranceFailures("FAILED FINAL TOLERANCES", result)
            throw new Error("PitchEnvironmentTuner failed to reach required tolerances")
        }

        log("DONE", `R=${result.actual.teamRunsPerGame.toFixed(3)}`, `AVG=${result.actual.avg.toFixed(3)}`, `BABIP=${result.actual.babip.toFixed(3)}`, `BB=${result.actual.teamBBPerGame.toFixed(3)}`, `SO%=${result.actual.soPercent.toFixed(3)}`, `HR=${result.actual.teamHomeRunsPerGame.toFixed(3)}`, `SB=${result.actual.teamSBPerGame.toFixed(3)}`)

        return candidate
    }

    private static async runAllStages(candidate: PitchEnvironmentTuning, result: any, ctx: any, games: number, label: string): Promise<{ candidate: PitchEnvironmentTuning, result: any }> {
        let currentCandidate = this.normalizeTuningShape(candidate)
        let currentResult = result

        const stages = this.getStages()

        for (const stage of stages) {
            const tuned = await this.runStageUntilComplete(currentCandidate, currentResult, ctx, games, `${label}-${stage.name}`, stage)
            currentCandidate = tuned.candidate
            currentResult = tuned.result
        }

        return {
            candidate: currentCandidate,
            result: currentResult
        }
    }

    private static async runStageUntilComplete(candidate: PitchEnvironmentTuning, result: any, ctx: any, games: number, label: string, stage: any): Promise<{ candidate: PitchEnvironmentTuning, result: any }> {
        let currentCandidate = this.normalizeTuningShape(candidate)
        let currentResult = result

        for (let iteration = 0; iteration < ctx.maxStageIterations; iteration++) {
            const complete = stage.isComplete(currentResult, ctx)

            this.printStageStatus(
                stage.name,
                iteration,
                games,
                currentCandidate,
                currentResult,
                complete
            )

            if (complete) {
                return {
                    candidate: currentCandidate,
                    result: currentResult
                }
            }

            const candidates = this.uniqueCandidates(
                stage.makeCandidates(currentCandidate, currentResult, ctx)
                    .map((row: PitchEnvironmentTuning) => this.normalizeTuningShape(row))
            )

            if (candidates.length === 0) {
                this.printStageFailures(
                    `STAGE ${stage.name} BLOCKED`,
                    stage,
                    currentResult
                )

                return {
                    candidate: currentCandidate,
                    result: currentResult
                }
            }

            const evaluated = await ctx.evaluateBatch(
                candidates,
                games,
                `${label}-${iteration}`
            )

            const results = evaluated.map((message: any) =>
                ctx.applyScore(message.result)
            )

            let bestCandidate = currentCandidate
            let bestResult = currentResult
            let bestStageError = stage.error(currentResult, ctx)

            for (let i = 0; i < candidates.length; i++) {
                const stageError = stage.error(results[i], ctx)

                if (stageError < bestStageError) {
                    bestCandidate = candidates[i]
                    bestResult = results[i]
                    bestStageError = stageError
                }
            }

            const currentStageError = stage.error(currentResult, ctx)

            if (bestStageError > currentStageError + 0.00001) {
                this.printStageFailures(
                    `STAGE ${stage.name} WORSE`,
                    stage,
                    bestResult
                )

                return {
                    candidate: currentCandidate,
                    result: currentResult
                }
            }

            if (Math.abs(bestStageError - currentStageError) <= 0.00001) {
                this.printStageFailures(
                    `STAGE ${stage.name} FLAT`,
                    stage,
                    currentResult
                )

                return {
                    candidate: currentCandidate,
                    result: currentResult
                }
            }

            currentCandidate = this.normalizeTuningShape(bestCandidate)
            currentResult = bestResult

            ctx.printDiagnostic(
                stage.name,
                iteration,
                games,
                currentCandidate,
                currentResult
            )
        }

        this.printStageFailures(
            `STAGE ${stage.name} MAX ITERATIONS`,
            stage,
            currentResult
        )

        return {
            candidate: currentCandidate,
            result: currentResult
        }
    }

    private static withinTolerance(diff: number, tolerance: number): boolean {
        return diff <= tolerance + 0.000001
    }

    private static getStages(): any[] {
        return [
            {
                name: "bb",
                isComplete: (result: any) => this.withinTolerance(this.diff(result, "bbPercent"), 0.0035),
                error: (result: any) => this.diff(result, "bbPercent") / 0.0035,
                makeCandidates: (candidate: PitchEnvironmentTuning, result: any, ctx: any) => this.makeWalkCandidates(candidate, result, ctx),
                report: (result: any) => this.makeStageReport(result, [
                    ["bbPercent", 0.0035]
                ])
            },
            {
                name: "so",
                isComplete: (result: any) => this.withinTolerance(this.diff(result, "soPercent"), 0.006),
                error: (result: any) => this.diff(result, "soPercent") / 0.006,
                makeCandidates: (candidate: PitchEnvironmentTuning, result: any, ctx: any) => {
                    const c = this.normalizeTuningShape(candidate)
                    const actual = Number(result.actual?.soPercent ?? 0)
                    const target = Number(result.target?.soPercent ?? 0)
                    const direction = actual < target ? -1 : 1
                    const values = [10, 20, 40, 70].flatMap(step => [direction * step, -direction * step])
                    const candidates: PitchEnvironmentTuning[] = []

                    for (const delta of values) {
                        candidates.push(this.withPatch(c, trial => {
                            trial.tuning!.contact.pitchQualityContactEffect = clamp(Number(trial.tuning!.contact.pitchQualityContactEffect ?? 0) + delta, ctx.contactMin, ctx.contactMax)
                        }))

                        candidates.push(this.withPatch(c, trial => {
                            trial.tuning!.contact.contactSkillEffect = clamp(Number(trial.tuning!.contact.contactSkillEffect ?? 0) + delta, ctx.contactMin, ctx.contactMax)
                        }))

                        candidates.push(this.withPatch(c, trial => {
                            trial.tuning!.contact.pitchQualityContactEffect = clamp(Number(trial.tuning!.contact.pitchQualityContactEffect ?? 0) + delta, ctx.contactMin, ctx.contactMax)
                            trial.tuning!.contact.contactSkillEffect = clamp(Number(trial.tuning!.contact.contactSkillEffect ?? 0) + delta, ctx.contactMin, ctx.contactMax)
                        }))
                    }

                    return candidates
                },
                report: (result: any) => this.makeStageReport(result, [
                    ["soPercent", 0.006]
                ])
            },
            {
                name: "avg_babip",
                isComplete: (result: any) => (
                    this.withinTolerance(this.diff(result, "avg"), 0.02) &&
                    this.withinTolerance(this.diff(result, "babip"), 0.008)
                ),
                error: (result: any) => (
                    (this.diff(result, "avg") / 0.02) +
                    (this.diff(result, "babip") / 0.008)
                ),
                makeCandidates: (candidate: PitchEnvironmentTuning, result: any, ctx: any) => this.makeContactConversionCandidates(candidate, result, ctx),
                report: (result: any) => this.makeStageReport(result, [
                    ["avg", 0.02],
                    ["babip", 0.008]
                ])
            },
            {
                name: "outcomes",
                isComplete: (result: any) => (
                    this.withinTolerance(this.diff(result, "singlePercent"), 0.015) &&
                    this.withinTolerance(this.diff(result, "doublePercent"), 0.006) &&
                    this.withinTolerance(this.diff(result, "triplePercent"), 0.0015) &&
                    this.withinTolerance(this.diff(result, "homeRunPercent"), 0.004)
                ),
                error: (result: any) => (
                    (this.diff(result, "singlePercent") / 0.015) +
                    (this.diff(result, "doublePercent") / 0.006) +
                    (this.diff(result, "triplePercent") / 0.0015) +
                    (this.diff(result, "homeRunPercent") / 0.004)
                ),
                makeCandidates: (candidate: PitchEnvironmentTuning, result: any, ctx: any) => this.makeOutcomeCandidates(candidate, result, ctx),
                report: (result: any) => this.makeStageReport(result, [
                    ["singlePercent", 0.015],
                    ["doublePercent", 0.006],
                    ["triplePercent", 0.0015],
                    ["homeRunPercent", 0.004]
                ])
            },
            {
                name: "sb",
                isComplete: (result: any) => (
                    this.withinTolerance(this.diff(result, "teamSBPerGame"), 0.04) &&
                    this.withinTolerance(this.diff(result, "teamSBAttemptsPerGame"), 0.08)
                ),
                error: (result: any) => (
                    (this.diff(result, "teamSBAttemptsPerGame") / 0.08) +
                    (this.diff(result, "teamSBPerGame") / 0.04)
                ),
                makeCandidates: (candidate: PitchEnvironmentTuning, result: any, ctx: any) => {
                    const c = this.normalizeTuningShape(candidate)
                    const current = Number(c.tuning!.running.stealAttemptAggressionScale ?? 0)
                    const actualAttempts = Number(result.actual?.teamSBAttemptsPerGame ?? 0)
                    const targetAttempts = Number(result.target?.teamSBAttemptsPerGame ?? 0)
                    const values = new Set<number>()

                    values.add(current)

                    if (actualAttempts > 0 && targetAttempts > 0) {
                        values.add(clamp(((1 + current) * (targetAttempts / actualAttempts)) - 1, ctx.stealMin, ctx.stealMax))
                    }

                    for (const delta of [-0.08, -0.05, -0.03, -0.02, -0.01, 0.01, 0.02, 0.03, 0.05, 0.08]) {
                        values.add(clamp(current + delta, ctx.stealMin, ctx.stealMax))
                    }

                    return Array.from(values).map(value => this.withPatch(c, trial => {
                        trial.tuning!.running.stealAttemptAggressionScale = value
                    }))
                },
                report: (result: any) => this.makeStageReport(result, [
                    ["teamSBPerGame", 0.04],
                    ["teamSBAttemptsPerGame", 0.08]
                ])
            },
            {
                name: "runs",
                isComplete: (result: any) => this.withinTolerance(this.diff(result, "teamRunsPerGame"), 0.18),
                error: (result: any) => this.diff(result, "teamRunsPerGame") / 0.18,
                makeCandidates: (candidate: PitchEnvironmentTuning, result: any, ctx: any) => this.makeBaserunningCandidates(candidate, result, ctx),
                report: (result: any) => this.makeStageReport(result, [
                    ["teamRunsPerGame", 0.18]
                ])
            }
        ]
    }


    private static makeContactConversionCandidates(candidate: PitchEnvironmentTuning, result: any, ctx: any): PitchEnvironmentTuning[] {
        const c = this.normalizeTuningShape(candidate)

        const actualAvg = Number(result.actual?.avg ?? 0)
        const targetAvg = Number(result.target?.avg ?? 0)
        const actualBabip = Number(result.actual?.babip ?? 0)
        const targetBabip = Number(result.target?.babip ?? 0)

        const teamDefenseCurrent = Number(c.tuning!.meta.fullTeamDefenseBonus ?? 0)
        const fielderDefenseCurrent = Number(c.tuning!.meta.fullFielderDefenseBonus ?? 0)
        const pitchQualityCurrent = Number(c.tuning!.meta.fullPitchQualityBonus ?? 0)

        const candidates: PitchEnvironmentTuning[] = []

        const babipHigh = actualBabip > targetBabip
        const avgHigh = actualAvg > targetAvg
        const primaryDefenseDirection = babipHigh || avgHigh ? 1 : -1
        const primaryPitchQualityDirection = babipHigh || avgHigh ? 1 : -1

        const defenseSteps = [25, 50, 100, 150, 225, 300, 400]
        const pitchQualitySteps = [50, 100, 200, 350, 500, 750, 1000]

        const defenseValues = new Set<number>()
        const pitchQualityValues = new Set<number>()

        defenseValues.add(teamDefenseCurrent)
        defenseValues.add(fielderDefenseCurrent)
        defenseValues.add(ctx.defenseMin)
        defenseValues.add(ctx.defenseMax)

        pitchQualityValues.add(pitchQualityCurrent)
        pitchQualityValues.add(ctx.pitchQualityMin)
        pitchQualityValues.add(ctx.pitchQualityMax)

        for (const direction of [primaryDefenseDirection, -primaryDefenseDirection]) {
            for (const step of defenseSteps) {
                defenseValues.add(clamp(teamDefenseCurrent + (direction * step), ctx.defenseMin, ctx.defenseMax))
                defenseValues.add(clamp(fielderDefenseCurrent + (direction * step), ctx.defenseMin, ctx.defenseMax))
            }
        }

        for (const direction of [primaryPitchQualityDirection, -primaryPitchQualityDirection]) {
            for (const step of pitchQualitySteps) {
                pitchQualityValues.add(clamp(pitchQualityCurrent + (direction * step), ctx.pitchQualityMin, ctx.pitchQualityMax))
            }
        }

        for (const value of defenseValues) {
            candidates.push(this.withPatch(c, trial => {
                trial.tuning!.meta.fullTeamDefenseBonus = value
                trial.tuning!.meta.fullFielderDefenseBonus = value
            }))

            candidates.push(this.withPatch(c, trial => {
                trial.tuning!.meta.fullTeamDefenseBonus = value
            }))

            candidates.push(this.withPatch(c, trial => {
                trial.tuning!.meta.fullFielderDefenseBonus = value
            }))
        }

        for (const value of pitchQualityValues) {
            candidates.push(this.withPatch(c, trial => {
                trial.tuning!.meta.fullPitchQualityBonus = value
            }))
        }

        for (const defenseValue of defenseValues) {
            for (const pitchQualityValue of pitchQualityValues) {
                candidates.push(this.withPatch(c, trial => {
                    trial.tuning!.meta.fullTeamDefenseBonus = defenseValue
                    trial.tuning!.meta.fullFielderDefenseBonus = defenseValue
                    trial.tuning!.meta.fullPitchQualityBonus = pitchQualityValue
                }))
            }
        }

        return this.uniqueCandidates(candidates)
    } 

    private static makeStageReport(result: any, rows: [string, number][]): any[] {
        return rows.map(([key, tolerance]) => {
            const actual = Number(result.actual?.[key] ?? 0)
            const target = Number(result.target?.[key] ?? 0)
            const diff = this.diff(result, key)

            return {
                key,
                actual,
                target,
                diff,
                tolerance,
                ok: this.withinTolerance(diff, tolerance)
            }
        })
    }
    private static makeWalkCandidates(candidate: PitchEnvironmentTuning, result: any, ctx: any): PitchEnvironmentTuning[] {
        const c = this.normalizeTuningShape(candidate)
        const current = clamp(Number(c.tuning!.swing.walkRateScale ?? 0), ctx.walkMin, ctx.walkMax)

        const actual = Number(result.actual?.bbPercent ?? 0)
        const target = Number(result.target?.bbPercent ?? 0)

        const values = new Set<number>()

        values.add(current)

        for (const value of [
            ctx.walkMin,
            -20,
            -15,
            -10,
            -7.5,
            -5,
            -2.5,
            -1,
            0,
            1,
            2.5,
            5,
            7.5,
            10,
            15,
            20,
            ctx.walkMax
        ]) {
            values.add(clamp(value, ctx.walkMin, ctx.walkMax))
        }

        const direction = actual < target ? 1 : -1

        for (const delta of [0.5, 1, 2.5, 5, 7.5, 10, 15]) {
            values.add(clamp(current + (direction * delta), ctx.walkMin, ctx.walkMax))
        }

        return Array.from(values).map(value => this.withPatch(c, trial => {
            trial.tuning!.swing.walkRateScale = clamp(value, ctx.walkMin, ctx.walkMax)
        }))
    }

    private static printStageFailures(label: string, stage: any, result: any): void {
        console.log(
            `[IMPORTER] ${label}`,
            stage.report(result)
                .filter((row: any) => !row.ok)
        )
    }

    private static makeOutcomeCandidates(candidate: PitchEnvironmentTuning, result: any, ctx: any): PitchEnvironmentTuning[] {
        const c = this.normalizeTuningShape(candidate)

        const specs = [
            {
                key: "singlePercent",
                tolerance: 0.015,
                min: ctx.singleMin,
                max: ctx.singleMax,
                spread: 0.02,
                getValue: (candidate: PitchEnvironmentTuning) => Number(candidate.tuning!.contactQuality.singleOutcomeScale ?? 0),
                setValue: (candidate: PitchEnvironmentTuning, value: number) => candidate.tuning!.contactQuality.singleOutcomeScale = value
            },
            {
                key: "doublePercent",
                tolerance: 0.006,
                min: ctx.doubleMin,
                max: ctx.doubleMax,
                spread: 0.01,
                getValue: (candidate: PitchEnvironmentTuning) => Number(candidate.tuning!.contactQuality.doubleOutcomeScale ?? 0),
                setValue: (candidate: PitchEnvironmentTuning, value: number) => candidate.tuning!.contactQuality.doubleOutcomeScale = value
            },
            {
                key: "triplePercent",
                tolerance: 0.0015,
                min: ctx.tripleMin,
                max: ctx.tripleMax,
                spread: 0.005,
                getValue: (candidate: PitchEnvironmentTuning) => Number(candidate.tuning!.contactQuality.tripleOutcomeScale ?? 0),
                setValue: (candidate: PitchEnvironmentTuning, value: number) => candidate.tuning!.contactQuality.tripleOutcomeScale = value
            },
            {
                key: "homeRunPercent",
                tolerance: 0.004,
                min: ctx.homeRunMin,
                max: ctx.homeRunMax,
                spread: 0.01,
                getValue: (candidate: PitchEnvironmentTuning) => Number(candidate.tuning!.contactQuality.homeRunOutcomeScale ?? 0),
                setValue: (candidate: PitchEnvironmentTuning, value: number) => candidate.tuning!.contactQuality.homeRunOutcomeScale = value
            }
        ].filter(spec => this.diff(result, spec.key) > spec.tolerance)

        const candidates: PitchEnvironmentTuning[] = []

        for (const spec of specs) {
            const actual = Number(result.actual?.[spec.key] ?? 0)
            const target = Number(result.target?.[spec.key] ?? 0)

            if (actual <= 0 || target <= 0) {
                continue
            }

            const current = clamp(spec.getValue(c), spec.min, spec.max)

            const predicted = clamp(
                ((1 + current) * (target / actual)) - 1,
                spec.min,
                spec.max
            )

            const values = [
                predicted - spec.spread,
                predicted - (spec.spread / 2),
                predicted,
                predicted + (spec.spread / 2),
                predicted + spec.spread
            ].map(value => clamp(value, spec.min, spec.max))

            for (const value of values) {
                candidates.push(this.withPatch(c, trial => {
                    spec.setValue(trial, value)
                }))
            }
        }

        return this.uniqueCandidates(candidates)
    }

    private static makeDefenseCandidates(candidate: PitchEnvironmentTuning, result: any, ctx: any): PitchEnvironmentTuning[] {
        const c = this.normalizeTuningShape(candidate)

        const actualBabip = Number(result.actual?.babip ?? 0)
        const targetBabip = Number(result.target?.babip ?? 0)
        const actualRuns = Number(result.actual?.teamRunsPerGame ?? 0)
        const targetRuns = Number(result.target?.teamRunsPerGame ?? 0)
        const actualSingles = Number(result.actual?.singlePercent ?? 0)
        const targetSingles = Number(result.target?.singlePercent ?? 0)

        if (actualBabip <= 0 || targetBabip <= 0) {
            return [c]
        }

        const current = Number(c.tuning!.meta.fullFielderDefenseBonus ?? 0)
        const direction = actualBabip > targetBabip ? 1 : -1
        const babipMiss = Math.abs(actualBabip - targetBabip)
        const babipTolerance = 0.008
        const unitMove = babipMiss / babipTolerance

        const runsFragile = actualRuns < targetRuns
        const singlesFragile = actualSingles <= targetSingles

        const maxStep =
            runsFragile && singlesFragile ? 1 :
            runsFragile || singlesFragile ? 2 :
            4

        const predicted = clamp(
            current + (direction * Math.min(maxStep, unitMove)),
            ctx.defenseMin,
            ctx.defenseMax
        )

        const values = [
            current,
            predicted,
            current + (direction * Math.min(maxStep, unitMove / 2)),
            current + (direction * Math.min(maxStep, unitMove * 1.5)),
            current + (direction * maxStep)
        ].map(value => clamp(value, ctx.defenseMin, ctx.defenseMax))

        return this.uniqueCandidates(values.map(value => this.withPatch(c, trial => {
            trial.tuning!.meta.fullTeamDefenseBonus = 0
            trial.tuning!.meta.fullFielderDefenseBonus = value
        })))
    }

    private static makeBaserunningCandidates(candidate: PitchEnvironmentTuning, result: any, ctx: any): PitchEnvironmentTuning[] {
        const c = this.normalizeTuningShape(candidate)

        const current = Number(c.tuning!.running.advancementAggressionScale ?? 0)

        const actualRuns = Number(result.actual?.teamRunsPerGame ?? 0)
        const targetRuns = Number(result.target?.teamRunsPerGame ?? 0)

        if (actualRuns <= 0 || targetRuns <= 0) {
            return [c]
        }

        const runsDiff = targetRuns - actualRuns
        const predicted = clamp(
            current + (runsDiff * 0.35),
            ctx.advancementMin,
            ctx.advancementMax
        )

        const values = [
            predicted - 0.10,
            predicted - 0.05,
            predicted,
            predicted + 0.05,
            predicted + 0.10
        ].map(value => clamp(value, ctx.advancementMin, ctx.advancementMax))

        return this.uniqueCandidates(values.map(value => this.withPatch(c, trial => {
            trial.tuning!.running.advancementAggressionScale = value
        })))
    }

    private static withPatch(candidate: PitchEnvironmentTuning, patch: (candidate: PitchEnvironmentTuning) => void): PitchEnvironmentTuning {
        const c = this.normalizeTuningShape(candidate)
        patch(c)
        c._id = uuidv4()
        return this.normalizeTuningShape(c)
    }

    private static uniqueCandidates(candidates: PitchEnvironmentTuning[]): PitchEnvironmentTuning[] {
        const seen = new Set<string>()
        const unique: PitchEnvironmentTuning[] = []

        for (const candidate of candidates) {
            const key = JSON.stringify(candidate.tuning)

            if (seen.has(key)) {
                continue
            }

            seen.add(key)
            unique.push(candidate)
        }

        return unique
    }

    private static async evaluateOne(candidate: PitchEnvironmentTuning, ctx: any, games: number, label: string): Promise<any> {
        const evaluated = await ctx.evaluateBatch([this.normalizeTuningShape(candidate)], games, label)
        return ctx.applyScore(evaluated[0].result)
    }

    private static printStageStatus(stage: string, iteration: number, games: number, candidate: PitchEnvironmentTuning, result: any, complete: boolean): void {
        const actual = result.actual ?? {}
        const target = result.target ?? {}
        const brActual = this.getNonHrRunConversion(result, "actual")
        const brTarget = this.getNonHrRunConversion(result, "target")

        log(
            "STAGE",
            stage,
            `i=${iteration}`,
            `G=${games}`,
            complete ? "DONE" : "WORK",
            `R=${this.f(actual.teamRunsPerGame)}/${this.f(target.teamRunsPerGame)}(${this.s(this.diff(result, "teamRunsPerGame"))})`,
            `AVG=${this.f(actual.avg)}/${this.f(target.avg)}(${this.s(this.diff(result, "avg"))})`,
            `BABIP=${this.f(actual.babip)}/${this.f(target.babip)}(${this.s(this.diff(result, "babip"))})`,
            `BB%=${this.f(actual.bbPercent)}/${this.f(target.bbPercent)}(${this.s(this.diff(result, "bbPercent"))})`,
            `SO%=${this.f(actual.soPercent)}/${this.f(target.soPercent)}(${this.s(this.diff(result, "soPercent"))})`,
            `1B=${this.f(actual.singlePercent)}/${this.f(target.singlePercent)}(${this.s(this.diff(result, "singlePercent"))})`,
            `2B=${this.f(actual.doublePercent)}/${this.f(target.doublePercent)}(${this.s(this.diff(result, "doublePercent"))})`,
            `3B=${this.f(actual.triplePercent)}/${this.f(target.triplePercent)}(${this.s(this.diff(result, "triplePercent"))})`,
            `HR=${this.f(actual.homeRunPercent)}/${this.f(target.homeRunPercent)}(${this.s(this.diff(result, "homeRunPercent"))})`,
            `SB=${this.f(actual.teamSBPerGame)}/${this.f(target.teamSBPerGame)}(${this.s(this.diff(result, "teamSBPerGame"))})`,
            `SBA=${this.f(actual.teamSBAttemptsPerGame)}/${this.f(target.teamSBAttemptsPerGame)}(${this.s(this.diff(result, "teamSBAttemptsPerGame"))})`,
            `BR=${this.f(brActual)}/${this.f(brTarget)}(${this.s(Math.abs(brActual - brTarget))})`,
            `T[1b=${this.f(candidate.tuning?.contactQuality.singleOutcomeScale)} 2b=${this.f(candidate.tuning?.contactQuality.doubleOutcomeScale)} 3b=${this.f(candidate.tuning?.contactQuality.tripleOutcomeScale)} hr=${this.f(candidate.tuning?.contactQuality.homeRunOutcomeScale)} bb=${this.f(candidate.tuning?.swing.walkRateScale)} so=${this.f(candidate.tuning?.contact.pitchQualityContactEffect)}/${this.f(candidate.tuning?.contact.contactSkillEffect)} sb=${this.f(candidate.tuning?.running.stealAttemptAggressionScale)} br=${this.f(candidate.tuning?.running.advancementAggressionScale)} def=${this.f(candidate.tuning?.meta.fullFielderDefenseBonus)}]`
        )
    }

    private static printToleranceFailures(label: string, result: any): void {
        log(label, this.getToleranceReport(result).filter((row: any) => !row.ok))
    }

    private static getToleranceReport(result: any): any[] {
        const rows = [
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
        ]

        return rows.map(([key, tolerance]: any[]) => {
            const actual = Number(result.actual?.[key] ?? 0)
            const target = Number(result.target?.[key] ?? 0)
            const diff = Math.abs(actual - target)

            return {
                key,
                actual,
                target,
                diff,
                tolerance,
                ok: diff <= tolerance
            }
        })
    }

    private static getTotalError(result: any): number {
        return this.getToleranceReport(result).reduce((sum, row) => sum + (row.diff / Math.max(1e-9, row.tolerance)), 0)
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

    private static createTuningContext(pitchEnvironment: PitchEnvironmentTarget, rng: Function, params?: any): any {
        const baseSeed = String(rng())
        const gamesPerIteration = params?.gamesPerIteration ?? 100
        const workers = Math.max(1, params?.workers ?? 1)
        const printDiagnostics = params?.printDiagnostics ?? true
        const maxPasses = params?.maxPasses ?? params?.maxIterations ?? 8
        const finalPasses = params?.finalPasses ?? 3
        const maxStageIterations = params?.maxStageIterations ?? 12
        const bestCandidate = this.normalizeTuningShape(params?.startingCandidate ?? playerImporterService.seedPitchEnvironmentTuning(pitchEnvironment))

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
                result: evaluateCandidateLocal(
                    pitchEnvironment,
                    candidate,
                    games,
                    `${baseSeed}:${tagPrefix}:${candidate._id}`,
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
            maxPasses,
            finalPasses,
            maxStageIterations,
            gamesPerIteration,
            finalGamesPerIteration: params?.finalGamesPerIteration ?? Math.max(gamesPerIteration, 250),
            workers,
            evMin: -50,
            evMax: 50,
            laMin: -50,
            laMax: 50,
            distanceMin: -75,
            distanceMax: 75,
            stealMin: -0.99,
            stealMax: 4,
            advancementMin: -1,
            advancementMax: 2,
            walkMin: -0.9,
            walkMax: 8,
            singleMin: -0.75,
            singleMax: 1.5,
            doubleMin: -0.75,
            doubleMax: 1.5,
            tripleMin: -0.75,
            tripleMax: 2.5,
            homeRunMin: -0.75,
            homeRunMax: 1.5,
            defenseMin: -400,
            defenseMax: 400,
            pitchQualityMin: -1000,
            pitchQualityMax: 1000,
            contactMin: -250,
            contactMax: 250,
            evaluateBatch,
            applyScore,
            printDiagnostic: (stage: string, iteration: number, games: number, candidate: PitchEnvironmentTuning, result: any) => {
                if (!printDiagnostics) return
                playerImporterService.printPitchEnvironmentIterationDiagnostics(stage, iteration, maxPasses, games, candidate, result)
            }
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

        q.singleOutcomeScale = clamp(Number(q.singleOutcomeScale ?? 0), -0.75, 1.5)
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

    private static diff(result: any, key: string): number {
        const actual = Number(result.actual?.[key] ?? 0)
        const target = Number(result.target?.[key] ?? 0)

        return Math.abs(actual - target)
    }

    private static relative(result: any, key: string): number {
        const actual = Number(result.actual?.[key] ?? 0)
        const target = Number(result.target?.[key] ?? 0)

        if (target === 0) {
            return Math.abs(actual)
        }

        return Math.abs((actual - target) / target)
    }


    private static f(value: any): string {
        const n = Number(value ?? 0)
        return Number.isFinite(n) ? n.toFixed(3) : "NaN"
    }

    private static s(value: any): string {
        const n = Number(value ?? 0)
        return `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(3)}`
    }

    private static isCloseEnough(result: any): boolean {
        return this.getToleranceReport(result).every(row => row.ok)
    }

}


export {
    importPitchEnvironmentTarget
}

export type {
    ImportPitchEnvironmentTargetResult
}