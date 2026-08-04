import { strict as assert } from "assert"
import fs from "fs"
import os from "os"
import path from "path"

import { afterEach, beforeEach, describe, it } from "mocha"

import { PlayerImportService } from "../src/importer/service/player-import-service.js"

import type { StatExport } from "baseball-database"
import type { PlayerImportRaw } from "../src/sim/service/interfaces.js"
import type { StatAccumulatorService } from "../src/importer/service/stat-accumulator-service.js"
import type {
    DatedStatExport,
    PlayerImportSelection
} from "../src/importer/service/player-import-service.js"

describe("PlayerImportService", function () {

    let baseDataDir: string
    let accumulatedCalls: {
        season: number
        statExports: DatedStatExport[]
        selections: PlayerImportSelection[]
    }[]

    beforeEach(async function () {
        baseDataDir = await fs.promises.mkdtemp(
            path.join(
                os.tmpdir(),
                "baseball-sim-engine-player-import-"
            )
        )

        accumulatedCalls = []
    })

    afterEach(async function () {
        await fs.promises.rm(
            baseDataDir,
            {
                recursive: true,
                force: true
            }
        )
    })

    it("uses each player's latest 162 appearances before the game date", async function () {
        const service = createService()
        const subject = service as any
        const games = Array.from(
            {
                length: 200
            },
            (_, index) => {
                const gamePk = index + 1
                const gameDate = addDays(
                    "2025-01-01",
                    index
                )

                return {
                    gamePk,
                    gameDate,
                    playerIds: [
                        "player-a"
                    ]
                }
            }
        )

        subject.getStatExport = (): StatExport =>
            createStatExport(
                games
            )

        await service.buildCorePlayerImports(
            2026,
            "2026-01-01",
            new Set([
                "player-a"
            ])
        )

        assert.equal(
            accumulatedCalls.length,
            1
        )

        const selection = accumulatedCalls[0].selections[0]

        assert.equal(
            selection.playerId,
            "player-a"
        )

        assert.equal(
            selection.gamePks.length,
            162
        )

        assert.equal(
            selection.gamePks[0],
            39
        )

        assert.equal(
            selection.gamePks.at(-1),
            200
        )
    })

    it("excludes appearances on and after the core game date", async function () {
        const service = createService()
        const subject = service as any

        subject.getStatExport = (): StatExport =>
            createStatExport([
                {
                    gamePk: 101,
                    gameDate: "2026-07-09",
                    playerIds: [
                        "player-a"
                    ]
                },
                {
                    gamePk: 102,
                    gameDate: "2026-07-10",
                    playerIds: [
                        "player-a"
                    ]
                },
                {
                    gamePk: 103,
                    gameDate: "2026-07-11",
                    playerIds: [
                        "player-a"
                    ]
                }
            ])

        await service.buildCorePlayerImports(
            2026,
            "2026-07-10",
            new Set([
                "player-a"
            ])
        )

        assert.deepEqual(
            accumulatedCalls[0].selections[0].gamePks,
            [
                101
            ]
        )
    })

    it("selects appearances inside a date range", async function () {
        const service = createService()
        const subject = service as any

        subject.getStatExport = (
            startDate: string,
            endDateExclusive: string
        ): StatExport => {
            assert.equal(
                startDate,
                "2026-07-08"
            )

            assert.equal(
                endDateExclusive,
                "2026-07-16"
            )

            return createStatExport([
                {
                    gamePk: 102,
                    gameDate: "2026-07-08",
                    playerIds: [
                        "player-a"
                    ]
                },
                {
                    gamePk: 103,
                    gameDate: "2026-07-15",
                    playerIds: [
                        "player-a"
                    ]
                }
            ])
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
            accumulatedCalls[0].selections,
            [
                {
                    playerId: "player-a",
                    gamePks: [
                        102,
                        103
                    ]
                }
            ]
        )
    })

    it("creates one selection per player from shared games", async function () {
        const service = createService()
        const subject = service as any

        subject.getStatExport = (): StatExport =>
            createStatExport([
                {
                    gamePk: 101,
                    gameDate: "2026-07-01",
                    playerIds: [
                        "player-a",
                        "player-b"
                    ]
                }
            ])

        await service.buildDateRangePlayerImports(
            2026,
            "2026-07-01",
            "2026-07-02",
            new Set([
                "player-a",
                "player-b"
            ])
        )

        assert.deepEqual(
            accumulatedCalls[0].selections,
            [
                {
                    playerId: "player-a",
                    gamePks: [
                        101
                    ]
                },
                {
                    playerId: "player-b",
                    gamePks: [
                        101
                    ]
                }
            ]
        )
    })

    it("returns only requested players", async function () {
        const service = createService()
        const subject = service as any

        subject.getStatExport = (): StatExport =>
            createStatExport([
                {
                    gamePk: 101,
                    gameDate: "2026-07-01",
                    playerIds: [
                        "player-a",
                        "player-b"
                    ]
                }
            ])

        const players = await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-b"
            ])
        )

        assert.deepEqual(
            Array.from(
                players.keys()
            ),
            [
                "player-b"
            ]
        )

        assert.deepEqual(
            accumulatedCalls[0].selections,
            [
                {
                    playerId: "player-b",
                    gamePks: [
                        101
                    ]
                }
            ]
        )
    })

    it("returns appearance counts capped at 162", async function () {
        const service = createService()
        const subject = service as any
        const games = [
            ...Array.from(
                {
                    length: 200
                },
                (_, index) => ({
                    gamePk: index + 1,
                    gameDate: addDays(
                        "2025-01-01",
                        index
                    ),
                    playerIds: [
                        "player-a"
                    ]
                })
            ),
            ...Array.from(
                {
                    length: 25
                },
                (_, index) => ({
                    gamePk: 1001 + index,
                    gameDate: addDays(
                        "2025-02-01",
                        index
                    ),
                    playerIds: [
                        "player-b"
                    ]
                })
            )
        ]

        subject.getStatExport = (): StatExport =>
            createStatExport(
                games
            )

        const counts = await service.getAppearanceCountsBeforeDate(
            2026,
            "2026-01-01",
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
        let statExportLoads = 0

        subject.getStatExport = (): StatExport => {
            statExportLoads++

            return createStatExport([
                {
                    gamePk: 101,
                    gameDate: "2026-07-01",
                    playerIds: [
                        "player-a"
                    ]
                }
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

        assert.equal(
            statExportLoads,
            1
        )

        assert.notEqual(
            first,
            second
        )

        assert.notEqual(
            first.get("player-a"),
            second.get("player-a")
        )

        assert.deepEqual(
            first,
            second
        )
    })

    it("force rebuild clears the existing core import cache and state", async function () {
        const service = createService()
        const subject = service as any
        let statExportLoads = 0

        subject.getStatExport = (): StatExport => {
            statExportLoads++

            return createStatExport([
                {
                    gamePk: 100 + statExportLoads,
                    gameDate: "2026-07-01",
                    playerIds: [
                        "player-a"
                    ]
                }
            ])
        }

        await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ])
        )

        await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ]),
            true
        )

        assert.equal(
            statExportLoads,
            2
        )
    })

    it("advances the existing season state without rebuilding unaffected players", async function () {
        const service = createService()
        const subject = service as any
        let call = 0

        subject.getStatExport = (): StatExport => {
            call++

            if (call === 1) {
                return createStatExport([
                    {
                        gamePk: 101,
                        gameDate: "2026-07-01",
                        playerIds: [
                            "player-a"
                        ]
                    }
                ])
            }

            return createStatExport([
                {
                    gamePk: 102,
                    gameDate: "2026-07-02",
                    playerIds: [
                        "player-b"
                    ]
                }
            ])
        }

        const first = await service.buildCorePlayerImports(
            2026,
            "2026-07-02"
        )

        const second = await service.buildCorePlayerImports(
            2026,
            "2026-07-03"
        )

        assert.equal(
            first.has("player-a"),
            true
        )

        assert.equal(
            second.has("player-a"),
            true
        )

        assert.equal(
            second.has("player-b"),
            true
        )

        assert.deepEqual(
            accumulatedCalls[1].selections,
            [
                {
                    playerId: "player-b",
                    gamePks: [
                        102
                    ]
                }
            ]
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
                    createPlayer(
                        "player-a"
                    )
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

        assert.equal(
            builds,
            1
        )

        assert.deepEqual(
            first,
            second
        )

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
            path.dirname(
                resultsPath
            ),
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
                    createPlayer(
                        "player-a"
                    )
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
                    createPlayer(
                        "player-b"
                    )
                ]
            ])
        }

        const players = await service.buildSeasonPlayerImports(
            2025,
            new Set([
                "player-b"
            ])
        )

        assert.equal(
            builds,
            1
        )

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
                    createPlayer(
                        "player-a"
                    )
                ]
            ])
        }

        const player = await service.buildSeasonPlayerImportRaw(
            2026,
            "player-a"
        )

        assert.deepEqual(
            Array.from(
                requestedPlayerIds ??
                []
            ),
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

        subject.states.push({
            season: 2026,
            currentDate: "2026-07-01",
            statExports: [],
            players: new Map(),
            appearancesByPlayer: {}
        })

        service.clearCache()

        assert.equal(
            subject.importCache.size,
            0
        )

        assert.equal(
            subject.states.length,
            0
        )
    })

    function createService(): PlayerImportService {
        const statAccumulatorService = {
            accumulateStatExportsIntoPlayerImports(
                season: number,
                statExports: DatedStatExport[],
                selections: PlayerImportSelection[],
                players: Map<string, PlayerImportRaw>
            ): void {
                accumulatedCalls.push({
                    season,
                    statExports: structuredClone(
                        statExports
                    ),
                    selections: structuredClone(
                        selections
                    )
                })

                for (const selection of selections) {
                    players.set(
                        selection.playerId,
                        createPlayer(
                            selection.playerId
                        )
                    )
                }
            }
        } as StatAccumulatorService

        const service = new PlayerImportService(
            baseDataDir,
            statAccumulatorService
        )

        const subject = service as any

        subject.finalizePlayers = (): void => {}

        return service
    }
})

function createStatExport(games: {
    gamePk: number
    gameDate: string
    playerIds: string[]
}[]): StatExport {
    return {
        games: games.map(game => ({
            gamePk: game.gamePk,
            gameDate: game.gameDate
        })) as any[],
        appearances: games.flatMap(game =>
            game.playerIds.map(playerId => ({
                gamePk: game.gamePk,
                playerId
            }))
        ) as any[],
        plateAppearances: [],
        pitches: [],
        runnerMovements: [],
        fieldingCredits: [],
        defensiveEvents: []
    }
}

function createPlayer(playerId: string): PlayerImportRaw {
    return {
        playerId,
        firstName: "Test",
        lastName: "Player"
    } as PlayerImportRaw
}

function addDays(value: string, days: number): string {
    const date = new Date(
        `${value}T12:00:00.000Z`
    )

    date.setUTCDate(
        date.getUTCDate() +
        days
    )

    return date.toISOString().slice(
        0,
        10
    )
}