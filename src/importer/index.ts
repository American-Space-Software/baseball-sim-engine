import { Worker } from "worker_threads"
import seedrandom from "seedrandom"
import { PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerImportRaw, RatingTuning } from "../sim/service/interfaces.js"
import { RollChartService } from "../sim/service/roll-chart-service.js"
import { GameInfo, GamePlayers, SimRolls, SimService } from "../sim/service/sim-service.js"
import { StatService } from "../sim/service/stat-service.js"
import { DownloaderService } from "./service/downloader-service.js"
import { PitchEnvironmentService } from "./service/pitch-environment-service.js"
import { v4 as uuidv4 } from "uuid"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import { clamp } from "./util.js"
import { OpenAI } from "openai"
import { RunnerService } from "../sim/service/runner-service.js"
import { SubstitutionService } from "../sim/service/substitution-service.js"
import { PlayerRatingService } from "./service/player-rating-service.js"
import { BaselineGameService } from "./service/baseline-game-service.js"


const NUMBER_OF_WORKERS = 25

const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY

if (!CHATGPT_API_KEY) {
    throw new Error("CHATGPT_API_KEY environment variable is required to run the importer")
}

const log = (...args: any[]) => {
    console.log("[IMPORTER]", ...args)
}

type PitchEnvironmentWorkerInput = {
    kind: "pitchEnvironment"
    pitchEnvironment: PitchEnvironmentTarget
    candidate: PitchEnvironmentTuning
    gamesPerIteration: number
    rngSeed: string
}

type RatingWorkerInput = {
    kind: "rating"
    pitchEnvironment: PitchEnvironmentTarget
    candidate: RatingTuning
    players: PlayerImportRaw[]
    gamesPerPlayer: number
    rngSeed: string
}

type TuningWorkerInput = PitchEnvironmentWorkerInput | RatingWorkerInput

type TuningWorkerSuccess = {
    ok: true
    candidate: PitchEnvironmentTuning | RatingTuning
    result: { actual: any, target: any, diff: any, score: number }
}

type TuningWorkerFailure = {
    ok: false
    error: string
    stack?: string
}

type TuningWorkerOutput = TuningWorkerSuccess | TuningWorkerFailure

