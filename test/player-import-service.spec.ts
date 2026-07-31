import { strict as assert } from "assert"
import fs from "fs"
import os from "os"
import path from "path"

import { afterEach, beforeEach, describe, it } from "mocha"

import { PlayerImportService } from "../src/importer/service/player-import-service.js"

import type { PlayerImportRaw } from "../src/sim/service/interfaces.js"
import type { StatAccumulatorService } from "../src/importer/service/stat-accumulator-service.js"

describe("PlayerImportService", function () {

    let baseDataDir: string
    let accumulatedGames: {
        season: number
        gamePk: number
        playerIds: string[]
    }[]

    beforeEach(async function () {
        baseDataDir = await fs.promises.mkdtemp(
            path.join(
                os.tmpdir(),
                "baseball-sim-engine-player-import-"
            )
        )

        accumulatedGames = []
    })

    afterEach(async function () {
        await fs.promises.rm(baseDataDir, {
            recursive: true,
            force: true
        })
    })

    it("builds player imports from supplied game feeds", function () {
        const service = createService()
        const subject = service as any

        subject.finalizePlayers = (): void => {}

        const players = service.buildFromGameFeeds(
            2026,
            [
                {
                    sourceSeason: 2025,
                    gamePk: 101,
                    data: {
                        gamePk: 101
                    },
                    playerIds: [
                        "player-a",
                        "player-b"
                    ]
                },
                {
                    sourceSeason: 2026,
                    gamePk: 201,
                    data: {
                        gamePk: 201
                    },
                    playerIds: [
                        "player-a",
                        "player-c"
                    ]
                }
            ]
        )

        assert.deepEqual(
            accumulatedGames,
            [
                {
                    season: 2026,
                    gamePk: 101,
                    playerIds: [
                        "player-a",
                        "player-b"
                    ]
                },
                {
                    season: 2026,
                    gamePk: 201,
                    playerIds: [
                        "player-a",
                        "player-c"
                    ]
                }
            ]
        )

        assert.deepEqual(
            Array.from(players.keys()),
            [
                "player-a",
                "player-b",
                "player-c"
            ]
        )
    })

    it("ignores supplied game feeds without a game PK, data, or player IDs", function () {
        const service = createService()
        const subject = service as any

        subject.finalizePlayers = (): void => {}

        const players = service.buildFromGameFeeds(
            2026,
            [
                {
                    sourceSeason: 2026,
                    gamePk: 0,
                    data: {
                        gamePk: 0
                    },
                    playerIds: [
                        "player-a"
                    ]
                },
                {
                    sourceSeason: 2026,
                    gamePk: 101,
                    data: undefined as any,
                    playerIds: [
                        "player-a"
                    ]
                },
                {
                    sourceSeason: 2026,
                    gamePk: 102,
                    data: {
                        gamePk: 102
                    },
                    playerIds: []
                }
            ]
        )

        assert.equal(accumulatedGames.length, 0)
        assert.equal(players.size, 0)
    })

    it("uses each player's latest 162 appearances before the game date", async function () {
        const service = createService()
        const subject = service as any

        subject.getAppearanceIndex = async (): Promise<any> => {
            return {
                season: 2026,
                appearancesByPlayerId: new Map([
                    [
                        "player-a",
                        Array.from(
                            {
                                length: 200
                            },
                            (_, index) => {
                                const gameNumber = index + 1

                                return {
                                    sourceSeason: gameNumber <= 100
                                        ? 2025
                                        : 2026,
                                    gamePk: gameNumber,
                                    gameDate: gameNumber <= 100
                                        ? `2025-09-${String(((gameNumber - 1) % 28) + 1).padStart(2, "0")}`
                                        : `2026-04-${String(((gameNumber - 101) % 28) + 1).padStart(2, "0")}`
                                }
                            }
                        )
                    ],
                    [
                        "player-b",
                        Array.from(
                            {
                                length: 50
                            },
                            (_, index) => ({
                                sourceSeason: 2025,
                                gamePk: 1001 + index,
                                gameDate: `2025-08-${String((index % 28) + 1).padStart(2, "0")}`
                            })
                        )
                    ]
                ])
            }
        }

        let selectedGames: Map<string, any> | undefined

        subject.buildFromSelectedGames = async (
            _season: number,
            games: Map<string, any>
        ): Promise<Map<string, PlayerImportRaw>> => {
            selectedGames = games
            return new Map()
        }

        await service.buildCorePlayerImports(
            2026,
            "2026-12-31",
            new Set([
                "player-a",
                "player-b"
            ])
        )

        assert.ok(selectedGames)

        const playerAGames = Array.from(selectedGames!.values())
            .filter(game => game.playerIds.has("player-a"))
            .map(game => game.gamePk)

        const playerBGames = Array.from(selectedGames!.values())
            .filter(game => game.playerIds.has("player-b"))
            .map(game => game.gamePk)

        assert.equal(playerAGames.length, 162)
        assert.equal(playerAGames.includes(38), false)
        assert.equal(playerAGames.includes(39), true)
        assert.equal(playerAGames.includes(200), true)

        assert.equal(playerBGames.length, 50)
        assert.equal(playerBGames.includes(1001), true)
        assert.equal(playerBGames.includes(1050), true)
    })

    it("excludes appearances on and after the core game date", async function () {
        const service = createService()
        const subject = service as any

        subject.getAppearanceIndex = async (): Promise<any> => {
            return {
                season: 2026,
                appearancesByPlayerId: new Map([
                    [
                        "player-a",
                        [
                            {
                                sourceSeason: 2026,
                                gamePk: 101,
                                gameDate: "2026-07-09"
                            },
                            {
                                sourceSeason: 2026,
                                gamePk: 102,
                                gameDate: "2026-07-10"
                            },
                            {
                                sourceSeason: 2026,
                                gamePk: 103,
                                gameDate: "2026-07-11"
                            }
                        ]
                    ]
                ])
            }
        }

        let selectedGames: Map<string, any> | undefined

        subject.buildFromSelectedGames = async (
            _season: number,
            games: Map<string, any>
        ): Promise<Map<string, PlayerImportRaw>> => {
            selectedGames = games
            return new Map()
        }

        await service.buildCorePlayerImports(
            2026,
            "2026-07-10",
            new Set([
                "player-a"
            ])
        )

        assert.deepEqual(
            Array.from(selectedGames!.values()).map(game =>
                game.gamePk
            ),
            [
                101
            ]
        )
    })

    it("selects appearances inside a date range", async function () {
        const service = createService()
        const subject = service as any

        subject.getAppearanceIndex = async (): Promise<any> => {
            return {
                season: 2026,
                appearancesByPlayerId: new Map([
                    [
                        "player-a",
                        [
                            {
                                sourceSeason: 2026,
                                gamePk: 101,
                                gameDate: "2026-07-01"
                            },
                            {
                                sourceSeason: 2026,
                                gamePk: 102,
                                gameDate: "2026-07-08"
                            },
                            {
                                sourceSeason: 2026,
                                gamePk: 103,
                                gameDate: "2026-07-15"
                            },
                            {
                                sourceSeason: 2026,
                                gamePk: 104,
                                gameDate: "2026-07-16"
                            }
                        ]
                    ]
                ])
            }
        }

        let selectedGames: Map<string, any> | undefined

        subject.buildFromSelectedGames = async (
            _season: number,
            games: Map<string, any>
        ): Promise<Map<string, PlayerImportRaw>> => {
            selectedGames = games
            return new Map()
        }

        await service.buildDateRangePlayerImports(
            2026,
            "2026-07-08",
            "2026-07-16",
            new Set([
                "player-a"
            ])
        )

        assert.deepEqual(
            Array.from(selectedGames!.values()).map(game =>
                game.gamePk
            ),
            [
                102,
                103
            ]
        )
    })

    it("groups multiple players from the same game into one selected game", async function () {
        const service = createService()
        const subject = service as any

        subject.getAppearanceIndex = async (): Promise<any> => {
            return {
                season: 2026,
                appearancesByPlayerId: new Map([
                    [
                        "player-a",
                        [
                            {
                                sourceSeason: 2026,
                                gamePk: 101,
                                gameDate: "2026-07-01"
                            }
                        ]
                    ],
                    [
                        "player-b",
                        [
                            {
                                sourceSeason: 2026,
                                gamePk: 101,
                                gameDate: "2026-07-01"
                            }
                        ]
                    ]
                ])
            }
        }

        let selectedGames: Map<string, any> | undefined

        subject.buildFromSelectedGames = async (
            _season: number,
            games: Map<string, any>
        ): Promise<Map<string, PlayerImportRaw>> => {
            selectedGames = games
            return new Map()
        }

        await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a",
                "player-b"
            ])
        )

        assert.equal(selectedGames!.size, 1)

        const selectedGame = Array.from(
            selectedGames!.values()
        )[0]

        assert.equal(selectedGame.gamePk, 101)

        assert.deepEqual(
            Array.from(selectedGame.playerIds),
            [
                "player-a",
                "player-b"
            ]
        )
    })

    it("builds imports from selected games in chronological order", async function () {
        const service = createService()
        const subject = service as any

        const loadedGamePks: number[] = []

        subject.getGameFeed = async (gamePk: number): Promise<any> => {
            loadedGamePks.push(gamePk)

            return {
                gamePk
            }
        }

        subject.finalizePlayers = (): void => {}

        const selectedGames = new Map([
            [
                "2026:103",
                {
                    sourceSeason: 2026,
                    gamePk: 103,
                    gameDate: "2026-07-03",
                    playerIds: new Set([
                        "player-a"
                    ])
                }
            ],
            [
                "2026:101",
                {
                    sourceSeason: 2026,
                    gamePk: 101,
                    gameDate: "2026-07-01",
                    playerIds: new Set([
                        "player-a"
                    ])
                }
            ],
            [
                "2026:102",
                {
                    sourceSeason: 2026,
                    gamePk: 102,
                    gameDate: "2026-07-02",
                    playerIds: new Set([
                        "player-a"
                    ])
                }
            ]
        ])

        await subject.buildFromSelectedGames(
            2026,
            selectedGames
        )

        assert.deepEqual(
            loadedGamePks,
            [
                101,
                102,
                103
            ]
        )

        assert.deepEqual(
            accumulatedGames.map(game =>
                game.gamePk
            ),
            [
                101,
                102,
                103
            ]
        )
    })

    it("returns appearance counts capped at 162", async function () {
        const service = createService()
        const subject = service as any

        subject.getAppearanceIndex = async (): Promise<any> => {
            return {
                season: 2026,
                appearancesByPlayerId: new Map([
                    [
                        "player-a",
                        Array.from(
                            {
                                length: 200
                            },
                            (_, index) => ({
                                sourceSeason: 2026,
                                gamePk: index + 1,
                                gameDate: index < 190
                                    ? "2026-07-01"
                                    : "2026-08-01"
                            })
                        )
                    ],
                    [
                        "player-b",
                        Array.from(
                            {
                                length: 25
                            },
                            (_, index) => ({
                                sourceSeason: 2026,
                                gamePk: 1001 + index,
                                gameDate: "2026-07-01"
                            })
                        )
                    ]
                ])
            }
        }

        const counts = await service.getAppearanceCountsBeforeDate(
            2026,
            "2026-07-28",
            new Set([
                "player-a",
                "player-b",
                "player-c"
            ])
        )

        assert.equal(
            counts.get("player-a"),
            162
        )

        assert.equal(
            counts.get("player-b"),
            25
        )

        assert.equal(
            counts.get("player-c"),
            0
        )
    })

    it("returns cloned results from the in-memory core import cache", async function () {
        const service = createService()
        const subject = service as any

        let builds = 0

        subject.getAppearanceIndex = async (): Promise<any> => {
            return {
                season: 2026,
                appearancesByPlayerId: new Map([
                    [
                        "player-a",
                        [
                            {
                                sourceSeason: 2026,
                                gamePk: 101,
                                gameDate: "2026-07-01"
                            }
                        ]
                    ]
                ])
            }
        }

        subject.buildFromSelectedGames = async (): Promise<Map<string, PlayerImportRaw>> => {
            builds++

            return new Map([
                [
                    "player-a",
                    {
                        playerId: "player-a",
                        firstName: "Test"
                    } as PlayerImportRaw
                ]
            ])
        }

        const first = await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ])
        )

        const second = await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ])
        )

        assert.equal(builds, 1)
        assert.notEqual(first, second)
        assert.notEqual(first.get("player-a"), second.get("player-a"))
        assert.deepEqual(first, second)
    })

    it("force rebuild clears the existing core import cache", async function () {
        const service = createService()
        const subject = service as any

        let builds = 0

        subject.getAppearanceIndex = async (): Promise<any> => {
            return {
                season: 2026,
                appearancesByPlayerId: new Map([
                    [
                        "player-a",
                        [
                            {
                                sourceSeason: 2026,
                                gamePk: 101,
                                gameDate: "2026-07-01"
                            }
                        ]
                    ]
                ])
            }
        }

        subject.buildFromSelectedGames = async (): Promise<Map<string, PlayerImportRaw>> => {
            builds++

            return new Map([
                [
                    "player-a",
                    {
                        playerId: "player-a",
                        firstName: `Build ${builds}`
                    } as PlayerImportRaw
                ]
            ])
        }

        await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ])
        )

        const rebuilt = await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ]),
            true
        )

        assert.equal(builds, 2)
        assert.equal(
            rebuilt.get("player-a")?.firstName,
            "Build 2"
        )
    })

    it("writes and then reads season player imports from the results file", async function () {
        const service = createService()
        const subject = service as any

        let builds = 0

        subject.buildCorePlayerImports = async (): Promise<Map<string, PlayerImportRaw>> => {
            builds++

            return new Map([
                [
                    "player-a",
                    {
                        playerId: "player-a",
                        firstName: "Test",
                        lastName: "Player"
                    } as PlayerImportRaw
                ]
            ])
        }

        const first = await service.buildSeasonPlayerImports(
            2025,
            new Set([
                "player-a"
            ])
        )

        const second = await service.buildSeasonPlayerImports(
            2025,
            new Set([
                "player-a"
            ])
        )

        assert.equal(builds, 1)
        assert.deepEqual(first, second)

        assert.equal(
            fs.existsSync(
                path.join(
                    baseDataDir,
                    "2025",
                    "_results.json"
                )
            ),
            true
        )
    })

    it("does not use a season results file created for different player IDs", async function () {
        const service = createService()
        const subject = service as any

        const resultsPath = path.join(
            baseDataDir,
            "2025",
            "_results.json"
        )

        await fs.promises.mkdir(
            path.dirname(resultsPath),
            {
                recursive: true
            }
        )

        await fs.promises.writeFile(
            resultsPath,
            JSON.stringify({
                season: 2025,
                playerIds: [
                    "player-a"
                ],
                players: [
                    {
                        playerId: "player-a"
                    }
                ]
            }),
            "utf8"
        )

        let builds = 0

        subject.buildCorePlayerImports = async (): Promise<Map<string, PlayerImportRaw>> => {
            builds++

            return new Map([
                [
                    "player-b",
                    {
                        playerId: "player-b"
                    } as PlayerImportRaw
                ]
            ])
        }

        const players = await service.buildSeasonPlayerImports(
            2025,
            new Set([
                "player-b"
            ])
        )

        assert.equal(builds, 1)
        assert.equal(
            players.has("player-b"),
            true
        )
    })

    it("builds a single season player import using a filtered player set", async function () {
        const service = createService()
        const subject = service as any

        let requestedPlayerIds: Set<string> | undefined

        subject.buildSeasonPlayerImports = async (
            _season: number,
            playerIds?: Set<string>
        ): Promise<Map<string, PlayerImportRaw>> => {
            requestedPlayerIds = playerIds

            return new Map([
                [
                    "player-a",
                    {
                        playerId: "player-a"
                    } as PlayerImportRaw
                ]
            ])
        }

        const player = await service.buildSeasonPlayerImportRaw(
            2026,
            "player-a"
        )

        assert.deepEqual(
            Array.from(requestedPlayerIds ?? []),
            [
                "player-a"
            ]
        )

        assert.equal(
            player?.playerId,
            "player-a"
        )
    })

    it("rejects an invalid core import date", async function () {
        const service = createService()

        await assert.rejects(
            service.buildCorePlayerImports(
                2026,
                "not-a-date"
            ),
            /Invalid date: not-a-date/
        )
    })

    it("rejects an invalid date-range boundary", async function () {
        const service = createService()

        await assert.rejects(
            service.buildDateRangePlayerImports(
                2026,
                "2026-07-01",
                "invalid"
            ),
            /Invalid date: invalid/
        )
    })

    it("rejects a date range whose start is not before its end", async function () {
        const service = createService()

        await assert.rejects(
            service.buildDateRangePlayerImports(
                2026,
                "2026-07-10",
                "2026-07-10"
            ),
            /Start date 2026-07-10 must be before end date 2026-07-10/
        )
    })

    it("clears all internal caches", function () {
        const service = createService()
        const subject = service as any

        subject.importCache.set(
            "core:2026:2026-07-01:*",
            new Map()
        )

        subject.appearanceIndexes.set(
            2026,
            Promise.resolve({
                season: 2026,
                appearancesByPlayerId: new Map()
            })
        )

        subject.gameFeeds.set(
            101,
            {
                gamePk: 101
            }
        )

        service.clearCache()

        assert.equal(subject.importCache.size, 0)
        assert.equal(subject.appearanceIndexes.size, 0)
        assert.equal(subject.gameFeeds.size, 0)
    })

    function createService(): PlayerImportService {
        const statAccumulatorService = {
            accumulateGameIntoSeasonPlayerImports(
                season: number,
                gamePk: number,
                _gameData: any,
                players: Map<string, PlayerImportRaw>,
                filterPlayerIds?: Set<string>
            ): void {
                const playerIds = Array.from(
                    filterPlayerIds ?? []
                )

                accumulatedGames.push({
                    season,
                    gamePk,
                    playerIds
                })

                for (const playerId of playerIds) {
                    if (!players.has(playerId)) {
                        players.set(
                            playerId,
                            {
                                playerId
                            } as PlayerImportRaw
                        )
                    }
                }
            }
        } as StatAccumulatorService

        return new PlayerImportService(
            baseDataDir,
            statAccumulatorService
        )
    }
})