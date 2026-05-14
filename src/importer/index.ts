import { Worker } from "worker_threads"
import seedrandom from "seedrandom"
import { PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerImportRaw } from "../sim/service/interfaces.js"
import { RollChartService } from "../sim/service/roll-chart-service.js"
import { GameInfo, GamePlayers, RunnerActions, SimRolls, SimService } from "../sim/service/sim-service.js"
import { StatService } from "../sim/service/stat-service.js"
import { DownloaderService } from "./service/downloader-service.js"
import { PlayerImporterService } from "./service/player-importer-service.js"
import { v4 as uuidv4 } from "uuid"
import path from "path"
import fs from "fs"
import { clamp } from "../util.js"
import { OpenAI } from "openai"

const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY

if (!CHATGPT_API_KEY) {
    throw new Error("CHATGPT_API_KEY environment variable is required to run the importer")
}

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

const createPlayerImporterService = (baseDataDir: string): { importer: PlayerImporterService, downloader: DownloaderService } => {
    const rollChartService = new RollChartService()
    const statService = new StatService()
    const simRolls = new SimRolls(rollChartService)
    const gamePlayers = new GamePlayers(rollChartService)
    const runnerActions = new RunnerActions(rollChartService, simRolls)
    const gameInfo = new GameInfo(gamePlayers)
    const simService = new SimService(rollChartService, simRolls, runnerActions, gameInfo, {} as PitchEnvironmentTarget)
    const downloader = new DownloaderService(baseDataDir, 1000)
    const importer = new PlayerImporterService(simService, statService, downloader)

    return { importer, downloader }
}

const buildCandidatePitchEnvironment = (pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning): PitchEnvironmentTarget => {
    return JSON.parse(JSON.stringify({
        ...pitchEnvironment,
        pitchEnvironmentTuning: candidate
    }))
}

const evaluateCandidateLocal = (pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, gamesPerIteration: number, rngSeed: string, baseDataDir: string): { actual: any, target: any, diff: any, score: number } => {
    const { importer } = createPlayerImporterService(baseDataDir)
    const candidatePitchEnvironment = buildCandidatePitchEnvironment(pitchEnvironment, candidate)
    const rng = seedrandom(rngSeed)

    return importer.evaluatePitchEnvironment(candidatePitchEnvironment, rng, gamesPerIteration)
}

