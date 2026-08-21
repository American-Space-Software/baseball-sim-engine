import { strict as assert } from "assert"

import { afterEach, beforeEach, describe, it } from "mocha"

import {
    queries
} from "baseball-database"



import { PitcherAppearanceService } from "../src/ratings/service/pitcher-appearance-service.js"
import type { PitcherAppearance } from "../src/ratings/repository/pitcher-appearance-repository.js"


class PitcherAppearanceServiceTestHarness {

    public readonly stored = new Map<string, PitcherAppearance[]>()

    public readonly reads: string[] = []

    public readonly writes: {
        gameDate: string
        appearances: PitcherAppearance[]
    }[] = []

    public readonly repository = {
        read: async (gameDate: string): Promise<PitcherAppearance[] | undefined> => {
            this.reads.push(
                gameDate
            )

            return this.stored.get(
                gameDate
            )
        },

        write: async (gameDate: string, appearances: PitcherAppearance[]): Promise<void> => {
            this.writes.push({
                gameDate,
                appearances
            })

            this.stored.set(
                gameDate,
                appearances
            )
        }
    }

    public createService(): PitcherAppearanceService {
        return new PitcherAppearanceService(
            this.repository as any
        )
    }

}


describe("PitcherAppearanceService", function () {

    let harness: PitcherAppearanceServiceTestHarness
    let service: PitcherAppearanceService
    let originalGetSchedule: typeof queries.getSchedule
    let originalGetGame: typeof queries.getGame

    beforeEach(function () {
        harness = new PitcherAppearanceServiceTestHarness()
        service = harness.createService()

        originalGetSchedule = queries.getSchedule
        originalGetGame = queries.getGame
    })

    afterEach(function () {
        queries.getSchedule = originalGetSchedule
        queries.getGame = originalGetGame
    })

    it("returns stored pitcher appearances without reading MLB data", async function () {
        const stored: PitcherAppearance[] = [
            {
                playerId: "100",
                playerName: "Cached Pitcher",
                gameId: "123456",
                gameDate: "2026-08-20",
                teamId: "10",
                pitches: 25,
                outs: 3,
                inningsPitched: 1,
                battersFaced: 4,
                gamesStarted: 0,
                gamesFinished: 1,
                saves: 1,
                holds: 0,
                blownSaves: 0,
                entryInning: 9
            }
        ]

        harness.stored.set(
            "2026-08-20",
            stored
        )

        let scheduleRequested = false
        let gameRequested = false

        queries.getSchedule = (() => {
            scheduleRequested = true
            return undefined
        }) as typeof queries.getSchedule

        queries.getGame = (() => {
            gameRequested = true
            return undefined
        }) as typeof queries.getGame

        const appearances = await service.getForDate(
            "2026-08-20"
        )

        assert.deepEqual(
            appearances,
            stored
        )

        assert.deepEqual(
            harness.reads,
            [
                "2026-08-20"
            ]
        )

        assert.equal(
            harness.writes.length,
            0
        )

        assert.equal(
            scheduleRequested,
            false
        )

        assert.equal(
            gameRequested,
            false
        )
    })

    it("returns an empty array when there are no games on the requested date", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-08-20T12:00:00.000Z",
            data: {
                dates: []
            }
        })) as unknown as typeof queries.getSchedule

        const appearances = await service.getForDate(
            "2026-08-20"
        )

        assert.deepEqual(
            appearances,
            []
        )

        assert.deepEqual(
            harness.writes,
            [
                {
                    gameDate: "2026-08-20",
                    appearances: []
                }
            ]
        )
    })

    it("stores built appearances so the next lookup is cached", async function () {
        let scheduleRequests = 0
        let gameRequests = 0

        queries.getSchedule = (() => {
            scheduleRequests++

            return {
                season: 2026,
                downloadedAt: "2026-08-20T12:00:00.000Z",
                data: {
                    dates: []
                }
            }
        }) as unknown as typeof queries.getSchedule

        queries.getGame = (() => {
            gameRequests++
            return undefined
        }) as typeof queries.getGame

        const first = await service.getForDate(
            "2026-08-20"
        )

        const second = await service.getForDate(
            "2026-08-20"
        )

        assert.deepEqual(
            first,
            []
        )

        assert.deepEqual(
            second,
            []
        )

        assert.equal(
            scheduleRequests,
            1
        )

        assert.equal(
            gameRequests,
            0
        )

        assert.deepEqual(
            harness.reads,
            [
                "2026-08-20",
                "2026-08-20"
            ]
        )

        assert.equal(
            harness.writes.length,
            1
        )
    })

    it("ignores games that are not complete", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-08-20T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: "2026-08-20",
                        games: [
                            {
                                gamePk: 123456,
                                status: {
                                    abstractGameState: "Live",
                                    codedGameState: "I",
                                    detailedState: "In Progress"
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        let gameRequested = false

        queries.getGame = (() => {
            gameRequested = true
            return undefined
        }) as typeof queries.getGame

        const appearances = await service.getForDate(
            "2026-08-20"
        )

        assert.deepEqual(
            appearances,
            []
        )

        assert.equal(
            gameRequested,
            false
        )

        assert.equal(
            harness.writes.length,
            1
        )
    })

    it("ignores postponed games even when another status field looks complete", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-08-20T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: "2026-06-18",
                        games: [
                            {
                                gamePk: 824911,
                                status: {
                                    abstractGameState: "Final",
                                    codedGameState: "F",
                                    detailedState: "Postponed"
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        let gameRequested = false

        queries.getGame = (() => {
            gameRequested = true
            return undefined
        }) as typeof queries.getGame

        const appearances = await service.getForDate(
            "2026-06-18"
        )

        assert.deepEqual(
            appearances,
            []
        )

        assert.equal(
            gameRequested,
            false
        )
    })

    it("ignores cancelled games", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-08-20T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: "2026-08-20",
                        games: [
                            {
                                gamePk: 123456,
                                status: {
                                    abstractGameState: "Final",
                                    codedGameState: "C",
                                    detailedState: "Cancelled"
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        let gameRequested = false

        queries.getGame = (() => {
            gameRequested = true
            return undefined
        }) as typeof queries.getGame

        const appearances = await service.getForDate(
            "2026-08-20"
        )

        assert.deepEqual(
            appearances,
            []
        )

        assert.equal(
            gameRequested,
            false
        )
    })

    it("ignores suspended games", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-08-20T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: "2026-08-20",
                        games: [
                            {
                                gamePk: 123456,
                                status: {
                                    abstractGameState: "Final",
                                    codedGameState: "F",
                                    detailedState: "Suspended"
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        let gameRequested = false

        queries.getGame = (() => {
            gameRequested = true
            return undefined
        }) as typeof queries.getGame

        const appearances = await service.getForDate(
            "2026-08-20"
        )

        assert.deepEqual(
            appearances,
            []
        )

        assert.equal(
            gameRequested,
            false
        )
    })

    it("builds and stores pitcher appearances from a completed game", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-08-20T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: "2026-08-20",
                        games: [
                            {
                                gamePk: 123456,
                                status: {
                                    abstractGameState: "Final",
                                    codedGameState: "F",
                                    detailedState: "Final"
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = (() => ({
            gamePk: 123456,
            data: {
                gameData: {
                    teams: {
                        away: {
                            id: 10
                        },
                        home: {
                            id: 20
                        }
                    }
                },
                liveData: {
                    boxscore: {
                        teams: {
                            away: {
                                team: {
                                    id: 10
                                },
                                pitchers: [
                                    100
                                ],
                                players: {
                                    ID100: {
                                        person: {
                                            id: 100,
                                            fullName: "Away Pitcher"
                                        },
                                        stats: {
                                            pitching: {
                                                numberOfPitches: 92,
                                                outs: 18,
                                                battersFaced: 24,
                                                gamesStarted: 1,
                                                gamesFinished: 0,
                                                saves: 0,
                                                holds: 0,
                                                blownSaves: 0
                                            }
                                        }
                                    }
                                }
                            },
                            home: {
                                team: {
                                    id: 20
                                },
                                pitchers: [
                                    200
                                ],
                                players: {
                                    ID200: {
                                        person: {
                                            id: 200,
                                            fullName: "Home Pitcher"
                                        },
                                        stats: {
                                            pitching: {
                                                numberOfPitches: 20,
                                                outs: 3,
                                                battersFaced: 4,
                                                gamesStarted: 0,
                                                gamesFinished: 1,
                                                saves: 1,
                                                holds: 0,
                                                blownSaves: 0
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    plays: {
                        allPlays: [
                            {
                                about: {
                                    inning: 1
                                },
                                matchup: {
                                    pitcher: {
                                        id: 100
                                    }
                                }
                            },
                            {
                                about: {
                                    inning: 9
                                },
                                matchup: {
                                    pitcher: {
                                        id: 200
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        })) as unknown as typeof queries.getGame

        const appearances = await service.getForDate(
            "2026-08-20"
        )

        const expected: PitcherAppearance[] = [
            {
                playerId: "100",
                playerName: "Away Pitcher",
                gameId: "123456",
                gameDate: "2026-08-20",
                teamId: "10",
                pitches: 92,
                outs: 18,
                inningsPitched: 6,
                battersFaced: 24,
                gamesStarted: 1,
                gamesFinished: 0,
                saves: 0,
                holds: 0,
                blownSaves: 0,
                entryInning: 1
            },
            {
                playerId: "200",
                playerName: "Home Pitcher",
                gameId: "123456",
                gameDate: "2026-08-20",
                teamId: "20",
                pitches: 20,
                outs: 3,
                inningsPitched: 1,
                battersFaced: 4,
                gamesStarted: 0,
                gamesFinished: 1,
                saves: 1,
                holds: 0,
                blownSaves: 0,
                entryInning: 9
            }
        ]

        assert.deepEqual(
            appearances,
            expected
        )

        assert.deepEqual(
            harness.writes,
            [
                {
                    gameDate: "2026-08-20",
                    appearances: expected
                }
            ]
        )
    })

    it("does not include boxscore players who did not pitch", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-08-20T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: "2026-08-20",
                        games: [
                            {
                                gamePk: 123456,
                                status: {
                                    abstractGameState: "Final",
                                    codedGameState: "F",
                                    detailedState: "Final"
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = (() => ({
            gamePk: 123456,
            data: {
                gameData: {
                    teams: {
                        away: {
                            id: 10
                        },
                        home: {
                            id: 20
                        }
                    }
                },
                liveData: {
                    boxscore: {
                        teams: {
                            away: {
                                team: {
                                    id: 10
                                },
                                pitchers: [
                                    100
                                ],
                                players: {
                                    ID100: {
                                        person: {
                                            id: 100,
                                            fullName: "Pitcher"
                                        },
                                        stats: {
                                            pitching: {
                                                numberOfPitches: 15,
                                                outs: 3,
                                                battersFaced: 4
                                            }
                                        }
                                    },
                                    ID101: {
                                        person: {
                                            id: 101,
                                            fullName: "Position Player"
                                        },
                                        stats: {
                                            batting: {
                                                atBats: 4
                                            }
                                        }
                                    }
                                }
                            },
                            home: {
                                team: {
                                    id: 20
                                },
                                pitchers: [],
                                players: {}
                            }
                        }
                    },
                    plays: {
                        allPlays: []
                    }
                }
            }
        })) as unknown as typeof queries.getGame

        const appearances = await service.getForDate(
            "2026-08-20"
        )

        assert.equal(
            appearances.length,
            1
        )

        assert.equal(
            appearances[0].playerId,
            "100"
        )
    })

    it("converts innings pitched to outs when direct outs are unavailable", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-08-20T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: "2026-08-20",
                        games: [
                            {
                                gamePk: 123456,
                                status: {
                                    abstractGameState: "Final",
                                    codedGameState: "F",
                                    detailedState: "Final"
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = (() => ({
            gamePk: 123456,
            data: {
                gameData: {
                    teams: {
                        away: {
                            id: 10
                        },
                        home: {
                            id: 20
                        }
                    }
                },
                liveData: {
                    boxscore: {
                        teams: {
                            away: {
                                team: {
                                    id: 10
                                },
                                pitchers: [
                                    100
                                ],
                                players: {
                                    ID100: {
                                        person: {
                                            id: 100,
                                            fullName: "Pitcher"
                                        },
                                        stats: {
                                            pitching: {
                                                numberOfPitches: 50,
                                                inningsPitched: "5.2",
                                                battersFaced: 20
                                            }
                                        }
                                    }
                                }
                            },
                            home: {
                                team: {
                                    id: 20
                                },
                                pitchers: [],
                                players: {}
                            }
                        }
                    },
                    plays: {
                        allPlays: []
                    }
                }
            }
        })) as unknown as typeof queries.getGame

        const appearances = await service.getForDate(
            "2026-08-20"
        )

        assert.equal(
            appearances[0].outs,
            17
        )

        assert.equal(
            appearances[0].inningsPitched,
            17 / 3
        )
    })

    it("throws when the stored schedule does not exist", async function () {
        queries.getSchedule = (() =>
            undefined
        ) as typeof queries.getSchedule

        await assert.rejects(
            service.getForDate(
                "2026-08-20"
            ),
            /MLB schedule not found for season 2026/
        )

        assert.equal(
            harness.writes.length,
            0
        )
    })

    it("throws when a completed scheduled game feed is missing", async function () {
        queries.getSchedule = (() => ({
            season: 2026,
            downloadedAt: "2026-08-20T12:00:00.000Z",
            data: {
                dates: [
                    {
                        date: "2026-08-20",
                        games: [
                            {
                                gamePk: 123456,
                                status: {
                                    abstractGameState: "Final",
                                    codedGameState: "F",
                                    detailedState: "Final"
                                }
                            }
                        ]
                    }
                ]
            }
        })) as unknown as typeof queries.getSchedule

        queries.getGame = (() =>
            undefined
        ) as typeof queries.getGame

        await assert.rejects(
            service.getForDate(
                "2026-08-20"
            ),
            /MLB game feed 123456 was not found/
        )

        assert.equal(
            harness.writes.length,
            0
        )
    })

})