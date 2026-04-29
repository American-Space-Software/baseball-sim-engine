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

        log("TUNING START", `workers=${ctx.workers}`, `games=${ctx.gamesPerIteration}`, `finalGames=${ctx.finalGamesPerIteration}`, `maxIterations=${ctx.maxIterations}`)

        log("SEED START", `candidate=${ctx.bestCandidate._id}`, `games=${ctx.gamesPerIteration}`)
        const seedRaw = this.evaluateCandidate(ctx.pitchEnvironment, ctx.bestCandidate, `seed:${ctx.baseSeed}`, ctx.gamesPerIteration)
        ctx.bestResult = ctx.applyScore(seedRaw)
        ctx.seedResult = ctx.bestResult
        log("SEED DONE", `score=${ctx.bestResult.score.toFixed(1)}`, `runs=${this.getRuns(ctx.bestResult).toFixed(3)}`)

        ctx.printDiagnostic("seed", -1, ctx.gamesPerIteration, ctx.bestCandidate, ctx.bestResult)

        for (let iteration = 0; iteration < ctx.maxIterations; iteration++) {
            const candidates = this.buildCorrectionCandidates(ctx, iteration)

            if (candidates.length === 0) {
                log("ITER STOP", `reason=no-candidates`, `iter=${iteration}`)
                break
            }

            log("ITER START", `iter=${iteration}`, `candidates=${candidates.length}`, `stall=${ctx.stallIterations}`, `score=${ctx.bestResult.score.toFixed(1)}`, `runs=${this.getRuns(ctx.bestResult).toFixed(3)}`)

            const evaluated = await ctx.evaluateBatch(candidates, ctx.gamesPerIteration, `iter:${ctx.baseSeed}:${iteration}`)
            const scored = ctx.scoreBatch(evaluated)
                .sort((a: any, b: any) => a.result.score - b.result.score)

            const winner = scored[0]

            log("ITER DONE", `iter=${iteration}`, `winnerScore=${winner.result.score.toFixed(1)}`, `bestScore=${ctx.bestResult.score.toFixed(1)}`, `winnerRuns=${this.getRuns(winner.result).toFixed(3)}`, `bestRuns=${this.getRuns(ctx.bestResult).toFixed(3)}`)
            ctx.printDiagnostic("try", iteration, ctx.gamesPerIteration, winner.candidate, winner.result)

            if (winner.result.score < ctx.bestResult.score) {
                const oldScore = ctx.bestResult.score

                ctx.bestCandidate = this.cloneCandidate(winner.candidate)
                ctx.bestResult = winner.result
                ctx.acceptedIterations++
                ctx.stallIterations = 0

                log("ITER ACCEPTED", `iter=${iteration}`, `oldScore=${oldScore.toFixed(1)}`, `newScore=${ctx.bestResult.score.toFixed(1)}`, `runs=${this.getRuns(ctx.bestResult).toFixed(3)}`)
                ctx.printDiagnostic("acc", iteration, ctx.gamesPerIteration, ctx.bestCandidate, ctx.bestResult)

                if (this.isCloseEnough(ctx.bestResult)) {
                    log("ITER STOP", `reason=close-enough`, `iter=${iteration}`)
                    break
                }
            } else {
                ctx.stallIterations++
                log("ITER REJECTED", `iter=${iteration}`, `stall=${ctx.stallIterations}`)

                if (ctx.stallIterations >= ctx.maxStallIterations) {
                    log("ITER STOP", `reason=stall`, `iter=${iteration}`, `stall=${ctx.stallIterations}`)
                    break
                }
            }

            if (ctx.printDiagnostics && ((iteration + 1) % ctx.heartbeatEvery === 0)) {
                log("HEARTBEAT", `iter=${iteration + 1}/${ctx.maxIterations}`, `score=${ctx.bestResult.score.toFixed(1)}`, `runs=${this.getRuns(ctx.bestResult).toFixed(3)}`, `stall=${ctx.stallIterations}`, `accepted=${ctx.acceptedIterations}`)
            }
        }

        log("FINAL CONFIRM START", `candidate=${ctx.bestCandidate._id}`, `games=${ctx.finalGamesPerIteration}`)
        const finalRaw = this.evaluateCandidate(ctx.pitchEnvironment, ctx.bestCandidate, `final:${ctx.baseSeed}`, ctx.finalGamesPerIteration)
        const finalResult = ctx.applyScore(finalRaw)
        log("FINAL CONFIRM DONE", `score=${finalResult.score.toFixed(1)}`, `runs=${this.getRuns(finalResult).toFixed(3)}`)

        ctx.printDiagnostic("final", ctx.maxIterations, ctx.finalGamesPerIteration, ctx.bestCandidate, finalResult)

        log("TUNING DONE", `finalScore=${finalResult.score.toFixed(1)}`, `runs=${this.getRuns(finalResult).toFixed(3)}`, `accepted=${ctx.acceptedIterations}`)

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

        if (options?.useMetaDuringCorePass !== true) {
            bestCandidate.tuning!.meta.fullPitchQualityBonus = 0
            bestCandidate.tuning!.meta.fullTeamDefenseBonus = 0
            bestCandidate.tuning!.meta.fullFielderDefenseBonus = 0
        }

        if (!bestCandidate._id) {
            bestCandidate._id = uuidv4()
        }

        const maxIterations = options?.maxIterations ?? 12
        const gamesPerIteration = options?.gamesPerIteration ?? 150
        const printDiagnostics = options?.printDiagnostics ?? true
        const maxStallIterations = options?.maxStallIterations ?? 4
        const workers = Math.max(1, options?.workers ?? 1)
        const heartbeatEvery = Math.max(1, options?.heartbeatEvery ?? 3)
        const finalGamesPerIteration = options?.finalGamesPerIteration ?? Math.max(gamesPerIteration, 250)
        const seedCandidate = this.cloneCandidate(bestCandidate)
        const neutralCandidate = this.normalizeTuningShape({
            _id: uuidv4(),
            tuning: {
                contactQuality: {
                    evScale: 0,
                    laScale: 0,
                    distanceScale: 0,
                    homeRunOutcomeScale: 0
                },
                swing: {
                    pitchQualityZoneSwingEffect: 0,
                    pitchQualityChaseSwingEffect: 0,
                    disciplineZoneSwingEffect: 0,
                    disciplineChaseSwingEffect: 0
                },
                contact: {
                    pitchQualityContactEffect: 0,
                    contactSkillEffect: 0
                },
                running: {
                    stealAttemptAggressionScale: 1
                },
                meta: {
                    fullPitchQualityBonus: 0,
                    fullTeamDefenseBonus: 0,
                    fullFielderDefenseBonus: 0
                }
            },
            ratingTuning: bestCandidate.ratingTuning
        } as PitchEnvironmentTuning)

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

        const applyScore = (rawResult: { actual: any, target: any, diff: any, score: number }) => this.scoreResult(rawResult)

        const scoreBatch = (evaluated: any[]) => {
            return evaluated.map(message => ({
                candidate: message.candidate,
                rawResult: message.result,
                result: applyScore(message.result)
            }))
        }

        const printDiagnostic = (stage: string, iteration: number, games: number, candidate: PitchEnvironmentTuning, result: { actual: any, target: any, diff: any, score: number }) => {
            if (!printDiagnostics) return
            playerImporterService.printPitchEnvironmentIterationDiagnostics(stage, iteration, maxIterations, games, candidate, result)
        }

        return {
            pitchEnvironment,
            baseSeed,
            options,
            bestCandidate,
            seedCandidate,
            neutralCandidate,
            bestResult: undefined,
            seedResult: undefined,
            maxIterations,
            gamesPerIteration,
            printDiagnostics,
            maxStallIterations,
            workers,
            heartbeatEvery,
            finalGamesPerIteration,
            evaluateBatch,
            applyScore,
            scoreBatch,
            printDiagnostic,
            stallIterations: 0,
            acceptedIterations: 0
        }
    }

    private static normalizeTuningShape(candidate: PitchEnvironmentTuning): PitchEnvironmentTuning {
        const normalized = JSON.parse(JSON.stringify(candidate)) as PitchEnvironmentTuning

        if (!normalized.tuning) {
            normalized.tuning = {} as any
        }

        const tuning: any = normalized.tuning

        tuning.contactQuality = tuning.contactQuality ?? {}
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
        delete tuning.pitch

        tuning.contactQuality.evScale = this.round(this.clamp(Number(tuning.contactQuality.evScale ?? 0), -40, 40), 3)
        tuning.contactQuality.laScale = this.round(this.clamp(Number(tuning.contactQuality.laScale ?? 0), -20, 20), 3)
        tuning.contactQuality.distanceScale = this.round(this.clamp(Number(tuning.contactQuality.distanceScale ?? 0), -60, 60), 3)
        tuning.contactQuality.homeRunOutcomeScale = this.round(this.clamp(Number(tuning.contactQuality.homeRunOutcomeScale ?? 0), -0.75, 0.75), 3)

        tuning.swing.pitchQualityZoneSwingEffect = this.round(this.clamp(Number(tuning.swing.pitchQualityZoneSwingEffect ?? 0), -80, 80), 2)
        tuning.swing.pitchQualityChaseSwingEffect = this.round(this.clamp(Number(tuning.swing.pitchQualityChaseSwingEffect ?? 0), -80, 80), 2)
        tuning.swing.disciplineZoneSwingEffect = this.round(this.clamp(Number(tuning.swing.disciplineZoneSwingEffect ?? 0), -80, 80), 2)
        tuning.swing.disciplineChaseSwingEffect = this.round(this.clamp(Number(tuning.swing.disciplineChaseSwingEffect ?? 0), -80, 80), 2)

        tuning.contact.pitchQualityContactEffect = this.round(this.clamp(Number(tuning.contact.pitchQualityContactEffect ?? 0), -120, 120), 2)
        tuning.contact.contactSkillEffect = this.round(this.clamp(Number(tuning.contact.contactSkillEffect ?? 0), -120, 120), 2)

        tuning.running.stealAttemptAggressionScale = this.round(this.clamp(Number(tuning.running.stealAttemptAggressionScale ?? 1), 0.1, 3), 2)

        tuning.meta.fullPitchQualityBonus = this.round(this.clamp(Number(tuning.meta.fullPitchQualityBonus ?? 0), -500, 800), 1)
        tuning.meta.fullTeamDefenseBonus = this.round(this.clamp(Number(tuning.meta.fullTeamDefenseBonus ?? 0), -400, 400), 1)
        tuning.meta.fullFielderDefenseBonus = this.round(this.clamp(Number(tuning.meta.fullFielderDefenseBonus ?? 0), -400, 400), 1)

        return normalized
    }

    private static buildCorrectionCandidates(ctx: any, iteration: number): PitchEnvironmentTuning[] {
        const candidates: PitchEnvironmentTuning[] = []
        const seen = new Set<string>()

        const add = (candidate: PitchEnvironmentTuning, reason: string): void => {
            const normalized = this.normalizeTuningShape(candidate)
            const signature = JSON.stringify(normalized.tuning)

            if (seen.has(signature)) {
                return
            }

            seen.add(signature)
            normalized._id = uuidv4()
            ;(normalized as any).__reason = reason
            candidates.push(normalized)
        }

        for (const candidate of this.buildBestGuessCandidates(ctx, iteration)) {
            add(candidate, String((candidate as any).__reason ?? "best-guess"))
        }

        for (const candidate of this.buildLocalRefinementCandidates(ctx, iteration)) {
            add(candidate, String((candidate as any).__reason ?? "local"))
        }

        const d = this.getMetricDiffs(ctx.bestResult)
        const coreClose = this.isCoreOffenseClose(ctx.bestResult)

        log(
            "CORRECTIONS",
            `iter=${iteration}`,
            `candidates=${candidates.length}`,
            `R=${d.runs.toFixed(3)}`,
            `OPS=${d.ops.toFixed(3)}`,
            `AVG=${d.avg.toFixed(3)}`,
            `OBP=${d.obp.toFixed(3)}`,
            `SLG=${d.slg.toFixed(3)}`,
            `BABIP=${d.babip.toFixed(3)}`,
            `BB=${d.bbPercent.toFixed(3)}`,
            `HR=${d.homeRunPercent.toFixed(3)}`,
            `H/G=${d.hitsPerGame.toFixed(3)}`,
            `HR/G=${d.homeRunsPerGame.toFixed(3)}`,
            `BB/G=${d.bbPerGame.toFixed(3)}`,
            `coreClose=${coreClose}`
        )

        return candidates
    }

    private static buildBestGuessCandidates(ctx: any, iteration: number): PitchEnvironmentTuning[] {
        const result = ctx.bestResult
        const d = this.getMetricDiffs(result)
        const current = this.normalizeTuningShape(ctx.bestCandidate)
        const seed = this.normalizeTuningShape(ctx.seedCandidate)
        const neutral = this.normalizeTuningShape(ctx.neutralCandidate)
        const candidates: PitchEnvironmentTuning[] = []
        const seen = new Set<string>()

        const add = (candidate: PitchEnvironmentTuning, reason: string): void => {
            const normalized = this.normalizeTuningShape(candidate)
            const signature = JSON.stringify(normalized.tuning)

            if (seen.has(signature)) {
                return
            }

            seen.add(signature)
            normalized._id = uuidv4()
            ;(normalized as any).__reason = reason
            candidates.push(normalized)
        }

        const makeFrom = (base: PitchEnvironmentTuning, scale: number, reason: string): PitchEnvironmentTuning => {
            const candidate = this.cloneCandidate(base)
            const tuning = candidate.tuning!

            const hitsHigh = d.babip > 0.006 || d.hitsPerGame > 0.35 || d.avg > 0.006
            const hitsLow = d.babip < -0.006 || d.hitsPerGame < -0.35 || d.avg < -0.006
            const hrLow = d.homeRunPercent < -0.002 || d.homeRunsPerGame < -0.07
            const bbLow = d.bbPercent < -0.003 || d.bbPerGame < -0.10
            const runsLow = d.runs < -0.15
            const runsHigh = d.runs > 0.15

            const defenseCorrection = this.clamp((d.babip * 1800) + (d.hitsPerGame * 10) + (d.avg * 650), -120, 120)
            const teamDefenseCorrection = this.clamp((d.babip * 760) + (d.hitsPerGame * 4.25) + (d.avg * 260), -60, 60)

            const hrCorrection = this.clamp(
                (-d.homeRunPercent * 8.5)
                + (-d.homeRunsPerGame * 0.055)
                + (-d.slg * 0.18)
                + (d.babip > 0.02 ? 0.02 : 0)
                + (runsLow ? 0.015 : 0),
                -0.10,
                0.10
            )

            const chaseCorrection = this.clamp((d.bbPercent * 95) + (d.bbPerGame * 1.75), -8, 8)
            const disciplineChaseCorrection = this.clamp((-d.bbPercent * 68) + (-d.bbPerGame * 1.25), -7, 7)

            tuning.meta.fullFielderDefenseBonus = this.round(
                this.clamp(tuning.meta.fullFielderDefenseBonus + (defenseCorrection * scale), -400, 400), 1
            )

            tuning.meta.fullTeamDefenseBonus = this.round(
                this.clamp(tuning.meta.fullTeamDefenseBonus + (teamDefenseCorrection * scale), -400, 400), 1
            )

            tuning.contactQuality.homeRunOutcomeScale = this.round(
                this.clamp(tuning.contactQuality.homeRunOutcomeScale + (hrCorrection * scale), -0.75, 0.75), 3
            )

            tuning.swing.pitchQualityChaseSwingEffect = this.round(
                this.clamp(tuning.swing.pitchQualityChaseSwingEffect + (chaseCorrection * scale), -80, 80), 2
            )

            tuning.swing.disciplineChaseSwingEffect = this.round(
                this.clamp(tuning.swing.disciplineChaseSwingEffect + (disciplineChaseCorrection * scale), -80, 80), 2
            )

            if (runsLow && hitsHigh) {
                tuning.meta.fullFielderDefenseBonus = this.round(
                    this.clamp(Math.max(tuning.meta.fullFielderDefenseBonus, base.tuning!.meta.fullFielderDefenseBonus + 25), -400, 400), 1
                )

                if (hrLow) {
                    tuning.contactQuality.homeRunOutcomeScale = this.round(
                        this.clamp(Math.max(tuning.contactQuality.homeRunOutcomeScale, base.tuning!.contactQuality.homeRunOutcomeScale + 0.03), -0.75, 0.75), 3
                    )
                }

                if (bbLow) {
                    tuning.swing.pitchQualityChaseSwingEffect = this.round(
                        this.clamp(Math.min(tuning.swing.pitchQualityChaseSwingEffect, base.tuning!.swing.pitchQualityChaseSwingEffect - 1.2), -80, 80), 2
                    )

                    tuning.swing.disciplineChaseSwingEffect = this.round(
                        this.clamp(Math.max(tuning.swing.disciplineChaseSwingEffect, base.tuning!.swing.disciplineChaseSwingEffect + 0.9), -80, 80), 2
                    )
                }
            }

            if (runsLow && !hitsHigh) {
                tuning.meta.fullPitchQualityBonus = this.round(
                    this.clamp(tuning.meta.fullPitchQualityBonus + (12 * scale), -500, 800), 1
                )
            }

            if (runsHigh && !hitsLow) {
                tuning.meta.fullPitchQualityBonus = this.round(
                    this.clamp(tuning.meta.fullPitchQualityBonus - (12 * scale), -500, 800), 1
                )
            }

            if (this.isCoreOffenseClose(result)) {
                const actualAttempts = Number(result.actual?.teamSBAttemptsPerGame ?? 0)
                const targetAttempts = Number(result.target?.teamSBAttemptsPerGame ?? 0)
                const ratio = actualAttempts > 0 && targetAttempts > 0 ? targetAttempts / actualAttempts : 1

                tuning.running.stealAttemptAggressionScale = this.round(
                    this.clamp(tuning.running.stealAttemptAggressionScale * Math.pow(ratio, scale), 0.1, 3), 2
                )
            }

            ;(candidate as any).__reason = reason
            return candidate
        }

        for (const scale of [0.5, 0.8, 1.1, 1.4]) {
            add(makeFrom(current, scale, `guess-current-${scale}`), `guess-current-${scale}`)
        }

        for (const scale of [0.8, 1.2]) {
            add(makeFrom(seed, scale, `guess-seed-${scale}`), `guess-seed-${scale}`)
        }

        if (iteration === 0 || ctx.stallIterations > 1) {
            for (const scale of [1, 1.3]) {
                add(makeFrom(neutral, scale, `guess-neutral-${scale}`), `guess-neutral-${scale}`)
            }
        }

        return candidates
    }

    private static buildLocalRefinementCandidates(ctx: any, iteration: number): PitchEnvironmentTuning[] {
        const current = ctx.bestCandidate as PitchEnvironmentTuning
        const result = ctx.bestResult
        const d = this.getMetricDiffs(result)
        const candidates: PitchEnvironmentTuning[] = []
        const seen = new Set<string>()

        const add = (candidate: PitchEnvironmentTuning, reason: string): void => {
            const normalized = this.normalizeTuningShape(candidate)
            const signature = JSON.stringify(normalized.tuning)

            if (seen.has(signature)) {
                return
            }

            seen.add(signature)
            normalized._id = uuidv4()
            ;(normalized as any).__reason = reason
            candidates.push(normalized)
        }

        const addDelta = (path: string[], delta: number, reason: string, scales: number[] = [0.5, 1, 1.5]): void => {
            if (!Number.isFinite(delta) || Math.abs(delta) <= 0.000001) {
                return
            }

            const knob = this.getKnob(path)

            for (const scale of scales) {
                const candidate = this.cloneCandidate(current)
                const currentValue = Number(this.getNested(candidate.tuning, path) ?? 0)
                const nextValue = this.round(this.clamp(currentValue + (delta * scale), knob.min, knob.max), knob.digits)

                if (nextValue === currentValue) {
                    continue
                }

                this.setNested(candidate.tuning, path, nextValue)
                add(candidate, `${reason}:${this.pathKey(path)}:${scale}`)
            }
        }

        const hitsHigh = d.babip > 0.006 || d.hitsPerGame > 0.35 || d.avg > 0.006
        const hitsLow = d.babip < -0.006 || d.hitsPerGame < -0.35 || d.avg < -0.006
        const hrLow = d.homeRunPercent < -0.002 || d.homeRunsPerGame < -0.07
        const hrHigh = d.homeRunPercent > 0.002 || d.homeRunsPerGame > 0.07
        const bbLow = d.bbPercent < -0.003 || d.bbPerGame < -0.10
        const bbHigh = d.bbPercent > 0.003 || d.bbPerGame > 0.10
        const runsLow = d.runs < -0.15
        const runsHigh = d.runs > 0.15

        if (hitsHigh) {
            addDelta(["meta", "fullFielderDefenseBonus"], 12, "local-defense-up", [0.75, 1.25, 1.75])
            addDelta(["meta", "fullTeamDefenseBonus"], 6, "local-team-defense-up", [0.75, 1.25])
        }

        if (hitsLow && !runsLow) {
            addDelta(["meta", "fullFielderDefenseBonus"], -12, "local-defense-down", [0.75, 1.25, 1.75])
            addDelta(["meta", "fullTeamDefenseBonus"], -6, "local-team-defense-down", [0.75, 1.25])
        }

        if (hrLow) {
            addDelta(["contactQuality", "homeRunOutcomeScale"], 0.025, "local-hr-up", [0.75, 1.25, 1.75])
            addDelta(["contactQuality", "distanceScale"], 1.2, "local-distance-up", [0.75, 1.25])
        }

        if (hrHigh) {
            addDelta(["contactQuality", "homeRunOutcomeScale"], -0.025, "local-hr-down", [0.75, 1.25, 1.75])
            addDelta(["contactQuality", "distanceScale"], -1.2, "local-distance-down", [0.75, 1.25])
        }

        if (bbLow) {
            addDelta(["swing", "pitchQualityChaseSwingEffect"], -0.9, "local-bb-chase-down", [0.75, 1.25, 1.75])
            addDelta(["swing", "disciplineChaseSwingEffect"], 0.65, "local-bb-discipline-up", [0.75, 1.25])
            addDelta(["contact", "pitchQualityContactEffect"], -0.45, "local-bb-contact-down", [0.75, 1.25])
        }

        if (bbHigh) {
            addDelta(["swing", "pitchQualityChaseSwingEffect"], 0.9, "local-bb-chase-up", [0.75, 1.25, 1.75])
            addDelta(["swing", "disciplineChaseSwingEffect"], -0.65, "local-bb-discipline-down", [0.75, 1.25])
            addDelta(["contact", "pitchQualityContactEffect"], 0.45, "local-bb-contact-up", [0.75, 1.25])
        }

        if (runsLow && !hitsHigh) {
            addDelta(["contactQuality", "homeRunOutcomeScale"], 0.018, "local-runs-hr-up", [0.75, 1.25])
            addDelta(["meta", "fullPitchQualityBonus"], 10, "local-runs-pitch-up", [0.75, 1.25])
        }

        if (runsHigh && !hitsLow) {
            addDelta(["contactQuality", "homeRunOutcomeScale"], -0.018, "local-runs-hr-down", [0.75, 1.25])
            addDelta(["meta", "fullPitchQualityBonus"], -10, "local-runs-pitch-down", [0.75, 1.25])
        }

        if (Math.abs(d.swingAtBallsPercent) > 0.004) {
            addDelta(["swing", "pitchQualityChaseSwingEffect"], d.swingAtBallsPercent > 0 ? -0.65 : 0.65, "local-process-chase", [0.75, 1.25])
        }

        if (Math.abs(d.swingAtStrikesPercent) > 0.004) {
            addDelta(["swing", "pitchQualityZoneSwingEffect"], d.swingAtStrikesPercent > 0 ? -0.65 : 0.65, "local-process-zone", [0.75, 1.25])
        }

        if (Math.abs(d.inZoneContactPercent) > 0.006 || Math.abs(d.outZoneContactPercent) > 0.006) {
            const direction = (d.inZoneContactPercent + d.outZoneContactPercent) > 0 ? 1 : -1
            addDelta(["contact", "pitchQualityContactEffect"], direction * -0.9, "local-process-contact", [0.75, 1.25])
            addDelta(["contact", "contactSkillEffect"], direction * -0.45, "local-process-contact-skill", [0.75, 1.25])
        }

        if (this.isCoreOffenseClose(result) && (Math.abs(d.sbPerGame) > 0.05 || Math.abs(d.sbAttemptsPerGame) > 0.06)) {
            const currentScale = Number(current.tuning?.running?.stealAttemptAggressionScale ?? 1)
            const actualAttempts = Number(result.actual?.teamSBAttemptsPerGame ?? 0)
            const targetAttempts = Number(result.target?.teamSBAttemptsPerGame ?? 0)
            const actualSteals = Number(result.actual?.teamSBPerGame ?? 0)
            const targetSteals = Number(result.target?.teamSBPerGame ?? 0)
            const attemptRatio = actualAttempts > 0 && targetAttempts > 0 ? targetAttempts / actualAttempts : undefined
            const stealRatio = actualSteals > 0 && targetSteals > 0 ? targetSteals / actualSteals : undefined
            const ratio = attemptRatio ?? stealRatio ?? 1

            addDelta(["running", "stealAttemptAggressionScale"], (currentScale * ratio) - currentScale, "local-running", [0.75, 1, 1.25])
        }

        return candidates
    }

    private static scoreResult(rawResult: { actual: any, target: any, diff: any, score: number }): { actual: any, target: any, diff: any, score: number } {
        const actual = rawResult.actual
        const target = rawResult.target
        const signedDiff = (key: string): number => Number(actual?.[key] ?? 0) - Number(target?.[key] ?? 0)
        const diff = (key: string): number => Math.abs(signedDiff(key))
        const over = (key: string): number => Math.max(0, signedDiff(key))
        const under = (key: string): number => Math.max(0, -signedDiff(key))
        const sq = (value: number): number => value * value

        const runDiff = signedDiff("teamRunsPerGame")
        const babipOver = over("babip")
        const hitsOver = over("teamHitsPerGame")
        const hrUnder = under("homeRunPercent")
        const hrGameUnder = under("teamHomeRunsPerGame")
        const bbUnder = under("bbPercent")
        const bbGameUnder = under("teamBBPerGame")
        const highHitLowRunBadShape = runDiff < 0 ? (babipOver * 24) + (hitsOver * 0.22) : 0
        const lowHrLowRunBadShape = runDiff < 0 ? (hrGameUnder * 2.8) + (hrUnder * 90) : 0
        const lowBbLowRunBadShape = runDiff < 0 ? (bbGameUnder * 1.9) + (bbUnder * 80) : 0
        const lowRunMultiplier = runDiff < 0 ? 1 + this.clamp(highHitLowRunBadShape + lowHrLowRunBadShape + lowBbLowRunBadShape, 0, 3) : 1

        const coreScore =
            sq(diff("teamRunsPerGame")) * 3600000 * lowRunMultiplier +
            sq(diff("ops")) * 90000000 +
            sq(diff("obp")) * 76000000 +
            sq(diff("slg")) * 62000000 +
            sq(diff("avg")) * 38000000 +
            sq(diff("babip")) * 52000000

        const shapeScore =
            sq(diff("homeRunPercent")) * 130000000 +
            sq(diff("bbPercent")) * 115000000 +
            sq(diff("teamHomeRunsPerGame")) * 115000 +
            sq(diff("teamBBPerGame")) * 80000 +
            sq(diff("teamHitsPerGame")) * 30000 +
            sq(babipOver) * 180000000 +
            sq(hitsOver) * 50000 +
            sq(hrUnder) * 260000000 +
            sq(hrGameUnder) * 160000 +
            sq(bbUnder) * 210000000 +
            sq(bbGameUnder) * 95000

        const processScore =
            sq(diff("pitchesPerPA")) * 175000 +
            sq(diff("swingAtStrikesPercent")) * 650000 +
            sq(diff("swingAtBallsPercent")) * 650000 +
            sq(diff("inZoneContactPercent")) * 650000 +
            sq(diff("outZoneContactPercent")) * 650000

        const runningScore = this.isCoreOffenseClose(rawResult)
            ? (sq(diff("teamSBPerGame")) * 120000) + (sq(diff("teamSBAttemptsPerGame")) * 60000)
            : (sq(diff("teamSBPerGame")) * 1000) + (sq(diff("teamSBAttemptsPerGame")) * 500)

        return {
            ...rawResult,
            score: coreScore + shapeScore + processScore + runningScore
        }
    }

    private static isCloseEnough(result: { actual: any, target: any }): boolean {
        const diff = (key: string): number => Math.abs(Number(result.actual?.[key] ?? 0) - Number(result.target?.[key] ?? 0))

        return (
            diff("teamRunsPerGame") <= 0.20 &&
            diff("ops") <= 0.014 &&
            diff("obp") <= 0.010 &&
            diff("slg") <= 0.014 &&
            diff("avg") <= 0.010 &&
            diff("babip") <= 0.012 &&
            diff("bbPercent") <= 0.008 &&
            diff("homeRunPercent") <= 0.005 &&
            diff("teamHitsPerGame") <= 0.50 &&
            diff("teamHomeRunsPerGame") <= 0.16 &&
            diff("teamBBPerGame") <= 0.22 &&
            diff("pitchesPerPA") <= 0.050 &&
            diff("swingAtStrikesPercent") <= 0.010 &&
            diff("swingAtBallsPercent") <= 0.010 &&
            diff("inZoneContactPercent") <= 0.014 &&
            diff("outZoneContactPercent") <= 0.014
        )
    }

    private static isCoreOffenseClose(result: { actual: any, target: any }): boolean {
        const diff = (key: string): number => Math.abs(Number(result.actual?.[key] ?? 0) - Number(result.target?.[key] ?? 0))

        return (
            diff("teamRunsPerGame") <= 0.30 &&
            diff("ops") <= 0.022 &&
            diff("obp") <= 0.016 &&
            diff("slg") <= 0.022 &&
            diff("avg") <= 0.016 &&
            diff("babip") <= 0.018 &&
            diff("bbPercent") <= 0.010 &&
            diff("homeRunPercent") <= 0.007 &&
            diff("teamHitsPerGame") <= 0.75 &&
            diff("teamHomeRunsPerGame") <= 0.20 &&
            diff("teamBBPerGame") <= 0.30
        )
    }

    private static getMetricDiffs(result: { actual: any, target: any }): any {
        const diff = (key: string): number => Number(result.actual?.[key] ?? 0) - Number(result.target?.[key] ?? 0)

        return {
            runs: diff("teamRunsPerGame"),
            ops: diff("ops"),
            avg: diff("avg"),
            obp: diff("obp"),
            slg: diff("slg"),
            babip: diff("babip"),
            bbPercent: diff("bbPercent"),
            homeRunPercent: diff("homeRunPercent"),
            hitsPerGame: diff("teamHitsPerGame"),
            homeRunsPerGame: diff("teamHomeRunsPerGame"),
            bbPerGame: diff("teamBBPerGame"),
            sbPerGame: diff("teamSBPerGame"),
            sbAttemptsPerGame: diff("teamSBAttemptsPerGame"),
            pitchesPerPA: diff("pitchesPerPA"),
            swingAtStrikesPercent: diff("swingAtStrikesPercent"),
            swingAtBallsPercent: diff("swingAtBallsPercent"),
            inZoneContactPercent: diff("inZoneContactPercent"),
            outZoneContactPercent: diff("outZoneContactPercent")
        }
    }

    private static getKnob(path: string[]): { path: string[], step: number, min: number, max: number, digits: number } {
        const key = this.pathKey(path)
        const knobs = this.getKnobGroups().flatMap(group => group.knobs)
        const knob = knobs.find(knob => this.pathKey(knob.path) === key)

        if (!knob) {
            throw new Error(`Missing tuning knob config for ${key}`)
        }

        return knob
    }

    private static getKnobGroups(): any[] {
        return [
            {
                group: "contactQuality",
                knobs: [
                    { path: ["contactQuality", "evScale"], step: 0.25, min: -40, max: 40, digits: 3 },
                    { path: ["contactQuality", "laScale"], step: 0.25, min: -20, max: 20, digits: 3 },
                    { path: ["contactQuality", "distanceScale"], step: 0.5, min: -60, max: 60, digits: 3 },
                    { path: ["contactQuality", "homeRunOutcomeScale"], step: 0.025, min: -0.75, max: 0.75, digits: 3 }
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
                    { path: ["contact", "pitchQualityContactEffect"], step: 0.5, min: -120, max: 120, digits: 2 },
                    { path: ["contact", "contactSkillEffect"], step: 0.5, min: -120, max: 120, digits: 2 }
                ]
            },
            {
                group: "running",
                knobs: [
                    { path: ["running", "stealAttemptAggressionScale"], step: 0.05, min: 0.1, max: 3, digits: 2 }
                ]
            },
            {
                group: "meta",
                knobs: [
                    { path: ["meta", "fullPitchQualityBonus"], step: 20, min: -500, max: 800, digits: 1 },
                    { path: ["meta", "fullTeamDefenseBonus"], step: 10, min: -400, max: 400, digits: 1 },
                    { path: ["meta", "fullFielderDefenseBonus"], step: 10, min: -400, max: 400, digits: 1 }
                ]
            }
        ]
    }

    private static evaluateCandidate(pitchEnvironment: PitchEnvironmentTarget, candidateToEvaluate: PitchEnvironmentTuning, seed: string, candidateGamesPerIteration: number): { actual: any, target: any, diff: any, score: number } {
        return evaluateCandidateLocal(pitchEnvironment, candidateToEvaluate, candidateGamesPerIteration, seed, currentBaseDataDir)
    }

    private static cloneCandidate(candidate: PitchEnvironmentTuning): PitchEnvironmentTuning {
        return JSON.parse(JSON.stringify(candidate)) as PitchEnvironmentTuning
    }

    private static pathKey(path: string[] | string): string {
        return Array.isArray(path) ? path.join(".") : path
    }

    private static getRuns(result: { actual: any }): number {
        return Number(result?.actual?.teamRunsPerGame ?? 0)
    }

    private static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value))
    }

    private static round(value: number, digits: number): number {
        const multiplier = Math.pow(10, digits)
        return Math.round(value * multiplier) / multiplier
    }

    private static getNested(obj: any, path: string[]): any {
        return path.reduce((acc, key) => acc?.[key], obj)
    }

    private static setNested(obj: any, path: string[], value: any): void {
        let current = obj

        for (let i = 0; i < path.length - 1; i++) {
            current[path[i]] = current[path[i]] ?? {}
            current = current[path[i]]
        }

        current[path[path.length - 1]] = value
    }
}


export {
    importPitchEnvironmentTarget
}

export type {
    ImportPitchEnvironmentTargetResult
}