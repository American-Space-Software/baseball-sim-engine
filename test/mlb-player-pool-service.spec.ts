import assert from "node:assert/strict"

import {
    MlbPlayerPoolService
} from "../src/ratings/service/mlb-player-pool-service.js"

import type {
    PlayerRatingsRepository,
    PlayerRatingsRow
} from "../src/ratings/repository/player-ratings-repository.js"

import type {
    MlbRosterService,
    MlbTeam,
    MlbTeamRoster
} from "../src/ratings/service/mlb-roster-service.js"


function createRatings(
    playerId: string,
    firstName: string,
    lastName: string
): PlayerRatingsRow {
    return {
        playerId,
        firstName,
        lastName,
        primaryPosition: "1B",
        age: 27,
        throws: "R",
        hits: "R",
        overallRating: 100,
        hittingRatings: {
            speed: 100,
            steals: 100,
            defense: 100,
            arm: 100
        },
        pitchRatings: {
            power: 100
        }
    }
}


function createTeam(
    id: number,
    name: string,
    abbrev: string
): MlbTeam {
    return {
        id,
        name,
        abbrev,
        colors: {
            color1: "#000000",
            color2: "#FFFFFF"
        }
    }
}


describe("MlbPlayerPoolService", function () {

    const gameDate = "2026-07-20"

    let ratings: PlayerRatingsRow[]
    let rosters: MlbTeamRoster[]
    let ratingsReadDates: string[]
    let rosterDates: string[]
    let service: MlbPlayerPoolService

    beforeEach(function () {
        ratings = []
        rosters = []
        ratingsReadDates = []
        rosterDates = []

        const playerRatingsRepository = {
            read: async (date: string): Promise<PlayerRatingsRow[]> => {
                ratingsReadDates.push(
                    date
                )

                return ratings
            }
        } as unknown as PlayerRatingsRepository

        const mlbRosterService = {
            getRosters: async (date: string): Promise<MlbTeamRoster[]> => {
                rosterDates.push(
                    date
                )

                return rosters
            }
        } as unknown as MlbRosterService

        service = new MlbPlayerPoolService(
            playerRatingsRepository,
            mlbRosterService
        )
    })


    it("builds the player pool for the requested date", async function () {
        ratings = [
            createRatings(
                "1",
                "First",
                "Player"
            ),
            createRatings(
                "2",
                "Second",
                "Player"
            )
        ]

        const result = await service.build(
            gameDate
        )

        assert.equal(
            result.date,
            gameDate
        )

        assert.equal(
            result.players.length,
            2
        )

        assert.deepEqual(
            ratingsReadDates,
            [
                gameDate
            ]
        )

        assert.deepEqual(
            rosterDates,
            [
                gameDate
            ]
        )
    })


    it("assigns a team to a player on an MLB roster", async function () {
        const team = createTeam(
            147,
            "New York Yankees",
            "NYY"
        )

        ratings = [
            createRatings(
                "1",
                "First",
                "Player"
            )
        ]

        rosters = [
            {
                team,
                players: [
                    {
                        playerId: "1",
                        fullName: "First Player",
                        position: "1B" as any
                    }
                ]
            }
        ]

        const result = await service.build(
            gameDate
        )

        assert.deepEqual(
            result.players[0].team,
            team
        )
    })


    it("leaves players without an MLB roster assignment unassigned", async function () {
        ratings = [
            createRatings(
                "1",
                "First",
                "Player"
            ),
            createRatings(
                "2",
                "Second",
                "Player"
            )
        ]

        const team = createTeam(
            147,
            "New York Yankees",
            "NYY"
        )

        rosters = [
            {
                team,
                players: [
                    {
                        playerId: "1",
                        fullName: "First Player",
                        position: "1B" as any
                    }
                ]
            }
        ]

        const result = await service.build(
            gameDate
        )

        assert.deepEqual(
            result.players[0].team,
            team
        )

        assert.equal(
            result.players[1].team,
            undefined
        )
    })


    it("includes rated players even when they do not appear on any roster", async function () {
        ratings = [
            createRatings(
                "1",
                "First",
                "Player"
            ),
            createRatings(
                "2",
                "Second",
                "Player"
            ),
            createRatings(
                "3",
                "Third",
                "Player"
            )
        ]

        rosters = []

        const result = await service.build(
            gameDate
        )

        assert.deepEqual(
            result.players.map(player => player.playerId),
            [
                "1",
                "2",
                "3"
            ]
        )

        assert.ok(
            result.players.every(player =>
                player.team === undefined
            )
        )
    })


    it("does not add roster players that do not have ratings", async function () {
        const team = createTeam(
            147,
            "New York Yankees",
            "NYY"
        )

        ratings = [
            createRatings(
                "1",
                "First",
                "Player"
            )
        ]

        rosters = [
            {
                team,
                players: [
                    {
                        playerId: "1",
                        fullName: "First Player",
                        position: "1B" as any
                    },
                    {
                        playerId: "999",
                        fullName: "Roster Only Player",
                        position: "P" as any
                    }
                ]
            }
        ]

        const result = await service.build(
            gameDate
        )

        assert.deepEqual(
            result.players.map(player => player.playerId),
            [
                "1"
            ]
        )
    })


    it("assigns players from different rosters to their correct teams", async function () {
        const yankees = createTeam(
            147,
            "New York Yankees",
            "NYY"
        )

        const redSox = createTeam(
            111,
            "Boston Red Sox",
            "BOS"
        )

        ratings = [
            createRatings(
                "1",
                "First",
                "Player"
            ),
            createRatings(
                "2",
                "Second",
                "Player"
            ),
            createRatings(
                "3",
                "Third",
                "Player"
            )
        ]

        rosters = [
            {
                team: yankees,
                players: [
                    {
                        playerId: "1",
                        fullName: "First Player",
                        position: "1B" as any
                    }
                ]
            },
            {
                team: redSox,
                players: [
                    {
                        playerId: "2",
                        fullName: "Second Player",
                        position: "P" as any
                    }
                ]
            }
        ]

        const result = await service.build(
            gameDate
        )

        assert.deepEqual(
            result.players[0].team,
            yankees
        )

        assert.deepEqual(
            result.players[1].team,
            redSox
        )

        assert.equal(
            result.players[2].team,
            undefined
        )
    })


    it("preserves all player rating data", async function () {
        const player = createRatings(
            "1",
            "First",
            "Player"
        )

        player.overallRating = 123
        player.age = 31
        player.primaryPosition = "RF"
        player.throws = "L"
        player.hits = "L"
        player.hittingRatings = {
            speed: 111,
            steals: 112,
            defense: 113,
            arm: 114
        }
        player.pitchRatings = {
            power: 115
        }

        ratings = [
            player
        ]

        const result = await service.build(
            gameDate
        )

        assert.deepEqual(
            result.players[0],
            {
                ...player,
                team: undefined
            }
        )
    })


    it("returns an empty player pool when there are no ratings", async function () {
        ratings = []

        rosters = [
            {
                team: createTeam(
                    147,
                    "New York Yankees",
                    "NYY"
                ),
                players: [
                    {
                        playerId: "1",
                        fullName: "First Player",
                        position: "1B" as any
                    }
                ]
            }
        ]

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
    })

})