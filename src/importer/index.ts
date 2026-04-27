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

        log("TUNING START", `workers=${ctx.workers}`, `fastGames=${ctx.fastGamesPerIteration}`, `confirmGames=${ctx.confirmGamesPerIteration}`, `finalGames=${ctx.finalGamesPerIteration}`, `maxIterations=${ctx.maxIterations}`)

        log("SEED CONFIRM START", `candidate=${ctx.bestCandidate._id}`, `games=${ctx.confirmGamesPerIteration}`)
        const seedRaw = this.evaluateSeedCandidate(ctx.pitchEnvironment, ctx.bestCandidate, `seed-confirm:${ctx.baseSeed}:0`, ctx.confirmGamesPerIteration)
        ctx.bestResult = ctx.applyScore(seedRaw)
        log("SEED CONFIRM DONE", `score=${ctx.bestResult.score}`, `stage=${this.getStage(ctx.bestResult)}`, `runs=${this.getRuns(ctx.bestResult).toFixed(3)}`)

        ctx.printDiagnostic("seed", -1, ctx.confirmGamesPerIteration, ctx.bestCandidate, ctx.bestResult)

        await this.runStageTuningIterations(ctx)

        log("FINAL CONFIRM START", `candidate=${ctx.bestCandidate._id}`, `games=${ctx.finalGamesPerIteration}`)
        const finalRaw = this.evaluateSeedCandidate(ctx.pitchEnvironment, ctx.bestCandidate, `final-confirm:${ctx.baseSeed}:0`, ctx.finalGamesPerIteration)
        const finalResult = ctx.applyScore(finalRaw)
        log("FINAL CONFIRM DONE", `score=${finalResult.score}`, `stage=${this.getStage(finalResult)}`, `runs=${this.getRuns(finalResult).toFixed(3)}`)

        ctx.printDiagnostic("final", ctx.maxIterations, ctx.finalGamesPerIteration, ctx.bestCandidate, finalResult)

        log("TUNING DONE", `best=${finalResult.score}`, `runs=${this.getRuns(finalResult).toFixed(3)}`, `accepted=${ctx.acceptedIterations}`)

        return ctx.bestCandidate
    }

    private static createTuningContext(pitchEnvironment: PitchEnvironmentTarget, rng: Function, params?: any): any {
        const baseSeed = String(rng())
        const startingCandidate = params?.startingCandidate as PitchEnvironmentTuning | undefined
        const options = params ?? {}

        let bestCandidate = startingCandidate
            ? JSON.parse(JSON.stringify(startingCandidate)) as PitchEnvironmentTuning
            : playerImporterService.seedPitchEnvironmentTuning(pitchEnvironment)

        bestCandidate = this.normalizeTuningShape(bestCandidate)

        if (!bestCandidate._id) {
            bestCandidate._id = uuidv4()
        }

        const maxIterations = options?.maxIterations ?? 18
        const gamesPerIteration = options?.gamesPerIteration ?? 75
        const printDiagnostics = options?.printDiagnostics ?? true
        const maxStallIterations = options?.maxStallIterations ?? 4
        const workers = Math.max(1, options?.workers ?? 1)
        const heartbeatEvery = Math.max(1, options?.heartbeatEvery ?? 3)
        const fastGamesPerIteration = options?.fastGamesPerIteration ?? Math.max(50, Math.min(gamesPerIteration, 75))
        const confirmGamesPerIteration = options?.confirmGamesPerIteration ?? Math.max(gamesPerIteration, 150)
        const finalGamesPerIteration = options?.finalGamesPerIteration ?? Math.max(confirmGamesPerIteration, 250)
        const confirmPoolSize = options?.confirmPoolSize ?? 2

        const knobGroups = this.getKnobGroups()
        const allKnobs = knobGroups.flatMap(group => group.knobs.map((knob: any) => ({ groupName: group.group, knob })))

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

        const applyScore = (rawResult: { actual: any, target: any, diff: any, score: number }) => this.applyStageScore(rawResult)

        const scoreBatch = (evaluated: any[]) => {
            return evaluated.map(message => ({
                candidate: message.candidate,
                rawResult: message.result,
                result: applyScore(message.result)
            }))
        }

        const buildDirectionalTrial = (base: PitchEnvironmentTuning, entry: any, direction: number, magnitude: number): PitchEnvironmentTuning | undefined =>
            this.mutateSimpleKnobTrial(base, entry.knob, direction, magnitude)

        const printDiagnostic = (stage: string, iteration: number, games: number, candidate: PitchEnvironmentTuning, result: { actual: any, target: any, diff: any, score: number }) => {
            if (!printDiagnostics) return
            playerImporterService.printPitchEnvironmentIterationDiagnostics(stage, iteration, maxIterations, games, candidate, result)
        }

        return {
            pitchEnvironment,
            baseSeed,
            options,
            bestCandidate,
            bestResult: undefined,
            maxIterations,
            gamesPerIteration,
            printDiagnostics,
            maxStallIterations,
            workers,
            heartbeatEvery,
            fastGamesPerIteration,
            confirmGamesPerIteration,
            finalGamesPerIteration,
            confirmPoolSize,
            knobGroups,
            allKnobs,
            evaluateBatch,
            applyScore,
            scoreBatch,
            buildDirectionalTrial,
            printDiagnostic,
            stallIterations: 0,
            acceptedIterations: 0,
            stageDirections: new Map<string, Map<string, number[]>>()
        }
    }

    private static normalizeTuningShape(candidate: PitchEnvironmentTuning): PitchEnvironmentTuning {
        const normalized = JSON.parse(JSON.stringify(candidate)) as PitchEnvironmentTuning

        if (!normalized.tuning) {
            normalized.tuning = {} as any
        }

        const tuning: any = normalized.tuning

        tuning.contactQuality = tuning.contactQuality ?? {}
        tuning.pitch = tuning.pitch ?? {}
        tuning.swing = tuning.swing ?? {}
        tuning.contact = tuning.contact ?? {}
        tuning.running = tuning.running ?? {}
        tuning.meta = tuning.meta ?? {}

        if (tuning.meta.fullPitchQualityBonus === undefined && tuning.contactQuality.fullPitchQualityBonus !== undefined) {
            tuning.meta.fullPitchQualityBonus = tuning.contactQuality.fullPitchQualityBonus
        }

        if (tuning.meta.fullTeamDefenseBonus === undefined && tuning.defense?.fullTeamDefenseBonus !== undefined) {
            tuning.meta.fullTeamDefenseBonus = tuning.defense.fullTeamDefenseBonus
        }

        if (tuning.meta.fullFielderDefenseBonus === undefined && tuning.defense?.fullFielderDefenseBonus !== undefined) {
            tuning.meta.fullFielderDefenseBonus = tuning.defense.fullFielderDefenseBonus
        }

        delete tuning.contactQuality.fullPitchQualityBonus
        delete tuning.defense

        tuning.contactQuality.evScale = Number(tuning.contactQuality.evScale ?? 0)
        tuning.contactQuality.laScale = Number(tuning.contactQuality.laScale ?? 0)
        tuning.contactQuality.distanceScale = Number(tuning.contactQuality.distanceScale ?? 0)

        tuning.pitch.velocityToQualityScale = Number(tuning.pitch.velocityToQualityScale ?? 0)
        tuning.pitch.movementToQualityScale = Number(tuning.pitch.movementToQualityScale ?? 0)
        tuning.pitch.controlToQualityScale = Number(tuning.pitch.controlToQualityScale ?? 0)

        tuning.swing.pitchQualityZoneSwingEffect = Number(tuning.swing.pitchQualityZoneSwingEffect ?? 0)
        tuning.swing.pitchQualityChaseSwingEffect = Number(tuning.swing.pitchQualityChaseSwingEffect ?? 0)
        tuning.swing.disciplineZoneSwingEffect = Number(tuning.swing.disciplineZoneSwingEffect ?? 0)
        tuning.swing.disciplineChaseSwingEffect = Number(tuning.swing.disciplineChaseSwingEffect ?? 0)

        tuning.contact.pitchQualityContactEffect = Number(tuning.contact.pitchQualityContactEffect ?? 0)
        tuning.contact.contactSkillEffect = Number(tuning.contact.contactSkillEffect ?? 0)

        tuning.running.stealAttemptAggressionScale = Number(tuning.running.stealAttemptAggressionScale ?? 1)

        tuning.meta.fullPitchQualityBonus = Number(tuning.meta.fullPitchQualityBonus ?? 0)
        tuning.meta.fullTeamDefenseBonus = Number(tuning.meta.fullTeamDefenseBonus ?? 0)
        tuning.meta.fullFielderDefenseBonus = Number(tuning.meta.fullFielderDefenseBonus ?? 0)

        return normalized
    }    

    private static async discoverStageDirections(ctx: any, stage: "pitch" | "avg" | "obp" | "slg" | "ops" | "runs" | "done", iteration: number): Promise<void> {
        if (stage === "done") return

        if (!ctx.stageDirections) {
            ctx.stageDirections = new Map<string, Map<string, number[]>>()
        }

        if (ctx.stageDirections.has(stage)) {
            return
        }

        const candidates: PitchEnvironmentTuning[] = []
        const candidateMeta: { path: string, direction: number }[] = []
        const seen = new Set<string>()
        const paths = this.getStageKnobPaths(stage)
        const entries = ctx.allKnobs.filter((entry: any) => paths.has(this.pathKey(entry.knob.path)))

        for (const entry of entries) {
            const path = this.pathKey(entry.knob.path)

            for (const direction of [-1, 1]) {
                const candidate = ctx.buildDirectionalTrial(ctx.bestCandidate, entry, direction, 1)

                if (!candidate) continue

                const signature = JSON.stringify(candidate.tuning)
                if (seen.has(signature)) continue

                seen.add(signature)
                candidates.push(candidate)
                candidateMeta.push({ path, direction })
            }
        }

        if (candidates.length === 0) {
            ctx.stageDirections.set(stage, new Map())
            return
        }

        log("STAGE DIRECTION PROBE START", `stage=${stage}`, `candidates=${candidates.length}`, `games=${ctx.fastGamesPerIteration}`)

        const evaluated = await ctx.evaluateBatch(candidates, ctx.fastGamesPerIteration, `stage-direction:${ctx.baseSeed}:${iteration}:${stage}`)
        const scored = ctx.scoreBatch(evaluated)

        const currentStageScore = this.getStageScore(stage, ctx.bestResult)
        const directionScores = new Map<string, { direction: number, score: number, runs: number }[]>()

        for (let i = 0; i < scored.length; i++) {
            const meta = candidateMeta[i]
            const result = scored[i].result
            const stageScore = this.getStageScore(stage, result)

            if (!directionScores.has(meta.path)) {
                directionScores.set(meta.path, [])
            }

            directionScores.get(meta.path)!.push({
                direction: meta.direction,
                score: stageScore,
                runs: this.getRuns(result)
            })
        }

        const discovered = new Map<string, number[]>()

        for (const [path, rows] of directionScores.entries()) {
            const improving = rows
                .filter(row => row.score < currentStageScore)
                .sort((a, b) => a.score - b.score)

            if (improving.length > 0) {
                discovered.set(path, [improving[0].direction])
                log("STAGE DIRECTION", `stage=${stage}`, `path=${path}`, `direction=${improving[0].direction}`, `score=${improving[0].score.toFixed(5)}`, `runs=${improving[0].runs.toFixed(3)}`)
                continue
            }

            const best = rows.sort((a, b) => a.score - b.score)[0]
            discovered.set(path, [best.direction])
            log("STAGE DIRECTION", `stage=${stage}`, `path=${path}`, `direction=${best.direction}`, `score=${best.score.toFixed(5)}`, `runs=${best.runs.toFixed(3)}`, `note=no-improvement`)
        }

        ctx.stageDirections.set(stage, discovered)
        log("STAGE DIRECTION PROBE DONE", `stage=${stage}`, `knobs=${discovered.size}`)
    }

    private static async runStageTuningIterations(ctx: any): Promise<void> {
        for (let iteration = 0; iteration < ctx.maxIterations; iteration++) {
            const stage = this.getStage(ctx.bestResult)

            if (stage === "done") {
                log("ITER STOP", `reason=done`)
                break
            }

            await this.discoverStageDirections(ctx, stage, iteration)

            const candidates = this.buildStageCandidateBatch(ctx, stage)

            if (candidates.length === 0) {
                log("ITER SKIP", `iter=${iteration}`, `stage=${stage}`, "reason=no-candidates")
                break
            }

            log("ITER START", `iter=${iteration}`, `stage=${stage}`, `candidates=${candidates.length}`, `stall=${ctx.stallIterations}`, `stageScore=${this.getStageScore(stage, ctx.bestResult).toFixed(5)}`, `runs=${this.getRuns(ctx.bestResult).toFixed(3)}`)

            const evaluatedFast = await ctx.evaluateBatch(candidates, ctx.fastGamesPerIteration, `iter-fast:${ctx.baseSeed}:${iteration}:${stage}`)
            const scoredFast = ctx.scoreBatch(evaluatedFast)
                .sort((a: any, b: any) => this.compareStageCandidates(stage, a.result, b.result))

            const fastPool = scoredFast
                .filter((item: any) => this.isStageCandidateWorthConfirming(stage, ctx.bestResult, item.result))
                .slice(0, ctx.confirmPoolSize)

            const winnerFast = fastPool[0] ?? scoredFast[0]

            log("ITER FAST DONE", `iter=${iteration}`, `stage=${stage}`, `winnerStageScore=${this.getStageScore(stage, winnerFast.result).toFixed(5)}`, `runs=${this.getRuns(winnerFast.result).toFixed(3)}`, `pool=${fastPool.length}`)
            ctx.printDiagnostic("trial", iteration, ctx.fastGamesPerIteration, winnerFast.candidate, winnerFast.result)

            if (fastPool.length === 0) {
                ctx.stallIterations++

                if (this.shouldStopStageTuning(ctx)) {
                    log("ITER STOP", `reason=stall`, `stage=${stage}`, `stall=${ctx.stallIterations}`)
                    break
                }

                continue
            }

            log("ITER CONFIRM START", `iter=${iteration}`, `stage=${stage}`, `pool=${fastPool.length}`, `games=${ctx.confirmGamesPerIteration}`)

            const evaluatedConfirm = await ctx.evaluateBatch(fastPool.map((item: any) => item.candidate), ctx.confirmGamesPerIteration, `iter-confirm:${ctx.baseSeed}:${iteration}:${stage}`)
            const scoredConfirm = ctx.scoreBatch(evaluatedConfirm)
                .sort((a: any, b: any) => this.compareStageCandidates(stage, a.result, b.result))

            const winnerConfirm = scoredConfirm[0]

            log("ITER CONFIRM DONE", `iter=${iteration}`, `stage=${stage}`, `winnerStageScore=${this.getStageScore(stage, winnerConfirm.result).toFixed(5)}`, `runs=${this.getRuns(winnerConfirm.result).toFixed(3)}`)
            ctx.printDiagnostic("confirm", iteration, ctx.confirmGamesPerIteration, winnerConfirm.candidate, winnerConfirm.result)

            if (this.shouldAcceptStageCandidate(stage, ctx.bestResult, winnerConfirm.result)) {
                ctx.bestCandidate = JSON.parse(JSON.stringify(winnerConfirm.candidate))
                ctx.bestResult = winnerConfirm.result
                ctx.stallIterations = 0
                ctx.acceptedIterations++

                const nextStage = this.getStage(ctx.bestResult)

                log("ITER ACCEPTED", `iter=${iteration}`, `stage=${stage}`, `nextStage=${nextStage}`, `score=${ctx.bestResult.score.toFixed(1)}`, `runs=${this.getRuns(ctx.bestResult).toFixed(3)}`)
                ctx.printDiagnostic("accepted", iteration, ctx.confirmGamesPerIteration, ctx.bestCandidate, ctx.bestResult)

                ctx.stageDirections?.clear()

                if (nextStage !== stage) {
                    log("STAGE ADVANCE", `from=${stage}`, `to=${nextStage}`)
                }

                if (nextStage === "done") {
                    log("ITER STOP", `reason=done`)
                    break
                }
            } else {
                ctx.stallIterations++
            }

            if (ctx.printDiagnostics && ((iteration + 1) % ctx.heartbeatEvery === 0)) {
                log("HEARTBEAT", `iter=${iteration + 1}/${ctx.maxIterations}`, `stage=${this.getStage(ctx.bestResult)}`, `score=${ctx.bestResult.score.toFixed(1)}`, `runs=${this.getRuns(ctx.bestResult).toFixed(3)}`, `stall=${ctx.stallIterations}`, `accepted=${ctx.acceptedIterations}`)
            }

            if (this.shouldStopStageTuning(ctx)) {
                log("ITER STOP", `reason=stall`, `stage=${this.getStage(ctx.bestResult)}`, `stall=${ctx.stallIterations}`)
                break
            }
        }
    }

    private static buildStageCandidateBatch(ctx: any, stage: "pitch" | "avg" | "obp" | "slg" | "ops" | "runs" | "done"): PitchEnvironmentTuning[] {
        const candidates: PitchEnvironmentTuning[] = []
        const seen = new Set<string>()
        const paths = this.getStageKnobPaths(stage)
        const entries = ctx.allKnobs.filter((entry: any) => paths.has(this.pathKey(entry.knob.path)))
        const directions = ctx.stageDirections?.get(stage) ?? new Map<string, number[]>()

        for (const entry of entries) {
            const path = this.pathKey(entry.knob.path)
            const directed = directions.get(path) ?? [-1, 1]

            for (const direction of directed) {
                for (const magnitude of [0.5, 1, 2]) {
                    this.pushUniqueCandidate(candidates, seen, ctx.buildDirectionalTrial(ctx.bestCandidate, entry, direction, magnitude))
                }
            }
        }

        return candidates
    }

    private static mutateSimpleKnobTrial(baseCandidate: PitchEnvironmentTuning, knob: any, direction: number, magnitude: number): PitchEnvironmentTuning | undefined {
        const trial = this.cloneCandidate(baseCandidate)
        const currentValue = this.getNested(trial.tuning, knob.path)
        const nextValue = this.round(this.clamp(currentValue + (knob.step * direction * magnitude), knob.min, knob.max), knob.digits)

        if (nextValue === currentValue) {
            return undefined
        }

        this.setNested(trial.tuning, knob.path, nextValue)
        return trial
    }

    private static getStage(result: { actual: any, target: any }): "pitch" | "avg" | "obp" | "slg" | "ops" | "runs" | "done" {
        const diff = (key: string): number => Math.abs(Number(result.actual?.[key] ?? 0) - Number(result.target?.[key] ?? 0))

        const pitchError =
            diff("pitchesPerPA") +
            diff("swingAtStrikesPercent") +
            diff("swingAtBallsPercent") +
            diff("inZoneContactPercent") +
            diff("outZoneContactPercent")

        if (pitchError > 0.085) return "pitch"
        if (diff("obp") > 0.007 || diff("bbPercent") > 0.009) return "obp"
        if (diff("slg") > 0.012 || diff("homeRunPercent") > 0.004) return "slg"
        if (diff("ops") > 0.014) return "ops"
        if (diff("avg") > 0.0015) return "avg"
        if (diff("babip") > 0.010) return "avg"
        if (diff("teamRunsPerGame") > 0.25) return "runs"

        return "done"
    }

    private static getStageScore(stage: "pitch" | "avg" | "obp" | "slg" | "ops" | "runs" | "done", result: { actual: any, target: any }): number {
        const diff = (key: string): number => Math.abs(Number(result.actual?.[key] ?? 0) - Number(result.target?.[key] ?? 0))

        if (stage === "pitch") {
            return (
                diff("pitchesPerPA") * 1 +
                diff("swingAtStrikesPercent") * 8 +
                diff("swingAtBallsPercent") * 8 +
                diff("inZoneContactPercent") * 8 +
                diff("outZoneContactPercent") * 8
            )
        }

        if (stage === "avg") {
            return (
                diff("avg") * 100 +
                diff("babip") * 8 +
                diff("singlePercent") * 2
            )
        }

        if (stage === "obp") {
            return (
                diff("obp") * 10 +
                diff("bbPercent") * 8 +
                diff("teamBBPerGame") * 0.5
            )
        }

        if (stage === "slg") {
            return (
                diff("slg") * 10 +
                diff("homeRunPercent") * 10 +
                diff("teamHomeRunsPerGame") * 0.5
            )
        }

        if (stage === "ops") {
            return (
                diff("ops") * 12 +
                diff("obp") * 5 +
                diff("slg") * 5
            )
        }

        if (stage === "runs") {
            return diff("teamRunsPerGame")
        }

        return 0
    }

    private static passesStageGuard(stage: "pitch" | "avg" | "obp" | "slg" | "ops" | "runs" | "done", result: { actual: any, target: any }): boolean {
        const diff = (key: string): number => Math.abs(Number(result.actual?.[key] ?? 0) - Number(result.target?.[key] ?? 0))
        const signedDiff = (key: string): number => Number(result.actual?.[key] ?? 0) - Number(result.target?.[key] ?? 0)

        if (stage !== "pitch") {
            const pitchError =
                diff("pitchesPerPA") +
                diff("swingAtStrikesPercent") +
                diff("swingAtBallsPercent") +
                diff("inZoneContactPercent") +
                diff("outZoneContactPercent")

            if (pitchError > 0.115) return false
        }

        if (stage === "avg") {
            if (signedDiff("obp") < -0.010) return false
            if (signedDiff("teamRunsPerGame") < -0.35) return false
        }

        if (stage !== "pitch" && stage !== "avg") {
            if (diff("avg") > 0.012) return false
            if (diff("babip") > 0.016) return false
        }

        if (stage === "slg" || stage === "ops" || stage === "runs" || stage === "done") {
            if (diff("obp") > 0.012) return false
            if (diff("bbPercent") > 0.014) return false
        }

        if (stage === "ops" || stage === "runs" || stage === "done") {
            if (diff("slg") > 0.018) return false
            if (diff("homeRunPercent") > 0.006) return false
        }

        return true
    }

    private static compareStageCandidates(stage: "pitch" | "avg" | "obp" | "slg" | "ops" | "runs" | "done", a: { actual: any, target: any, diff: any, score: number }, b: { actual: any, target: any, diff: any, score: number }): number {
        const aGuard = this.passesStageGuard(stage, a)
        const bGuard = this.passesStageGuard(stage, b)

        if (aGuard !== bGuard) return aGuard ? -1 : 1

        const aStageScore = this.getStageScore(stage, a)
        const bStageScore = this.getStageScore(stage, b)

        if (aStageScore !== bStageScore) return aStageScore - bStageScore

        return a.score - b.score
    }

    private static isStageCandidateWorthConfirming(stage: "pitch" | "avg" | "obp" | "slg" | "ops" | "runs" | "done", current: { actual: any, target: any, diff: any, score: number }, result: { actual: any, target: any, diff: any, score: number }): boolean {
        if (!this.passesStageGuard(stage, result)) return false

        const diff = (item: { actual: any, target: any }, key: string): number => Math.abs(Number(item.actual?.[key] ?? 0) - Number(item.target?.[key] ?? 0))

        if (stage === "avg") {
            const currentAvgDiff = diff(current, "avg")
            const nextAvgDiff = diff(result, "avg")

            if (nextAvgDiff >= currentAvgDiff) return false

            const currentBabipDiff = diff(current, "babip")
            const nextBabipDiff = diff(result, "babip")

            if (nextBabipDiff > currentBabipDiff + 0.004) return false

            return true
        }

        return this.getStageScore(stage, result) < this.getStageScore(stage, current)
    }

    private static shouldAcceptStageCandidate(stage: "pitch" | "avg" | "obp" | "slg" | "ops" | "runs" | "done", current: { actual: any, target: any, diff: any, score: number }, result: { actual: any, target: any, diff: any, score: number }): boolean {
        if (!this.passesStageGuard(stage, result)) return false

        const diff = (item: { actual: any, target: any }, key: string): number => Math.abs(Number(item.actual?.[key] ?? 0) - Number(item.target?.[key] ?? 0))

        if (stage === "avg") {
            const currentAvgDiff = diff(current, "avg")
            const nextAvgDiff = diff(result, "avg")

            if (nextAvgDiff > 0.0015 && currentAvgDiff - nextAvgDiff < 0.003) return false
            if (nextAvgDiff >= currentAvgDiff) return false

            const currentBabipDiff = diff(current, "babip")
            const nextBabipDiff = diff(result, "babip")

            if (nextBabipDiff > currentBabipDiff + 0.004) return false

            return true
        }

        return this.getStageScore(stage, result) < this.getStageScore(stage, current)
    }

    private static getStageKnobPaths(stage: "pitch" | "avg" | "obp" | "slg" | "ops" | "runs" | "done"): Set<string> {
        if (stage === "pitch") {
            return new Set([
                "pitch.velocityToQualityScale",
                "pitch.movementToQualityScale",
                "pitch.controlToQualityScale",
                "swing.pitchQualityZoneSwingEffect",
                "swing.pitchQualityChaseSwingEffect",
                "contact.pitchQualityContactEffect",
                "contact.contactSkillEffect"
            ])
        }

        if (stage === "avg") {
            return new Set([
                "contactQuality.evScale",
                "contactQuality.laScale",
                "contact.pitchQualityContactEffect",
                "contact.contactSkillEffect",
                "meta.fullTeamDefenseBonus",
                "meta.fullFielderDefenseBonus"
            ])
        }

        if (stage === "obp") {
            return new Set([
                "pitch.controlToQualityScale",
                "swing.pitchQualityChaseSwingEffect",
                "swing.disciplineChaseSwingEffect",
                "swing.disciplineZoneSwingEffect"
            ])
        }

        if (stage === "slg") {
            return new Set([
                "contactQuality.evScale",
                "contactQuality.laScale",
                "contactQuality.distanceScale",
                "meta.fullPitchQualityBonus",
                "meta.fullTeamDefenseBonus",
                "meta.fullFielderDefenseBonus",
                "pitch.velocityToQualityScale",
                "pitch.movementToQualityScale",
                "contact.pitchQualityContactEffect"
            ])
        }

        if (stage === "ops") {
            return new Set([
                "contactQuality.evScale",
                "contactQuality.laScale",
                "pitch.controlToQualityScale",
                "swing.pitchQualityChaseSwingEffect",
                "contact.pitchQualityContactEffect",
                "contact.contactSkillEffect",
                "meta.fullPitchQualityBonus",
                "meta.fullTeamDefenseBonus",
                "meta.fullFielderDefenseBonus"
            ])
        }

        if (stage === "runs") {
            return new Set([
                "swing.disciplineChaseSwingEffect",
                "swing.pitchQualityChaseSwingEffect",
                "running.stealAttemptAggressionScale",
                "meta.fullPitchQualityBonus",
                "meta.fullTeamDefenseBonus",
                "meta.fullFielderDefenseBonus"
            ])
        }

        return new Set()
    }

    private static shouldStopStageTuning(ctx: any): boolean {
        return ctx.stallIterations >= ctx.maxStallIterations
    }

    private static pushUniqueCandidate(list: PitchEnvironmentTuning[], seen: Set<string>, candidate: PitchEnvironmentTuning | undefined): void {
        if (!candidate) return
        const signature = JSON.stringify(candidate.tuning)
        if (seen.has(signature)) return
        seen.add(signature)
        list.push(candidate)
    }

    private static pathKey(path: string[] | string): string {
        return Array.isArray(path) ? path.join(".") : path
    }

    private static getRuns(result: { actual: any }): number {
        return Number(result?.actual?.teamRunsPerGame ?? 0)
    }

    private static getKnobGroups(): any[] {
        return [
            {
                group: "contactQuality",
                knobs: [
                    { path: ["contactQuality", "evScale"], step: 0.25, min: -40, max: 40, digits: 3 },
                    { path: ["contactQuality", "laScale"], step: 0.25, min: -20, max: 20, digits: 3 },
                    { path: ["contactQuality", "distanceScale"], step: 0.5, min: -60, max: 60, digits: 3 }
                ]
            },
            {
                group: "pitch",
                knobs: [
                    { path: ["pitch", "velocityToQualityScale"], step: 1, min: -140, max: 140, digits: 2 },
                    { path: ["pitch", "movementToQualityScale"], step: 1, min: -140, max: 140, digits: 2 },
                    { path: ["pitch", "controlToQualityScale"], step: 1, min: -140, max: 140, digits: 2 }
                ]
            },
            {
                group: "swing",
                knobs: [
                    { path: ["swing", "pitchQualityZoneSwingEffect"], step: 0.5, min: -80, max: 80, digits: 2 },
                    { path: ["swing", "pitchQualityChaseSwingEffect"], step: 0.5, min: -80, max: 80, digits: 2 },
                    { path: ["swing", "disciplineZoneSwingEffect"], step: 0.5, min: -80, max: 80, digits: 2 },
                    { path: ["swing", "disciplineChaseSwingEffect"], step: 0.5, min: -80, max: 80, digits: 2 }
                ]
            },
            {
                group: "contact",
                knobs: [
                    { path: ["contact", "pitchQualityContactEffect"], step: 0.5, min: -140, max: 140, digits: 2 },
                    { path: ["contact", "contactSkillEffect"], step: 0.5, min: -140, max: 140, digits: 2 }
                ]
            },
            {
                group: "running",
                knobs: [
                    { path: ["running", "stealAttemptAggressionScale"], step: 0.1, min: 0.1, max: 3, digits: 2 }
                ]
            },
            {
                group: "meta",
                knobs: [
                    { path: ["meta", "fullPitchQualityBonus"], step: 5, min: 0, max: 750, digits: 2 },
                    { path: ["meta", "fullTeamDefenseBonus"], step: 2, min: -180, max: 180, digits: 2 },
                    { path: ["meta", "fullFielderDefenseBonus"], step: 2, min: -180, max: 180, digits: 2 }
                ]
            }
        ]
    }

    private static evaluateSeedCandidate(pitchEnvironment: PitchEnvironmentTarget, candidateToEvaluate: PitchEnvironmentTuning, seed: string, candidateGamesPerIteration: number): { actual: any, target: any, diff: any, score: number } {
        return evaluateCandidateLocal(pitchEnvironment, candidateToEvaluate, candidateGamesPerIteration, seed, currentBaseDataDir)
    }

    private static applyStageScore(rawResult: { actual: any, target: any, diff: any, score: number }): { actual: any, target: any, diff: any, score: number } {
        const actual = rawResult.actual
        const target = rawResult.target
        const diff = (key: string): number => Math.abs(Number(actual?.[key] ?? 0) - Number(target?.[key] ?? 0))

        const score =
            (diff("pitchesPerPA") * 100000) +
            (diff("swingAtStrikesPercent") * 600000) +
            (diff("swingAtBallsPercent") * 600000) +
            (diff("inZoneContactPercent") * 600000) +
            (diff("outZoneContactPercent") * 600000) +
            (diff("avg") * 900000) +
            (diff("babip") * 700000) +
            (diff("obp") * 900000) +
            (diff("bbPercent") * 700000) +
            (diff("slg") * 900000) +
            (diff("homeRunPercent") * 900000) +
            (diff("ops") * 1000000) +
            (diff("teamRunsPerGame") * 250000)

        return {
            ...rawResult,
            score
        }
    }

    private static cloneCandidate(source: PitchEnvironmentTuning): PitchEnvironmentTuning {
        const cloned = JSON.parse(JSON.stringify(source))
        cloned._id = uuidv4()
        return cloned
    }

    private static getNested(obj: any, path: string[]): number {
        let current = obj

        for (const key of path) {
            current = current?.[key]
        }

        return Number(current ?? 0)
    }

    private static setNested(obj: any, path: string[], value: number): void {
        let current = obj

        for (let i = 0; i < path.length - 1; i++) {
            if (!current[path[i]]) {
                current[path[i]] = {}
            }

            current = current[path[i]]
        }

        current[path[path.length - 1]] = value
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