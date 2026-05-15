import assert from "assert"
import {
    StatService,
    simService
} from "../src/sim/index.js"
import seedrandom from "seedrandom"
import type {
    PitchEnvironmentTarget
} from "../src/sim/index.js"

import { PitchEnvironmentService } from "../src/importer/service/pitch-environment-service.js"
import { importPitchEnvironmentTarget } from "../src/importer/index.js"
import { DownloaderService } from "../src/importer/service/downloader-service.js"

const statService = new StatService()
let pitchEnvironment: PitchEnvironmentTarget
let tunedPitchEnvironment: PitchEnvironmentTarget

const season = 2025
const baseDataDir = "data"

const pitchEnvironmentService = new PitchEnvironmentService(simService, statService, {} as any)
const downloaderservice = new DownloaderService(baseDataDir, 1000)

const players = await downloaderservice.buildSeasonPlayerImports(season, new Set([]))

console.log(JSON.stringify(players.get("660271")))

describe("Player Ratings", async () => {

    it("should calculate pitch environment target for season", async () => {
        pitchEnvironment = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(season, players)

        assert.ok(pitchEnvironment)
    })



})
