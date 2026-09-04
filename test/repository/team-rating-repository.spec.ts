import { strict as assert } from "assert"
import fs from "fs"
import os from "os"
import path from "path"

import {
    afterEach,
    beforeEach,
    describe,
    it
} from "mocha"

import {
    TeamRatingRepository
} from "../../src/ratings/repository/team-rating-repository.js"

import type {
    TeamRatingSnapshot
} from "../../src/ratings/repository/team-rating-repository.js"


describe("TeamRatingRepository", () => {

    let dataDir: string
    let repository: TeamRatingRepository

    beforeEach(() => {
        dataDir = fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "team-rating-repository-"
            )
        )

        repository = new TeamRatingRepository(
            dataDir
        )
    })

    afterEach(() => {
        fs.rmSync(
            dataDir,
            {
                recursive: true,
                force: true
            }
        )
    })

    it("returns undefined when a rating snapshot does not exist", async () => {
        const result = await repository.get(
            "2026-07-09"
        )

        assert.equal(
            result,
            undefined
        )
    })

    it("writes and reads a team rating snapshot", async () => {
        const snapshot: TeamRatingSnapshot = {
            date: "2026-07-09",
            teams: {
                "134": {
                    rating: 1512,
                    rd: 24,
                    vol: 0.059
                },
                "143": {
                    rating: 1488,
                    rd: 26,
                    vol: 0.061
                }
            }
        }

        await repository.put(
            snapshot
        )

        const result = await repository.get(
            "2026-07-09"
        )

        assert.deepEqual(
            result,
            snapshot
        )

        assert.equal(
            fs.existsSync(
                path.join(
                    dataDir,
                    "2026",
                    "team-ratings",
                    "2026-07-09.json"
                )
            ),
            true
        )
    })

    it("returns the latest rating snapshot before the requested date", async () => {
        await repository.put({
            date: "2026-07-07",
            teams: {
                "134": {
                    rating: 1501,
                    rd: 25,
                    vol: 0.06
                }
            }
        })

        await repository.put({
            date: "2026-07-08",
            teams: {
                "134": {
                    rating: 1502,
                    rd: 24,
                    vol: 0.06
                }
            }
        })

        await repository.put({
            date: "2026-07-09",
            teams: {
                "134": {
                    rating: 1503,
                    rd: 23,
                    vol: 0.06
                }
            }
        })

        const result = await repository.getLatestBefore(
            "2026-07-09"
        )

        assert.ok(
            result
        )

        assert.equal(
            result.date,
            "2026-07-08"
        )

        assert.equal(
            result.teams["134"].rating,
            1502
        )
    })

    it("does not return a snapshot from the requested date or later", async () => {
        await repository.put({
            date: "2026-07-09",
            teams: {
                "134": {
                    rating: 1503,
                    rd: 23,
                    vol: 0.06
                }
            }
        })

        await repository.put({
            date: "2026-07-10",
            teams: {
                "134": {
                    rating: 1504,
                    rd: 22,
                    vol: 0.06
                }
            }
        })

        const result = await repository.getLatestBefore(
            "2026-07-09"
        )

        assert.equal(
            result,
            undefined
        )
    })

    it("returns undefined when the team rating directory does not exist", async () => {
        const result = await repository.getLatestBefore(
            "2026-07-09"
        )

        assert.equal(
            result,
            undefined
        )
    })

    it("ignores non-json files when finding the latest snapshot", async () => {
        await repository.put({
            date: "2026-07-07",
            teams: {
                "134": {
                    rating: 1501,
                    rd: 25,
                    vol: 0.06
                }
            }
        })

        const directory = path.join(
            dataDir,
            "2026",
            "team-ratings"
        )

        fs.writeFileSync(
            path.join(
                directory,
                "2026-07-08.txt"
            ),
            "not a snapshot",
            "utf8"
        )

        const result = await repository.getLatestBefore(
            "2026-07-09"
        )

        assert.ok(
            result
        )

        assert.equal(
            result.date,
            "2026-07-07"
        )
    })

    it("stores snapshots in separate season directories", async () => {
        await repository.put({
            date: "2025-09-30",
            teams: {
                "134": {
                    rating: 1490,
                    rd: 30,
                    vol: 0.06
                }
            }
        })

        await repository.put({
            date: "2026-04-01",
            teams: {
                "134": {
                    rating: 1510,
                    rd: 29,
                    vol: 0.06
                }
            }
        })

        assert.equal(
            fs.existsSync(
                path.join(
                    dataDir,
                    "2025",
                    "team-ratings",
                    "2025-09-30.json"
                )
            ),
            true
        )

        assert.equal(
            fs.existsSync(
                path.join(
                    dataDir,
                    "2026",
                    "team-ratings",
                    "2026-04-01.json"
                )
            ),
            true
        )
    })

    it("rejects an invalid date", async () => {
        await assert.rejects(
            repository.get(
                "2026-02-30"
            ),
            /Invalid team rating date 2026-02-30/
        )
    })

    it("rejects a snapshot whose date does not match the file date", async () => {
        const directory = path.join(
            dataDir,
            "2026",
            "team-ratings"
        )

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        )

        fs.writeFileSync(
            path.join(
                directory,
                "2026-07-09.json"
            ),
            JSON.stringify({
                date: "2026-07-08",
                teams: {}
            }),
            "utf8"
        )

        await assert.rejects(
            repository.get(
                "2026-07-09"
            ),
            /Invalid team rating snapshot date 2026-07-08 for 2026-07-09/
        )
    })

    it("rejects a snapshot with invalid team ratings", async () => {
        await assert.rejects(
            repository.put({
                date: "2026-07-09",
                teams: {
                    "134": {
                        rating: Number.NaN,
                        rd: 25,
                        vol: 0.06
                    }
                }
            }),
            /Invalid team rating for team 134 on 2026-07-09/
        )
    })

})
