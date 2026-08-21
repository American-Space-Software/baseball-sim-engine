import { strict as assert } from "assert"

import { afterEach, beforeEach, describe, it } from "mocha"

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


describe("PitchEnvironmentTargetService", function () {

    let originalBuilder: typeof PitchEnvironmentService.getPitchEnvironmentTargetForSeason

    beforeEach(function () {
        originalBuilder =
            PitchEnvironmentService.getPitchEnvironmentTargetForSeason
    })

    afterEach(function () {
        PitchEnvironmentService.getPitchEnvironmentTargetForSeason =
            originalBuilder
    })


    it("returns the cached pitch environment without building player imports", async function () {
        const cached = buildTarget(
            100
        )

        let importCalls = 0
        let writes = 0

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

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService
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
    })


    it("builds and stores the pitch environment when no cached target exists", async function () {
        const players = new Map<string, PlayerImportRaw>([
            [
                "1",
                {
                    playerId: "1"
                } as PlayerImportRaw
            ]
        ])

        const built = buildTarget(
            105
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
            playerImportService as unknown as PlayerImportService
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


    it("rebuilds the target when forceRebuild is true", async function () {
        const cached = buildTarget(
            100
        )

        const rebuilt = buildTarget(
            110
        )

        let reads = 0
        let imports = 0
        let writes = 0

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

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = () =>
            rebuilt

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService
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

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService
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
                    100
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

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService
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

        PitchEnvironmentService.getPitchEnvironmentTargetForSeason = () => ({
            ...buildTarget(
                100
            ),
            importReference: {
                ...buildTarget(100).importReference,
                hitter: {
                    ...buildTarget(100).importReference.hitter,
                    pa: 0
                }
            }
        })

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService
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

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService
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

        const service = new PitchEnvironmentTargetService(
            repository as unknown as PitchEnvironmentTargetRepository,
            playerImportService as unknown as PlayerImportService
        )

        await assert.rejects(
            service.getForDate(
                "2026-02-30"
            ),
            /Invalid pitch-environment game date: 2026-02-30/
        )
    })


    function buildTarget(avgRating: number): PitchEnvironmentTarget {
        return {
            avgRating,
            season: 2026,
            homeFieldAdvantage: 0,

            importReference: {
                hitter: {
                    pa: 1000
                }
            }
        } as PitchEnvironmentTarget
    }

})