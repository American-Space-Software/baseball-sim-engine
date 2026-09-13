import { strict as assert } from "assert"

import { afterEach, beforeEach, describe, it } from "mocha"

import {
    queries
} from "baseball-database"

import type {
    StatExport
} from "baseball-database"

import type {
    PitchEnvironmentTarget
} from "../src/sim/service/interfaces.js"

import {
    PitchEnvironmentService
} from "../src/importer/service/pitch-environment-service.js"

import type {
    PitchEnvironmentStats
} from "../src/importer/service/pitch-environment-service.js"

import {
    PitchEnvironmentTargetRepository
} from "../src/ratings/repository/pitch-environment-target-repository.js"

import {
    PitchEnvironmentTargetService
} from "../src/ratings/service/pitch-environment-target-service.js"

import {
    DownloadService
} from "../src/importer/service/download-service.js"


describe("PitchEnvironmentTargetService", function () {

    let originalGetStatExport: typeof queries.getStatExport
    let originalGetSchedule: typeof queries.getSchedule
    let originalGetGame: typeof queries.getGame
    let originalGetStatsForStatExport: typeof PitchEnvironmentService.getPitchEnvironmentStatsForStatExport
    let originalGetTargetForStats: typeof PitchEnvironmentService.getPitchEnvironmentTargetForStats

    beforeEach(function () {
        originalGetStatExport = queries.getStatExport
        originalGetSchedule = queries.getSchedule
        originalGetGame = queries.getGame
        originalGetStatsForStatExport = PitchEnvironmentService.getPitchEnvironmentStatsForStatExport
        originalGetTargetForStats = PitchEnvironmentService.getPitchEnvironmentTargetForStats
    })

    afterEach(function () {
        queries.getStatExport = originalGetStatExport
        queries.getSchedule = originalGetSchedule
        queries.getGame = originalGetGame
        PitchEnvironmentService.getPitchEnvironmentStatsForStatExport = originalGetStatsForStatExport
        PitchEnvironmentService.getPitchEnvironmentTargetForStats = originalGetTargetForStats
    })


    it("returns a cached pitch environment with a nonzero home field advantage without rebuilding", async function () {
        const cached = buildTarget(
            100,
            0.0425
        )

        let statLoads = 0
        let writes = 0
        let syncCalls = 0

        const repository = {
            read: async () =>
                cached,

            write: async () => {
                writes++
            }
        }

        const downloadService = {
            syncSeason: async () => {
                syncCalls++
            }
        }

        queries.getStatExport = (() => {
            statLoads++

            return buildStatExport()
        }) as typeof queries.getStatExport

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
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
            statLoads,
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

            return score
                ? buildStoredGame(
                    score[0],
                    score[1]
                ) as any
                : undefined
        }) as typeof queries.getGame

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
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


    it("loads the previous 162 calendar days and stores the built target", async function () {
        const statLoads: {
            startDate: string
            endDateExclusive: string
        }[] = []

        const writes: {
            gameDate: string
            target: PitchEnvironmentTarget
        }[] = []

        const repository = {
            read: async () =>
                undefined,

            write: async (gameDate: string, target: PitchEnvironmentTarget) => {
                writes.push({
                    gameDate,
                    target
                })
            }
        }

        const downloadService = createDownloadService()

        queries.getStatExport = ((startDate: string, endDateExclusive: string) => {
            statLoads.push({
                startDate,
                endDateExclusive
            })

            return buildStatExport(
                startDate
            )
        }) as typeof queries.getStatExport

        PitchEnvironmentService.getPitchEnvironmentStatsForStatExport = () =>
            buildStats(
                100,
                25
            )

        let builderStats: PitchEnvironmentStats | undefined
        let builderSeason = 0
        let builderHomeFieldAdvantage = 0

        PitchEnvironmentService.getPitchEnvironmentTargetForStats = (
            season: number,
            stats: PitchEnvironmentStats,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget => {
            builderSeason = season
            builderStats = stats
            builderHomeFieldAdvantage = homeFieldAdvantage

            return buildTarget(
                season,
                homeFieldAdvantage
            )
        }

        setBalancedHomeFieldData()

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            downloadService as unknown as DownloadService
        )

        const result = await service.getForDate(
            "2026-08-21"
        )

        assert.deepEqual(
            statLoads,
            [
                {
                    startDate: "2026-03-12",
                    endDateExclusive: "2026-08-21"
                }
            ]
        )

        assert.equal(
            builderSeason,
            2026
        )

        assert.equal(
            builderStats?.hitterTotals.pa,
            100
        )

        assert.equal(
            builderStats?.hitterTotals.hits,
            25
        )

        assert.equal(
            builderHomeFieldAdvantage,
            0
        )

        assert.deepEqual(
            writes,
            [
                {
                    gameDate: "2026-08-21",
                    target: result
                }
            ]
        )
    })


    it("advances a rolling window by subtracting the outgoing day and adding the incoming day", async function () {
        const statLoads: {
            startDate: string
            endDateExclusive: string
        }[] = []

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const downloadService = createDownloadService()

        queries.getStatExport = ((startDate: string, endDateExclusive: string) => {
            statLoads.push({
                startDate,
                endDateExclusive
            })

            return buildStatExport(
                startDate
            )
        }) as typeof queries.getStatExport

        let statBuild = 0

        PitchEnvironmentService.getPitchEnvironmentStatsForStatExport = () => {
            statBuild++

            if (statBuild === 1) {
                return buildStats(
                    100,
                    25
                )
            }

            if (statBuild === 2) {
                return buildStats(
                    5,
                    1
                )
            }

            return buildStats(
                7,
                2
            )
        }

        const targets: {
            pa: number
            hits: number
        }[] = []

        PitchEnvironmentService.getPitchEnvironmentTargetForStats = (
            season: number,
            stats: PitchEnvironmentStats,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget => {
            targets.push({
                pa: stats.hitterTotals.pa,
                hits: stats.hitterTotals.hits
            })

            return buildTarget(
                season,
                homeFieldAdvantage
            )
        }

        setBalancedHomeFieldData()

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            downloadService as unknown as DownloadService
        )

        await service.getForDate(
            "2026-08-21"
        )

        await service.getForDate(
            "2026-08-22"
        )

        assert.deepEqual(
            statLoads,
            [
                {
                    startDate: "2026-03-12",
                    endDateExclusive: "2026-08-21"
                },
                {
                    startDate: "2026-03-12",
                    endDateExclusive: "2026-03-13"
                },
                {
                    startDate: "2026-08-21",
                    endDateExclusive: "2026-08-22"
                }
            ]
        )

        assert.deepEqual(
            targets,
            [
                {
                    pa: 100,
                    hits: 25
                },
                {
                    pa: 102,
                    hits: 26
                }
            ]
        )
    })


    it("rebuilds the full 162-day window when the requested date is not the next day", async function () {
        const statLoads: {
            startDate: string
            endDateExclusive: string
        }[] = []

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        queries.getStatExport = ((startDate: string, endDateExclusive: string) => {
            statLoads.push({
                startDate,
                endDateExclusive
            })

            return buildStatExport(
                startDate
            )
        }) as typeof queries.getStatExport

        PitchEnvironmentService.getPitchEnvironmentStatsForStatExport = () =>
            buildStats(
                100,
                25
            )

        PitchEnvironmentService.getPitchEnvironmentTargetForStats = (
            season: number,
            _stats: PitchEnvironmentStats,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget =>
            buildTarget(
                season,
                homeFieldAdvantage
            )

        setBalancedHomeFieldData()

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            createDownloadService() as unknown as DownloadService
        )

        await service.getForDate(
            "2026-08-21"
        )

        await service.getForDate(
            "2026-08-23"
        )

        assert.deepEqual(
            statLoads,
            [
                {
                    startDate: "2026-03-12",
                    endDateExclusive: "2026-08-21"
                },
                {
                    startDate: "2026-03-14",
                    endDateExclusive: "2026-08-23"
                }
            ]
        )
    })


    it("rebuilds the full window when forceRebuild is true and skips the cached target", async function () {
        const cached = buildTarget(
            100,
            0.0425
        )

        let reads = 0
        const statLoads: {
            startDate: string
            endDateExclusive: string
        }[] = []

        const repository = {
            read: async () => {
                reads++

                return cached
            },

            write: async () => {}
        }

        queries.getStatExport = ((startDate: string, endDateExclusive: string) => {
            statLoads.push({
                startDate,
                endDateExclusive
            })

            return buildStatExport(
                startDate
            )
        }) as typeof queries.getStatExport

        PitchEnvironmentService.getPitchEnvironmentStatsForStatExport = () =>
            buildStats(
                100,
                25
            )

        PitchEnvironmentService.getPitchEnvironmentTargetForStats = (
            season: number,
            _stats: PitchEnvironmentStats,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget =>
            buildTarget(
                season,
                homeFieldAdvantage
            )

        setBalancedHomeFieldData()

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            createDownloadService() as unknown as DownloadService
        )

        await service.getForDate(
            "2026-08-21",
            {
                forceRebuild: true
            }
        )

        assert.equal(
            reads,
            0
        )

        assert.deepEqual(
            statLoads,
            [
                {
                    startDate: "2026-03-12",
                    endDateExclusive: "2026-08-21"
                }
            ]
        )
    })


    it("reuses the calculated home field advantage for multiple dates in the same season", async function () {
        let syncCalls = 0
        let scheduleCalls = 0
        let gameCalls = 0

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const downloadService = {
            syncSeason: async () => {
                syncCalls++
            }
        }

        setDefaultStatBuild()

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

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
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
        const syncedSeasons: number[] = []
        let builderHomeFieldAdvantage = 0

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const downloadService = {
            syncSeason: async (season: number) => {
                syncedSeasons.push(
                    season
                )
            }
        }

        setDefaultStatBuild()

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

            return homeWins.has(
                gamePk
            )
                ? buildStoredGame(5, 3) as any
                : buildStoredGame(2, 4) as any
        }) as typeof queries.getGame

        PitchEnvironmentService.getPitchEnvironmentTargetForStats = (
            season: number,
            _stats: PitchEnvironmentStats,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget => {
            builderHomeFieldAdvantage = homeFieldAdvantage

            return buildTarget(
                season,
                homeFieldAdvantage
            )
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
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


    it("ignores unfinished and tied games when calculating home field advantage", async function () {
        let builderHomeFieldAdvantage = 0

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        setDefaultStatBuild()

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
                            ),
                            buildScheduledGame(
                                4
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
                    4,
                    4
                ) as any
            }

            if (gamePk === 4) {
                return buildStoredGame(
                    2,
                    4
                ) as any
            }

            throw new Error(
                "Unfinished game should not be loaded."
            )
        }) as typeof queries.getGame

        PitchEnvironmentService.getPitchEnvironmentTargetForStats = (
            season: number,
            _stats: PitchEnvironmentStats,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget => {
            builderHomeFieldAdvantage = homeFieldAdvantage

            return buildTarget(
                season,
                homeFieldAdvantage
            )
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            createDownloadService() as unknown as DownloadService
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
        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        setDefaultStatBuild()

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
            createDownloadService() as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-08-21"
            ),
            /Completed game 123 was not found in baseball-database/
        )
    })


    it("throws when no completed games are available for home field calculation", async function () {
        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        setDefaultStatBuild()

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
            createDownloadService() as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-08-21"
            ),
            /No completed games were found for home-field calculation in 2025/
        )
    })


    it("throws when no backward-looking pitch environment statistics are available", async function () {
        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        queries.getStatExport = (() =>
            buildStatExport()
        ) as typeof queries.getStatExport

        PitchEnvironmentService.getPitchEnvironmentStatsForStatExport = () =>
            buildStats(
                0,
                0
            )

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            createDownloadService() as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-08-21"
            ),
            /No backward-looking pitch-environment statistics were available for 2026-08-21/
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

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            createDownloadService() as unknown as DownloadService
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

        setDefaultStatBuild()
        setBalancedHomeFieldData()

        PitchEnvironmentService.getPitchEnvironmentTargetForStats = () => ({
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
            createDownloadService() as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-08-21"
            ),
            /Pitch environment target has no hitter plate appearances for 2026-08-21/
        )
    })


    it("clears the rolling stats state and cached home field advantage", async function () {
        const statLoads: {
            startDate: string
            endDateExclusive: string
        }[] = []

        let syncCalls = 0

        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const downloadService = {
            syncSeason: async () => {
                syncCalls++
            }
        }

        queries.getStatExport = ((startDate: string, endDateExclusive: string) => {
            statLoads.push({
                startDate,
                endDateExclusive
            })

            return buildStatExport(
                startDate
            )
        }) as typeof queries.getStatExport

        PitchEnvironmentService.getPitchEnvironmentStatsForStatExport = () =>
            buildStats(
                100,
                25
            )

        PitchEnvironmentService.getPitchEnvironmentTargetForStats = (
            season: number,
            _stats: PitchEnvironmentStats,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget =>
            buildTarget(
                season,
                homeFieldAdvantage
            )

        setBalancedHomeFieldData()

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            downloadService as unknown as DownloadService
        )

        await service.getForDate(
            "2024-08-21"
        )

        service.clearImportCache(
            2024
        )

        await service.getForDate(
            "2024-08-22"
        )

        assert.equal(
            syncCalls,
            2
        )

        assert.deepEqual(
            statLoads,
            [
                {
                    startDate: "2024-03-12",
                    endDateExclusive: "2024-08-21"
                },
                {
                    startDate: "2024-03-13",
                    endDateExclusive: "2024-08-22"
                }
            ]
        )
    })


    it("throws for an invalid game date", async function () {
        const repository = {
            read: async () =>
                undefined,

            write: async () => {}
        }

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            createDownloadService() as unknown as DownloadService
        )

        await assert.rejects(
            service.getForDate(
                "2026-02-30"
            ),
            /Invalid pitch-environment game date: 2026-02-30/
        )
    })


    function setDefaultStatBuild(): void {
        queries.getStatExport = (() =>
            buildStatExport()
        ) as typeof queries.getStatExport

        PitchEnvironmentService.getPitchEnvironmentStatsForStatExport = () =>
            buildStats(
                100,
                25
            )

        PitchEnvironmentService.getPitchEnvironmentTargetForStats = (
            season: number,
            _stats: PitchEnvironmentStats,
            homeFieldAdvantage: number
        ): PitchEnvironmentTarget =>
            buildTarget(
                season,
                homeFieldAdvantage
            )
    }


    function setBalancedHomeFieldData(): void {
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
    }


    function buildStats(pa: number, hits: number): PitchEnvironmentStats {
        const stats = PitchEnvironmentService.createPitchEnvironmentStats()

        stats.hitterTotals.pa = pa
        stats.hitterTotals.hits = hits

        return stats
    }


    function buildStatExport(gameDate = "2026-08-20"): StatExport {
        return {
            games: [
                {
                    gamePk: 1,
                    gameDate
                }
            ],
            appearances: [],
            plateAppearances: [],
            pitches: [],
            runnerMovements: [],
            fieldingCredits: [],
            defensiveEvents: []
        } as unknown as StatExport
    }


    function buildTarget(season: number, homeFieldAdvantage: number): PitchEnvironmentTarget {
        return {
            avgRating: 100,
            season,
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


    function createDownloadService(): DownloadService {
        return {
            syncSeason: async () => {}
        } as unknown as DownloadService
    }

})