const runWorker = (input: TuningWorkerInput): Promise<TuningWorkerSuccess> => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("./worker.js", import.meta.url), {
            workerData: input,
            execArgv: [...process.execArgv, "--no-warnings"]
        })

        worker.once("message", (message: TuningWorkerOutput) => {
            if (message.ok) {
                resolve(message)
                return
            }

            const failure = message as TuningWorkerFailure
            reject(new Error(failure.stack ? `${failure.error}\n${failure.stack}` : failure.error))
        })

        worker.once("error", reject)

        worker.once("exit", code => {
            if (code !== 0) {
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

    const existingPitchEnvironmentTarget = await fileExists(existingPitchEnvironmentTargetPath)
        ? await readJson(existingPitchEnvironmentTargetPath)
        : undefined

    const { importer, downloader } = createPlayerImporterService(baseDataDir)
    const players = await downloader.buildSeasonPlayerImports(season, new Set([]))
    const pitchEnvironment = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)
    const rng = seedrandom(String(season))

    const pitchEnvironmentTuning = await PitchEnvironmentTuner.getTunings(
        pitchEnvironment,
        rng,
        {
            ...options,
            baseDataDir,
            importer,
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

        log("TUNING START", "mode=deterministic-locks-then-chatgpt-shape", `games=${ctx.gamesPerIteration}`, `verifyGames=${ctx.finalGamesPerIteration}`, `workers=${ctx.workers}`)

        let candidate = this.normalizeTuningShape(params?.startingCandidate ?? ctx.importer.seedPitchEnvironmentTuning(pitchEnvironment))
        let result = await this.evaluateOne(candidate, ctx, ctx.gamesPerIteration, "baseline")

        this.printStatus("baseline", 0, ctx.gamesPerIteration, candidate, result)

        const history: any[] = [
            this.createHistoryRow("baseline", 0, candidate, result)
        ]

        let bestCandidate = this.normalizeTuningShape(candidate)
        let bestResult = result
        let bestPenalty = this.finalSelectionPenalty(result)

        const metric = (evaluatedResult: any, key: string): { actual: number, target: number, diff: number } => {
            const actual = Number(evaluatedResult.actual?.[key] ?? 0)
            const target = Number(evaluatedResult.target?.[key] ?? 0)

            return {
                actual,
                target,
                diff: actual - target
            }
        }

        const maybeAcceptBest = (next: PitchEnvironmentTuning, nextResult: any): void => {
            const nextPenalty = this.finalSelectionPenalty(nextResult)

            if (nextPenalty < bestPenalty) {
                bestCandidate = this.normalizeTuningShape(next)
                bestResult = nextResult
                bestPenalty = nextPenalty
            }
        }

        const runDeterministicPass = async (label: string, toleranceKey: string, tolerance: number, mutate: (next: PitchEnvironmentTuning, currentResult: any) => void): Promise<void> => {
            const currentMetric = metric(result, toleranceKey)

            if (Math.abs(currentMetric.diff) <= tolerance) {
                log("SKIP", label, `reason=${toleranceKey}-locked`, `actual=${this.f(currentMetric.actual)}`, `target=${this.f(currentMetric.target)}`)
                return
            }

            const next = this.normalizeTuningShape(candidate)
            mutate(next, result)

            if (this.sameTuning(candidate, next)) {
                log("SKIP", label, "reason=same-tuning")
                return
            }

            const nextResult = await this.evaluateOne(next, ctx, ctx.gamesPerIteration, label)
            const currentPenalty = this.finalSelectionPenalty(result)
            const nextPenalty = this.finalSelectionPenalty(nextResult)

            log("DETERMINISTIC", label, `currentPenalty=${this.f(currentPenalty)}`, `nextPenalty=${this.f(nextPenalty)}`)

            history.push(this.createHistoryRow(label, history.length, next, nextResult))
            maybeAcceptBest(next, nextResult)

            candidate = next
            result = nextResult

            this.printStatus(label, history.length, ctx.gamesPerIteration, candidate, result)
        }

        await runDeterministicPass("lock-BB", "bbPercent", 0.006, (next, currentResult) => {
            const bb = metric(currentResult, "bbPercent")
            const step = clamp((bb.target - bb.actual) / 0.6, -0.04, 0.04)

            next.tuning!.swing.walkRateScale = clamp(
                Number(next.tuning?.swing?.walkRateScale ?? 0) + step,
                ctx.walkMin,
                ctx.walkMax
            )
        })

        await runDeterministicPass("lock-SO", "soPercent", 0.008, (next, currentResult) => {
            const so = metric(currentResult, "soPercent")
            const step = clamp((so.target - so.actual) / 0.00025, -30, 30)

            next.tuning!.contact.pitchQualityContactEffect = clamp(
                Number(next.tuning?.contact?.pitchQualityContactEffect ?? 0) + step,
                ctx.contactMin,
                ctx.contactMax
            )

            next.tuning!.contact.contactSkillEffect = clamp(
                Number(next.tuning?.contact?.contactSkillEffect ?? 0) + step,
                ctx.contactMin,
                ctx.contactMax
            )
        })

        await runDeterministicPass("lock-OBP", "obp", 0.012, (next, currentResult) => {
            const obp = metric(currentResult, "obp")
            const step = clamp((obp.target - obp.actual) / -0.25, -0.03, 0.03)

            next.tuning!.contactQuality.outOutcomeScale = clamp(
                Number(next.tuning?.contactQuality?.outOutcomeScale ?? 0) + step,
                ctx.outMin,
                ctx.outMax
            )
        })

        await runDeterministicPass("lock-SBA", "teamSBAttemptsPerGame", 0.08, (next, currentResult) => {
            const sba = metric(currentResult, "teamSBAttemptsPerGame")
            const sb = metric(currentResult, "teamSBPerGame")
            const sbaStep = clamp((sba.target - sba.actual) / 0.55, -0.75, 0.75)
            const sbStep = clamp((sb.target - sb.actual) / 0.45, -0.75, 0.75)
            const step = Math.abs(sba.diff) >= Math.abs(sb.diff) ? sbaStep : sbStep

            next.tuning!.running.stealAttemptAggressionScale = clamp(
                Number(next.tuning?.running?.stealAttemptAggressionScale ?? 0) + step,
                ctx.stealMin,
                ctx.stealMax
            )
        })

        const maxChatPasses = Math.max(0, Number(params?.maxChatGptTuningPasses ?? 3))

        for (let pass = 1; pass <= maxChatPasses; pass++) {
            const proposedCandidate = this.normalizeTuningShape(await this.getChatGptProposal(pitchEnvironment, candidate, result, history, ctx, pass))

            if (this.sameTuning(candidate, proposedCandidate)) {
                log("CHATGPT STOP", `pass=${pass}`, "reason=same-tuning")
                break
            }

            const proposedResult = await this.evaluateOne(proposedCandidate, ctx, ctx.gamesPerIteration, `chatgpt-shape-${pass}`)
            const proposedPenalty = this.finalSelectionPenalty(proposedResult)

            log("CHATGPT PROPOSAL", `pass=${pass}`, `currentPenalty=${this.f(this.finalSelectionPenalty(result))}`, `bestPenalty=${this.f(bestPenalty)}`, `proposalPenalty=${this.f(proposedPenalty)}`)

            history.push(this.createHistoryRow(`chatgpt-shape-${pass}`, history.length, proposedCandidate, proposedResult))

            if (proposedPenalty < bestPenalty) {
                bestCandidate = proposedCandidate
                bestResult = proposedResult
                bestPenalty = proposedPenalty
                candidate = proposedCandidate
                result = proposedResult
                this.printStatus(`chatgpt-shape-${pass}`, pass, ctx.gamesPerIteration, candidate, result)
            }
        }

        const verified = await this.evaluateOne(bestCandidate, ctx, ctx.finalGamesPerIteration, "verify")

        this.printStatus("verify", 0, ctx.finalGamesPerIteration, bestCandidate, verified)

        if (!this.isCloseEnough(verified)) {
            this.printToleranceFailures("VERIFY WARNING", verified)
        }

        return bestCandidate
    }

    private static async getChatGptProposal(pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, result: any, history: any[], ctx: any, pass: number): Promise<PitchEnvironmentTuning> {
        if (!CHATGPT_API_KEY) {
            throw new Error("CHATGPT_API_KEY is empty")
        }

        const client = new OpenAI({
            apiKey: CHATGPT_API_KEY
        })

        const response = await client.responses.create({
            model: "gpt-4o-2024-08-06",
            input: [
                {
                    role: "system",
                    content: this.createChatGptSystemMessage()
                },
                {
                    role: "user",
                    content: this.createChatGptPrompt(pitchEnvironment, candidate, result, history, ctx, pass)
                }
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: "pitch_environment_tuning",
                    strict: true,
                    schema: this.createPitchEnvironmentTuningJsonSchema()
                }
            }
        })

        return this.clampTuning(this.parseChatGptTuningResponse(response.output_text), ctx)
    }

    private static createPitchEnvironmentTuningJsonSchema(): any {
        return {
            type: "object",
            additionalProperties: false,
            required: ["_id", "tuning"],
            properties: {
                _id: { type: "string" },
                tuning: {
                    type: "object",
                    additionalProperties: false,
                    required: ["contactQuality", "swing", "contact", "running", "meta"],
                    properties: {
                        contactQuality: {
                            type: "object",
                            additionalProperties: false,
                            required: ["evScale", "laScale", "distanceScale", "outOutcomeScale", "doubleOutcomeScale", "tripleOutcomeScale", "homeRunOutcomeScale"],
                            properties: {
                                evScale: { type: "number" },
                                laScale: { type: "number" },
                                distanceScale: { type: "number" },
                                outOutcomeScale: { type: "number" },
                                doubleOutcomeScale: { type: "number" },
                                tripleOutcomeScale: { type: "number" },
                                homeRunOutcomeScale: { type: "number" }
                            }
                        },
                        swing: {
                            type: "object",
                            additionalProperties: false,
                            required: ["pitchQualityZoneSwingEffect", "pitchQualityChaseSwingEffect", "disciplineZoneSwingEffect", "disciplineChaseSwingEffect", "walkRateScale"],
                            properties: {
                                pitchQualityZoneSwingEffect: { type: "number" },
                                pitchQualityChaseSwingEffect: { type: "number" },
                                disciplineZoneSwingEffect: { type: "number" },
                                disciplineChaseSwingEffect: { type: "number" },
                                walkRateScale: { type: "number" }
                            }
                        },
                        contact: {
                            type: "object",
                            additionalProperties: false,
                            required: ["pitchQualityContactEffect", "contactSkillEffect"],
                            properties: {
                                pitchQualityContactEffect: { type: "number" },
                                contactSkillEffect: { type: "number" }
                            }
                        },
                        running: {
                            type: "object",
                            additionalProperties: false,
                            required: ["stealAttemptAggressionScale", "advancementAggressionScale"],
                            properties: {
                                stealAttemptAggressionScale: { type: "number" },
                                advancementAggressionScale: { type: "number" }
                            }
                        },
                        meta: {
                            type: "object",
                            additionalProperties: false,
                            required: ["fullPitchQualityBonus", "fullTeamDefenseBonus", "fullFielderDefenseBonus"],
                            properties: {
                                fullPitchQualityBonus: { type: "number" },
                                fullTeamDefenseBonus: { type: "number" },
                                fullFielderDefenseBonus: { type: "number" }
                            }
                        }
                    }
                }
            }
        }
    }

    private static createChatGptSystemMessage(): string {
        return [
            "You are a deterministic baseball simulation tuning engine.",
            "Return only one JSON object.",
            "The JSON object must exactly match the PitchEnvironmentTuning TypeScript interface.",
            "Do not include markdown.",
            "Do not include explanations.",
            "Do not include fields outside the PitchEnvironmentTuning interface.",
            "BB%, SO%, OBP, and steal attempts have already been tuned deterministically.",
            "Do not change walkRateScale, pitchQualityContactEffect, contactSkillEffect, outOutcomeScale, or stealAttemptAggressionScale unless the prompt explicitly says one of them is badly broken.",
            "Focus on runs, OPS, SLG, HR%, doubles, triples, and baserunning advancement.",
            "Prefer advancementAggressionScale for run deficit when OPS is already high.",
            "Prefer homeRunOutcomeScale/doubleOutcomeScale/tripleOutcomeScale for OPS or SLG shape."
        ].join("\n")
    }

    private static createChatGptPrompt(pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, result: any, history: any[], ctx: any, pass: number): string {
        const latest = this.createCompactResult(result)
        const toleranceReport = this.getToleranceReport(result)
        const penaltyTerms = this.createPenaltyBreakdown(result)
        const largestPenaltyTerms = penaltyTerms
            .slice()
            .sort((a, b) => b.penalty - a.penalty)
            .slice(0, 8)

        const knobEffectSummary = this.createKnobEffectSummary(history)

        const environmentProfile = {
            pitch: {
                inZonePercent: pitchEnvironment.pitch?.inZonePercent,
                strikePercent: pitchEnvironment.pitch?.strikePercent,
                ballPercent: pitchEnvironment.pitch?.ballPercent,
                swingPercent: pitchEnvironment.pitch?.swingPercent,
                pitchesPerPA: pitchEnvironment.pitch?.pitchesPerPA,
                inZoneByCount: pitchEnvironment.pitch?.inZoneByCount
            },
            swing: {
                swingAtStrikesPercent: pitchEnvironment.swing?.swingAtStrikesPercent,
                swingAtBallsPercent: pitchEnvironment.swing?.swingAtBallsPercent,
                inZoneContactPercent: pitchEnvironment.swing?.inZoneContactPercent,
                outZoneContactPercent: pitchEnvironment.swing?.outZoneContactPercent,
                zoneSwingBase: pitchEnvironment.swing?.zoneSwingBase,
                chaseSwingBase: pitchEnvironment.swing?.chaseSwingBase,
                zoneContactBase: pitchEnvironment.swing?.zoneContactBase,
                chaseContactBase: pitchEnvironment.swing?.chaseContactBase,
                behaviorByCount: pitchEnvironment.swing?.behaviorByCount
            },
            outcome: {
                avg: pitchEnvironment.outcome?.avg,
                obp: pitchEnvironment.outcome?.obp,
                slg: pitchEnvironment.outcome?.slg,
                ops: pitchEnvironment.outcome?.ops,
                babip: pitchEnvironment.outcome?.babip,
                bbPercent: pitchEnvironment.outcome?.bbPercent,
                soPercent: pitchEnvironment.outcome?.soPercent,
                doublePercent: pitchEnvironment.outcome?.doublePercent,
                triplePercent: pitchEnvironment.outcome?.triplePercent,
                homeRunPercent: pitchEnvironment.outcome?.homeRunPercent,
                hbpPercent: pitchEnvironment.outcome?.hbpPercent
            },
            targetFromEvaluation: latest.target,
            running: {
                steal: pitchEnvironment.running?.steal,
                advancement: pitchEnvironment.running?.advancement
            }
        }

        return JSON.stringify({
            task: "Return the next PitchEnvironmentTuning. BB, SO, OBP, and SBA were handled deterministically. Use ChatGPT only for the remaining shape/runs/OPS tradeoff.",
            pass,
            environmentProfile,
            currentTuning: candidate,
            latest,
            toleranceReport,
            penaltyTerms,
            largestPenaltyTerms,
            knobEffectSummary,
            hardRules: [
                "Return only one JSON object matching the schema.",
                "Do not change walkRateScale unless bbPercent is outside tolerance by more than 0.008.",
                "Do not change pitchQualityContactEffect or contactSkillEffect unless soPercent is outside tolerance by more than 0.01.",
                "Do not change outOutcomeScale unless OBP/AVG/BABIP are the main problem.",
                "Do not change stealAttemptAggressionScale unless teamSBAttemptsPerGame is outside tolerance by more than 0.12.",
                "Prefer advancementAggressionScale when runs are low but OPS is already high or close.",
                "If OPS/SLG is high while runs are low, raise advancementAggressionScale and lower homeRunOutcomeScale or doubleOutcomeScale slightly.",
                "If OPS/SLG is low and runs are low, increase homeRunOutcomeScale or doubleOutcomeScale.",
                "If HR% is high, lower homeRunOutcomeScale.",
                "If HR% is low, raise homeRunOutcomeScale.",
                "Do not make more than 3 meaningful knob changes."
            ],
            knobNotes: {
                advancementAggressionScale: "Primary runs-only lever. Higher usually raises runs without directly changing AVG/OBP/SLG.",
                homeRunOutcomeScale: "Primary HR%, SLG, OPS, and runs lever. Higher raises HR/SLG; lower reduces HR/SLG.",
                doubleOutcomeScale: "Primary 2B%, SLG, OPS lever. Higher raises doubles/SLG without much OBP impact.",
                tripleOutcomeScale: "Primary 3B%, SLG, OPS lever. Usually small adjustments only.",
                outOutcomeScale: "Primary OBP/AVG/BABIP lever. Avoid unless OBP/AVG/BABIP are the issue.",
                walkRateScale: "Primary BB% lever. Already deterministically tuned.",
                pitchQualityContactEffect: "Primary SO% lever. Already deterministically tuned.",
                contactSkillEffect: "Primary SO/contact lever. Already deterministically tuned.",
                stealAttemptAggressionScale: "Primary SBA/SB lever. Already deterministically tuned."
            },
            ranges: {
                outOutcomeScale: [ctx.outMin, ctx.outMax],
                doubleOutcomeScale: [ctx.doubleMin, ctx.doubleMax],
                tripleOutcomeScale: [ctx.tripleMin, ctx.tripleMax],
                homeRunOutcomeScale: [ctx.homeRunMin, ctx.homeRunMax],
                walkRateScale: [ctx.walkMin, ctx.walkMax],
                pitchQualityContactEffect: [ctx.contactMin, ctx.contactMax],
                contactSkillEffect: [ctx.contactMin, ctx.contactMax],
                stealAttemptAggressionScale: [ctx.stealMin, ctx.stealMax],
                advancementAggressionScale: [ctx.advancementMin, ctx.advancementMax],
                fullTeamDefenseBonus: [-500, 500],
                fullFielderDefenseBonus: [-500, 500]
            }
        })
    }

    private static finalSelectionPenalty(result: any): number {
        const actual = result.actual ?? {}
        const target = result.target ?? {}

        const term = (key: string, tolerance: number, weight: number): number => {
            const diff = Number(actual[key] ?? 0) - Number(target[key] ?? 0)
            if (!Number.isFinite(diff)) return 0
            return Math.pow(diff / tolerance, 2) * weight
        }

        return (
            term("teamRunsPerGame", 0.12, 1500) +
            term("ops", 0.02, 800) +
            term("bbPercent", 0.004, 350) +
            term("soPercent", 0.006, 250) +
            term("homeRunPercent", 0.0035, 250) +
            term("teamSBAttemptsPerGame", 0.06, 180) +
            term("teamSBPerGame", 0.08, 120) +
            term("obp", 0.018, 100) +
            term("slg", 0.025, 100) +
            term("avg", 0.018, 35) +
            term("babip", 0.018, 25) +
            term("doublePercent", 0.008, 15) +
            term("triplePercent", 0.003, 10)
        )
    }

    private static createPenaltyBreakdown(result: any): any[] {
        const actual = result.actual ?? {}
        const target = result.target ?? {}

        const term = (key: string, tolerance: number, weight: number): any => {
            const actualValue = Number(actual[key] ?? 0)
            const targetValue = Number(target[key] ?? 0)
            const diff = actualValue - targetValue
            const penalty = Number.isFinite(diff) ? Math.pow(diff / tolerance, 2) * weight : 0

            return {
                key,
                actual: Number(actualValue.toFixed(4)),
                target: Number(targetValue.toFixed(4)),
                diff: Number(diff.toFixed(4)),
                tolerance,
                weight,
                penalty: Number(penalty.toFixed(3))
            }
        }

        return [
            term("teamRunsPerGame", 0.12, 1500),
            term("ops", 0.02, 800),
            term("bbPercent", 0.004, 350),
            term("soPercent", 0.006, 250),
            term("homeRunPercent", 0.0035, 250),
            term("teamSBAttemptsPerGame", 0.06, 180),
            term("teamSBPerGame", 0.08, 120),
            term("obp", 0.018, 100),
            term("slg", 0.025, 100),
            term("avg", 0.018, 35),
            term("babip", 0.018, 25),
            term("doublePercent", 0.008, 15),
            term("triplePercent", 0.003, 10)
        ]
    }

    private static createCompactTuning(candidate: PitchEnvironmentTuning): any {
        return {
            outOutcomeScale: candidate.tuning?.contactQuality?.outOutcomeScale,
            doubleOutcomeScale: candidate.tuning?.contactQuality?.doubleOutcomeScale,
            tripleOutcomeScale: candidate.tuning?.contactQuality?.tripleOutcomeScale,
            homeRunOutcomeScale: candidate.tuning?.contactQuality?.homeRunOutcomeScale,
            walkRateScale: candidate.tuning?.swing?.walkRateScale,
            pitchQualityContactEffect: candidate.tuning?.contact?.pitchQualityContactEffect,
            contactSkillEffect: candidate.tuning?.contact?.contactSkillEffect,
            stealAttemptAggressionScale: candidate.tuning?.running?.stealAttemptAggressionScale,
            advancementAggressionScale: candidate.tuning?.running?.advancementAggressionScale,
            fullTeamDefenseBonus: candidate.tuning?.meta?.fullTeamDefenseBonus,
            fullFielderDefenseBonus: candidate.tuning?.meta?.fullFielderDefenseBonus
        }
    }

    private static createKnobEffectSummary(history: any[]): any[] {
        const rows = history
            .filter(row => row?.tuning && row?.actual)
            .map(row => ({
                label: row.label,
                pass: row.pass,
                tuning: this.createCompactTuning(row.tuning),
                actual: row.actual,
                penalty: Number(row.penalty ?? 0)
            }))

        const effects: any[] = []
        const knobs = ["outOutcomeScale", "doubleOutcomeScale", "tripleOutcomeScale", "homeRunOutcomeScale", "walkRateScale", "pitchQualityContactEffect", "contactSkillEffect", "stealAttemptAggressionScale", "advancementAggressionScale", "fullTeamDefenseBonus", "fullFielderDefenseBonus"]
        const metrics = ["teamRunsPerGame", "avg", "obp", "slg", "ops", "babip", "bbPercent", "soPercent", "singlePercent", "doublePercent", "triplePercent", "homeRunPercent", "teamSBAttemptsPerGame", "teamSBPerGame"]

        for (let i = 1; i < rows.length; i++) {
            const previous = rows[i - 1]
            const current = rows[i]
            const knobDelta: any = {}
            const metricDelta: any = {}

            for (const knob of knobs) {
                const before = Number(previous.tuning?.[knob] ?? 0)
                const after = Number(current.tuning?.[knob] ?? 0)
                const delta = after - before

                if (Number.isFinite(delta) && Math.abs(delta) > 0.000001) {
                    knobDelta[knob] = Number(delta.toFixed(4))
                }
            }

            if (Object.keys(knobDelta).length === 0) continue

            for (const metric of metrics) {
                const before = Number(previous.actual?.[metric] ?? 0)
                const after = Number(current.actual?.[metric] ?? 0)
                const delta = after - before

                if (Number.isFinite(delta)) {
                    metricDelta[metric] = Number(delta.toFixed(4))
                }
            }

            effects.push({
                from: previous.label,
                to: current.label,
                penaltyDelta: Number((current.penalty - previous.penalty).toFixed(3)),
                knobDelta,
                metricDelta
            })
        }

        return effects.slice(-8)
    }

    private static createCompactResult(result: any): any {
        const actual = result.actual ?? {}
        const target = result.target ?? {}

        const metric = (key: string): any => {
            const a = Number(actual[key] ?? 0)
            const t = Number(target[key] ?? 0)

            return {
                actual: Number(a.toFixed(4)),
                target: Number(t.toFixed(4)),
                diff: Number((a - t).toFixed(4))
            }
        }

        return {
            actual,
            target,
            penalty: Number(this.finalSelectionPenalty(result).toFixed(3)),
            metrics: {
                teamRunsPerGame: metric("teamRunsPerGame"),
                avg: metric("avg"),
                obp: metric("obp"),
                slg: metric("slg"),
                ops: metric("ops"),
                babip: metric("babip"),
                bbPercent: metric("bbPercent"),
                soPercent: metric("soPercent"),
                singlePercent: metric("singlePercent"),
                doublePercent: metric("doublePercent"),
                triplePercent: metric("triplePercent"),
                homeRunPercent: metric("homeRunPercent"),
                teamSBAttemptsPerGame: metric("teamSBAttemptsPerGame"),
                teamSBPerGame: metric("teamSBPerGame")
            }
        }
    }

    private static parseChatGptTuningResponse(text: string): PitchEnvironmentTuning {
        const raw = String(text ?? "").trim()

        if (!raw) {
            throw new Error("ChatGPT returned an empty tuning response")
        }

        const withoutFence = raw
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim()

        const first = withoutFence.indexOf("{")
        const last = withoutFence.lastIndexOf("}")

        if (first < 0 || last <= first) {
            throw new Error(`ChatGPT did not return a JSON object: ${withoutFence.slice(0, 250)}`)
        }

        return JSON.parse(withoutFence.slice(first, last + 1))
    }

    private static createHistoryRow(label: string, pass: number, candidate: PitchEnvironmentTuning, result: any): any {
        return {
            label,
            pass,
            tuning: candidate,
            actual: result.actual,
            target: result.target,
            diff: result.diff,
            penalty: this.finalSelectionPenalty(result),
            toleranceReport: this.getToleranceReport(result)
        }
    }

    private static corePenalty(result: any): number {
        return this.finalSelectionPenalty(result)
    }

    private static async evaluateOne(candidate: PitchEnvironmentTuning, ctx: any, games: number, label: string): Promise<any> {
        const normalizedCandidate = this.normalizeTuningShape(candidate)
        const sampleCount = Math.max(1, Number(ctx.workers ?? 1))
        const candidates = new Array(sampleCount).fill(0).map(() => this.normalizeTuningShape(JSON.parse(JSON.stringify(normalizedCandidate))))

        log("BATCH START", label, `games=${games}`, `samples=${candidates.length}`, `workers=${ctx.workers}`)

        const evaluated = ctx.workers > 1
            ? await evaluateCandidatesWithWorkers(ctx.pitchEnvironment, candidates, games, ctx.workers, `${ctx.baseSeed}:${label}`)
            : candidates.map((candidate, index) => ({
                ok: true as const,
                candidate,
                result: evaluateCandidateLocal(ctx.pitchEnvironment, candidate, games, `${ctx.baseSeed}:${label}:${index}:${candidate._id}`, ctx.baseDataDir)
            }))

        log("BATCH DONE", label, `results=${evaluated.length}`)

        const results = evaluated.filter((row: any) => row?.ok && row?.result).map((row: any) => ctx.applyScore(row.result))

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

            diff[metric] = Number.isFinite(actualValue) && Number.isFinite(targetValue)
                ? actualValue - targetValue
                : averageBlock("diff", [metric])[metric]
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

        log("EVAL SAMPLE", label, `samples=${sampleCount}`, `gamesEach=${games}`, `totalGames=${totalGames}`)

        return {
            actual,
            target,
            diff,
            score: scoreCount > 0 ? score / scoreCount : Number.MAX_SAFE_INTEGER
        }
    }

    private static createTuningContext(pitchEnvironment: PitchEnvironmentTarget, rng: Function, params?: any): any {
        return {
            pitchEnvironment,
            importer: params?.importer,
            baseDataDir: params?.baseDataDir ?? "data",
            baseSeed: String(rng()),
            gamesPerIteration: params?.gamesPerIteration ?? 30,
            finalGamesPerIteration: params?.finalGamesPerIteration ?? 30,
            workers: Math.max(1, params?.workers ?? 1),
            outMin: -0.95,
            outMax: 0.95,
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
            applyScore: (rawResult: any) => this.normalizeHitTypeRatesToAtBats(rawResult)
        }
    }

    private static normalizeTuningShape(candidate: PitchEnvironmentTuning): PitchEnvironmentTuning {
        const next: PitchEnvironmentTuning = JSON.parse(JSON.stringify(candidate ?? {}))

        next._id = next._id ?? uuidv4()
        next.tuning = next.tuning ?? {} as any
        next.tuning!.contactQuality = next.tuning!.contactQuality ?? {} as any
        next.tuning!.swing = next.tuning!.swing ?? {} as any
        next.tuning!.contact = next.tuning!.contact ?? {} as any
        next.tuning!.running = next.tuning!.running ?? {} as any
        next.tuning!.meta = next.tuning!.meta ?? {} as any

        next.tuning!.contactQuality.evScale = Number(next.tuning!.contactQuality.evScale ?? 0)
        next.tuning!.contactQuality.laScale = Number(next.tuning!.contactQuality.laScale ?? 0)
        next.tuning!.contactQuality.distanceScale = Number(next.tuning!.contactQuality.distanceScale ?? 0)
        next.tuning!.contactQuality.outOutcomeScale = Number(next.tuning!.contactQuality.outOutcomeScale ?? 0)
        next.tuning!.contactQuality.doubleOutcomeScale = Number(next.tuning!.contactQuality.doubleOutcomeScale ?? 0)
        next.tuning!.contactQuality.tripleOutcomeScale = Number(next.tuning!.contactQuality.tripleOutcomeScale ?? 0)
        next.tuning!.contactQuality.homeRunOutcomeScale = Number(next.tuning!.contactQuality.homeRunOutcomeScale ?? 0)

        next.tuning!.swing.pitchQualityZoneSwingEffect = Number(next.tuning!.swing.pitchQualityZoneSwingEffect ?? 0)
        next.tuning!.swing.pitchQualityChaseSwingEffect = Number(next.tuning!.swing.pitchQualityChaseSwingEffect ?? 0)
        next.tuning!.swing.disciplineZoneSwingEffect = Number(next.tuning!.swing.disciplineZoneSwingEffect ?? 0)
        next.tuning!.swing.disciplineChaseSwingEffect = Number(next.tuning!.swing.disciplineChaseSwingEffect ?? 0)
        next.tuning!.swing.walkRateScale = Number(next.tuning!.swing.walkRateScale ?? 0)

        next.tuning!.contact.pitchQualityContactEffect = Number(next.tuning!.contact.pitchQualityContactEffect ?? 0)
        next.tuning!.contact.contactSkillEffect = Number(next.tuning!.contact.contactSkillEffect ?? next.tuning!.contact.pitchQualityContactEffect ?? 0)

        next.tuning!.running.stealAttemptAggressionScale = Number(next.tuning!.running.stealAttemptAggressionScale ?? 0)
        next.tuning!.running.advancementAggressionScale = Number(next.tuning!.running.advancementAggressionScale ?? 0)

        next.tuning!.meta.fullPitchQualityBonus = Number(next.tuning!.meta.fullPitchQualityBonus ?? 0)
        next.tuning!.meta.fullTeamDefenseBonus = Number(next.tuning!.meta.fullTeamDefenseBonus ?? 0)
        next.tuning!.meta.fullFielderDefenseBonus = Number(next.tuning!.meta.fullFielderDefenseBonus ?? 0)

        if (next.ratingTuning) {
            next.ratingTuning = JSON.parse(JSON.stringify(next.ratingTuning))
        }

        return next
    }

    private static clampTuning(candidate: PitchEnvironmentTuning, ctx: any): PitchEnvironmentTuning {
        const next = this.normalizeTuningShape(candidate)

        next.tuning!.contactQuality.evScale = clamp(next.tuning!.contactQuality.evScale, -250, 250)
        next.tuning!.contactQuality.laScale = clamp(next.tuning!.contactQuality.laScale, -250, 250)
        next.tuning!.contactQuality.distanceScale = clamp(next.tuning!.contactQuality.distanceScale, -250, 250)
        next.tuning!.contactQuality.outOutcomeScale = clamp(next.tuning!.contactQuality.outOutcomeScale, ctx.outMin, ctx.outMax)
        next.tuning!.contactQuality.doubleOutcomeScale = clamp(next.tuning!.contactQuality.doubleOutcomeScale, ctx.doubleMin, ctx.doubleMax)
        next.tuning!.contactQuality.tripleOutcomeScale = clamp(next.tuning!.contactQuality.tripleOutcomeScale, ctx.tripleMin, ctx.tripleMax)
        next.tuning!.contactQuality.homeRunOutcomeScale = clamp(next.tuning!.contactQuality.homeRunOutcomeScale, ctx.homeRunMin, ctx.homeRunMax)

        next.tuning!.swing.pitchQualityZoneSwingEffect = clamp(next.tuning!.swing.pitchQualityZoneSwingEffect, -250, 250)
        next.tuning!.swing.pitchQualityChaseSwingEffect = clamp(next.tuning!.swing.pitchQualityChaseSwingEffect, -250, 250)
        next.tuning!.swing.disciplineZoneSwingEffect = clamp(next.tuning!.swing.disciplineZoneSwingEffect, -250, 250)
        next.tuning!.swing.disciplineChaseSwingEffect = clamp(next.tuning!.swing.disciplineChaseSwingEffect, -250, 250)
        next.tuning!.swing.walkRateScale = clamp(next.tuning!.swing.walkRateScale, ctx.walkMin, ctx.walkMax)

        next.tuning!.contact.pitchQualityContactEffect = clamp(next.tuning!.contact.pitchQualityContactEffect, ctx.contactMin, ctx.contactMax)
        next.tuning!.contact.contactSkillEffect = clamp(next.tuning!.contact.contactSkillEffect, ctx.contactMin, ctx.contactMax)

        next.tuning!.running.stealAttemptAggressionScale = clamp(next.tuning!.running.stealAttemptAggressionScale, ctx.stealMin, ctx.stealMax)
        next.tuning!.running.advancementAggressionScale = clamp(next.tuning!.running.advancementAggressionScale, ctx.advancementMin, ctx.advancementMax)

        next.tuning!.meta.fullPitchQualityBonus = clamp(next.tuning!.meta.fullPitchQualityBonus, -500, 500)
        next.tuning!.meta.fullTeamDefenseBonus = clamp(next.tuning!.meta.fullTeamDefenseBonus, -500, 500)
        next.tuning!.meta.fullFielderDefenseBonus = clamp(next.tuning!.meta.fullFielderDefenseBonus, -500, 500)

        return next
    }

    private static sameTuning(a: PitchEnvironmentTuning, b: PitchEnvironmentTuning): boolean {
        const left = this.normalizeTuningShape(a)
        const right = this.normalizeTuningShape(b)

        return JSON.stringify(left.tuning) === JSON.stringify(right.tuning) &&
            JSON.stringify(left.ratingTuning ?? null) === JSON.stringify(right.ratingTuning ?? null)
    }

    private static normalizeHitTypeRatesToAtBats(result: { actual: any, target: any, diff: any, score: number }): { actual: any, target: any, diff: any, score: number } {
        const next = JSON.parse(JSON.stringify(result))

        const normalize = (block: any): void => {
            if (!block) return

            const pa = Number(block.pa ?? block.teamPlateAppearancesPerGame ?? 0)
            const ab = Number(block.atBats ?? block.teamAtBatsPerGame ?? 0)

            if (Number.isFinite(pa) && pa > 0 && Number.isFinite(ab) && ab > 0) {
                const scale = pa / ab

                for (const key of ["singlePercent", "doublePercent", "triplePercent", "homeRunPercent"]) {
                    if (Number.isFinite(Number(block[key]))) {
                        block[key] = Number(block[key]) * scale
                    }
                }
            }

            if (!Number.isFinite(Number(block.ops))) {
                block.ops = Number(block.obp ?? 0) + Number(block.slg ?? 0)
            }
        }

        normalize(next.actual)
        normalize(next.target)

        next.diff = next.diff ?? {}

        for (const key of Object.keys(next.actual ?? {})) {
            if (Number.isFinite(Number(next.actual?.[key])) && Number.isFinite(Number(next.target?.[key]))) {
                next.diff[key] = Number(next.actual[key]) - Number(next.target[key])
            }
        }

        return next
    }

    private static isCloseEnough(result: any): boolean {
        return this.getToleranceReport(result).every(row => row.ok)
    }

    private static getToleranceReport(result: any): any[] {
        const actual = result.actual ?? {}
        const target = result.target ?? {}

        return [
            { key: "teamRunsPerGame", actual: actual.teamRunsPerGame, target: target.teamRunsPerGame, tolerance: 0.18 },
            { key: "ops", actual: actual.ops, target: target.ops, tolerance: 0.03 },
            { key: "obp", actual: actual.obp, target: target.obp, tolerance: 0.018 },
            { key: "slg", actual: actual.slg, target: target.slg, tolerance: 0.025 },
            { key: "avg", actual: actual.avg, target: target.avg, tolerance: 0.018 },
            { key: "babip", actual: actual.babip, target: target.babip, tolerance: 0.018 },
            { key: "bbPercent", actual: actual.bbPercent, target: target.bbPercent, tolerance: 0.01 },
            { key: "soPercent", actual: actual.soPercent, target: target.soPercent, tolerance: 0.012 },
            { key: "singlePercent", actual: actual.singlePercent, target: target.singlePercent, tolerance: 0.014 },
            { key: "doublePercent", actual: actual.doublePercent, target: target.doublePercent, tolerance: 0.008 },
            { key: "triplePercent", actual: actual.triplePercent, target: target.triplePercent, tolerance: 0.003 },
            { key: "homeRunPercent", actual: actual.homeRunPercent, target: target.homeRunPercent, tolerance: 0.006 },
            { key: "teamSBAttemptsPerGame", actual: actual.teamSBAttemptsPerGame, target: target.teamSBAttemptsPerGame, tolerance: 0.12 },
            { key: "teamSBPerGame", actual: actual.teamSBPerGame, target: target.teamSBPerGame, tolerance: 0.12 }
        ].map(row => ({
            ...row,
            diff: Number(row.actual ?? 0) - Number(row.target ?? 0),
            ok: Math.abs(Number(row.actual ?? 0) - Number(row.target ?? 0)) <= row.tolerance
        }))
    }

    private static printStatus(label: string, loop: number, games: number, candidate: PitchEnvironmentTuning, result: any): void {
        const actual = result.actual ?? {}
        const target = result.target ?? {}

        log(
            label,
            `i=${loop}`,
            `G=${games}`,
            `R=${this.f(actual.teamRunsPerGame)}/${this.f(target.teamRunsPerGame)}`,
            `AVG=${this.f(actual.avg)}/${this.f(target.avg)}`,
            `OBP=${this.f(actual.obp)}/${this.f(target.obp)}`,
            `SLG=${this.f(actual.slg)}/${this.f(target.slg)}`,
            `OPS=${this.f(actual.ops)}/${this.f(target.ops)}`,
            `BABIP=${this.f(actual.babip)}/${this.f(target.babip)}`,
            `BB=${this.f(actual.bbPercent)}/${this.f(target.bbPercent)}`,
            `SO=${this.f(actual.soPercent)}/${this.f(target.soPercent)}`,
            `1B=${this.f(actual.singlePercent)}/${this.f(target.singlePercent)}`,
            `2B=${this.f(actual.doublePercent)}/${this.f(target.doublePercent)}`,
            `3B=${this.f(actual.triplePercent)}/${this.f(target.triplePercent)}`,
            `HR=${this.f(actual.homeRunPercent)}/${this.f(target.homeRunPercent)}`,
            `SBA=${this.f(actual.teamSBAttemptsPerGame)}/${this.f(target.teamSBAttemptsPerGame)}`,
            `SB=${this.f(actual.teamSBPerGame)}/${this.f(target.teamSBPerGame)}`,
            `T[O=${this.f(candidate.tuning?.contactQuality.outOutcomeScale)} 2b=${this.f(candidate.tuning?.contactQuality.doubleOutcomeScale)} 3b=${this.f(candidate.tuning?.contactQuality.tripleOutcomeScale)} hr=${this.f(candidate.tuning?.contactQuality.homeRunOutcomeScale)} bb=${this.f(candidate.tuning?.swing.walkRateScale)} so=${this.f(candidate.tuning?.contact.pitchQualityContactEffect)} sb=${this.f(candidate.tuning?.running.stealAttemptAggressionScale)} br=${this.f(candidate.tuning?.running.advancementAggressionScale)} td=${this.f(candidate.tuning?.meta.fullTeamDefenseBonus)} fd=${this.f(candidate.tuning?.meta.fullFielderDefenseBonus)}]`
        )
    }

    private static printToleranceFailures(label: string, result: any): void {
        log(label, JSON.stringify(this.getToleranceReport(result).filter(row => !row.ok), null, 2))
    }

    private static f(value: any): string {
        const number = Number(value)
        return Number.isFinite(number) ? Number(number.toFixed(3)).toString() : "NaN"
    }
}

export {
    importPitchEnvironmentTarget,
    evaluateCandidateLocal,
    evaluateCandidatesWithWorkers,
    ImportPitchEnvironmentTargetResult
}