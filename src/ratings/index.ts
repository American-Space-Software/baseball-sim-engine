import fs from "fs"
import path from "path"

import { database } from "baseball-database"

import type { PitchEnvironmentTarget } from "../sim/service/interfaces.js"

import { PlayerRatingInputRepository } from "./repository/player-rating-input-repository.js"
import { PlayerRatingSeasonInputRepository } from "./repository/player-rating-season-input-repository.js"
import { PlayerRatingsRepository } from "./repository/player-ratings-repository.js"
import { PitchEnvironmentTargetRepository } from "./repository/pitch-environment-target-repository.js"
import { DownloadService } from "../importer/service/download-service.js"
import { SchemaService } from "../importer/service/schema-service.js"
import { PlayerRatingService } from "./service/player-rating-service.js"
import { PlayerStatRepository } from "./repository/player-stat-repository.js"
import { PlayerStatService } from "./service/player-stat-service.js"
import { StatService } from "../sim/index.js"
import { MlbGameBundleService } from "./service/mlb-game-bundle-service.js"
import { MlbRosterService } from "./service/mlb-roster-service.js"
import { GameLineupService } from "./service/game-lineup-service.js"
import { PitcherAppearanceService } from "./service/pitcher-appearance-service.js"
import { PitcherWorkloadService } from "./service/pitcher-workload-service.js"
import { PitcherAppearanceRepository } from "./repository/pitcher-appearance-repository.js"
import { PitchEnvironmentTargetService } from "./service/pitch-environment-target-service.js"
import { PlayerImportService } from "../importer/service/player-import-service.js"
import { StatAccumulatorService } from "../importer/service/stat-accumulator-service.js"
import { StatClassificationService } from "../importer/service/stat-classification-service.js"
import { DownloaderService } from "./service/downloader-service.js"
import { BaseballSavantService } from "./service/baseball-savant-service.js"
import { TeamRatingService } from "./service/team-rating-service.js"
import { TeamRatingRepository } from "./repository/team-rating-repository.js"

const firstRatingSeason = 2008
const defaultBaseDataDir = process.env.DATA_DIR ?? "data"

const schemaService = new SchemaService(database)
schemaService.load()

const playerRatingInputRepository = new PlayerRatingInputRepository(database)
const playerRatingSeasonInputRepository = new PlayerRatingSeasonInputRepository(database)
const playerRatingsRepository = new PlayerRatingsRepository(defaultBaseDataDir)
const playerStatRepository = new PlayerStatRepository(database)
const pitcherAppearanceRepository = new PitcherAppearanceRepository(defaultBaseDataDir)
const pitchEnvironmentTargetRepository = new PitchEnvironmentTargetRepository(defaultBaseDataDir)

const downloaderService = new DownloaderService(
    defaultBaseDataDir,
    1000 * 60 * 60
)

const baseballSavantService = new BaseballSavantService(
    downloaderService
)

const statService = new StatService()
const playerStatService = new PlayerStatService(statService, playerStatRepository)
const downloadService = new DownloadService(schemaService, playerRatingInputRepository, playerRatingSeasonInputRepository, playerStatRepository)
const playerRatingService = new PlayerRatingService(playerRatingInputRepository, playerRatingSeasonInputRepository, playerRatingsRepository)

const statClassificationService = new StatClassificationService()
const statAccumulatorService = new StatAccumulatorService(statClassificationService)
const playerImportService = new PlayerImportService(defaultBaseDataDir, statAccumulatorService)

const pitchEnvironmentTargetService = new PitchEnvironmentTargetService(
    pitchEnvironmentTargetRepository,
    playerImportService,
    downloadService
)

const mlbRosterService = new MlbRosterService()
const pitcherAppearanceService = new PitcherAppearanceService(pitcherAppearanceRepository)
const pitcherWorkloadService = new PitcherWorkloadService(pitcherAppearanceService)
const gameLineupService = new GameLineupService(mlbRosterService, pitcherWorkloadService)
const teamRatingRepository = new TeamRatingRepository(defaultBaseDataDir)
const teamRatingService = new TeamRatingService(teamRatingRepository)
const mlbGameBundleService = new MlbGameBundleService(
    mlbRosterService,
    gameLineupService,
    playerRatingService,
    pitchEnvironmentTargetService,
    playerStatService,
    baseballSavantService,
    teamRatingService
)

async function exportPlayerRatings(season: number, baseDataDir = defaultBaseDataDir): Promise<any[]> {
    const seasonDataDir = path.join(baseDataDir, String(season))
    const playerRatingsPath = path.join(seasonDataDir, "_player_ratings.json")
    const pitchEnvironmentTargetPath = path.join(seasonDataDir, "_pitch_environment_target.json")

    if (!await fileExists(pitchEnvironmentTargetPath)) {
        throw new Error(`Pitch environment target not found: ${pitchEnvironmentTargetPath}`)
    }

    const pitchEnvironment = await readJson<PitchEnvironmentTarget>(pitchEnvironmentTargetPath)

    console.log(`Checking rating history through ${season}.`)
    await downloadService.syncRatingHistory(season)
    console.log(`Rating history through ${season} is ready.`)

    const generatedRatings = await playerRatingService.buildPlayerRatingsForDate(season, getSeasonRatingsDate(season), pitchEnvironment)
    const playerRatings = Array.from(generatedRatings.values()).sort((a, b) => String(a.playerId).localeCompare(String(b.playerId)))

    await writeJson(playerRatingsPath, playerRatings)

    return playerRatings
}

