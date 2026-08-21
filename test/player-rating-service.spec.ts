import { strict as assert } from "assert"

import { afterEach, beforeEach, describe, it } from "mocha"

import {
    queries
} from "baseball-database"

import type {
    PitchEnvironmentTarget,
    PlayerRatingInput
} from "../src/sim/service/interfaces.js"

import { PlayerRatingInputRepository } from "../src/ratings/repository/player-rating-input-repository.js"
import { PlayerRatingSeasonInputRepository } from "../src/ratings/repository/player-rating-season-input-repository.js"
import { PlayerRatingsRepository } from "../src/ratings/repository/player-ratings-repository.js"

import type {
    PlayerRatingsRow
} from "../src/ratings/repository/player-ratings-repository.js"

import {
    PlayerRatingService
} from "../src/ratings/service/player-rating-service.js"


const pitchEnvironment = {
    avgRating: 100,
    battedBall: {
        contactRollInput: {
            groundball: 44,
            flyBall: 36,
            lineDrive: 20
        }
    },
    outcome: {
        avg: 0.245,
        bbPercent: 0.084,
        soPercent: 0.222,
        babip: 0.294,
        doublePercent: 0.045,
        triplePercent: 0.004,
        homeRunPercent: 0.031
    },
    swing: {
        swingAtBallsPercent: 28,
        inZoneContactPercent: 84,
        outZoneContactPercent: 60
    },
    importReference: {
        hitter: {
            pa: 1000,
            ab: 900,
            hits: 220,
            bb: 84,
            so: 222,
            doubles: 45,
            triples: 4,
            homeRuns: 31,
            pitchesSeen: 3800,
            inZonePitches: 1900,
            swingAtBalls: 530,
            groundBalls: 400,
            flyBalls: 330,
            lineDrives: 180,
            physics: {
                exitVelocity: {
                    avg: 88
                }
            }
        },
        pitcher: {
            battersFaced: 1000,
            outs: 700,
            so: 222,
            bbAllowed: 84,
            hbpAllowed: 10,
            doublesAllowed: 45,
            triplesAllowed: 4,
            homeRunsAllowed: 31,
            strikesThrown: 2400,
            ballsThrown: 1400,
            pitchesThrown: 3800,
            swingAtStrikesAllowed: 1200,
            inZoneContactAllowed: 1000,
            swingAtBallsAllowed: 500,
            outZoneContactAllowed: 300,
            groundBallsAllowed: 400,
            flyBallsAllowed: 330,
            lineDrivesAllowed: 180,
            physics: {
                velocity: {
                    avg: 93
                },
                horizontalBreak: {
                    avg: 8
                },
                verticalBreak: {
                    avg: 12
                },
                byPitchType: {}
            }
        },
        running: {
            sbAttempts: 100,
            sb: 75
        },
        fielding: {
            chances: 1000,
            errors: 20,
            assists: 300,
            putouts: 680,
            outfieldAssists: 10,
            catcherCaughtStealing: 20,
            catcherStolenBasesAllowed: 60
        }
    }
} as PitchEnvironmentTarget


