import { strict as assert } from "assert"
import fs from "fs"
import os from "os"
import path from "path"

import { afterEach, beforeEach, describe, it } from "mocha"

import type {
    PitchEnvironmentTarget
} from "../src/sim/service/interfaces.js"

import type {
    PlayerRatingsRow
} from "../src/ratings/repository/player-ratings-repository.js"

import type {
    MlbTeam
} from "../src/ratings/service/mlb-roster-service.js"

import {
    MlbPlayerPoolService
} from "../src/ratings/service/mlb-player-pool-service.js"


const gameDate = "2026-07-09"

const pitchEnvironmentTarget = {
    season: 2026,
    avgRating: 100,
    pitchEnvironmentTuning: {}
} as PitchEnvironmentTarget

const pirates = {
    id: 134,
    name: "Pittsburgh Pirates",
    abbrev: "PIT"
} as MlbTeam

const phillies = {
    id: 143,
    name: "Philadelphia Phillies",
    abbrev: "PHI"
} as MlbTeam

const buildRating = (playerId: string, firstName: string): PlayerRatingsRow => ({
    playerId,
    firstName,
    lastName: "Player",
    primaryPosition: "P",
    age: 27,
    throws: "R",
    hits: "R",
    overallRating: 100,
    hittingRatings: {} as any,
    pitchRatings: {} as any
})


