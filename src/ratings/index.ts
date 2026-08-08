import fs from "fs"
import path from "path"

import {
    database
} from "baseball-database"

import type {
    PitchEnvironmentTarget
} from "../sim/service/interfaces.js"

import { PlayerRatingInputRepository } from "./repository/player-rating-input-repository.js"
import { PlayerRatingSeasonInputRepository } from "./repository/player-rating-season-input-repository.js"
import { DownloadService } from "../importer/service/download-service.js"
import { SchemaService } from "../importer/service/schema-service.js"
import { PlayerRatingService } from "./service/player-rating-service.js"


const defaultBaseDataDir = process.env.DATA_DIR ?? "data"

const schemaService = new SchemaService(database)
schemaService.load()

const playerRatingInputRepository = new PlayerRatingInputRepository(database)
const playerRatingSeasonInputRepository = new PlayerRatingSeasonInputRepository(database)
const downloadService = new DownloadService(schemaService, playerRatingInputRepository, playerRatingSeasonInputRepository)
const playerRatingService = new PlayerRatingService(playerRatingInputRepository, playerRatingSeasonInputRepository)


async function exportPlayerRatings(season: number, baseDataDir = defaultBaseDataDir): Promise<any[]> {
    const seasonDataDir = path.join(baseDataDir, String(season))
    const playerRatingsPath = path.join(seasonDataDir, "_player_ratings.json")
    const pitchEnvironmentTargetPath = path.join(seasonDataDir, "_pitch_environment_target.json")

    if (!await fileExists(pitchEnvironmentTargetPath)) {
        throw new Error(
            `Pitch environment target not found: ${pitchEnvironmentTargetPath}`
        )
    }

    const pitchEnvironment = await readJson<PitchEnvironmentTarget>(pitchEnvironmentTargetPath)

    console.log(
        `Checking rating history through ${season}.`
    )

    await downloadService.syncRatingHistory(season)

    console.log(
        `Rating history through ${season} is ready.`
    )

    const generatedRatings = await playerRatingService.buildPlayerRatingsForDate(season, getSeasonRatingsDate(season), pitchEnvironment)
    const playerRatings = Array.from(generatedRatings.values()).sort((a, b) => String(a.playerId).localeCompare(String(b.playerId)))

    await writeJson(playerRatingsPath, playerRatings)

    return playerRatings
}

function getSeasonRatingsDate(season: number): string {
    const currentSeason = new Date().getUTCFullYear()

    return season < currentSeason
        ? `${season + 1}-01-01`
        : new Date().toISOString().slice(0, 10)
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
    playerRatingService,
    PlayerRatingService
}


if (process.argv[1] && path.basename(process.argv[1]) === "ratings.js") {
    const action = process.argv[2]
    const subject = process.argv[3]
    const seasonArgument = process.argv[4]
    const currentSeason = new Date().getUTCFullYear()

    if (action !== "download" && `${action ?? ""} ${subject ?? ""}`.trim() !== "generate ratings") {
        throw new Error(
            [
                `Unknown command: ${process.argv.slice(2).join(" ") || "(none)"}`,
                "",
                "Supported commands:",
                "  download [season|all]",
                "  generate ratings [season]"
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
        console.log(JSON.stringify({ firstSeason: 2008, endSeason: currentSeason, seasonsSynchronized: result.size, gamesSynchronized }, null, 2))
        console.log("")
    } else if (action === "download") {
        const season = subject ? Number(subject) : currentSeason

        if (!Number.isInteger(season) || season < 1871) {
            throw new Error(
                `Invalid season: ${subject}`
            )
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
        const season = seasonArgument ? Number(seasonArgument) : currentSeason

        if (!Number.isInteger(season) || season < 1871) {
            throw new Error(
                `Invalid season: ${seasonArgument}`
            )
        }

        const result = await exportPlayerRatings(season, defaultBaseDataDir)

        console.log("")
        console.log("========================================")
        console.log("GENERATE RATINGS COMPLETE")
        console.log(`SEASON: ${season}`)
        console.log("========================================")
        console.log(JSON.stringify({ season, playerRatingsGenerated: result.length }, null, 2))
        console.log("")
    }
}