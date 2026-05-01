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

    private static async evaluateAcceptedCandidates(candidates: PitchEnvironmentTuning[], ctx: any, games: number, label: string): Promise<{ candidate: PitchEnvironmentTuning, result: any }[]> {
        let accepted = candidates.map(candidate => this.normalizeTuningShape(candidate))
        let evaluated = await ctx.evaluateBatch(accepted, games, `${label}-raw`)
        let results = evaluated.map((message: any) => ctx.applyScore(message.result))

        for (let i = 0; i < ctx.directIterations; i++) {
            accepted = accepted.map((candidate, index) => this.solveDirectKnobs(candidate, results[index], ctx, games))
            evaluated = await ctx.evaluateBatch(accepted, games, `${label}-fixed-${i}`)
            results = evaluated.map((message: any) => ctx.applyScore(message.result))

            const allFixed = results.every((result: any) => {
                const sbError = Math.abs(Number(result.actual?.teamSBPerGame ?? 0) - Number(result.target?.teamSBPerGame ?? 0))
                const hrError = Math.abs(Number(result.actual?.teamHomeRunsPerGame ?? 0) - Number(result.target?.teamHomeRunsPerGame ?? 0))
                const bbError = Math.abs(Number(result.actual?.bbPercent ?? 0) - Number(result.target?.bbPercent ?? 0))

                return sbError <= 0.01 && hrError <= 0.03 && bbError <= 0.003
            })

            if (allFixed) {
                break
            }
        }

        return accepted.map((candidate, index) => ({
            candidate,
            result: results[index]
        }))
    }

    private static async evaluateAcceptedCandidate(candidate: PitchEnvironmentTuning, ctx: any, games: number, label: string): Promise<{ candidate: PitchEnvironmentTuning, result: any }> {
        const accepted = await this.evaluateAcceptedCandidates([candidate], ctx, games, label)
        return accepted[0]
    }


    private static solveDirectKnobs(candidate: PitchEnvironmentTuning, result: any, ctx: any, games: number): PitchEnvironmentTuning {
        const c = this.normalizeTuningShape(candidate)

        const actualSB = Number(result.actual?.teamSBPerGame ?? 0)
        const targetSB = Number(result.target?.teamSBPerGame ?? 0)

        if (actualSB > 0 && targetSB > 0) {
            const currentMultiplier = Math.max(0.0001, 1 + Number(c.tuning!.running.stealAttemptAggressionScale ?? 0))
            c.tuning!.running.stealAttemptAggressionScale = this.clamp(
                (currentMultiplier * (targetSB / actualSB)) - 1,
                ctx.stealMin,
                ctx.stealMax
            )
        }

        const actualHR = Number(result.actual?.teamHomeRunsPerGame ?? 0)
        const targetHR = Number(result.target?.teamHomeRunsPerGame ?? 0)

        if (actualHR > 0 && targetHR > 0) {
            const currentMultiplier = Math.max(0.0001, 1 + Number(c.tuning!.contactQuality.homeRunOutcomeScale ?? 0))
            c.tuning!.contactQuality.homeRunOutcomeScale = this.clamp(
                (currentMultiplier * (targetHR / actualHR)) - 1,
                ctx.homeRunMin,
                ctx.homeRunMax
            )
        }

        const actualBB = Number(result.actual?.bbPercent ?? 0)
        const targetBB = Number(result.target?.bbPercent ?? 0)

        if (actualBB > 0 && targetBB > 0) {
            const currentMultiplier = Math.max(0.0001, 1 + Number(c.tuning!.swing.walkRateScale ?? 0))
            c.tuning!.swing.walkRateScale = this.clamp(
                (currentMultiplier * (targetBB / actualBB)) - 1,
                ctx.walkMin,
                ctx.walkMax
            )
        }

        c._id = uuidv4()

        return this.normalizeTuningShape(c)
    }

    private static async solveDefense(candidate: PitchEnvironmentTuning, result: any, ctx: any, games: number): Promise<PitchEnvironmentTuning> {
        const baseCandidate = this.normalizeTuningShape(candidate)
        const currentDefense = Number(baseCandidate.tuning!.meta.fullFielderDefenseBonus ?? 0)

        const candidates = [
            ctx.defenseMin,
            (ctx.defenseMin + currentDefense) / 2,
            currentDefense,
            (currentDefense + ctx.defenseMax) / 2,
            ctx.defenseMax
        ].map(value => this.withDefense(baseCandidate, this.clamp(value, ctx.defenseMin, ctx.defenseMax)))

        const accepted = await this.evaluateAcceptedCandidates(candidates, ctx, games, "defense")
        const best = accepted.sort((a, b) => this.getShapeError(a.result) - this.getShapeError(b.result))[0]

        return this.normalizeTuningShape(best.candidate)
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
            directIterations: params?.directIterations ?? 6,
            defenseIterations: params?.defenseIterations ?? 4,
            workers,
            stealMin: -0.99,
            stealMax: 4,
            advancementMin: -0.99,
            advancementMax: 4,
            walkMin: -0.99,
            walkMax: 4,
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
        t.swing.walkRateScale = this.clamp(Number(t.swing.walkRateScale ?? 0), -0.99, 4)

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