describe("MlbPlayerPoolService", function () {

    let dataDir: string

    beforeEach(function () {
        dataDir = fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "mlb-player-pool-service-"
            )
        )

        fs.mkdirSync(
            path.join(
                dataDir,
                "2026"
            ),
            {
                recursive: true
            }
        )

        fs.writeFileSync(
            path.join(
                dataDir,
                "2026",
                "_pitch_environment_target.json"
            ),
            JSON.stringify(
                pitchEnvironmentTarget
            ),
            "utf8"
        )
    })

    afterEach(function () {
        fs.rmSync(
            dataDir,
            {
                recursive: true,
                force: true
            }
        )
    })

    it("builds the pool from every player on the active MLB rosters", async function () {
        const ratings = [
            buildRating("100", "Pirates One"),
            buildRating("101", "Pirates Two"),
            buildRating("200", "Phillies One"),
            buildRating("999", "Free Agent")
        ]

        const ratingCalls: {
            season: number
            gameDate: string
            pitchEnvironmentTarget: PitchEnvironmentTarget
            playerIds: Set<string>
        }[] = []

        const service = new MlbPlayerPoolService(
            {
                read: async date => {
                    assert.equal(
                        date,
                        gameDate
                    )

                    return ratings
                }
            } as any,
            {
                buildPlayerRatingsForDate: async (season, date, target, playerIds) => {
                    ratingCalls.push({
                        season,
                        gameDate: date,
                        pitchEnvironmentTarget: target,
                        playerIds: new Set(playerIds)
                    })

                    return new Map()
                }
            } as any,
            {
                getRosters: async date => {
                    assert.equal(
                        date,
                        gameDate
                    )

                    return [
                        {
                            team: pirates,
                            players: [
                                {
                                    playerId: "100"
                                },
                                {
                                    playerId: "101"
                                }
                            ]
                        },
                        {
                            team: phillies,
                            players: [
                                {
                                    playerId: "200"
                                }
                            ]
                        }
                    ]
                }
            } as any,
            dataDir
        )

        const result = await service.build(
            gameDate
        )

        assert.equal(
            ratingCalls.length,
            1
        )

        assert.equal(
            ratingCalls[0].season,
            2026
        )

        assert.equal(
            ratingCalls[0].gameDate,
            gameDate
        )

        assert.deepEqual(
            ratingCalls[0].pitchEnvironmentTarget,
            pitchEnvironmentTarget
        )

        assert.deepEqual(
            Array.from(
                ratingCalls[0].playerIds
            ).sort(),
            [
                "100",
                "101",
                "200"
            ]
        )

        assert.equal(
            result.date,
            gameDate
        )

        assert.deepEqual(
            result.players.map(player => ({
                playerId: player.playerId,
                team: player.team?.abbrev
            })),
            [
                {
                    playerId: "100",
                    team: "PIT"
                },
                {
                    playerId: "101",
                    team: "PIT"
                },
                {
                    playerId: "200",
                    team: "PHI"
                }
            ]
        )
    })

    it("excludes stored ratings for players who are not on an active roster", async function () {
        const service = new MlbPlayerPoolService(
            {
                read: async () => [
                    buildRating("100", "Rostered"),
                    buildRating("999", "Free Agent")
                ]
            } as any,
            {
                buildPlayerRatingsForDate: async () => new Map()
            } as any,
            {
                getRosters: async () => [
                    {
                        team: pirates,
                        players: [
                            {
                                playerId: "100"
                            }
                        ]
                    }
                ]
            } as any,
            dataDir
        )

        const result = await service.build(
            gameDate
        )

        assert.deepEqual(
            result.players.map(player =>
                player.playerId
            ),
            [
                "100"
            ]
        )
    })

    it("deduplicates players before building ratings", async function () {
        let requestedPlayerIds: Set<string> | undefined

        const service = new MlbPlayerPoolService(
            {
                read: async () => [
                    buildRating("100", "Player")
                ]
            } as any,
            {
                buildPlayerRatingsForDate: async (_season, _date, _target, playerIds) => {
                    requestedPlayerIds = new Set(
                        playerIds
                    )

                    return new Map()
                }
            } as any,
            {
                getRosters: async () => [
                    {
                        team: pirates,
                        players: [
                            {
                                playerId: "100"
                            }
                        ]
                    },
                    {
                        team: phillies,
                        players: [
                            {
                                playerId: "100"
                            }
                        ]
                    }
                ]
            } as any,
            dataDir
        )

        const result = await service.build(
            gameDate
        )

        assert.deepEqual(
            Array.from(
                requestedPlayerIds ?? []
            ),
            [
                "100"
            ]
        )

        assert.equal(
            result.players.length,
            1
        )

        assert.equal(
            result.players[0].team?.abbrev,
            "PHI"
        )
    })

    it("returns an empty pool without building unfiltered ratings when there are no roster players", async function () {
        let ratingsBuilt = false
        let ratingsRead = false

        const service = new MlbPlayerPoolService(
            {
                read: async () => {
                    ratingsRead = true
                    return []
                }
            } as any,
            {
                buildPlayerRatingsForDate: async () => {
                    ratingsBuilt = true
                    return new Map()
                }
            } as any,
            {
                getRosters: async () => []
            } as any,
            dataDir
        )

        const result = await service.build(
            gameDate
        )

        assert.deepEqual(
            result,
            {
                date: gameDate,
                players: []
            }
        )

        assert.equal(
            ratingsBuilt,
            false
        )

        assert.equal(
            ratingsRead,
            false
        )
    })

    it("throws when the season pitch environment target is missing", async function () {
        fs.rmSync(
            path.join(
                dataDir,
                "2026",
                "_pitch_environment_target.json"
            )
        )

        const service = new MlbPlayerPoolService(
            {
                read: async () => []
            } as any,
            {
                buildPlayerRatingsForDate: async () => new Map()
            } as any,
            {
                getRosters: async () => [
                    {
                        team: pirates,
                        players: [
                            {
                                playerId: "100"
                            }
                        ]
                    }
                ]
            } as any,
            dataDir
        )

        await assert.rejects(
            service.build(
                gameDate
            ),
            /Pitch environment target not found/
        )
    })

    it("throws when the pitch environment target season does not match", async function () {
        fs.writeFileSync(
            path.join(
                dataDir,
                "2026",
                "_pitch_environment_target.json"
            ),
            JSON.stringify({
                ...pitchEnvironmentTarget,
                season: 2025
            }),
            "utf8"
        )

        const service = new MlbPlayerPoolService(
            {
                read: async () => []
            } as any,
            {
                buildPlayerRatingsForDate: async () => new Map()
            } as any,
            {
                getRosters: async () => [
                    {
                        team: pirates,
                        players: [
                            {
                                playerId: "100"
                            }
                        ]
                    }
                ]
            } as any,
            dataDir
        )

        await assert.rejects(
            service.build(
                gameDate
            ),
            /Pitch environment target season 2025 does not match requested season 2026/
        )
    })

    it("throws when the pitch environment target has no tuning", async function () {
        const target = {
            ...pitchEnvironmentTarget
        } as any

        delete target.pitchEnvironmentTuning

        fs.writeFileSync(
            path.join(
                dataDir,
                "2026",
                "_pitch_environment_target.json"
            ),
            JSON.stringify(
                target
            ),
            "utf8"
        )

        const service = new MlbPlayerPoolService(
            {
                read: async () => []
            } as any,
            {
                buildPlayerRatingsForDate: async () => new Map()
            } as any,
            {
                getRosters: async () => [
                    {
                        team: pirates,
                        players: [
                            {
                                playerId: "100"
                            }
                        ]
                    }
                ]
            } as any,
            dataDir
        )

        await assert.rejects(
            service.build(
                gameDate
            ),
            /Pitch environment target has no tuning for season 2026/
        )
    })

})