async function exportPlayerRatingsRange(startSeason: number, endSeason: number, baseDataDir = defaultBaseDataDir): Promise<Map<number, number>> {
    validateSeasonRange(startSeason, endSeason)

    await downloadService.syncRatingHistory(endSeason)

    const results = new Map<number, number>()

    for (let season = startSeason; season <= endSeason; season++) {
        const seasonDataDir = path.join(baseDataDir, String(season))
        const playerRatingsPath = path.join(seasonDataDir, "_player_ratings.json")
        const pitchEnvironmentTargetPath = path.join(seasonDataDir, "_pitch_environment_target.json")

        if (!await fileExists(pitchEnvironmentTargetPath)) {
            throw new Error(`Pitch environment target not found: ${pitchEnvironmentTargetPath}`)
        }

        const pitchEnvironment = await readJson<PitchEnvironmentTarget>(pitchEnvironmentTargetPath)
        const generatedRatings = await playerRatingService.buildPlayerRatingsForDate(season, getSeasonRatingsDate(season), pitchEnvironment)
        const playerRatings = Array.from(generatedRatings.values()).sort((a, b) => String(a.playerId).localeCompare(String(b.playerId)))

        await writeJson(playerRatingsPath, playerRatings)

        results.set(season, playerRatings.length)
        console.log(`Generated ${playerRatings.length} player ratings for ${season}.`)
    }

    return results
}

function getSeasonRatingsDate(season: number): string {
    const currentSeason = new Date().getUTCFullYear()
    return season < currentSeason ? `${season + 1}-01-01` : new Date().toISOString().slice(0, 10)
}

function validateSeasonRange(startSeason: number, endSeason: number): void {
    if (!Number.isInteger(startSeason) || startSeason < firstRatingSeason) {
        throw new Error(`Invalid start season: ${startSeason}`)
    }

    if (!Number.isInteger(endSeason) || endSeason < startSeason) {
        throw new Error(`Invalid end season: ${endSeason}`)
    }
}

async function readJson<T>(filePath: string): Promise<T> {
    return JSON.parse(await fs.promises.readFile(filePath, "utf8")) as T
}

async function writeJson(filePath: string, data: any): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8")
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK)
        return true
    } catch {
        return false
    }
}

export {
    downloadService,
    exportPlayerRatings,
    exportPlayerRatingsRange,
    playerRatingService,
    playerStatService,
    pitchEnvironmentTargetService,
    mlbGameBundleService,
    MlbGameBundleService,
    PlayerRatingService,
    PlayerStatService
}

if (process.argv[1] && path.basename(process.argv[1]) === "ratings.js") {
    const action = process.argv[2]
    const subject = process.argv[3]
    const startSeasonArgument = process.argv[4]
    const endSeasonArgument = process.argv[5]
    const currentSeason = new Date().getUTCFullYear()
    const generateRatings = `${action ?? ""} ${subject ?? ""}`.trim() === "generate ratings"

    if (action !== "download" && !generateRatings) {
        throw new Error(
            [
                `Unknown command: ${process.argv.slice(2).join(" ") || "(none)"}`,
                "",
                "Supported commands:",
                "  download [season|all]",
                "  generate ratings [startSeason] [endSeason]"
            ].join("\n")
        )
    }

    if (action === "download" && subject === "all") {
        const result = await downloadService.syncRatingHistory(currentSeason)
        const gamesSynchronized = Array.from(result.values()).reduce((total: number, gamePks: Set<number>) => total + gamePks.size, 0)

        console.log("")
        console.log("========================================")
        console.log("DOWNLOAD ALL COMPLETE")
        console.log(`END SEASON: ${currentSeason}`)
        console.log("========================================")
        console.log(JSON.stringify({ firstSeason: firstRatingSeason, endSeason: currentSeason, seasonsSynchronized: result.size, gamesSynchronized }, null, 2))
        console.log("")
    } else if (action === "download") {
        const season = subject ? Number(subject) : currentSeason

        if (!Number.isInteger(season) || season < 1871) {
            throw new Error(`Invalid season: ${subject}`)
        }

        const result = await downloadService.syncSeason(season)

        console.log("")
        console.log("========================================")
        console.log("DOWNLOAD COMPLETE")
        console.log(`SEASON: ${season}`)
        console.log("========================================")
        console.log(JSON.stringify({ season, gamesSynchronized: result.size }, null, 2))
        console.log("")
    } else {
        const startSeason = startSeasonArgument ? Number(startSeasonArgument) : firstRatingSeason
        const endSeason = endSeasonArgument ? Number(endSeasonArgument) : startSeasonArgument ? startSeason : currentSeason

        validateSeasonRange(startSeason, endSeason)

        if (startSeason === endSeason) {
            const result = await exportPlayerRatings(startSeason, defaultBaseDataDir)

            console.log("")
            console.log("========================================")
            console.log("GENERATE RATINGS COMPLETE")
            console.log(`SEASON: ${startSeason}`)
            console.log("========================================")
            console.log(JSON.stringify({ season: startSeason, playerRatingsGenerated: result.length }, null, 2))
            console.log("")
        } else {
            const result = await exportPlayerRatingsRange(startSeason, endSeason, defaultBaseDataDir)
            const playerRatingsGenerated = Array.from(result.values()).reduce((total, count) => total + count, 0)

            console.log("")
            console.log("========================================")
            console.log("GENERATE RATINGS COMPLETE")
            console.log(`SEASONS: ${startSeason}-${endSeason}`)
            console.log("========================================")
            console.log(JSON.stringify({ startSeason, endSeason, seasonsGenerated: result.size, playerRatingsGenerated }, null, 2))
            console.log("")
        }
    }
}