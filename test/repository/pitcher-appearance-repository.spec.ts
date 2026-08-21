import { strict as assert } from "assert"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, it } from "mocha"

import {
    PitcherAppearanceRepository
} from "../../src/ratings/repository/pitcher-appearance-repository.js"

import type {
    PitcherAppearance
} from "../../src/ratings/repository/pitcher-appearance-repository.js"

describe("PitcherAppearanceRepository", () => {

    let temporaryDirectory: string | undefined

    afterEach(async () => {
        if (!temporaryDirectory) {
            return
        }

        await fs.rm(
            temporaryDirectory,
            {
                recursive: true,
                force: true
            }
        )

        temporaryDirectory = undefined
    })

    it("returns undefined when no file exists", async () => {
        temporaryDirectory = await fs.mkdtemp(
            path.join(
                os.tmpdir(),
                "pitcher-appearance-repository-"
            )
        )

        const repository = new PitcherAppearanceRepository(
            temporaryDirectory
        )

        const appearances = await repository.read(
            "2025-03-27"
        )

        assert.equal(
            appearances,
            undefined
        )
    })

    it("writes and reads pitcher appearances", async () => {
        temporaryDirectory = await fs.mkdtemp(
            path.join(
                os.tmpdir(),
                "pitcher-appearance-repository-"
            )
        )

        const repository = new PitcherAppearanceRepository(
            temporaryDirectory
        )

        const expected: PitcherAppearance[] = [
            {
                playerId: "608331",
                playerName: "Tarik Skubal",
                gameId: "778547",
                gameDate: "2025-03-27",
                teamId: "116",
                pitches: 97,
                outs: 21,
                inningsPitched: 7,
                battersFaced: 27,
                gamesStarted: 1,
                gamesFinished: 0,
                saves: 0,
                holds: 0,
                blownSaves: 0,
                entryInning: 1
            },
            {
                playerId: "605483",
                playerName: "Will Vest",
                gameId: "778547",
                gameDate: "2025-03-27",
                teamId: "116",
                pitches: 18,
                outs: 3,
                inningsPitched: 1,
                battersFaced: 4,
                gamesStarted: 0,
                gamesFinished: 1,
                saves: 1,
                holds: 0,
                blownSaves: 0,
                entryInning: 9
            }
        ]

        await repository.write(
            "2025-03-27",
            expected
        )

        const actual = await repository.read(
            "2025-03-27"
        )

        assert.deepEqual(
            actual,
            expected
        )
    })

    it("writes the file under the season pitcher-appearances directory", async () => {
        temporaryDirectory = await fs.mkdtemp(
            path.join(
                os.tmpdir(),
                "pitcher-appearance-repository-"
            )
        )

        const repository = new PitcherAppearanceRepository(
            temporaryDirectory
        )

        await repository.write(
            "2025-03-27",
            []
        )

        const filePath = path.join(
            temporaryDirectory,
            "2025",
            "pitcher-appearances",
            "2025-03-27.json"
        )

        const contents = await fs.readFile(
            filePath,
            "utf8"
        )

        assert.deepEqual(
            JSON.parse(contents),
            []
        )
    })
})