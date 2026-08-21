import { strict as assert } from "assert"
import fs from "fs"
import os from "os"
import path from "path"

import { afterEach, beforeEach, describe, it } from "mocha"

import {
    queries
} from "baseball-database"

import type {
    PitchEnvironmentTarget
} from "../src/sim/service/interfaces.js"

import {
    MlbGameBundleService
} from "../src/ratings/service/mlb-game-bundle-service.js"

import type {
    TeamBundle
} from "../src/ratings/service/game-lineup-service.js"

import type {
    MlbRosterEntry,
    MlbTeam
} from "../src/ratings/service/mlb-roster-service.js"

import type {
    GeneratedPlayerRatings
} from "../src/ratings/service/player-rating-service.js"


class MlbGameBundleServiceTestHarness {

    public readonly gameDate = "2026-07-09"

    public readonly teams: MlbTeam[] = [
        {
            id: 134,
            name: "Pittsburgh Pirates",
            abbrev: "PIT"
        },
        {
            id: 143,
            name: "Philadelphia Phillies",
            abbrev: "PHI"
        },
        {
            id: 147,
            name: "New York Yankees",
            abbrev: "NYY"
        },
        {
            id: 111,
            name: "Boston Red Sox",
            abbrev: "BOS"
        }
    ]

    public readonly pitchEnvironmentTarget = {
        avgRating: 100,
        season: 2026
    } as PitchEnvironmentTarget

    public readonly buildCalls: {
        gameDate: string
        team: MlbTeam
        roster: MlbRosterEntry[]
        ratings: Map<string, GeneratedPlayerRatings>
        gamePk?: number | string
    }[] = []

    public readonly getRosterCalls: {
        gameDate: string
        team: MlbTeam
        gamePk?: number | string
    }[] = []

    public readonly syncRosterCalls: string[] = []

    public readonly ratingCalls: {
        season: number
        gameDate: string
        pitchEnvironmentTarget: PitchEnvironmentTarget
        playerIds: Set<string>
    }[] = []

    public readonly bundles = new Map<number, TeamBundle>()
    public readonly rosters = new Map<number, MlbRosterEntry[]>()

    public readonly ratings = new Map<string, GeneratedPlayerRatings>([
        [
            "134001",
            {
                playerId: "134001"
            } as GeneratedPlayerRatings
        ],
        [
            "143001",
            {
                playerId: "143001"
            } as GeneratedPlayerRatings
        ],
        [
            "147001",
            {
                playerId: "147001"
            } as GeneratedPlayerRatings
        ],
        [
            "111001",
            {
                playerId: "111001"
            } as GeneratedPlayerRatings
        ]
    ])

    public readonly mlbRosterService = {
        syncRosters: async (gameDate: string): Promise<void> => {
            this.syncRosterCalls.push(
                gameDate
            )
        },

        getTeams: async (_season: number): Promise<MlbTeam[]> =>
            this.teams
    }

    public readonly playerRatingService = {
        buildPlayerRatingsForDate: async (
            season: number,
            gameDate: string,
            pitchEnvironmentTarget: PitchEnvironmentTarget,
            playerIds: Set<string>
        ): Promise<Map<string, GeneratedPlayerRatings>> => {
            this.ratingCalls.push({
                season,
                gameDate,
                pitchEnvironmentTarget,
                playerIds
            })

            return this.ratings
        }
    }

    public readonly gameLineupService = {
        getRoster: async (
            gameDate: string,
            team: MlbTeam,
            gamePk?: number | string
        ): Promise<MlbRosterEntry[]> => {
            this.getRosterCalls.push({
                gameDate,
                team,
                gamePk
            })

            const roster = this.rosters.get(
                team.id
            )

            if (!roster) {
                throw new Error(
                    `Test roster not configured for team ${team.id}.`
                )
            }

            return roster
        },

        build: async (
            gameDate: string,
            team: MlbTeam,
            roster: MlbRosterEntry[],
            ratings: Map<string, GeneratedPlayerRatings>,
            gamePk?: number | string
        ): Promise<TeamBundle> => {
            this.buildCalls.push({
                gameDate,
                team,
                roster,
                ratings,
                gamePk
            })

            const bundle = this.bundles.get(
                team.id
            )

            if (!bundle) {
                throw new Error(
                    `Test bundle not configured for team ${team.id}.`
                )
            }

            return bundle
        }
    }

    public createRoster(team: MlbTeam): MlbRosterEntry[] {
        return [
            {
                playerId: `${team.id}001`,
                fullName: `${team.name} Player`,
                position: "P"
            } as MlbRosterEntry
        ]
    }

