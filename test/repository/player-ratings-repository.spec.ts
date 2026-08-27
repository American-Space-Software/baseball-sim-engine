import { strict as assert } from "assert"
import fs from "fs"
import os from "os"
import path from "path"

import { afterEach, beforeEach, describe, it } from "mocha"

import { PlayerRatingsRepository } from "../../src/ratings/repository/player-ratings-repository.js"

import type { PlayerRatingsRow } from "../../src/ratings/repository/player-ratings-repository.js"


describe("PlayerRatingsRepository", function () {

    let rootDir: string
    let dataDir: string
    let repository: PlayerRatingsRepository

    beforeEach(async function () {
        rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "player-ratings-repository-"))
        dataDir = path.join(rootDir, "data")
        repository = new PlayerRatingsRepository(dataDir)
    })

    afterEach(async function () {
        await fs.promises.rm(rootDir, {
            recursive: true,
            force: true
        })
    })

    it("returns an empty array when the ratings file does not exist", async function () {
        assert.deepEqual(await repository.read("2026-07-11"), [])
    })

    it("writes and reads player ratings", async function () {
        const ratings = [
            buildRatingsRow("1")
        ]

        await repository.write("2026-07-11", ratings)

        assert.deepEqual(await repository.read("2026-07-11"), ratings)

        assert.equal(
            fs.existsSync(path.join(dataDir, "2026", "player-ratings", "2026-07-11.json")),
            true
        )
    })

    it("replaces ratings for the same game date", async function () {
        await repository.write("2026-07-11", [
            buildRatingsRow("1")
        ])

        await repository.write("2026-07-11", [
            buildRatingsRow("2")
        ])

        assert.deepEqual(await repository.read("2026-07-11"), [
            buildRatingsRow("2")
        ])
    })

    it("stores ratings for different dates separately", async function () {
        const firstDateRatings = [
            buildRatingsRow("1")
        ]

        const secondDateRatings = [
            buildRatingsRow("2")
        ]

        await repository.write("2026-07-11", firstDateRatings)
        await repository.write("2026-07-12", secondDateRatings)

        assert.deepEqual(await repository.read("2026-07-11"), firstDateRatings)
        assert.deepEqual(await repository.read("2026-07-12"), secondDateRatings)
    })

    it("stores ratings for different seasons separately", async function () {
        await repository.write("2025-07-11", [
            buildRatingsRow("1")
        ])

        await repository.write("2026-07-11", [
            buildRatingsRow("2")
        ])

        assert.deepEqual(await repository.read("2025-07-11"), [
            buildRatingsRow("1")
        ])

        assert.deepEqual(await repository.read("2026-07-11"), [
            buildRatingsRow("2")
        ])
    })

    it("throws when the ratings file is not an array", async function () {
        const filePath = path.join(dataDir, "2026", "player-ratings", "2026-07-11.json")

        await fs.promises.mkdir(path.dirname(filePath), {
            recursive: true
        })

        await fs.promises.writeFile(
            filePath,
            JSON.stringify({
                playerId: "1"
            }),
            "utf8"
        )

        await assert.rejects(
            repository.read("2026-07-11"),
            /Historical player ratings file is not an array/
        )
    })

    function buildRatingsRow(playerId: string): PlayerRatingsRow {
        return {
            playerId,
            firstName: "Test",
            lastName: "Player",
            primaryPosition: "P",
            age: 27,
            throws: "R",
            hits: "R",
            overallRating: 100,
            hittingRatings: {
                contact: 100
            },
            pitchRatings: {
                power: 100
            }
        }
    }

})