function buildImport(playerId: string, value: number, plateAppearances = 100): PlayerRatingInput {
    return {
        playerId,

        hitting: {
            games: 10,
            pa: plateAppearances,
            ab: plateAppearances - 10,
            hits: Math.round(value / 4),
            bb: 10,
            so: 20,
            doubles: 5,
            triples: 1,
            homeRuns: 3,
            pitchesSeen: 400,
            inZonePitches: 200,
            swingAtBalls: 50,
            groundBalls: 40,
            flyBalls: 30,
            lineDrives: 20,
            exitVelocity: {
                count: 10,
                totalExitVelo: 880,
                avgExitVelo: 88
            }
        },

        pitching: {
            games: 0,
            starts: 0,
            battersFaced: 0,
            outs: 0,
            so: 0,
            bbAllowed: 0,
            hbpAllowed: 0,
            doublesAllowed: 0,
            triplesAllowed: 0,
            homeRunsAllowed: 0,
            strikesThrown: 0,
            ballsThrown: 0,
            pitchesThrown: 0,
            swingAtStrikesAllowed: 0,
            inZoneContactAllowed: 0,
            swingAtBallsAllowed: 0,
            outZoneContactAllowed: 0,
            groundBallsAllowed: 0,
            flyBallsAllowed: 0,
            lineDrivesAllowed: 0,
            pitchTypes: {}
        },

        fielding: {
            errors: 0,
            assists: 0,
            putouts: 0,
            outfieldAssists: 0,
            catcherCaughtStealing: 0,
            catcherStolenBasesAllowed: 0
        },

        running: {
            sbAttempts: 0,
            sb: 0
        },

        splits: {
            hitting: {
                vsR: {
                    pa: plateAppearances,
                    ab: plateAppearances - 10,
                    hits: Math.round(value / 4),
                    bb: 10,
                    so: 20,
                    doubles: 5,
                    triples: 1,
                    homeRuns: 3,
                    exitVelocity: 88
                },
                vsL: {
                    pa: plateAppearances,
                    ab: plateAppearances - 10,
                    hits: Math.round(value / 4),
                    bb: 10,
                    so: 20,
                    doubles: 5,
                    triples: 1,
                    homeRuns: 3,
                    exitVelocity: 88
                }
            },
            pitching: {
                vsR: {
                    battersFaced: 0,
                    so: 0,
                    bbAllowed: 0,
                    doublesAllowed: 0,
                    triplesAllowed: 0,
                    homeRunsAllowed: 0
                },
                vsL: {
                    battersFaced: 0,
                    so: 0,
                    bbAllowed: 0,
                    doublesAllowed: 0,
                    triplesAllowed: 0,
                    homeRunsAllowed: 0
                }
            }
        },

        value
    } as unknown as PlayerRatingInput
}


function buildRatings(playerId: string, value: number, pitches = ["FF"]): any {
    return {
        playerId,
        hittingRatings: {
            speed: value,
            steals: value,
            defense: value,
            arm: value,
            contactProfile: {
                groundball: 44,
                flyBall: 36,
                lineDrive: 20
            },
            vsR: {
                plateDiscipline: value,
                contact: value,
                gapPower: value,
                homerunPower: value
            },
            vsL: {
                plateDiscipline: value,
                contact: value,
                gapPower: value,
                homerunPower: value
            }
        },
        pitchRatings: {
            power: value,
            contactProfile: {
                groundball: 44,
                flyBall: 36,
                lineDrive: 20
            },
            vsR: {
                control: value,
                movement: value
            },
            vsL: {
                control: value,
                movement: value
            },
            pitches
        }
    }
}


function buildRatingsRow(playerId: string, value: number): PlayerRatingsRow {
    const ratings = buildRatings(
        playerId,
        value
    )

    return {
        playerId,
        firstName: "Test",
        lastName: `Player ${playerId}`,
        primaryPosition: "1B",
        age: 27,
        throws: "R",
        hits: "R",
        hittingRatings: ratings.hittingRatings,
        pitchRatings: ratings.pitchRatings
    }
}