    public readonly pitchEnvironmentTargetService = {
        getForDate: async (_gameDate: string): Promise<PitchEnvironmentTarget> =>
            this.pitchEnvironmentTarget
    }

    public createBundle(team: MlbTeam): TeamBundle {
        return {
            team: {
                _id: String(team.id),
                name: team.name,
                abbrev: team.abbrev
            },
            players: [],
            lineup: {
                order: [],
                valid: true
            },
            startingPitcher: {
                _id: `${team.id}-starter`
            },
            availablePitchers: [],
            lineupSource: "confirmed"
        } as unknown as TeamBundle
    }

    public createService(): MlbGameBundleService {
        return new MlbGameBundleService(
            this.mlbRosterService as any,
            this.gameLineupService as any,
            this.playerRatingService as any,
            this.pitchEnvironmentTargetService as any
        )
    }

}


describe("MlbGameBundleService", function () {

    let harness: MlbGameBundleServiceTestHarness
    let service: MlbGameBundleService
    let originalGetSchedule: typeof queries.getSchedule
    let originalDataDir: string | undefined
    let dataDir: string

    beforeEach(function () {
        harness = new MlbGameBundleServiceTestHarness()

        for (const team of harness.teams) {
            harness.rosters.set(
                team.id,
                harness.createRoster(team)
            )

            harness.bundles.set(
                team.id,
                harness.createBundle(team)
            )
        }

        service = harness.createService()

        originalGetSchedule = queries.getSchedule
        originalDataDir = process.env.DATA_DIR

        dataDir = fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "mlb-game-bundle-service-"
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
                harness.pitchEnvironmentTarget
            ),
            "utf8"
        )

        process.env.DATA_DIR = dataDir
    })

    afterEach(function () {
        queries.getSchedule = originalGetSchedule

        if (originalDataDir === undefined) {
            delete process.env.DATA_DIR
        } else {
            process.env.DATA_DIR = originalDataDir
        }

        fs.rmSync(
            dataDir,
            {
                recursive: true,
                force: true
            }
        )
    })


    it("builds every scheduled game into the daily bundle", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-07-09T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: harness.gameDate,
                        games: [
                            {
                                gamePk: 1001,
                                teams: {
                                    away: {
                                        team: {
                                            id: 134
                                        }
                                    },
                                    home: {
                                        team: {
                                            id: 143
                                        }
                                    }
                                }
                            },
                            {
                                gamePk: 1002,
                                teams: {
                                    away: {
                                        team: {
                                            id: 147
                                        }
                                    },
                                    home: {
                                        team: {
                                            id: 111
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        const result = await service.build(
            harness.gameDate
        )

        assert.deepEqual(
            harness.syncRosterCalls,
            [
                harness.gameDate
            ]
        )

        assert.equal(
            harness.ratingCalls.length,
            1
        )

        assert.equal(
            result.date,
            harness.gameDate
        )

        assert.deepEqual(
            result.pitchEnvironmentTarget,
            harness.pitchEnvironmentTarget
        )

        assert.equal(
            result.games.length,
            2
        )

        assert.equal(
            result.games[0].gamePk,
            1001
        )

        assert.equal(
            result.games[0].away.team._id,
            "134"
        )

        assert.equal(
            result.games[0].home.team._id,
            "143"
        )

        assert.equal(
            result.games[1].gamePk,
            1002
        )

        assert.equal(
            result.games[1].away.team._id,
            "147"
        )

        assert.equal(
            result.games[1].home.team._id,
            "111"
        )
    })


    it("loads every game roster before building ratings", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-07-09T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: harness.gameDate,
                        games: [
                            {
                                gamePk: 1001,
                                teams: {
                                    away: {
                                        team: {
                                            id: 134
                                        }
                                    },
                                    home: {
                                        team: {
                                            id: 143
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        await service.build(
            harness.gameDate
        )

        assert.deepEqual(
            harness.getRosterCalls.map(call => ({
                gameDate: call.gameDate,
                teamId: call.team.id,
                gamePk: call.gamePk
            })),
            [
                {
                    gameDate: harness.gameDate,
                    teamId: 134,
                    gamePk: 1001
                },
                {
                    gameDate: harness.gameDate,
                    teamId: 143,
                    gamePk: 1001
                }
            ]
        )
    })


    it("builds ratings once for every player in the daily rosters", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-07-09T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: harness.gameDate,
                        games: [
                            {
                                gamePk: 1001,
                                teams: {
                                    away: {
                                        team: {
                                            id: 134
                                        }
                                    },
                                    home: {
                                        team: {
                                            id: 143
                                        }
                                    }
                                }
                            },
                            {
                                gamePk: 1002,
                                teams: {
                                    away: {
                                        team: {
                                            id: 147
                                        }
                                    },
                                    home: {
                                        team: {
                                            id: 111
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        await service.build(
            harness.gameDate
        )

        assert.equal(
            harness.ratingCalls.length,
            1
        )

        const ratingCall = harness.ratingCalls[0]

        assert.equal(
            ratingCall.season,
            2026
        )

        assert.equal(
            ratingCall.gameDate,
            harness.gameDate
        )

        assert.deepEqual(
            ratingCall.pitchEnvironmentTarget,
            harness.pitchEnvironmentTarget
        )

        assert.deepEqual(
            Array.from(ratingCall.playerIds).sort(),
            [
                "111001",
                "134001",
                "143001",
                "147001"
            ]
        )
    })


    it("builds both team bundles with their rosters and shared ratings", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-07-09T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: harness.gameDate,
                        games: [
                            {
                                gamePk: 1001,
                                teams: {
                                    away: {
                                        team: {
                                            id: 134
                                        }
                                    },
                                    home: {
                                        team: {
                                            id: 143
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        await service.build(
            harness.gameDate
        )

        assert.equal(
            harness.buildCalls.length,
            2
        )

        assert.deepEqual(
            harness.buildCalls.map(call => ({
                gameDate: call.gameDate,
                teamId: call.team.id,
                playerIds: call.roster.map(player =>
                    player.playerId
                ),
                gamePk: call.gamePk
            })),
            [
                {
                    gameDate: harness.gameDate,
                    teamId: 134,
                    playerIds: [
                        "134001"
                    ],
                    gamePk: 1001
                },
                {
                    gameDate: harness.gameDate,
                    teamId: 143,
                    playerIds: [
                        "143001"
                    ],
                    gamePk: 1001
                }
            ]
        )

        for (const call of harness.buildCalls) {
            assert.equal(
                call.ratings,
                harness.ratings
            )
        }
    })


    it("returns an empty games collection when nothing is scheduled for the date", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-07-09T12:00:00.000Z",
            data: {
                dates: []
            }
        })) as unknown as typeof queries.getSchedule

        const result = await service.build(
            harness.gameDate
        )

        assert.deepEqual(
            harness.syncRosterCalls,
            [
                harness.gameDate
            ]
        )

        assert.equal(
            harness.getRosterCalls.length,
            0
        )

        assert.equal(
            harness.ratingCalls.length,
            1
        )

        assert.deepEqual(
            Array.from(
                harness.ratingCalls[0].playerIds
            ),
            []
        )

        assert.equal(
            result.date,
            harness.gameDate
        )

        assert.deepEqual(
            result.pitchEnvironmentTarget,
            harness.pitchEnvironmentTarget
        )

        assert.deepEqual(
            result.games,
            []
        )

        assert.equal(
            harness.buildCalls.length,
            0
        )
    })


    it("throws when the season schedule does not exist", async function () {
        queries.getSchedule = (() =>
            undefined
        ) as typeof queries.getSchedule

        await assert.rejects(
            service.build(
                harness.gameDate
            ),
            /MLB schedule not found for season 2026/
        )

        assert.deepEqual(
            harness.syncRosterCalls,
            []
        )
    })


    it("throws when a scheduled team cannot be resolved", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-07-09T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: harness.gameDate,
                        games: [
                            {
                                gamePk: 1001,
                                teams: {
                                    away: {
                                        team: {
                                            id: 999
                                        }
                                    },
                                    home: {
                                        team: {
                                            id: 143
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        await assert.rejects(
            service.build(
                harness.gameDate
            ),
            /MLB team 999 for game 1001 was not found/
        )

        assert.deepEqual(
            harness.syncRosterCalls,
            [
                harness.gameDate
            ]
        )
    })



    it("throws for an invalid game date", async function () {
        await assert.rejects(
            service.build(
                "2026-02-30"
            ),
            /Invalid MLB game date: 2026-02-30/
        )

        assert.deepEqual(
            harness.syncRosterCalls,
            []
        )
    })


    it("throws when the pitch environment target cannot be loaded", async function () {
        const failingService = new MlbGameBundleService(
            harness.mlbRosterService as any,
            harness.gameLineupService as any,
            harness.playerRatingService as any,
            {
                getForDate: async () => {
                    throw new Error(
                        "Pitch environment target unavailable."
                    )
                }
            } as any
        )

        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-07-09T12:00:00.000Z",
            data: {
                dates: []
            }
        })) as unknown as typeof queries.getSchedule

        await assert.rejects(
            failingService.build(
                harness.gameDate
            ),
            /Pitch environment target unavailable/
        )
    })    

})