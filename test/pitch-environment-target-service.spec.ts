import { strict as assert } from "assert"

import { afterEach, beforeEach, describe, it } from "mocha"

import {
    queries
} from "baseball-database"

import type {
    PitchEnvironmentTarget,
    PlayerImportRaw
} from "../src/sim/service/interfaces.js"

import {
    PitchEnvironmentService
} from "../src/importer/service/pitch-environment-service.js"

import {
    PitchEnvironmentTargetRepository
} from "../src/ratings/repository/pitch-environment-target-repository.js"

import {
    PitchEnvironmentTargetService
} from "../src/ratings/service/pitch-environment-target-service.js"

import {
    PlayerImportService
} from "../src/importer/service/player-import-service.js"

import {
    DownloadService
} from "../src/importer/service/download-service.js"


describe("PitchEnvironmentTargetService", function () {

    let originalBuilder: typeof PitchEnvironmentService.getPitchEnvironmentTargetForSeason
    let originalGetSchedule: typeof queries.getSchedule
    let originalGetGame: typeof queries.getGame

    beforeEach(function () {
        originalBuilder =
            PitchEnvironmentService.getPitchEnvironmentTargetForSeason

        originalGetSchedule =
            queries.getSchedule

        originalGetGame =
            queries.getGame
    })

    afterEach(function () {
        PitchEnvironmentService.getPitchEnvironmentTargetForSeason =
            originalBuilder

        queries.getSchedule =
            originalGetSchedule

        queries.getGame =
            originalGetGame
    })


    it("returns a cached pitch environment with a nonzero home field advantage without rebuilding", async function () {
        const cached = buildTarget(
            100,
            0.0425
        )

        let importCalls = 0
        let writes = 0
        let syncCalls = 0

        const repository = {
            read: async () =>
                cached,

            write: async () => {
                writes++
            }
        }

        const playerImportService = {
            buildCorePlayerImports: async () => {
                importCalls++

                return new Map<string, PlayerImportRaw>()
            },

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {
                syncCalls++
            }
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        const result = await service.getForDate(
            "2026-08-21"
        )

        assert.deepEqual(
            result,
            cached
        )

        assert.equal(
            importCalls,
            0
        )

        assert.equal(
            writes,
            0
        )

        assert.equal(
            syncCalls,
            0
        )
    })


    it("repairs a cached zero home field advantage using the previous season for the current season", async function () {
        const cached = buildTarget(
            100,
            0
        )

        const writes: {
            gameDate: string
            target: PitchEnvironmentTarget
        }[] = []

        const syncedSeasons: number[] = []

        const repository = {
            read: async () =>
                cached,

            write: async (gameDate: string, target: PitchEnvironmentTarget) => {
                writes.push({
                    gameDate,
                    target
                })
            }
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                new Map<string, PlayerImportRaw>(),

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async (season: number) => {
                syncedSeasons.push(
                    season
                )
            }
        }

        queries.getSchedule = ((season: number) => {
            assert.equal(
                season,
                2025
            )

            return {
                data: {
                    dates: [
                        {
                            games: [
                                buildScheduledGame(
                                    1
                                ),
                                buildScheduledGame(
                                    2
                                ),
                                buildScheduledGame(
                                    3
                                ),
                                buildScheduledGame(
                                    4
                                )
                            ]
                        }
                    ]
                }
            } as any
        }) as typeof queries.getSchedule

        queries.getGame = ((gamePk: number) => {
            const scores = new Map<number, [number, number]>([
                [1, [5, 3]],
                [2, [2, 4]],
                [3, [6, 2]],
                [4, [4, 1]]
            ])

            const score = scores.get(
                gamePk
            )

            if (!score) {
                return undefined
            }

            return buildStoredGame(
                score[0],
                score[1]
            ) as any
        }) as typeof queries.getGame

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        const result = await service.getForDate(
            "2026-08-21"
        )

        assert.deepEqual(
            syncedSeasons,
            [
                2025
            ]
        )

        assert.equal(
            result.homeFieldAdvantage,
            0.25
        )

        assert.equal(
            cached.homeFieldAdvantage,
            0.25
        )

        assert.deepEqual(
            writes,
            [
                {
                    gameDate: "2026-08-21",
                    target: cached
                }
            ]
        )
    })


    it("builds and stores the pitch environment with calculated home field advantage when no cached target exists", async function () {
        const players = new Map<string, PlayerImportRaw>([
            [
                "1",
                {
                    playerId: "1"
                } as PlayerImportRaw
            ]
        ])

        const built = buildTarget(
            105,
            0.1
        )

        const reads: string[] = []

        const writes: {
            gameDate: string
            target: PitchEnvironmentTarget
        }[] = []

        const importCalls: {
            season: number
            gameDate: string
        }[] = []

        const syncedSeasons: number[] = []

        const repository = {
            read: async (gameDate: string) => {
                reads.push(
                    gameDate
                )

                return undefined
            },

            write: async (gameDate: string, target: PitchEnvironmentTarget) => {
                writes.push({
                    gameDate,
                    target
                })
            }
        }

        const playerImportService = {
            buildCorePlayerImports: async (season: number, gameDate: string) => {
                importCalls.push({
                    season,
                    gameDate
                })

                return players
            },

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async (season: number) => {
                syncedSeasons.push(
                    season
                )
            }
        }

        queries.getSchedule = (() => ({
            data: {
                dates: [
                    {
                        games: [
                            buildScheduledGame(
                                1
                            ),
                            buildScheduledGame(
                                2
                            )
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = ((gamePk: number) => {
            if (gamePk === 1) {
                return buildStoredGame(
                    5,
                    3
                ) as any
            }

            return buildStoredGame(
                2,
                4
            ) as any
        }) as typeof queries.getGame

        const builderCalls: {
            season: number
            players: Map<string, PlayerImportRaw>
            homeFieldAdvantage: number
        }[] = []

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = (
            season: number,
            builtPlayers: Map<string, PlayerImportRaw>,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget => {
            builderCalls.push({
                season,
                players: builtPlayers,
                homeFieldAdvantage
            })

            return built
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        const result = await service.getForDate(
            "2026-08-21"
        )

        assert.deepEqual(
            reads,
            [
                "2026-08-21"
            ]
        )

        assert.deepEqual(
            importCalls,
            [
                {
                    season: 2026,
                    gameDate: "2026-08-21"
                }
            ]
        )

        assert.deepEqual(
            syncedSeasons,
            [
                2025
            ]
        )

        assert.equal(
            builderCalls.length,
            1
        )

        assert.equal(
            builderCalls[0].season,
            2026
        )

        assert.equal(
            builderCalls[0].players,
            players
        )

        assert.equal(
            builderCalls[0].homeFieldAdvantage,
            0
        )

        assert.deepEqual(
            writes,
            [
                {
                    gameDate: "2026-08-21",
                    target: built
                }
            ]
        )

        assert.deepEqual(
            result,
            built
        )
    })


    it("reuses the calculated home field advantage for multiple dates in the same season", async function () {
        const players = new Map<string, PlayerImportRaw>([
            [
                "1",
                {
                    playerId: "1"
                } as PlayerImportRaw
            ]
        ])

        let syncCalls = 0
        let scheduleCalls = 0
        let gameCalls = 0

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                players,

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {
                syncCalls++
            }
        }

        queries.getSchedule = (() => {
            scheduleCalls++

            return {
                data: {
                    dates: [
                        {
                            games: [
                                buildScheduledGame(
                                    1
                                ),
                                buildScheduledGame(
                                    2
                                )
                            ]
                        }
                    ]
                }
            } as any
        }) as typeof queries.getSchedule

        queries.getGame = ((gamePk: number) => {
            gameCalls++

            return gamePk === 1
                ? buildStoredGame(5, 3) as any
                : buildStoredGame(2, 4) as any
        }) as typeof queries.getGame

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = (
            season: number,
            _players: Map<string, PlayerImportRaw>,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget =>
            buildTarget(
                season,
                homeFieldAdvantage
            )

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await service.getForDate(
            "2024-08-21"
        )

        await service.getForDate(
            "2024-08-22"
        )

        assert.equal(
            syncCalls,
            1
        )

        assert.equal(
            scheduleCalls,
            1
        )

        assert.equal(
            gameCalls,
            2
        )
    })


    it("uses the requested season for home field advantage when the requested season is not current", async function () {
        const players = new Map<string, PlayerImportRaw>([
            [
                "1",
                {
                    playerId: "1"
                } as PlayerImportRaw
            ]
        ])

        const syncedSeasons: number[] = []
        let builderHomeFieldAdvantage = 0

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                players,

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async (season: number) => {
                syncedSeasons.push(
                    season
                )
            }
        }

        queries.getSchedule = ((season: number) => {
            assert.equal(
                season,
                2024
            )

            return {
                data: {
                    dates: [
                        {
                            games: [
                                buildScheduledGame(
                                    1
                                ),
                                buildScheduledGame(
                                    2
                                ),
                                buildScheduledGame(
                                    3
                                ),
                                buildScheduledGame(
                                    4
                                )
                            ]
                        }
                    ]
                }
            } as any
        }) as typeof queries.getSchedule

        queries.getGame = ((gamePk: number) => {
            const homeWins = new Set([
                1,
                2,
                3
            ])

            return homeWins.has(gamePk)
                ? buildStoredGame(5, 3) as any
                : buildStoredGame(2, 4) as any
        }) as typeof queries.getGame

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = (
            _season: number,
            _players: Map<string, PlayerImportRaw>,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget => {
            builderHomeFieldAdvantage =
                homeFieldAdvantage

            return buildTarget(
                100,
                homeFieldAdvantage
            )
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await service.getForDate(
            "2024-08-21"
        )

        assert.deepEqual(
            syncedSeasons,
            [
                2024
            ]
        )

        assert.equal(
            builderHomeFieldAdvantage,
            0.25
        )
    })


    it("ignores unfinished games when calculating home field advantage", async function () {
        const players = new Map<string, PlayerImportRaw>([
            [
                "1",
                {
                    playerId: "1"
                } as PlayerImportRaw
            ]
        ])

        let builderHomeFieldAdvantage = 0

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                players,

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {}
        }

        queries.getSchedule = (() => ({
            data: {
                dates: [
                    {
                        games: [
                            buildScheduledGame(
                                1
                            ),
                            buildScheduledGame(
                                2,
                                false
                            ),
                            buildScheduledGame(
                                3
                            )
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = ((gamePk: number) => {
            if (gamePk === 1) {
                return buildStoredGame(
                    5,
                    3
                ) as any
            }

            if (gamePk === 3) {
                return buildStoredGame(
                    2,
                    4
                ) as any
            }

            throw new Error(
                "Unfinished game should not be loaded."
            )
        }) as typeof queries.getGame

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = (
            _season: number,
            _players: Map<string, PlayerImportRaw>,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget => {
            builderHomeFieldAdvantage =
                homeFieldAdvantage

            return buildTarget(
                100,
                homeFieldAdvantage
            )
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await service.getForDate(
            "2026-08-21"
        )

        assert.equal(
            builderHomeFieldAdvantage,
            0
        )
    })


    it("ignores tied completed games when calculating home field advantage", async function () {
        const players = new Map<string, PlayerImportRaw>([
            [
                "1",
                {
                    playerId: "1"
                } as PlayerImportRaw
            ]
        ])

        let builderHomeFieldAdvantage = 0

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                players,

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {}
        }

        queries.getSchedule = (() => ({
            data: {
                dates: [
                    {
                        games: [
                            buildScheduledGame(
                                1
                            ),
                            buildScheduledGame(
                                2
                            ),
                            buildScheduledGame(
                                3
                            )
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = ((gamePk: number) => {
            if (gamePk === 1) {
                return buildStoredGame(
                    5,
                    3
                ) as any
            }

            if (gamePk === 2) {
                return buildStoredGame(
                    4,
                    4
                ) as any
            }

            return buildStoredGame(
                2,
                4
            ) as any
        }) as typeof queries.getGame

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = (
            _season: number,
            _players: Map<string, PlayerImportRaw>,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget => {
            builderHomeFieldAdvantage =
                homeFieldAdvantage

            return buildTarget(
                100,
                homeFieldAdvantage
            )
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await service.getForDate(
            "2026-08-21"
        )

        assert.equal(
            builderHomeFieldAdvantage,
            0
        )
    })


    it("throws when a completed game is missing from baseball-database", async function () {
        const players = new Map<string, PlayerImportRaw>([
            [
                "1",
                {
                    playerId: "1"
                } as PlayerImportRaw
            ]
        ])

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                players,

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {}
        }

        queries.getSchedule = (() => ({
            data: {
                dates: [
                    {
                        games: [
                            buildScheduledGame(
                                123
                            )
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = (() =>
            undefined
        ) as typeof queries.getGame

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-08-21"
            ),
            /Completed game 123 was not found in baseball-database/
        )
    })


    it("throws when no completed games are available for home field calculation", async function () {
        const players = new Map<string, PlayerImportRaw>([
            [
                "1",
                {
                    playerId: "1"
                } as PlayerImportRaw
            ]
        ])

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                players,

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {}
        }

        queries.getSchedule = (() => ({
            data: {
                dates: [
                    {
                        games: [
                            buildScheduledGame(
                                1,
                                false
                            )
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-08-21"
            ),
            /No completed games were found for home-field calculation in 2025/
        )
    })


    it("rebuilds the target when forceRebuild is true", async function () {
        const cached = buildTarget(
            100,
            0.0425
        )

        const rebuilt = buildTarget(
            110,
            0
        )

        let reads = 0
        let imports = 0
        let writes = 0
        let syncs = 0

        const repository = {
            read: async () => {
                reads++

                return cached
            },

            write: async (_gameDate: string, target: PitchEnvironmentTarget) => {
                writes++

                assert.deepEqual(
                    target,
                    rebuilt
                )
            }
        }

        const playerImportService = {
            buildCorePlayerImports: async () => {
                imports++

                return new Map<string, PlayerImportRaw>([
                    [
                        "1",
                        {
                            playerId: "1"
                        } as PlayerImportRaw
                    ]
                ])
            },

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {
                syncs++
            }
        }

        queries.getSchedule = (() => ({
            data: {
                dates: [
                    {
                        games: [
                            buildScheduledGame(
                                1
                            ),
                            buildScheduledGame(
                                2
                            )
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = ((gamePk: number) =>
            gamePk === 1
                ? buildStoredGame(5, 3) as any
                : buildStoredGame(2, 4) as any
        ) as typeof queries.getGame

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = () =>
            rebuilt

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        const result = await service.getForDate(
            "2026-08-21",
            {
                forceRebuild: true
            }
        )

        assert.equal(
            reads,
            0
        )

        assert.equal(
            imports,
            1
        )

        assert.equal(
            syncs,
            1
        )

        assert.equal(
            writes,
            1
        )

        assert.deepEqual(
            result,
            rebuilt
        )
    })


    it("throws when no backward-looking player imports are available", async function () {
        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                new Map<string, PlayerImportRaw>(),

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {}
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-08-21"
            ),
            /No backward-looking player imports were available for 2026-08-21/
        )
    })


    it("throws when a cached target has an invalid average rating", async function () {
        const repository = {
            read: async () => ({
                ...buildTarget(
                    100,
                    0.0425
                ),
                avgRating: 0
            }),

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                new Map<string, PlayerImportRaw>(),

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {}
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-08-21"
            ),
            /Pitch environment target has an invalid avgRating for 2026-08-21/
        )
    })


    it("throws when a built target has no hitter plate appearances", async function () {
        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                new Map<string, PlayerImportRaw>([
                    [
                        "1",
                        {
                            playerId: "1"
                        } as PlayerImportRaw
                    ]
                ]),

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {}
        }

        queries.getSchedule = (() => ({
            data: {
                dates: [
                    {
                        games: [
                            buildScheduledGame(
                                1
                            ),
                            buildScheduledGame(
                                2
                            )
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = ((gamePk: number) =>
            gamePk === 1
                ? buildStoredGame(5, 3) as any
                : buildStoredGame(2, 4) as any
        ) as typeof queries.getGame

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = () => ({
            ...buildTarget(
                100,
                0
            ),
            importReference: {
                ...buildTarget(100, 0).importReference,
                hitter: {
                    ...buildTarget(100, 0).importReference.hitter,
                    pa: 0
                }
            }
        })

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-08-21"
            ),
            /Pitch environment target has no hitter plate appearances for 2026-08-21/
        )
    })


    it("clears the player import cache", function () {
        const clearedSeasons: Array<number | undefined> = []

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                new Map<string, PlayerImportRaw>(),

            clearCache: (season?: number) => {
                clearedSeasons.push(
                    season
                )
            }
        }

        const downloadService = {
            syncSeason: async () => {}
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        service.clearImportCache(
            2026
        )

        service.clearImportCache()

        assert.deepEqual(
            clearedSeasons,
            [
                2026,
                undefined
            ]
        )
    })


    it("clears the cached home field advantage for the requested season", async function () {
        const players = new Map<string, PlayerImportRaw>([
            [
                "1",
                {
                    playerId: "1"
                } as PlayerImportRaw
            ]
        ])

        let syncCalls = 0

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                players,

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {
                syncCalls++
            }
        }

        queries.getSchedule = (() => ({
            data: {
                dates: [
                    {
                        games: [
                            buildScheduledGame(
                                1
                            ),
                            buildScheduledGame(
                                2
                            )
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = ((gamePk: number) =>
            gamePk === 1
                ? buildStoredGame(5, 3) as any
                : buildStoredGame(2, 4) as any
        ) as typeof queries.getGame

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = (
            season: number,
            _players: Map<string, PlayerImportRaw>,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget =>
            buildTarget(
                season,
                homeFieldAdvantage
            )

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await service.getForDate(
            "2024-08-21"
        )

        await service.getForDate(
            "2024-08-22"
        )

        service.clearImportCache(
            2024
        )

        await service.getForDate(
            "2024-08-23"
        )

        assert.equal(
            syncCalls,
            2
        )
    })


    it("throws for an invalid game date", async function () {
        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const playerImportService = {
            buildCorePlayerImports: async () =>
                new Map<string, PlayerImportRaw>(),

            clearCache: () => {}
        }

        const downloadService = {
            syncSeason: async () => {}
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService,
            downloadService as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-02-30"
            ),
            /Invalid pitch-environment game date: 2026-02-30/
        )
    })


    function buildTarget(avgRating: number, homeFieldAdvantage: number): PitchEnvironmentTarget {
        return {
            avgRating,
            season: 2026,
            homeFieldAdvantage,

            importReference: {
                hitter: {
                    pa: 1000
                }
            }
        } as PitchEnvironmentTarget
    }


    function buildScheduledGame(gamePk: number, complete = true): any {
        return {
            gamePk,
            status: complete
                ? {
                    abstractGameState: "Final",
                    detailedState: "Final",
                    codedGameState: "F"
                }
                : {
                    abstractGameState: "Live",
                    detailedState: "In Progress",
                    codedGameState: "I"
                }
        }
    }


    function buildStoredGame(homeScore: number, awayScore: number): any {
        return {
            data: {
                liveData: {
                    linescore: {
                        teams: {
                            home: {
                                runs: homeScore
                            },
                            away: {
                                runs: awayScore
                            }
                        }
                    }
                }
            }
        }
    }

})