describe("PlayerRatingService", function () {

    let originalGetPlayer: typeof queries.getPlayer

    beforeEach(function () {
        originalGetPlayer = queries.getPlayer
    })

    afterEach(function () {
        queries.getPlayer = originalGetPlayer
    })


    describe("persistent ratings cache", function () {

        it("returns stored ratings without loading rating inputs", async function () {
            let inputCalls = 0
            let seasonInputCalls = 0
            let writes = 0

            const inputRepository = {
                getPlayerIdsForSeason: () => {
                    inputCalls++
                    return new Set(["1"])
                },
                getLastAppearances: () => {
                    inputCalls++
                    return []
                },
                getForDateRange: () => {
                    inputCalls++
                    return []
                }
            }

            const seasonInputRepository = {
                getBeforeSeason: () => {
                    seasonInputCalls++
                    return []
                }
            }

            const ratingsRepository = {
                read: async () => [
                    buildRatingsRow(
                        "1",
                        123
                    )
                ],
                write: async () => {
                    writes++
                }
            }

            const service = new PlayerRatingService(
                inputRepository as unknown as PlayerRatingInputRepository,
                seasonInputRepository as unknown as PlayerRatingSeasonInputRepository,
                ratingsRepository as unknown as PlayerRatingsRepository
            )

            const ratings = await service.buildPlayerRatingsForDate(
                2026,
                "2026-07-20",
                pitchEnvironment,
                new Set([
                    "1"
                ])
            )

            assert.equal(
                inputCalls,
                0
            )

            assert.equal(
                seasonInputCalls,
                0
            )

            assert.equal(
                writes,
                0
            )

            const player = ratings.get(
                "1"
            )

            assert.ok(
                player
            )

            assert.equal(
                player.hittingRatings.speed,
                123
            )

            assert.equal(
                player.pitchRatings.power,
                123
            )
        })


        it("builds only players missing from stored ratings", async function () {
            const requestedSeasons: any[] = []
            const requestedLastAppearances: any[] = []
            const requestedRanges: any[] = []
            const writes: PlayerRatingsRow[][] = []

            const inputRepository = {
                getPlayerIdsForSeason: () => new Set([
                    "1",
                    "2"
                ]),

                getLastAppearances: (endDateExclusive: string, appearanceCount: number, playerIds?: Set<string>) => {
                    requestedLastAppearances.push({
                        endDateExclusive,
                        appearanceCount,
                        playerIds: Array.from(playerIds ?? [])
                    })

                    return [
                        buildImport(
                            "2",
                            110
                        )
                    ]
                },

                getForDateRange: (startDate: string, endDateExclusive: string, playerIds?: Set<string>) => {
                    requestedRanges.push({
                        startDate,
                        endDateExclusive,
                        playerIds: Array.from(playerIds ?? [])
                    })

                    if (startDate === "2026-01-01") {
                        return []
                    }

                    return [
                        buildImport(
                            "2",
                            120
                        )
                    ]
                }
            }

            const seasonInputRepository = {
                getBeforeSeason: (requestedSeason: number, playerIds?: Set<string>) => {
                    requestedSeasons.push({
                        season: requestedSeason,
                        playerIds: Array.from(playerIds ?? [])
                    })

                    return [
                        {
                            season: 2025,
                            playerId: "2",
                            data: buildImport(
                                "2",
                                100
                            ),
                            metadata: {}
                        }
                    ]
                }
            }

            const ratingsRepository = {
                read: async () => [
                    buildRatingsRow(
                        "1",
                        90
                    )
                ],
                write: async (_gameDate: string, rows: PlayerRatingsRow[]) => {
                    writes.push(
                        rows
                    )
                }
            }

            queries.getPlayer = ((playerId: number) => ({
                playerId,
                firstName: "Built",
                lastName: "Player",
                fullName: "Built Player",
                primaryPosition: "1B",
                birthDate: "1999-01-01",
                throws: "R",
                bats: "L"
            })) as typeof queries.getPlayer

            const service = new PlayerRatingService(
                inputRepository as unknown as PlayerRatingInputRepository,
                seasonInputRepository as unknown as PlayerRatingSeasonInputRepository,
                ratingsRepository as unknown as PlayerRatingsRepository
            )

            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings

            ratingService.buildPlayerRatings = (_environment: PitchEnvironmentTarget, input: any) =>
                buildRatings(
                    input.playerId,
                    input.value
                )

            try {
                const ratings = await service.buildPlayerRatingsForDate(
                    2026,
                    "2026-07-20",
                    pitchEnvironment,
                    new Set([
                        "1",
                        "2"
                    ])
                )

                assert.deepEqual(
                    requestedSeasons,
                    [
                        {
                            season: 2026,
                            playerIds: [
                                "2"
                            ]
                        }
                    ]
                )

                for (const call of requestedLastAppearances) {
                    assert.deepEqual(
                        call.playerIds,
                        [
                            "2"
                        ]
                    )
                }

                for (const call of requestedRanges) {
                    assert.deepEqual(
                        call.playerIds,
                        [
                            "2"
                        ]
                    )
                }

                assert.equal(
                    writes.length,
                    1
                )

                assert.deepEqual(
                    writes[0].map(row =>
                        row.playerId
                    ),
                    [
                        "1",
                        "2"
                    ]
                )

                assert.equal(
                    ratings.get("1")?.hittingRatings.speed,
                    90
                )

                assert.ok(
                    ratings.has(
                        "2"
                    )
                )
            } finally {
                ratingService.buildPlayerRatings =
                    originalBuildPlayerRatings
            }
        })


        it("writes generated ratings using baseball-database player metadata", async function () {
            let writtenRows: PlayerRatingsRow[] = []

            const inputRepository = {
                getPlayerIdsForSeason: () => new Set([
                    "1"
                ]),

                getLastAppearances: () => [
                    buildImport(
                        "1",
                        100
                    )
                ],

                getForDateRange: () => [
                    buildImport(
                        "1",
                        100
                    )
                ]
            }

            const seasonInputRepository = {
                getBeforeSeason: () => [
                    {
                        season: 2025,
                        playerId: "1",
                        data: buildImport(
                            "1",
                            100
                        ),
                        metadata: {}
                    }
                ]
            }

            const ratingsRepository = {
                read: async () => [],
                write: async (_gameDate: string, rows: PlayerRatingsRow[]) => {
                    writtenRows = rows
                }
            }

            queries.getPlayer = (() => ({
                playerId: 1,
                firstName: "Bryan",
                lastName: "Reynolds",
                fullName: "Bryan Reynolds",
                primaryPosition: "LF",
                birthDate: "1995-01-27",
                throws: "R",
                bats: "S"
            })) as unknown as typeof queries.getPlayer

            const service = new PlayerRatingService(
                inputRepository as unknown as PlayerRatingInputRepository,
                seasonInputRepository as unknown as PlayerRatingSeasonInputRepository,
                ratingsRepository as unknown as PlayerRatingsRepository
            )

            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings

            ratingService.buildPlayerRatings = (_environment: PitchEnvironmentTarget, input: any) =>
                buildRatings(
                    input.playerId,
                    120
                )

            try {
                await service.buildPlayerRatingsForDate(
                    2026,
                    "2026-07-20",
                    pitchEnvironment,
                    new Set([
                        "1"
                    ])
                )

                assert.equal(
                    writtenRows.length,
                    1
                )

                assert.equal(
                    writtenRows[0].playerId,
                    "1"
                )

                assert.equal(
                    writtenRows[0].firstName,
                    "Bryan"
                )

                assert.equal(
                    writtenRows[0].lastName,
                    "Reynolds"
                )

                assert.equal(
                    writtenRows[0].primaryPosition,
                    "LF"
                )

                assert.equal(
                    writtenRows[0].throws,
                    "R"
                )

                assert.equal(
                    writtenRows[0].hits,
                    "S"
                )

                assert.equal(
                    writtenRows[0].age,
                    31
                )

                assert.ok(
                    Math.abs(
                        writtenRows[0].hittingRatings.speed - 120
                    ) < 0.000001
                )


                assert.ok(
                    Math.abs(
                        writtenRows[0].pitchRatings.power - 120
                    ) < 0.000001
                )

            } finally {
                ratingService.buildPlayerRatings =
                    originalBuildPlayerRatings
            }
        })


        it("builds baseline ratings when no historical rating input exists", async function () {
            let writtenRows: PlayerRatingsRow[] = []

            const inputRepository = {
                getPlayerIdsForSeason: () => new Set([
                    "1"
                ]),
                getLastAppearances: () => [],
                getForDateRange: () => []
            }

            const seasonInputRepository = {
                getBeforeSeason: () => []
            }

            const ratingsRepository = {
                read: async () => [],
                write: async (_gameDate: string, rows: PlayerRatingsRow[]) => {
                    writtenRows = rows
                }
            }

            queries.getPlayer = (() => ({
                playerId: 1,
                firstName: "New",
                lastName: "Pitcher",
                fullName: "New Pitcher",
                primaryPosition: "P",
                birthDate: "2000-01-01",
                throws: "R",
                bats: "R"
            })) as unknown as typeof queries.getPlayer

            const service = new PlayerRatingService(
                inputRepository as unknown as PlayerRatingInputRepository,
                seasonInputRepository as unknown as PlayerRatingSeasonInputRepository,
                ratingsRepository as unknown as PlayerRatingsRepository
            )

            const ratings = await service.buildPlayerRatingsForDate(
                2026,
                "2026-07-20",
                pitchEnvironment,
                new Set([
                    "1"
                ])
            )

            const player = ratings.get(
                "1"
            )

            assert.ok(
                player
            )

            assert.equal(
                player.hittingRatings.speed,
                100
            )

            assert.equal(
                player.hittingRatings.vsR.contact,
                100
            )

            assert.equal(
                player.hittingRatings.vsL.homerunPower,
                100
            )

            assert.equal(
                player.pitchRatings.power,
                100
            )

            assert.equal(
                player.pitchRatings.vsR.control,
                100
            )

            assert.deepEqual(
                player.pitchRatings.pitches,
                [
                    "FF"
                ]
            )

            assert.equal(
                writtenRows.length,
                1
            )
        })


        it("uses the persisted result on a later service instance", async function () {
            const stored = new Map<string, PlayerRatingsRow[]>()
            let inputCalls = 0

            const ratingsRepository = {
                read: async (gameDate: string) =>
                    stored.get(gameDate) ??
                    [],

                write: async (gameDate: string, rows: PlayerRatingsRow[]) => {
                    stored.set(
                        gameDate,
                        structuredClone(
                            rows
                        )
                    )
                }
            }

            const inputRepository = {
                getPlayerIdsForSeason: () => new Set([
                    "1"
                ]),

                getLastAppearances: () => {
                    inputCalls++

                    return [
                        buildImport(
                            "1",
                            100
                        )
                    ]
                },

                getForDateRange: () => {
                    inputCalls++

                    return [
                        buildImport(
                            "1",
                            100
                        )
                    ]
                }
            }

            const seasonInputRepository = {
                getBeforeSeason: () => {
                    inputCalls++

                    return [
                        {
                            season: 2025,
                            playerId: "1",
                            data: buildImport(
                                "1",
                                100
                            ),
                            metadata: {}
                        }
                    ]
                }
            }

            queries.getPlayer = (() => ({
                playerId: 1,
                firstName: "Test",
                lastName: "Player",
                fullName: "Test Player",
                primaryPosition: "1B",
                birthDate: "2000-01-01",
                throws: "R",
                bats: "R"
            })) as unknown as typeof queries.getPlayer

            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings

            ratingService.buildPlayerRatings = (_environment: PitchEnvironmentTarget, input: any) =>
                buildRatings(
                    input.playerId,
                    115
                )

            try {
                const firstService = new PlayerRatingService(
                    inputRepository as unknown as PlayerRatingInputRepository,
                    seasonInputRepository as unknown as PlayerRatingSeasonInputRepository,
                    ratingsRepository as unknown as PlayerRatingsRepository
                )

                await firstService.buildPlayerRatingsForDate(
                    2026,
                    "2026-07-20",
                    pitchEnvironment,
                    new Set([
                        "1"
                    ])
                )

                assert.ok(
                    inputCalls > 0
                )

                inputCalls = 0

                const secondService = new PlayerRatingService(
                    inputRepository as unknown as PlayerRatingInputRepository,
                    seasonInputRepository as unknown as PlayerRatingSeasonInputRepository,
                    ratingsRepository as unknown as PlayerRatingsRepository
                )

                const ratings = await secondService.buildPlayerRatingsForDate(
                    2026,
                    "2026-07-20",
                    pitchEnvironment,
                    new Set([
                        "1"
                    ])
                )

                assert.equal(
                    inputCalls,
                    0
                )

                assert.equal(
                    ratings.get("1")?.hittingRatings.speed,
                    115
                )
            } finally {
                ratingService.buildPlayerRatings =
                    originalBuildPlayerRatings
            }
        })

    })


    describe("rating windows", function () {

        it("requests each configured bulk rating window once during initial state creation", async function () {
            const requestedSeasons: any[] = []
            const requestedLastAppearances: any[] = []
            const requestedRanges: any[] = []

            const inputRepository = {
                getPlayerIdsForSeason: () => new Set([
                    "1"
                ]),

                getLastAppearances: (endDateExclusive: string, appearanceCount: number, playerIds?: Set<string>) => {
                    requestedLastAppearances.push({
                        endDateExclusive,
                        appearanceCount,
                        playerIds: Array.from(playerIds ?? [])
                    })

                    return [
                        buildImport(
                            "1",
                            110
                        )
                    ]
                },

                getForDateRange: (startDate: string, endDateExclusive: string, playerIds?: Set<string>) => {
                    requestedRanges.push({
                        startDate,
                        endDateExclusive,
                        playerIds: Array.from(playerIds ?? [])
                    })

                    if (startDate === "2026-01-01") {
                        return []
                    }

                    const value =
                        startDate === "2026-06-20"
                            ? 120
                            : startDate === "2026-07-05"
                                ? 130
                                : 140

                    return [
                        buildImport(
                            "1",
                            value
                        )
                    ]
                }
            }

            const seasonInputRepository = {
                getBeforeSeason: (requestedSeason: number, playerIds?: Set<string>) => {
                    requestedSeasons.push({
                        season: requestedSeason,
                        playerIds: Array.from(playerIds ?? [])
                    })

                    return [
                        {
                            season: 2025,
                            playerId: "1",
                            data: buildImport(
                                "1",
                                100
                            ),
                            metadata: {}
                        }
                    ]
                }
            }

            const ratingsRepository = {
                read: async () => [],
                write: async () => {}
            }

            queries.getPlayer = (() => ({
                playerId: 1,
                firstName: "Test",
                lastName: "Player",
                fullName: "Test Player",
                primaryPosition: "1B",
                birthDate: "2000-01-01",
                throws: "R",
                bats: "R"
            })) as unknown as typeof queries.getPlayer

            const service = new PlayerRatingService(
                inputRepository as unknown as PlayerRatingInputRepository,
                seasonInputRepository as unknown as PlayerRatingSeasonInputRepository,
                ratingsRepository as unknown as PlayerRatingsRepository
            )

            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings

            ratingService.buildPlayerRatings = (_environment: PitchEnvironmentTarget, playerInput: any) =>
                buildRatings(
                    playerInput.playerId,
                    playerInput.value
                )

            try {
                const ratings = await service.buildPlayerRatingsForDate(
                    2026,
                    "2026-07-20",
                    pitchEnvironment,
                    new Set([
                        "1"
                    ])
                )

                assert.deepEqual(
                    requestedSeasons,
                    [
                        {
                            season: 2026,
                            playerIds: [
                                "1"
                            ]
                        }
                    ]
                )

                assert.deepEqual(
                    requestedLastAppearances,
                    [
                        {
                            endDateExclusive: "2026-07-20",
                            appearanceCount: 162,
                            playerIds: [
                                "1"
                            ]
                        }
                    ]
                )

                assert.deepEqual(
                    requestedRanges,
                    [
                        {
                            startDate: "2026-01-01",
                            endDateExclusive: "2026-07-20",
                            playerIds: [
                                "1"
                            ]
                        },
                        {
                            startDate: "2026-06-20",
                            endDateExclusive: "2026-07-05",
                            playerIds: [
                                "1"
                            ]
                        },
                        {
                            startDate: "2026-07-05",
                            endDateExclusive: "2026-07-13",
                            playerIds: [
                                "1"
                            ]
                        },
                        {
                            startDate: "2026-07-13",
                            endDateExclusive: "2026-07-20",
                            playerIds: [
                                "1"
                            ]
                        }
                    ]
                )

                const expected =
                    (100 * 0.50) +
                    (110 * 0.30) +
                    (120 * 0.12) +
                    (130 * 0.06) +
                    (140 * 0.02)

                const player = ratings.get(
                    "1"
                )

                assert.ok(
                    player
                )

                assert.equal(
                    player.hittingRatings.speed,
                    expected
                )

                assert.equal(
                    player.pitchRatings.power,
                    expected
                )
            } finally {
                ratingService.buildPlayerRatings =
                    originalBuildPlayerRatings
            }
        })


        it("uses the career set for nonnumeric rating values", function () {
            const ratings = (PlayerRatingService as any).buildWeightedPlayerRatings([
                {
                    ratings: buildRatings(
                        "1",
                        100,
                        [
                            "FF"
                        ]
                    ),
                    weight: 0.50
                },
                {
                    ratings: buildRatings(
                        "1",
                        140,
                        [
                            "SL",
                            "CH"
                        ]
                    ),
                    weight: 0.02
                }
            ])

            assert.equal(
                ratings.playerId,
                "1"
            )

            assert.deepEqual(
                ratings.pitchRatings.pitches,
                [
                    "FF"
                ]
            )
        })


        it("throws when no rating sets are supplied", function () {
            assert.throws(
                () =>
                    (PlayerRatingService as any).buildWeightedPlayerRatings(
                        []
                    ),
                /without rating sets/
            )
        })

    })

})