interface ImportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget
    players: Map<string, PlayerImportRaw>
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

    const tuningSupportService = new TuningSupportService(baseDataDir)
    const { pitchEnvironmentService, downloader } = tuningSupportService.createServices()

    const players = await downloader.buildSeasonPlayerImports(season, new Set([]))
    const pitchEnvironment = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(season, players)
    const rng = seedrandom(String(season))

    const tuningEvaluationService = new TuningEvaluationService()
    const pitchEnvironmentTuner = new PitchEnvironmentTuner(tuningSupportService, tuningEvaluationService)
    

    const pitchEnvironmentTuning = await pitchEnvironmentTuner.getTunings(
        pitchEnvironment,
        rng,
        {
            ...options,
            baseDataDir,
            pitchEnvironmentService,
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

async function importRatingTuning(season: number, baseDataDir: string, options?: any): Promise<RatingTuning> {
    const existingRatingTuningPath = path.join(baseDataDir, String(season), `_ratings_tuning.json`)

    const readJson = async (filePath: string): Promise<any> => JSON.parse(await fs.promises.readFile(filePath, "utf8"))

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

    const existingRatingTuning = await fileExists(existingRatingTuningPath)
        ? await readJson(existingRatingTuningPath)
        : undefined

    if (existingRatingTuning && !options?.forceRatingTuning) {
        log("RATING TUNING READ", existingRatingTuningPath)
        return existingRatingTuning
    }

    const tuningSupportService = new TuningSupportService(baseDataDir)
    const tuningEvaluationService = new TuningEvaluationService()
    const { pitchEnvironmentService, downloader } = tuningSupportService.createServices()

    const players = await downloader.buildSeasonPlayerImports(season, new Set([]))
    const pitchEnvironment = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(season, players)
    const rng = seedrandom(String(season))

    const ratingTuner = new RatingTuner(tuningSupportService, tuningEvaluationService)

    const ratingTuning = await ratingTuner.getTuning(
        pitchEnvironment,
        players,
        rng,
        {
            ...options,
            baseDataDir,
            pitchEnvironmentService,
            startingCandidate: existingRatingTuning
        }
    )

    await writeJson(existingRatingTuningPath, ratingTuning)

    return ratingTuning
}

async function importPlayerRatings(season: number, baseDataDir: string, ratingTuning?: RatingTuning): Promise<any[]> {
    const seasonDataDir = path.join(baseDataDir, String(season))
    const playerRatingsPath = path.join(seasonDataDir, `_player_ratings.json`)
    const ratingTuningPath = path.join(seasonDataDir, `_ratings_tuning.json`)
    const pitchEnvironmentTargetPath = path.join(seasonDataDir, `_pitch_environment_target.json`)

    const readJson = async (filePath: string): Promise<any> => {
        return JSON.parse(await fs.promises.readFile(filePath, "utf8"))
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

    const tuningSupportService = new TuningSupportService(baseDataDir)
    const { downloader } = tuningSupportService.createServices()

    const players = await downloader.buildSeasonPlayerImports(season, new Set([]))

    const pitchEnvironment: PitchEnvironmentTarget = await fileExists(pitchEnvironmentTargetPath)
        ? await readJson(pitchEnvironmentTargetPath)
        : PitchEnvironmentService.getPitchEnvironmentTargetForSeason(season, players)

    const finalRatingTuning: RatingTuning = ratingTuning
        ?? (await fileExists(ratingTuningPath)
            ? await readJson(ratingTuningPath)
            : PlayerRatingService.seedRatingTuning())

    if (!ratingTuning && !(await fileExists(ratingTuningPath))) {
        log("RATING TUNING MISSING", ratingTuningPath, "using seed rating tuning")
    }

    const playerRatings = Array.from(players.values()).map(playerImportRaw => {
        const command = PlayerRatingService.createPlayerFromImportRaw(
            pitchEnvironment,
            playerImportRaw
        )

        Object.assign(command as any, { ratingTuning: finalRatingTuning })

        const ratings = PlayerRatingService.createPlayerFromStatsCommand(command)

        return {
            playerId: playerImportRaw.playerId,
            firstName: playerImportRaw.firstName,
            lastName: playerImportRaw.lastName,
            primaryPosition: playerImportRaw.primaryPosition,
            age: playerImportRaw.age,
            throws: playerImportRaw.throws,
            hits: playerImportRaw.bats,
            hittingRatings: ratings.hittingRatings,
            pitchRatings: ratings.pitchRatings
        }
    })

    await writeJson(playerRatingsPath, playerRatings)

    return playerRatings
}

class PitchEnvironmentTuner {

    constructor(private tuningSupportService: TuningSupportService, private tuningEvaluationService: TuningEvaluationService) {}

    public async getTunings(pitchEnvironment: PitchEnvironmentTarget, rng: Function, params?: any): Promise<PitchEnvironmentTuning> {
        const ctx = this.createTuningContext(pitchEnvironment, rng, params)

        log("TUNING START", "mode=deterministic-locks-then-chatgpt-shape", `games=${ctx.gamesPerIteration}`, `verifyGames=${ctx.finalGamesPerIteration}`, `workers=${ctx.workers}`)

        let candidate = PitchEnvironmentTuner.normalizeTuningShape(params?.startingCandidate ?? ctx.importer.seedPitchEnvironmentTuning(pitchEnvironment))
        let result = await this.evaluateOne(candidate, ctx, ctx.gamesPerIteration, "baseline")

        this.printStatus("baseline", 0, ctx.gamesPerIteration, candidate, result)

        const history: any[] = [
            this.tuningEvaluationService.createHistoryRow("baseline", 0, candidate, result)
        ]

        const topCandidateLimit = ctx.topCandidateLimit
        const verifiedCandidateLimit = ctx.verifiedCandidateLimit

        const topCandidates: { label: string, candidate: PitchEnvironmentTuning, result: any, penalty: number }[] = []

        const addTopCandidate = (label: string, next: PitchEnvironmentTuning, nextResult: any): void => {
            const normalized = PitchEnvironmentTuner.normalizeTuningShape(next)
            const penalty = this.tuningEvaluationService.finalSelectionPenalty(nextResult)

            const existingIndex = topCandidates.findIndex(row =>
                PitchEnvironmentTuner.sameTuning(row.candidate, normalized)
            )

            if (existingIndex >= 0) {
                if (penalty < topCandidates[existingIndex].penalty) {
                    topCandidates[existingIndex] = {
                        label,
                        candidate: normalized,
                        result: nextResult,
                        penalty
                    }
                }
            } else {
                topCandidates.push({
                    label,
                    candidate: normalized,
                    result: nextResult,
                    penalty
                })
            }

            topCandidates.sort((a, b) => a.penalty - b.penalty)

            while (topCandidates.length > topCandidateLimit) {
                topCandidates.pop()
            }
        }

        addTopCandidate("baseline", candidate, result)

        const runDeterministicPass = async (label: string, toleranceKey: string, tolerance: number, mutate: (next: PitchEnvironmentTuning, currentResult: any) => void, acceptOnlyIfBetter: boolean = false): Promise<boolean> => {
            const currentMetric = this.tuningEvaluationService.metric(result, toleranceKey)

            if (Math.abs(currentMetric.diff) <= tolerance) {
                log("SKIP", label, `reason=${toleranceKey}-locked`, `actual=${this.tuningEvaluationService.f(currentMetric.actual)}`, `target=${this.tuningEvaluationService.f(currentMetric.target)}`)
                return true
            }

            const next = PitchEnvironmentTuner.normalizeTuningShape(candidate)
            mutate(next, result)

            if (PitchEnvironmentTuner.sameTuning(candidate, next)) {
                log("SKIP", label, "reason=same-tuning")
                return false
            }

            const nextResult = await this.evaluateOne(next, ctx, ctx.gamesPerIteration, label)
            const currentPenalty = this.tuningEvaluationService.finalSelectionPenalty(result)
            const nextPenalty = this.tuningEvaluationService.finalSelectionPenalty(nextResult)

            log("DETERMINISTIC", label, `currentPenalty=${this.tuningEvaluationService.f(currentPenalty)}`, `nextPenalty=${this.tuningEvaluationService.f(nextPenalty)}`)

            history.push(this.tuningEvaluationService.createHistoryRow(label, history.length, next, nextResult))
            addTopCandidate(label, next, nextResult)

            if (!acceptOnlyIfBetter || nextPenalty <= currentPenalty) {
                candidate = next
                result = nextResult
                this.printStatus(label, history.length, ctx.gamesPerIteration, candidate, result)
            } else {
                log("REJECT", label, "reason=worse-global-penalty")
            }

            return Math.abs(this.tuningEvaluationService.metric(result, toleranceKey).diff) <= tolerance
        }

        const runAdvancementProbePass = async (label: string): Promise<void> => {
            const runs = this.tuningEvaluationService.metric(result, "teamRunsPerGame")
            const ops = this.tuningEvaluationService.metric(result, "ops")

            if (runs.actual >= runs.target) {
                log("SKIP", label, "reason=runs-not-low", `actual=${this.tuningEvaluationService.f(runs.actual)}`, `target=${this.tuningEvaluationService.f(runs.target)}`)
                return
            }

            if (Math.abs(ops.diff) > 0.03) {
                log("SKIP", label, "reason=ops-not-close", `actual=${this.tuningEvaluationService.f(ops.actual)}`, `target=${this.tuningEvaluationService.f(ops.target)}`)
                return
            }

            const currentScale = Number(candidate.tuning?.running?.advancementAggressionScale ?? 0)
            const runGapShare = (runs.target - runs.actual) / Math.max(1, runs.target)
            const baseStep = clamp(runGapShare, 0.01, 0.12)

            const probeScales = [
                currentScale + baseStep,
                currentScale + (baseStep * 0.5),
                currentScale + (baseStep * 1.5),
                currentScale - (baseStep * 0.5)
            ]
                .map(value => clamp(value, ctx.advancementMin, ctx.advancementMax))
                .filter((value, index, values) => values.indexOf(value) === index)
                .filter(value => Math.abs(value - currentScale) > 0.000001)

            if (probeScales.length === 0) {
                log("SKIP", label, "reason=no-probes")
                return
            }

            let localBestCandidate = candidate
            let localBestResult = result
            let localBestPenalty = this.tuningEvaluationService.finalSelectionPenalty(result)

            for (let i = 0; i < probeScales.length; i++) {
                const next = PitchEnvironmentTuner.normalizeTuningShape(candidate)
                next.tuning!.running.advancementAggressionScale = probeScales[i]

                const nextResult = await this.evaluateOne(next, ctx, ctx.gamesPerIteration, `${label}-${i + 1}`)
                const nextPenalty = this.tuningEvaluationService.finalSelectionPenalty(nextResult)

                history.push(this.tuningEvaluationService.createHistoryRow(`${label}-${i + 1}`, history.length, next, nextResult))
                addTopCandidate(`${label}-${i + 1}`, next, nextResult)

                log("ADVANCEMENT PROBE", `${label}-${i + 1}`, `scale=${this.tuningEvaluationService.f(probeScales[i])}`, `currentPenalty=${this.tuningEvaluationService.f(localBestPenalty)}`, `nextPenalty=${this.tuningEvaluationService.f(nextPenalty)}`)

                if (nextPenalty < localBestPenalty) {
                    localBestCandidate = next
                    localBestResult = nextResult
                    localBestPenalty = nextPenalty
                }
            }

            if (!PitchEnvironmentTuner.sameTuning(candidate, localBestCandidate)) {
                candidate = localBestCandidate
                result = localBestResult
                this.printStatus(label, history.length, ctx.gamesPerIteration, candidate, result)
            } else {
                log("REJECT", label, "reason=no-better-advancement-probe")
            }
        }

        await runDeterministicPass("lock-BB", "bbPercent", 0.006, (next, currentResult) => {
            const bb = this.tuningEvaluationService.metric(currentResult, "bbPercent")
            const step = clamp((bb.target - bb.actual) / 0.6, -0.04, 0.04)
            next.tuning!.swing.walkRateScale = clamp(Number(next.tuning?.swing?.walkRateScale ?? 0) + step, ctx.walkMin, ctx.walkMax)
        })

        await runDeterministicPass("lock-SO", "soPercent", 0.008, (next, currentResult) => {
            const so = this.tuningEvaluationService.metric(currentResult, "soPercent")
            const step = clamp((so.target - so.actual) / 0.04, -0.25, 0.25)

            next.tuning!.contact.pitchQualityContactEffect = clamp(Number(next.tuning?.contact?.pitchQualityContactEffect ?? 0) + step, ctx.contactMin, ctx.contactMax)
            next.tuning!.contact.contactSkillEffect = clamp(Number(next.tuning?.contact?.contactSkillEffect ?? 0) + step, ctx.contactMin, ctx.contactMax)
        })

        await runDeterministicPass("lock-OBP", "obp", 0.012, (next, currentResult) => {
            const obp = this.tuningEvaluationService.metric(currentResult, "obp")
            const step = clamp((obp.target - obp.actual) / -0.35, -0.025, 0.025)
            next.tuning!.contactQuality.outOutcomeScale = clamp(Number(next.tuning?.contactQuality?.outOutcomeScale ?? 0) + step, ctx.outMin, ctx.outMax)
        })

        await runDeterministicPass("lock-BABIP", "babip", 0.012, (next, currentResult) => {
            const babip = this.tuningEvaluationService.metric(currentResult, "babip")
            const avg = this.tuningEvaluationService.metric(currentResult, "avg")
            const single = this.tuningEvaluationService.metric(currentResult, "singlePercent")
            const step = clamp((((babip.target - babip.actual) / -0.75) + ((avg.target - avg.actual) / -0.6) + ((single.target - single.actual) / -0.55)) / 3, -0.018, 0.018)
            next.tuning!.contactQuality.outOutcomeScale = clamp(Number(next.tuning?.contactQuality?.outOutcomeScale ?? 0) + step, ctx.outMin, ctx.outMax)
        })

        for (let sbaPass = 1; sbaPass <= 3; sbaPass++) {
            const locked = await runDeterministicPass(`lock-SBA-${sbaPass}`, "teamSBAttemptsPerGame", 0.12, (next, currentResult) => {
                const sba = this.tuningEvaluationService.metric(currentResult, "teamSBAttemptsPerGame")
                const currentScale = Number(next.tuning?.running?.stealAttemptAggressionScale ?? 0)
                const currentMultiplier = Math.max(0, 1 + currentScale)

                const nextMultiplier = sba.actual > 0
                    ? currentMultiplier * (sba.target / sba.actual)
                    : ctx.stealMax + 1

                next.tuning!.running.stealAttemptAggressionScale = clamp(nextMultiplier - 1, ctx.stealMin, ctx.stealMax)
            }, true)

            if (locked) break
        }

        for (let doublePass = 1; doublePass <= 2; doublePass++) {
            const locked = await runDeterministicPass(`lock-2B-${doublePass}`, "doublePercent", 0.008, (next, currentResult) => {
                const double = this.tuningEvaluationService.metric(currentResult, "doublePercent")
                const currentScale = Number(next.tuning?.contactQuality?.doubleOutcomeScale ?? 0)
                const step = clamp((double.target - double.actual) / 0.4, -0.05, 0.05)

                next.tuning!.contactQuality.doubleOutcomeScale = clamp(currentScale + step, ctx.doubleMin, ctx.doubleMax)
            }, true)

            if (locked) break
        }

        await runAdvancementProbePass("lock-runs-advancement")

        const maxChatPasses = Math.max(0, Number(params?.maxChatGptTuningPasses ?? 3))

        for (let pass = 1; pass <= maxChatPasses; pass++) {
            const proposedCandidate = PitchEnvironmentTuner.normalizeTuningShape(await PitchEnvironmentTuner.getChatGptProposal(pitchEnvironment, candidate, result, history, ctx, pass, this.tuningEvaluationService))

            if (PitchEnvironmentTuner.sameTuning(candidate, proposedCandidate)) {
                log("CHATGPT STOP", `pass=${pass}`, "reason=same-tuning")
                break
            }

            const proposedResult = await this.evaluateOne(proposedCandidate, ctx, ctx.gamesPerIteration, `chatgpt-shape-${pass}`)
            const proposedPenalty = this.tuningEvaluationService.finalSelectionPenalty(proposedResult)

            log("CHATGPT PROPOSAL", `pass=${pass}`, `currentPenalty=${this.tuningEvaluationService.f(this.tuningEvaluationService.finalSelectionPenalty(result))}`, `bestCandidatePenalty=${this.tuningEvaluationService.f(topCandidates[0]?.penalty)}`, `proposalPenalty=${this.tuningEvaluationService.f(proposedPenalty)}`)

            history.push(this.tuningEvaluationService.createHistoryRow(`chatgpt-shape-${pass}`, history.length, proposedCandidate, proposedResult))
            addTopCandidate(`chatgpt-shape-${pass}`, proposedCandidate, proposedResult)

            if (proposedPenalty < this.tuningEvaluationService.finalSelectionPenalty(result)) {
                candidate = proposedCandidate
                result = proposedResult
                this.printStatus(`chatgpt-shape-${pass}`, pass, ctx.gamesPerIteration, candidate, result)
            }
        }

        const candidatesToVerify = topCandidates
            .slice()
            .sort((a, b) => a.penalty - b.penalty)
            .slice(0, Math.min(verifiedCandidateLimit, topCandidates.length))

        let verifiedBestCandidate = candidatesToVerify[0]?.candidate ?? candidate
        let verifiedBestResult: any | undefined
        let verifiedBestPenalty = Number.MAX_SAFE_INTEGER
        let verifiedBestLabel = candidatesToVerify[0]?.label ?? "current"

        for (let i = 0; i < candidatesToVerify.length; i++) {
            const row = candidatesToVerify[i]
            const verified = await this.evaluateOne(row.candidate, ctx, ctx.finalGamesPerIteration, `verify-${i + 1}-${row.label}`)
            const verifiedPenalty = this.tuningEvaluationService.finalSelectionPenalty(verified)

            log(
                "VERIFY CANDIDATE",
                `rank=${i + 1}`,
                `label=${row.label}`,
                `searchPenalty=${this.tuningEvaluationService.f(row.penalty)}`,
                `verifyPenalty=${this.tuningEvaluationService.f(verifiedPenalty)}`
            )

            this.printStatus(`verify-${i + 1}-${row.label}`, 0, ctx.finalGamesPerIteration, row.candidate, verified)

            if (verifiedPenalty < verifiedBestPenalty) {
                verifiedBestCandidate = row.candidate
                verifiedBestResult = verified
                verifiedBestPenalty = verifiedPenalty
                verifiedBestLabel = row.label
            }
        }

        const finalVerified = verifiedBestResult ?? await this.evaluateOne(verifiedBestCandidate, ctx, ctx.finalGamesPerIteration, "verify")

        log("VERIFY SELECTED", `label=${verifiedBestLabel}`, `penalty=${this.tuningEvaluationService.f(verifiedBestPenalty)}`)

        this.printStatus("verify", 0, ctx.finalGamesPerIteration, verifiedBestCandidate, finalVerified)

        if (!this.tuningEvaluationService.isCloseEnough(finalVerified)) {
            this.tuningEvaluationService.printToleranceFailures("VERIFY WARNING", finalVerified)
        }

        return verifiedBestCandidate
    }

    private static async getChatGptProposal(pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, result: any, history: any[], ctx: any, pass: number, tuningEvaluationService: TuningEvaluationService): Promise<PitchEnvironmentTuning> {
        if (!CHATGPT_API_KEY) {
            throw new Error("CHATGPT_API_KEY is empty")
        }

        const client = new OpenAI({ apiKey: CHATGPT_API_KEY })

        const response = await client.responses.create({
            model: "gpt-4o-2024-08-06",
            input: [
                {
                    role: "system",
                    content: this.createChatGptSystemMessage()
                },
                {
                    role: "user",
                    content: this.createChatGptPrompt(pitchEnvironment, candidate, result, history, ctx, pass, tuningEvaluationService)
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
            "BB%, SO%, BABIP/AVG, steal attempts, and doubles have already been tuned deterministically.",
            "Do not change walkRateScale, pitchQualityContactEffect, contactSkillEffect, outOutcomeScale, stealAttemptAggressionScale, or doubleOutcomeScale unless the prompt explicitly says one of them is badly broken.",
            "The sim chooses offensive outcome before batted-ball physics, so homeRunOutcomeScale is not a generic run-scoring lever.",
            "If BABIP, AVG, or singlePercent is low, do not raise homeRunOutcomeScale to compensate.",
            "If homeRunPercent is already close to target or high, do not raise homeRunOutcomeScale.",
            "Runs are important, but do not blindly push one knob upward.",
            "advancementAggressionScale is nonlinear. A small positive value can improve runs, while larger values can reduce runs.",
            "When using advancementAggressionScale, prefer small local moves and be willing to reduce it if recent history shows the last increase made runs or penalty worse.",
            "Prefer advancementAggressionScale for a run deficit only when OPS is close and hit-shape metrics are close.",
            "Prefer doubleOutcomeScale only when doublePercent is below target and outside tolerance.",
            "Prefer tripleOutcomeScale only when triplePercent is below target and outside tolerance.",
            "Prefer homeRunOutcomeScale only when HR% is directly low.",
            "Prefer tiny multi-knob changes over one large change when runs are low but OPS/OBP/SLG are also low.",
            "Do not make more than 2 meaningful knob changes."
        ].join("\n")
    }

    private static createChatGptPrompt(pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, result: any, history: any[], ctx: any, pass: number, tuningEvaluationService: TuningEvaluationService): string {
        const latest = this.createCompactResult(result, tuningEvaluationService)
        const toleranceReport = tuningEvaluationService.getToleranceReport(result)
        const penaltyTerms = tuningEvaluationService.createPenaltyBreakdown(result)
        const largestPenaltyTerms = penaltyTerms.slice().sort((a, b) => b.penalty - a.penalty).slice(0, 8)
        const knobEffectSummary = this.createKnobEffectSummary(history)

        const current = this.createCompactTuning(candidate)
        const runs = tuningEvaluationService.metric(result, "teamRunsPerGame")
        const ops = tuningEvaluationService.metric(result, "ops")
        const obp = tuningEvaluationService.metric(result, "obp")
        const slg = tuningEvaluationService.metric(result, "slg")
        const avg = tuningEvaluationService.metric(result, "avg")
        const babip = tuningEvaluationService.metric(result, "babip")
        const single = tuningEvaluationService.metric(result, "singlePercent")
        const double = tuningEvaluationService.metric(result, "doublePercent")
        const triple = tuningEvaluationService.metric(result, "triplePercent")
        const hr = tuningEvaluationService.metric(result, "homeRunPercent")
        const bb = tuningEvaluationService.metric(result, "bbPercent")
        const so = tuningEvaluationService.metric(result, "soPercent")
        const sba = tuningEvaluationService.metric(result, "teamSBAttemptsPerGame")

        const advancementEffects = knobEffectSummary.filter(row =>
            Number(row?.knobDelta?.advancementAggressionScale ?? 0) !== 0
        )

        const lastAdvancementEffect = advancementEffects.length > 0
            ? advancementEffects[advancementEffects.length - 1]
            : undefined

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

        const guidance = {
            runDeficit: Number((runs.target - runs.actual).toFixed(4)),
            opsDeficit: Number((ops.target - ops.actual).toFixed(4)),
            currentCompactTuning: current,
            localAdvancementWarning: {
                message: "advancementAggressionScale is nonlinear. Do not keep increasing it just because runs are low.",
                lastAdvancementEffect
            },
            recommendedShape: {
                useAdvancementWhen: "teamRunsPerGame is low, OPS is within about 0.03, and recent advancement increases helped runs/penalty.",
                reduceAdvancementWhen: "recent advancement increase made teamRunsPerGame or penalty worse.",
                useDoubleWhen: "doublePercent is below target and outside tolerance.",
                useTripleWhen: "triplePercent is below target and outside tolerance.",
                useWalkOnlyWhen: "bbPercent/OBP is materially low; otherwise keep walkRateScale locked.",
                useOutOutcomeOnlyWhen: "AVG/BABIP/singlePercent are materially wrong and are the main problem.",
                useHomeRunOnlyWhen: "homeRunPercent is directly low by more than 0.004."
            }
        }

        return JSON.stringify({
            task: "Return the next PitchEnvironmentTuning. BB, SO, BABIP/AVG, SBA, and doubles were handled deterministically. Use ChatGPT only for remaining shape/runs/OPS tradeoff without moving locked knobs.",
            pass,
            environmentProfile,
            currentTuning: candidate,
            latest,
            toleranceReport,
            penaltyTerms,
            largestPenaltyTerms,
            knobEffectSummary,
            guidance,
            metricDiffs: {
                teamRunsPerGame: runs,
                ops,
                obp,
                slg,
                avg,
                babip,
                singlePercent: single,
                doublePercent: double,
                triplePercent: triple,
                homeRunPercent: hr,
                bbPercent: bb,
                soPercent: so,
                teamSBAttemptsPerGame: sba
            },
            hardRules: [
                "Return only one JSON object matching the schema.",
                "Do not change walkRateScale unless bbPercent is outside tolerance by more than 0.008 or OBP is badly low and BB% is not high.",
                "Do not change pitchQualityContactEffect or contactSkillEffect unless soPercent is outside tolerance by more than 0.01.",
                "Do not change outOutcomeScale unless AVG/BABIP/singlePercent are outside tolerance and are the main problem.",
                "Do not change stealAttemptAggressionScale unless teamSBAttemptsPerGame is outside tolerance by more than 0.12.",
                "Do not change doubleOutcomeScale when doublePercent is already inside tolerance.",
                "If 2B% is low, raise doubleOutcomeScale slightly only when doublePercent is below target and outside tolerance.",
                "Do not increase homeRunOutcomeScale unless homeRunPercent is below target by more than 0.004.",
                "If homeRunPercent is at target or high, homeRunOutcomeScale must stay the same or decrease.",
                "If BABIP or singlePercent is low, do not use homeRunOutcomeScale to fix runs.",
                "Runs are the primary remaining target. OPS is second.",
                "If teamRunsPerGame is low by more than 0.25 and OPS is within 0.03 of target, prefer a small local advancementAggressionScale move, not an automatic increase.",
                "If a recent advancementAggressionScale increase worsened runs or penalty, reduce advancementAggressionScale or leave it unchanged.",
                "If advancementAggressionScale is already positive and runs are still low, do not assume another increase will help.",
                "If teamRunsPerGame is low and OPS/SLG are also low, prefer OBP-supporting changes or a small advancementAggressionScale adjustment instead of doubleOutcomeScale.",
                "If teamRunsPerGame is low and OPS is high by more than 0.03, try advancementAggressionScale first. Only lower power knobs if OPS remains high after runs are close.",
                "If teamRunsPerGame is close and OPS/SLG is high, lower homeRunOutcomeScale or doubleOutcomeScale slightly only if that metric is outside tolerance on the high side.",
                "If OPS/SLG is low and HR% is not low, prefer a small advancementAggressionScale adjustment. Do not use doubleOutcomeScale unless doublePercent is below target and outside tolerance.",
                "If 3B% is low, raise tripleOutcomeScale slightly.",
                "Do not make more than 2 meaningful knob changes."
            ],
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

    private static createCompactResult(result: any, tuningEvaluationService: TuningEvaluationService): any {
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
            penalty: Number(tuningEvaluationService.finalSelectionPenalty(result).toFixed(3)),
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

    private async evaluateOne(candidate: PitchEnvironmentTuning, ctx: any, games: number, label: string): Promise<any> {
        const normalizedCandidate = PitchEnvironmentTuner.normalizeTuningShape(candidate)
        const sampleCount = Math.max(1, Number(ctx.samplesPerCandidate ?? 3))
        const candidates = new Array(sampleCount).fill(0).map(() => PitchEnvironmentTuner.normalizeTuningShape(JSON.parse(JSON.stringify(normalizedCandidate))))

        log("BATCH START", label, `games=${games}`, `samples=${candidates.length}`, `workers=${ctx.workers}`)

        const evaluated = ctx.workers > 1
            ? await this.tuningSupportService.evaluatePitchEnvironmentCandidatesWithWorkers(ctx.pitchEnvironment, candidates, games, ctx.workers, `${ctx.baseSeed}:${label}`)
            : candidates.map((candidate, index) => ({
                ok: true as const,
                candidate,
                result: this.tuningSupportService.evaluatePitchEnvironmentCandidateLocal(ctx.pitchEnvironment, candidate, games, `${ctx.baseSeed}:${label}:${index}:${candidate._id}`)
            }))

        log("BATCH DONE", label, `results=${evaluated.length}`)

        const results = evaluated
            .filter((row: any) => row?.ok && row?.result)
            .map((row: any) => ctx.applyScore(row.result))

        if (results.length === 0) {
            throw new Error(`evaluateOne produced no results for ${label}`)
        }

        log("EVAL SAMPLE", label, `samples=${sampleCount}`, `gamesEach=${games}`, `totalGames=${games * results.length}`)

        return this.tuningEvaluationService.averageResults(results)
    }

    private createTuningContext(pitchEnvironment: PitchEnvironmentTarget, rng: Function, params?: any): any {
        return {
            pitchEnvironment,
            importer: params?.importer ?? params?.pitchEnvironmentService,
            baseDataDir: params?.baseDataDir ?? "data",
            baseSeed: String(rng()),
            gamesPerIteration: Number(params?.gamesPerIteration ?? 30),
            finalGamesPerIteration: Number(params?.finalGamesPerIteration ?? 30),
            workers: Math.max(1, Number(params?.workers ?? 1)),
            samplesPerCandidate: Math.max(1, Number(params?.samplesPerCandidate ?? 3)),
            topCandidateLimit: Math.max(3, Number(params?.topCandidateLimit ?? 8)),
            verifiedCandidateLimit: Math.max(2, Number(params?.verifiedCandidateLimit ?? 5)),
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
            contactMin: -0.95,
            contactMax: 4,
            applyScore: (rawResult: any) => this.tuningEvaluationService.normalizeHitTypeRatesToAtBats(rawResult)
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

        next.tuning!.swing.pitchQualityZoneSwingEffect = clamp(next.tuning!.swing.pitchQualityZoneSwingEffect, -0.95, 4)
        next.tuning!.swing.pitchQualityChaseSwingEffect = clamp(next.tuning!.swing.pitchQualityChaseSwingEffect, -0.95, 4)
        next.tuning!.swing.disciplineZoneSwingEffect = clamp(next.tuning!.swing.disciplineZoneSwingEffect, -0.95, 4)
        next.tuning!.swing.disciplineChaseSwingEffect = clamp(next.tuning!.swing.disciplineChaseSwingEffect, -0.95, 4)
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

        return JSON.stringify(left.tuning) === JSON.stringify(right.tuning)
    }

    private printStatus(label: string, loop: number, games: number, candidate: PitchEnvironmentTuning, result: any): void {
        const actual = result.actual ?? {}
        const target = result.target ?? {}
        const f = (value: any): string => this.tuningEvaluationService.f(value)

        log(
            label,
            `i=${loop}`,
            `G=${games}`,
            `R=${f(actual.teamRunsPerGame)}/${f(target.teamRunsPerGame)}`,
            `AVG=${f(actual.avg)}/${f(target.avg)}`,
            `OBP=${f(actual.obp)}/${f(target.obp)}`,
            `SLG=${f(actual.slg)}/${f(target.slg)}`,
            `OPS=${f(actual.ops)}/${f(target.ops)}`,
            `BABIP=${f(actual.babip)}/${f(target.babip)}`,
            `BB=${f(actual.bbPercent)}/${f(target.bbPercent)}`,
            `SO=${f(actual.soPercent)}/${f(target.soPercent)}`,
            `1B=${f(actual.singlePercent)}/${f(target.singlePercent)}`,
            `2B=${f(actual.doublePercent)}/${f(target.doublePercent)}`,
            `3B=${f(actual.triplePercent)}/${f(target.triplePercent)}`,
            `HR=${f(actual.homeRunPercent)}/${f(target.homeRunPercent)}`,
            `SBA=${f(actual.teamSBAttemptsPerGame)}/${f(target.teamSBAttemptsPerGame)}`,
            `SB=${f(actual.teamSBPerGame)}/${f(target.teamSBPerGame)}`,
            `T[O=${f(candidate.tuning?.contactQuality.outOutcomeScale)} 2b=${f(candidate.tuning?.contactQuality.doubleOutcomeScale)} 3b=${f(candidate.tuning?.contactQuality.tripleOutcomeScale)} hr=${f(candidate.tuning?.contactQuality.homeRunOutcomeScale)} bb=${f(candidate.tuning?.swing.walkRateScale)} so=${f(candidate.tuning?.contact.pitchQualityContactEffect)} sb=${f(candidate.tuning?.running.stealAttemptAggressionScale)} br=${f(candidate.tuning?.running.advancementAggressionScale)} td=${f(candidate.tuning?.meta.fullTeamDefenseBonus)} fd=${f(candidate.tuning?.meta.fullFielderDefenseBonus)}]`
        )
    }

    private static f(value: any): string {
        const number = Number(value)
        return Number.isFinite(number) ? Number(number.toFixed(3)).toString() : "NaN"
    }
}

class RatingTuner {

    constructor(private tuningSupportService: TuningSupportService, private tuningEvaluationService: TuningEvaluationService) {}

    public async getTuning(pitchEnvironment: PitchEnvironmentTarget, players: Map<string, PlayerImportRaw>, rng: Function, params?: any): Promise<RatingTuning> {
        const ctx = this.createRatingTuningContext(pitchEnvironment, players, rng, params)

        let candidate = this.normalizeTuningShape(params?.startingCandidate ?? PlayerRatingService.seedRatingTuning())

        candidate = await this.tuneRatingTrack(candidate, ctx, ctx.sortedHitters, "hitting")
        candidate = await this.tuneRatingTrack(candidate, ctx, ctx.sortedPitchers, "pitching")

        const verifyHitters = ctx.sortedHitters.slice(0, Math.min(Number(params?.sampleSize ?? 100), ctx.sortedHitters.length))
        const verifyPitchers = ctx.sortedPitchers.slice(0, Math.min(Number(params?.sampleSize ?? 100), ctx.sortedPitchers.length))
        const verifyPlayers = [...new Map([...verifyHitters, ...verifyPitchers].map(player => [player.playerId, player])).values()]

        const verifyGamesPerPlayer = Math.max(ctx.gamesPerPlayer, Number(params?.finalGamesPerPlayer ?? ctx.gamesPerPlayer))
        const verified = await this.evaluateOne(candidate, ctx, verifyGamesPerPlayer, "verify", verifyPlayers)

        this.printStatus("verify", 0, verifyGamesPerPlayer, candidate, verified)

        return candidate
    }


    private async tuneRatingTrack(candidate: RatingTuning, ctx: any, sortedPlayers: PlayerImportRaw[], track: "hitting" | "pitching"): Promise<RatingTuning> {
        const stageSizes = this.getRatingStageSizes(sortedPlayers.length, Number(ctx.sampleSize ?? 100))

        for (const stageSize of stageSizes) {
            const stagePlayers = sortedPlayers.slice(0, stageSize)
            const label = `${track}-top-${stageSize}`

            log("RATING STAGE START", label, `players=${stagePlayers.length}`)

            candidate = await this.tuneRatingStage(candidate, ctx, stagePlayers, label, track)

            const result = await this.evaluateOne(candidate, ctx, ctx.gamesPerPlayer, `${label}-verify`, stagePlayers)
            this.printStatus(`${label}-verify`, 0, ctx.gamesPerPlayer, candidate, result)
        }

        return candidate
    }

    private async tuneRatingStage(candidate: RatingTuning, ctx: any, players: PlayerImportRaw[], label: string, track: "hitting" | "pitching"): Promise<RatingTuning> {
        let bestCandidate = this.normalizeTuningShape(candidate)
        let bestResult = await this.evaluateOne(bestCandidate, ctx, ctx.gamesPerPlayer, `${label}-baseline`, players)

        this.printStatus(`${label}-baseline`, 0, ctx.gamesPerPlayer, bestCandidate, bestResult)

        if (track === "hitting") {
            let lockResult = await this.runRatingLock(bestCandidate, bestResult, ctx, players, `${label}-lock-hSO`, "hitting", "soPercent", "lock-so", 0.010, next => {
                const metric = this.ratingMetric(bestResult, "hitting", "soPercent")
                const step = clamp(metric.diff / 0.40, -0.06, 0.06)
                next.hitting.contactScale = this.clampScale(next.hitting.contactScale + step)
            })

            bestCandidate = lockResult.candidate
            bestResult = lockResult.result

            lockResult = await this.runRatingLock(bestCandidate, bestResult, ctx, players, `${label}-lock-hBB`, "hitting", "bbPercent", "lock-bb", 0.007, next => {
                const metric = this.ratingMetric(bestResult, "hitting", "bbPercent")
                const step = clamp((metric.target - metric.actual) / 0.35, -0.06, 0.06)
                next.hitting.plateDisciplineScale = this.clampScale(next.hitting.plateDisciplineScale + step)
            })

            bestCandidate = lockResult.candidate
            bestResult = lockResult.result

            let probeResult = await this.runBestRatingProbePass(bestCandidate, bestResult, ctx, players, `${label}-shape-hAVG`, "hitting", "avg-obp", ["hContactUp", "hContactDown"])
            bestCandidate = probeResult.candidate
            bestResult = probeResult.result

            probeResult = await this.runBestRatingProbePass(bestCandidate, bestResult, ctx, players, `${label}-shape-hOBP`, "hitting", "avg-obp", ["hDiscUp", "hDiscDown"])
            bestCandidate = probeResult.candidate
            bestResult = probeResult.result

            probeResult = await this.runBestRatingProbePass(bestCandidate, bestResult, ctx, players, `${label}-shape-hSLG`, "hitting", "slg-ops", ["hGapUp", "hGapDown", "hHrUp", "hHrDown"])
            bestCandidate = probeResult.candidate
            bestResult = probeResult.result
        }

        if (track === "pitching") {
            let lockResult = await this.runRatingLock(bestCandidate, bestResult, ctx, players, `${label}-lock-pSO`, "pitching", "soPercent", "lock-so", 0.010, next => {
                const metric = this.ratingMetric(bestResult, "pitching", "soPercent")
                const step = clamp((metric.target - metric.actual) / 0.40, -0.06, 0.06)
                next.pitching.powerScale = this.clampScale(next.pitching.powerScale + step)
            })

            bestCandidate = lockResult.candidate
            bestResult = lockResult.result

            lockResult = await this.runRatingLock(bestCandidate, bestResult, ctx, players, `${label}-lock-pBB`, "pitching", "bbPercent", "lock-bb", 0.007, next => {
                const metric = this.ratingMetric(bestResult, "pitching", "bbPercent")
                const step = clamp(metric.diff / 0.35, -0.06, 0.06)
                next.pitching.controlScale = this.clampScale(next.pitching.controlScale + step)
            })

            bestCandidate = lockResult.candidate
            bestResult = lockResult.result

            const probeResult = await this.runBestRatingProbePass(bestCandidate, bestResult, ctx, players, `${label}-shape-pERA-HR`, "pitching", "era-hr", ["pMovementUp", "pMovementDown"])
            bestCandidate = probeResult.candidate
            bestResult = probeResult.result
        }

        return bestCandidate
    }

    private async runRatingLock(candidate: RatingTuning, result: any, ctx: any, players: PlayerImportRaw[], label: string, track: "hitting" | "pitching", metricKey: string, scenario: "lock-so" | "lock-bb" | "avg-obp" | "slg-ops" | "era-hr", tolerance: number, mutate: (next: RatingTuning) => void): Promise<{ candidate: RatingTuning, result: any }> {
        const metric = this.ratingMetric(result, track, metricKey)

        if (!Number.isFinite(metric.actual) || !Number.isFinite(metric.target) || metric.target === 0) {
            log("RATING LOCK SKIP", label, "reason=missing-metric")
            return { candidate, result }
        }

        if (Math.abs(metric.diff) <= tolerance) {
            log("RATING LOCK SKIP", label, "reason=already-close", `actual=${this.tuningEvaluationService.f(metric.actual)}`, `target=${this.tuningEvaluationService.f(metric.target)}`)
            return { candidate, result }
        }

        const next = this.normalizeTuningShape(JSON.parse(JSON.stringify(candidate)))
        mutate(next)


        
        const nextResult = await this.evaluateOne(next, ctx, ctx.gamesPerPlayer, label, players)
        const nextMetric = this.ratingMetric(nextResult, track, metricKey)

        const currentMetricError = Math.abs(metric.diff)
        const nextMetricError = Math.abs(nextMetric.diff)
        const currentScore = result.score
        const nextScore = nextResult.score

        this.printStatus(label, 0, ctx.gamesPerPlayer, next, nextResult)

        if (
            Number.isFinite(nextMetricError) &&
            nextMetricError < currentMetricError &&
            Number.isFinite(nextScore) &&
            nextScore <= currentScore
        ) {
            log("RATING LOCK ACCEPT", label, `metric=${this.tuningEvaluationService.f(currentMetricError)}->${this.tuningEvaluationService.f(nextMetricError)}`, `scenarioScore=${this.tuningEvaluationService.f(currentScore)}->${this.tuningEvaluationService.f(nextScore)}`)
            return { candidate: next, result: nextResult }
        }

        log("RATING LOCK REJECT", label, `metric=${this.tuningEvaluationService.f(currentMetricError)}->${this.tuningEvaluationService.f(nextMetricError)}`, `scenarioScore=${this.tuningEvaluationService.f(currentScore)}->${this.tuningEvaluationService.f(nextScore)}`)

        return { candidate, result }
    }



    private ratingMetric(result: any, track: "hitting" | "pitching", key: string): { actual: number, target: number, diff: number } {
        const blockKey = track === "hitting" ? "hitter" : "pitcher"

        const actual = Number(result.actual?.[blockKey]?.[key])
        const target = Number(result.target?.[blockKey]?.[key])

        return {
            actual,
            target,
            diff: actual - target
        }
    }

    private async runBestRatingProbePass(candidate: RatingTuning, result: any, ctx: any, players: PlayerImportRaw[], label: string, track: "hitting" | "pitching", scenario: "lock-so" | "lock-bb" | "avg-obp" | "slg-ops" | "era-hr", allowedLabels: string[]): Promise<{ candidate: RatingTuning, result: any }> {
        const stepFor = (key: string, fallback: number = 0.04): number => {
            const row = this.ratingMetric(result, track, key)

            if (!Number.isFinite(row.diff)) return fallback

            return clamp(Math.abs(row.diff) * 1.5, 0.02, 0.08)
        }

        const createProbe = (probeLabel: string): { label: string, candidate: RatingTuning } | undefined => {
            const next = this.normalizeTuningShape(JSON.parse(JSON.stringify(candidate)))

            if (probeLabel === "hContactUp") next.hitting.contactScale = this.clampScale(next.hitting.contactScale + stepFor("avg"))
            else if (probeLabel === "hContactDown") next.hitting.contactScale = this.clampScale(next.hitting.contactScale - stepFor("avg"))
            else if (probeLabel === "hDiscUp") next.hitting.plateDisciplineScale = this.clampScale(next.hitting.plateDisciplineScale + stepFor("obp"))
            else if (probeLabel === "hDiscDown") next.hitting.plateDisciplineScale = this.clampScale(next.hitting.plateDisciplineScale - stepFor("obp"))
            else if (probeLabel === "hGapUp") next.hitting.gapPowerScale = this.clampScale(next.hitting.gapPowerScale + stepFor("slg"))
            else if (probeLabel === "hGapDown") next.hitting.gapPowerScale = this.clampScale(next.hitting.gapPowerScale - stepFor("slg"))
            else if (probeLabel === "hHrUp") next.hitting.homerunPowerScale = this.clampScale(next.hitting.homerunPowerScale + stepFor("ops"))
            else if (probeLabel === "hHrDown") next.hitting.homerunPowerScale = this.clampScale(next.hitting.homerunPowerScale - stepFor("ops"))
            else if (probeLabel === "pMovementUp") next.pitching.movementScale = this.clampScale(next.pitching.movementScale + stepFor("era"))
            else if (probeLabel === "pMovementDown") next.pitching.movementScale = this.clampScale(next.pitching.movementScale - stepFor("era"))
            else if (probeLabel === "pPowerUp") next.pitching.powerScale = this.clampScale(next.pitching.powerScale + stepFor("soPercent"))
            else if (probeLabel === "pPowerDown") next.pitching.powerScale = this.clampScale(next.pitching.powerScale - stepFor("soPercent"))
            else if (probeLabel === "pControlUp") next.pitching.controlScale = this.clampScale(next.pitching.controlScale + stepFor("bbPercent"))
            else if (probeLabel === "pControlDown") next.pitching.controlScale = this.clampScale(next.pitching.controlScale - stepFor("bbPercent"))
            else return undefined

            return { label: probeLabel, candidate: next }
        }

        const probes = allowedLabels
            .map(createProbe)
            .filter((probe): probe is { label: string, candidate: RatingTuning } => !!probe)

        let bestCandidate = candidate
        let bestResult = result
        let bestScore = this.ratingScenarioScore(result, track, scenario)

        log(
            "RATING PROBE BASELINE",
            label,
            `scenario=${scenario}`,
            `scenarioScore=${this.tuningEvaluationService.f(bestScore)}`
        )

        for (const probe of probes) {
            const probeResult = await this.evaluateOne(probe.candidate, ctx, ctx.gamesPerPlayer, `${label}-${probe.label}`, players)
            const probeScore = this.ratingScenarioScore(probeResult, track, scenario)

            this.printStatus(`${label}-${probe.label}`, 0, ctx.gamesPerPlayer, probe.candidate, probeResult)

            log(
                "RATING PROBE",
                `${label}-${probe.label}`,
                `scenario=${scenario}`,
                `scenarioScore=${this.tuningEvaluationService.f(probeScore)}`,
                `best=${this.tuningEvaluationService.f(bestScore)}`
            )

            if (Number.isFinite(probeScore) && probeScore < bestScore) {
                bestCandidate = this.normalizeTuningShape(probe.candidate)
                bestResult = probeResult
                bestScore = probeScore
            }
        }

        if (bestCandidate !== candidate) {
            this.printStatus(`${label}-accepted`, 0, ctx.gamesPerPlayer, bestCandidate, bestResult)

            log(
                "RATING PROBE ACCEPT",
                label,
                `scenario=${scenario}`,
                `scenarioScore=${this.tuningEvaluationService.f(bestScore)}`
            )
        }

        return { candidate: bestCandidate, result: bestResult }
    }


    private async evaluateOne(candidate: RatingTuning, ctx: any, gamesPerPlayer: number, label: string, playersOverride?: PlayerImportRaw[]): Promise<any> {
        const normalizedCandidate = this.normalizeTuningShape(candidate)
        const players = playersOverride ?? ctx.sampledPlayers
        const sampleCount = Math.max(1, Number(ctx.samplesPerCandidate ?? 3))
        const candidates = new Array(sampleCount).fill(0).map(() => this.normalizeTuningShape(JSON.parse(JSON.stringify(normalizedCandidate))))

        log("RATING BATCH START", label, `players=${players.length}`, `gamesPerPlayer=${gamesPerPlayer}`, `samples=${candidates.length}`, `workers=${ctx.workers}`)

        const evaluated = ctx.workers > 1
            ? await this.tuningSupportService.evaluateRatingCandidatesWithWorkers(ctx.pitchEnvironment, candidates, players, gamesPerPlayer, ctx.workers, `${ctx.baseSeed}:${label}`)
            : candidates.map((candidate, index) => ({
                ok: true as const,
                candidate,
                result: this.tuningSupportService.evaluateRatingCandidateLocal(ctx.pitchEnvironment, candidate, players, gamesPerPlayer, `${ctx.baseSeed}:${label}:${index}:${candidate._id}`)
            }))

        const results = evaluated
            .filter((row: any) => row?.ok && row?.result)
            .map((row: any) => row.result)

        if (results.length === 0) {
            throw new Error(`RatingTuner.evaluateOne produced no results for ${label}`)
        }

        log("RATING BATCH DONE", label, `results=${results.length}`)

        return this.averageRatingResults(results)
    }

    private averageRatingResults(results: any[]): any {
        const averagePath = (path: string[]): number => {
            const values = results
                .map(result => {
                    let current: any = result

                    for (const key of path) {
                        current = current?.[key]
                    }

                    return Number(current)
                })
                .filter(value => Number.isFinite(value))

            return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
        }

        const averageNestedBlock = (rootKey: "actual" | "target", block: "hitter" | "pitcher"): any => {
            const keys = new Set<string>()

            for (const result of results) {
                for (const key of Object.keys(result?.[rootKey]?.[block] ?? {})) {
                    keys.add(key)
                }
            }

            const averaged: any = {}

            for (const key of keys) {
                averaged[key] = averagePath([rootKey, block, key])
            }

            return averaged
        }

        const hitterActual = averageNestedBlock("actual", "hitter")
        const pitcherActual = averageNestedBlock("actual", "pitcher")
        const hitterTarget = averageNestedBlock("target", "hitter")
        const pitcherTarget = averageNestedBlock("target", "pitcher")

        const diffBlock = (actual: any, target: any): any => {
            const keys = new Set<string>([...Object.keys(actual ?? {}), ...Object.keys(target ?? {})])
            const diff: any = {}

            for (const key of keys) {
                const actualValue = Number(actual?.[key])
                const targetValue = Number(target?.[key])

                diff[key] = Number.isFinite(actualValue) && Number.isFinite(targetValue) ? actualValue - targetValue : 0
            }

            return diff
        }

        const averagedResult = {
            actual: {
                playerCount: this.average(results.map(result => result.actual?.playerCount)),
                hitterCount: this.average(results.map(result => result.actual?.hitterCount)),
                pitcherCount: this.average(results.map(result => result.actual?.pitcherCount)),
                twoWayCount: this.average(results.map(result => result.actual?.twoWayCount)),
                hitter: hitterActual,
                pitcher: pitcherActual
            },
            target: {
                hitter: hitterTarget,
                pitcher: pitcherTarget
            },
            diff: {
                hitter: diffBlock(hitterActual, hitterTarget),
                pitcher: diffBlock(pitcherActual, pitcherTarget)
            },
            score: 0
        }

        averagedResult.score = this.ratingScore(averagedResult)

        return averagedResult
    }

    private ratingScenarioScore(result: any, track: "hitting" | "pitching", scenario: "lock-so" | "lock-bb" | "avg-obp" | "slg-ops" | "era-hr"): number {
        const terms: { key: string, tolerance: number, weight: number }[] = []

        const add = (key: string, tolerance: number, weight: number = 1): void => {
            terms.push({ key, tolerance, weight })
        }

        if (track === "hitting") {
            if (scenario === "lock-so") {
                add("soPercent", 0.008, 10)
                add("bbPercent", 0.012, 1)
                add("avg", 0.018, 1)
            }

            if (scenario === "lock-bb") {
                add("bbPercent", 0.006, 10)
                add("soPercent", 0.012, 1)
                add("obp", 0.018, 1)
            }

            if (scenario === "avg-obp") {
                add("soPercent", 0.010, 2)
                add("bbPercent", 0.008, 2)
                add("avg", 0.012, 5)
                add("obp", 0.014, 5)
                add("babip", 0.014, 4)
                add("singlePercent", 0.012, 2)
            }

            if (scenario === "slg-ops") {
                add("soPercent", 0.012, 2)
                add("bbPercent", 0.010, 2)
                add("avg", 0.018, 1)
                add("obp", 0.018, 1)
                add("slg", 0.025, 4)
                add("ops", 0.030, 2)
                add("doublePercent", 0.008, 4)
                add("triplePercent", 0.003, 2)
                add("homeRunPercent", 0.006, 5)
            }
        }

        if (track === "pitching") {
            if (scenario === "lock-so") {
                add("soPercent", 0.008, 10)
                add("bbPercent", 0.012, 1)
                add("avg", 0.018, 1)
            }

            if (scenario === "lock-bb") {
                add("bbPercent", 0.006, 10)
                add("soPercent", 0.012, 1)
                add("obp", 0.018, 1)
            }

            if (scenario === "era-hr") {
                add("soPercent", 0.010, 2)
                add("bbPercent", 0.008, 2)
                add("era", 0.45, 5)
                add("avg", 0.018, 2)
                add("obp", 0.020, 2)
                add("slg", 0.035, 3)
                add("babip", 0.018, 2)
                add("doublePercent", 0.010, 2)
                add("triplePercent", 0.003, 1)
                add("homeRunPercent", 0.006, 5)
            }
        }

        let total = 0
        let weightTotal = 0

        for (const term of terms) {
            const metric = this.ratingMetric(result, track, term.key)

            if (!Number.isFinite(metric.diff)) continue

            total += Math.abs(metric.diff / term.tolerance) * term.weight
            weightTotal += term.weight
        }

        return weightTotal > 0 ? total / weightTotal : Number(result.score)
    }

    private createRatingTuningContext(pitchEnvironment: PitchEnvironmentTarget, players: Map<string, PlayerImportRaw>, rng: Function, params?: any): any {
        const allPlayers = Array.from(players.values())

        const eligibleHitters = allPlayers.filter(player =>
            Number(player.hitting?.pa ?? 0) >= Number(params?.minHittingPA ?? 100)
        )

        const eligiblePitchers = allPlayers.filter(player =>
            Number(player.pitching?.battersFaced ?? 0) >= Number(params?.minPitchingBF ?? 100)
        )

        const sortedHitters = eligibleHitters
            .slice()
            .sort((a, b) => Number(b.hitting?.pa ?? 0) - Number(a.hitting?.pa ?? 0))

        const sortedPitchers = eligiblePitchers
            .slice()
            .sort((a, b) => Number(b.pitching?.battersFaced ?? 0) - Number(a.pitching?.battersFaced ?? 0))

        const sampleSize = Number(params?.sampleSize ?? 100)
        const gamesPerPlayer = Number(params?.gamesPerPlayer ?? params?.gamesPerIteration ?? 150)

        return {
            pitchEnvironment,
            allPlayers,
            eligiblePlayers: [...new Map([...eligibleHitters, ...eligiblePitchers].map(player => [player.playerId, player])).values()],
            sortedHitters,
            sortedPitchers,
            sampledPlayers: [
                ...sortedHitters.slice(0, Math.min(sampleSize, sortedHitters.length)),
                ...sortedPitchers.slice(0, Math.min(sampleSize, sortedPitchers.length))
            ],
            sampleSize,
            baseSeed: String(rng()),
            gamesPerPlayer,
            workers: Math.max(1, Number(params?.workers ?? 1)),
            samplesPerCandidate: Number(params?.samplesPerCandidate ?? 3),
            ratingTuningPasses: Number(params?.ratingTuningPasses ?? 2)
        }
    }

    private printStatus(label: string, iteration: number, gamesPerPlayer: number, candidate: RatingTuning, result: any): void {
        const f = (value: any): string => this.tuningEvaluationService.f(value)
        const actual = result.actual ?? {}
        const diff = result.diff ?? {}

        log(
            "RATING TUNING",
            label,
            `i=${iteration}`,
            `G=${gamesPerPlayer}`,
            `score=${f(result.score)}`,
            `players=${f(actual.playerCount ?? 0)}`,
            `hitters=${f(actual.hitterCount ?? 0)}`,
            `pitchers=${f(actual.pitcherCount ?? 0)}`,
            `twoWay=${f(actual.twoWayCount ?? 0)}`,
            `hAVG=${f(diff.hitter?.avg)}`,
            `hOBP=${f(diff.hitter?.obp)}`,
            `hSLG=${f(diff.hitter?.slg)}`,
            `hOPS=${f(diff.hitter?.ops)}`,
            `hBABIP=${f(diff.hitter?.babip)}`,
            `h1B=${f(diff.hitter?.singlePercent)}`,
            `h2B=${f(diff.hitter?.doublePercent)}`,
            `h3B=${f(diff.hitter?.triplePercent)}`,
            `hHR=${f(diff.hitter?.homeRunPercent)}`,
            `hSO=${f(diff.hitter?.soPercent)}`,
            `hBB=${f(diff.hitter?.bbPercent)}`,
            `pERA=${f(diff.pitcher?.era)}`,
            `pAVG=${f(diff.pitcher?.avg)}`,
            `pOBP=${f(diff.pitcher?.obp)}`,
            `pSLG=${f(diff.pitcher?.slg)}`,
            `pBABIP=${f(diff.pitcher?.babip)}`,
            `p2B=${f(diff.pitcher?.doublePercent)}`,
            `p3B=${f(diff.pitcher?.triplePercent)}`,
            `pHR=${f(diff.pitcher?.homeRunPercent)}`,
            `pSO=${f(diff.pitcher?.soPercent)}`,
            `pBB=${f(diff.pitcher?.bbPercent)}`,
            `T[hCt=${candidate.hitting.contactScale} hDisc=${candidate.hitting.plateDisciplineScale} hGap=${candidate.hitting.gapPowerScale} hHR=${candidate.hitting.homerunPowerScale} hSplit=${candidate.hitting.splitScale} pPow=${candidate.pitching.powerScale} pCtrl=${candidate.pitching.controlScale} pMov=${candidate.pitching.movementScale} pSplit=${candidate.pitching.splitScale}]`
        )
    }

    private normalizeTuningShape(candidate: RatingTuning): RatingTuning {
        const seed = PlayerRatingService.seedRatingTuning()

        return {
            _id: candidate?._id ?? seed._id,
            hitting: {
                contactScale: Number(candidate?.hitting?.contactScale ?? seed.hitting.contactScale),
                plateDisciplineScale: Number(candidate?.hitting?.plateDisciplineScale ?? seed.hitting.plateDisciplineScale),
                gapPowerScale: Number(candidate?.hitting?.gapPowerScale ?? seed.hitting.gapPowerScale),
                homerunPowerScale: Number(candidate?.hitting?.homerunPowerScale ?? seed.hitting.homerunPowerScale),
                splitScale: Number(candidate?.hitting?.splitScale ?? seed.hitting.splitScale)
            },
            pitching: {
                powerScale: Number(candidate?.pitching?.powerScale ?? seed.pitching.powerScale),
                controlScale: Number(candidate?.pitching?.controlScale ?? seed.pitching.controlScale),
                movementScale: Number(candidate?.pitching?.movementScale ?? seed.pitching.movementScale),
                splitScale: Number(candidate?.pitching?.splitScale ?? seed.pitching.splitScale)
            },
            running: {
                speedScale: Number(candidate?.running?.speedScale ?? seed.running.speedScale),
                stealsScale: Number(candidate?.running?.stealsScale ?? seed.running.stealsScale)
            },
            fielding: {
                defenseScale: Number(candidate?.fielding?.defenseScale ?? seed.fielding.defenseScale),
                armScale: Number(candidate?.fielding?.armScale ?? seed.fielding.armScale)
            }
        }
    }

    private getRatingStageSizes(totalPlayers: number, maxPlayers: number): number[] {
        const cap = Math.min(totalPlayers, maxPlayers)

        return [1, 2, 3, 5, 10, 25, 50, 100]
            .filter(size => size <= cap)
            .filter((size, index, sizes) => sizes.indexOf(size) === index)
    }


    private clampScale(value: number): number {
        return clamp(Number(value), -1, 1)
    }

    private average(values: any[]): number {
        const numbers = values.map(value => Number(value)).filter(value => Number.isFinite(value))
        return numbers.length > 0 ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0
    }

    private ratingScore(result: any): number {
        return (
            this.ratingScenarioScore(result, "hitting", "avg-obp") +
            this.ratingScenarioScore(result, "hitting", "slg-ops") +
            this.ratingScenarioScore(result, "pitching", "era-hr")
        ) / 3
    }

}

class TuningEvaluationService {

    public metric(result: any, key: string): { actual: number, target: number, diff: number } {
        const actual = Number(result.actual?.[key] ?? 0)
        const target = Number(result.target?.[key] ?? 0)
        return { actual, target, diff: actual - target }
    }

    public averageResults(results: any[]): { actual: any, target: any, diff: any, score: number } {
        const first = results[0]
        const actualKeys = Object.keys(first.actual ?? {})
        const targetKeys = Object.keys(first.target ?? {})
        const diffKeys = Object.keys(first.diff ?? {})

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
            diff[metric] = Number.isFinite(actualValue) && Number.isFinite(targetValue) ? actualValue - targetValue : averageBlock("diff", [metric])[metric]
        }

        const scores = results.map(result => Number(result.score)).filter(value => Number.isFinite(value))

        return {
            actual,
            target,
            diff,
            score: scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : Number.MAX_SAFE_INTEGER
        }
    }

    public normalizeHitTypeRatesToAtBats(result: { actual: any, target: any, diff: any, score: number }): { actual: any, target: any, diff: any, score: number } {
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

    public finalSelectionPenalty(result: any): number {
        const basePenalty = this.createPenaltyBreakdown(result).reduce((sum, row) => sum + Number(row.penalty ?? 0), 0)
        const toleranceFailures = this.getToleranceReport(result).filter(row => !row.ok)

        const toleranceFailurePenalty = toleranceFailures.reduce((sum, row) => {
            const tolerance = Math.max(Number(row.tolerance ?? 0), 0.000001)
            const miss = Math.abs(Number(row.diff ?? 0)) / tolerance
            const weight =
                row.key === "teamSBAttemptsPerGame" ? 1.5 :
                row.key === "teamSBPerGame" ? 1.5 :
                row.key === "bbPercent" ? 1.25 :
                row.key === "teamRunsPerGame" ? 1.25 :
                1

            return sum + (miss * miss * weight * 100000)
        }, 0)

        return basePenalty + toleranceFailurePenalty
    }

    public createPenaltyBreakdown(result: any): any[] {
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
            term("teamRunsPerGame", 0.18, 6),
            term("ops", 0.03, 5),
            term("obp", 0.018, 4),
            term("slg", 0.025, 4),
            term("avg", 0.018, 3),
            term("babip", 0.018, 3),
            term("bbPercent", 0.01, 5),
            term("soPercent", 0.012, 4),
            term("singlePercent", 0.014, 2),
            term("doublePercent", 0.008, 3),
            term("triplePercent", 0.003, 2),
            term("homeRunPercent", 0.006, 4),
            term("teamSBAttemptsPerGame", 0.12, 5),
            term("teamSBPerGame", 0.12, 4)
        ]
    }

    public getToleranceReport(result: any): any[] {
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
        ].map(row => {
            const actualValue = Number(row.actual ?? 0)
            const targetValue = Number(row.target ?? 0)
            const diff = actualValue - targetValue

            return {
                ...row,
                actual: actualValue,
                target: targetValue,
                diff,
                ok: Math.abs(diff) <= row.tolerance
            }
        })
    }

    public isCloseEnough(result: any): boolean {
        return this.getToleranceReport(result).every(row => row.ok)
    }

    public createHistoryRow(label: string, pass: number, candidate: PitchEnvironmentTuning, result: any): any {
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

    public printToleranceFailures(label: string, result: any): void {
        log(label, JSON.stringify(this.getToleranceReport(result).filter(row => !row.ok), null, 2))
    }

    public f(value: any): string {
        const number = Number(value)
        return Number.isFinite(number) ? Number(number.toFixed(3)).toString() : "NaN"
    }

}

class TuningSupportService {

    constructor(private baseDataDir: string) {}

    public createServices(): { pitchEnvironmentService: PitchEnvironmentService, playerRatingService: PlayerRatingService, downloader: DownloaderService, simService: SimService, statService: StatService, baselineGameService: BaselineGameService } {
        const rollChartService = new RollChartService()
        const statService = new StatService()
        const simRolls = new SimRolls(rollChartService)
        const gamePlayers = new GamePlayers()
        const runnerService = new RunnerService(simRolls)
        const gameInfo = new GameInfo(gamePlayers)
        const substitutionService = new SubstitutionService()
        const simService = new SimService(rollChartService, simRolls, runnerService, gameInfo, substitutionService, {} as PitchEnvironmentTarget)
        const baselineGameService = new BaselineGameService(simService)
        const downloader = new DownloaderService(this.baseDataDir, 1000)
        const pitchEnvironmentService = new PitchEnvironmentService(simService, statService, baselineGameService)
        const playerRatingService = new PlayerRatingService(simService, statService, baselineGameService)

        return { pitchEnvironmentService, playerRatingService, downloader, simService, statService, baselineGameService }
    }

    public buildCandidatePitchEnvironment(pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning): PitchEnvironmentTarget {
        return JSON.parse(JSON.stringify({
            ...pitchEnvironment,
            pitchEnvironmentTuning: candidate
        }))
    }

    public evaluatePitchEnvironmentCandidateLocal(pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, gamesPerIteration: number, rngSeed: string): { actual: any, target: any, diff: any, score: number } {
        const { pitchEnvironmentService } = this.createServices()
        const candidatePitchEnvironment = this.buildCandidatePitchEnvironment(pitchEnvironment, candidate)
        const rng = seedrandom(rngSeed)

        return pitchEnvironmentService.evaluatePitchEnvironment(candidatePitchEnvironment, rng, gamesPerIteration)
    }

    public evaluateRatingCandidateLocal(pitchEnvironment: PitchEnvironmentTarget, candidate: RatingTuning, players: PlayerImportRaw[], gamesPerPlayer: number, rngSeed: string): { actual: any, target: any, diff: any, score: number } {
        const { playerRatingService } = this.createServices()
        const rng = seedrandom(rngSeed)

        return playerRatingService.evaluatePlayerRatings(pitchEnvironment, candidate, players, rng, gamesPerPlayer)
    }


    public runPitchEnvironmentWorker(input: TuningWorkerInput): Promise<TuningWorkerSuccess> {
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

    public async evaluatePitchEnvironmentCandidatesWithWorkers(pitchEnvironment: PitchEnvironmentTarget, candidates: PitchEnvironmentTuning[], gamesPerIteration: number, workers: number, rngSeedBase: string): Promise<TuningWorkerSuccess[]> {
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

                results[index] = await this.runPitchEnvironmentWorker({
                    kind: "pitchEnvironment",
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
    
    public async evaluateRatingCandidatesWithWorkers(pitchEnvironment: PitchEnvironmentTarget, candidates: RatingTuning[], players: PlayerImportRaw[], gamesPerPlayer: number, workers: number, rngSeedBase: string): Promise<TuningWorkerSuccess[]> {
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

                results[index] = await this.runPitchEnvironmentWorker({
                    kind: "rating",
                    pitchEnvironment,
                    candidate: candidates[index],
                    players,
                    gamesPerPlayer,
                    rngSeed: `${rngSeedBase}:${index}:${candidates[index]._id}`
                })
            }
        }

        await Promise.all(new Array(concurrency).fill(0).map(() => consume()))

        return results
    }

}

export {
    importPitchEnvironmentTarget,
    importRatingTuning,
    importPlayerRatings,
    ImportPitchEnvironmentTargetResult
}



if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const command = process.argv[2]
    const season = Number(process.argv[3])

    if (!["target", "ratings"].includes(command)) {
        throw new Error(`Unknown command: ${command}`)
    }

    if (!Number.isFinite(season)) {
        throw new Error("Season is required.")
    }

    let options = {
        gamesPerIteration: 150,
        finalGamesPerIteration: 300,
        workers: NUMBER_OF_WORKERS,
        samplesPerCandidate: 5
    }

    const baseDataDir = "data"

    let result: any

    if (command === "target") {
        result = await importPitchEnvironmentTarget(season, baseDataDir, options)
    }

    if (command === "ratings") {
        result = await importRatingTuning(season, baseDataDir, options)
    }

    console.log("")
    console.log("========================================")
    console.log(`${command.toUpperCase()} COMPLETE`)
    console.log("========================================")
    console.log(JSON.stringify(result, null, 2))
    console.log("")
}