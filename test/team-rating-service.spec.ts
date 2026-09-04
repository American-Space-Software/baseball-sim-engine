import { strict as assert } from "assert"
import { afterEach, beforeEach, describe, it } from "mocha"

import { queries } from "baseball-database"

import { GLICKO_SETTINGS, TeamRatingService } from "../src/ratings/service/team-rating-service.js"

import type { TeamRatingSnapshot } from "../src/ratings/repository/team-rating-repository.js"


describe("TeamRatingService", function () {

    let originalGetSchedule: typeof queries.getSchedule

    beforeEach(function () {
        originalGetSchedule = queries.getSchedule
    })

    afterEach(function () {
        queries.getSchedule = originalGetSchedule
    })
    it("returns the cached prior-day snapshot without loading the schedule", async () => {
        const cached = createSnapshot("2026-04-01", {
            "10": { rating: 1525, rd: 20, vol: 0.06 },
            "20": { rating: 1475, rd: 20, vol: 0.06 }
        })

        const teamRatingRepository = new TeamRatingRepositoryStub()
        teamRatingRepository.snapshots.set(cached.date, cached)

        queries.getSchedule = (() => {
            throw new Error("Schedule should not be loaded.")
        }) as typeof queries.getSchedule

        const service = new TeamRatingService(teamRatingRepository as any)
        const actual = await service.getRatingsForDate("2026-04-02")

        assert.deepEqual(actual, cached)
        assert.equal(teamRatingRepository.puts.length, 0)
    })

    it("returns default ratings when no completed games exist before the prediction date", async () => {
        const schedule = {
            dates: [
                {
                    date: "2026-03-25",
                    games: [
                        createScheduledGame(1, 10, 20)
                    ]
                }
            ]
        }

        const teamRatingRepository = new TeamRatingRepositoryStub()
        const service = createService(schedule, teamRatingRepository)
        const snapshot = await service.getRatingsForDate("2026-03-25")

        assert.equal(snapshot.date, "2026-03-24")

        assert.deepEqual(snapshot.teams["10"], {
            rating: GLICKO_SETTINGS.rating,
            rd: GLICKO_SETTINGS.rd,
            vol: GLICKO_SETTINGS.vol
        })

        assert.deepEqual(snapshot.teams["20"], {
            rating: GLICKO_SETTINGS.rating,
            rd: GLICKO_SETTINGS.rd,
            vol: GLICKO_SETTINGS.vol
        })

        assert.equal(teamRatingRepository.puts.length, 0)
    })

    it("updates ratings from completed games before the prediction date", async () => {
        const schedule = {
            dates: [
                {
                    date: "2026-03-25",
                    games: [
                        createCompletedGame(1, 10, 20, 5, 2)
                    ]
                }
            ]
        }

        const teamRatingRepository = new TeamRatingRepositoryStub()
        const service = createService(schedule, teamRatingRepository)
        const snapshot = await service.getRatingsForDate("2026-03-26")

        const winningTeam = snapshot.teams["10"]
        const losingTeam = snapshot.teams["20"]

        assert.equal(snapshot.date, "2026-03-25")
        assert.ok(winningTeam.rating > GLICKO_SETTINGS.rating)
        assert.ok(losingTeam.rating < GLICKO_SETTINGS.rating)
        assert.ok(winningTeam.rating > losingTeam.rating)

        assert.ok(Number.isFinite(winningTeam.rd))
        assert.ok(Number.isFinite(losingTeam.rd))
        assert.ok(winningTeam.rd > 0)
        assert.ok(losingTeam.rd > 0)

        assert.ok(
            Math.abs(winningTeam.rd - losingTeam.rd) < 0.000001,
            `Expected equally initialized opponents to have matching RDs, winner=${winningTeam.rd} loser=${losingTeam.rd}.`
        )

        assert.ok(Number.isFinite(winningTeam.vol))
        assert.ok(Number.isFinite(losingTeam.vol))
        assert.ok(winningTeam.vol > 0)
        assert.ok(losingTeam.vol > 0)

        assert.equal(teamRatingRepository.puts.length, 1)
        assert.equal(teamRatingRepository.puts[0].date, "2026-03-25")
    })

    it("does not include games played on the prediction date", async () => {
        const schedule = {
            dates: [
                {
                    date: "2026-03-25",
                    games: [
                        createCompletedGame(1, 10, 20, 5, 2)
                    ]
                },
                {
                    date: "2026-03-26",
                    games: [
                        createCompletedGame(2, 20, 10, 8, 1)
                    ]
                }
            ]
        }

        const teamRatingRepository = new TeamRatingRepositoryStub()
        const service = createService(schedule, teamRatingRepository)
        const snapshot = await service.getRatingsForDate("2026-03-26")

        assert.equal(snapshot.date, "2026-03-25")
        assert.ok(snapshot.teams["10"].rating > snapshot.teams["20"].rating)
        assert.equal(teamRatingRepository.puts.length, 1)
        assert.equal(teamRatingRepository.puts[0].date, "2026-03-25")
    })

    it("processes completed dates chronologically and caches each snapshot", async () => {
        const schedule = {
            dates: [
                {
                    date: "2026-03-27",
                    games: [
                        createCompletedGame(3, 10, 30, 6, 2)
                    ]
                },
                {
                    date: "2026-03-25",
                    games: [
                        createCompletedGame(1, 10, 20, 5, 1)
                    ]
                },
                {
                    date: "2026-03-26",
                    games: [
                        createCompletedGame(2, 20, 30, 4, 3)
                    ]
                }
            ]
        }

        const teamRatingRepository = new TeamRatingRepositoryStub()
        const service = createService(schedule, teamRatingRepository)
        const snapshot = await service.getRatingsForDate("2026-03-28")

        assert.equal(snapshot.date, "2026-03-27")

        assert.deepEqual(
            teamRatingRepository.puts.map(snapshot => snapshot.date),
            [
                "2026-03-25",
                "2026-03-26",
                "2026-03-27"
            ]
        )

        assert.ok(snapshot.teams["10"].rating > snapshot.teams["20"].rating)
        assert.ok(snapshot.teams["20"].rating > snapshot.teams["30"].rating)
    })

    it("resumes after the latest cached snapshot", async () => {
        const cached = createSnapshot("2026-03-25", {
            "10": { rating: 1510, rd: 20, vol: 0.06 },
            "20": { rating: 1490, rd: 20, vol: 0.06 },
            "30": { rating: 1500, rd: 25, vol: 0.06 }
        })

        const schedule = {
            dates: [
                {
                    date: "2026-03-25",
                    games: [
                        createCompletedGame(1, 10, 20, 5, 1)
                    ]
                },
                {
                    date: "2026-03-26",
                    games: [
                        createCompletedGame(2, 20, 30, 6, 2)
                    ]
                }
            ]
        }

        const teamRatingRepository = new TeamRatingRepositoryStub()
        teamRatingRepository.snapshots.set(cached.date, cached)

        const service = createService(schedule, teamRatingRepository)
        const snapshot = await service.getRatingsForDate("2026-03-27")

        assert.equal(snapshot.date, "2026-03-26")
        assert.equal(teamRatingRepository.puts.length, 1)
        assert.equal(teamRatingRepository.puts[0].date, "2026-03-26")
        assert.equal(snapshot.teams["10"].rating, cached.teams["10"].rating)
        assert.ok(snapshot.teams["20"].rating > cached.teams["20"].rating)
        assert.ok(snapshot.teams["30"].rating < cached.teams["30"].rating)
    })

    it("submits doubleheader games in the same rating period", async () => {
        const schedule = {
            dates: [
                {
                    date: "2026-04-10",
                    games: [
                        createCompletedGame(1, 10, 20, 5, 1),
                        createCompletedGame(2, 10, 20, 2, 6)
                    ]
                }
            ]
        }

        const teamRatingRepository = new TeamRatingRepositoryStub()
        const service = createService(schedule, teamRatingRepository)
        const snapshot = await service.getRatingsForDate("2026-04-11")

        const team10 = snapshot.teams["10"]
        const team20 = snapshot.teams["20"]

        assert.equal(snapshot.date, "2026-04-10")
        assert.equal(teamRatingRepository.puts.length, 1)

        assert.ok(
            Math.abs(team10.rating - team20.rating) < 0.000001,
            `Expected split doubleheader ratings to match, team10=${team10.rating} team20=${team20.rating}.`
        )

        assert.ok(Number.isFinite(team10.rd))
        assert.ok(Number.isFinite(team20.rd))
        assert.ok(team10.rd > 0)
        assert.ok(team20.rd > 0)

        assert.ok(
            Math.abs(team10.rd - team20.rd) < 0.000001,
            `Expected split doubleheader RDs to match, team10=${team10.rd} team20=${team20.rd}.`
        )

        assert.ok(Number.isFinite(team10.vol))
        assert.ok(Number.isFinite(team20.vol))
        assert.ok(team10.vol > 0)
        assert.ok(team20.vol > 0)
    })

    it("ignores scheduled and in-progress games", async () => {
        const schedule = {
            dates: [
                {
                    date: "2026-03-25",
                    games: [
                        createScheduledGame(1, 10, 20),
                        createInProgressGame(2, 30, 40, 3, 2)
                    ]
                }
            ]
        }

        const teamRatingRepository = new TeamRatingRepositoryStub()
        const service = createService(schedule, teamRatingRepository)
        const snapshot = await service.getRatingsForDate("2026-03-26")

        for (const teamId of ["10", "20", "30", "40"]) {
            assert.deepEqual(snapshot.teams[teamId], {
                rating: GLICKO_SETTINGS.rating,
                rd: GLICKO_SETTINGS.rd,
                vol: GLICKO_SETTINGS.vol
            })
        }

        assert.equal(teamRatingRepository.puts.length, 0)
    })

    it("adds a team missing from the cached snapshot using default settings", async () => {
        const cached = createSnapshot("2026-03-25", {
            "10": { rating: 1510, rd: 20, vol: 0.06 },
            "20": { rating: 1490, rd: 20, vol: 0.06 }
        })

        const schedule = {
            dates: [
                {
                    date: "2026-03-26",
                    games: [
                        createCompletedGame(2, 10, 30, 4, 1)
                    ]
                }
            ]
        }

        const teamRatingRepository = new TeamRatingRepositoryStub()
        teamRatingRepository.snapshots.set(cached.date, cached)

        const service = createService(schedule, teamRatingRepository)
        const snapshot = await service.getRatingsForDate("2026-03-27")

        assert.ok(snapshot.teams["30"])
        assert.ok(snapshot.teams["30"].rating < GLICKO_SETTINGS.rating)
        assert.ok(snapshot.teams["10"].rating > cached.teams["10"].rating)
    })

    it("treats every completed MLB game as a win, loss, or draw rather than using run margin", async () => {
        const closeSchedule = {
            dates: [
                {
                    date: "2026-03-25",
                    games: [
                        createCompletedGame(1, 10, 20, 2, 1)
                    ]
                }
            ]
        }

        const blowoutSchedule = {
            dates: [
                {
                    date: "2026-03-25",
                    games: [
                        createCompletedGame(1, 10, 20, 20, 1)
                    ]
                }
            ]
        }

        const closeService = createService(closeSchedule, new TeamRatingRepositoryStub())
        const blowoutService = createService(blowoutSchedule, new TeamRatingRepositoryStub())

        const close = await closeService.getRatingsForDate("2026-03-26")
        const blowout = await blowoutService.getRatingsForDate("2026-03-26")

        assert.deepEqual(close.teams, blowout.teams)
    })

    it("throws for an invalid prediction date", async () => {
        const service = createService({ dates: [] }, new TeamRatingRepositoryStub())

        await assert.rejects(
            async () => await service.getRatingsForDate("2026-02-31"),
            /invalid team rating date/i
        )
    })
})


class TeamRatingRepositoryStub {
    readonly snapshots = new Map<string, TeamRatingSnapshot>()
    readonly puts: TeamRatingSnapshot[] = []

    async get(date: string): Promise<TeamRatingSnapshot | undefined> {
        const snapshot = this.snapshots.get(date)

        return snapshot
            ? structuredClone(snapshot)
            : undefined
    }

    async getLatestBefore(date: string): Promise<TeamRatingSnapshot | undefined> {
        const latestDate = Array.from(this.snapshots.keys())
            .filter(snapshotDate => snapshotDate < date)
            .sort()
            .at(-1)

        if (!latestDate) {
            return undefined
        }

        return structuredClone(this.snapshots.get(latestDate)!)
    }

    async put(snapshot: TeamRatingSnapshot): Promise<void> {
        const copy = structuredClone(snapshot)

        this.snapshots.set(copy.date, copy)
        this.puts.push(copy)
    }
}


function createService(schedule: any, teamRatingRepository: TeamRatingRepositoryStub): TeamRatingService {
    queries.getSchedule = (() => ({
        season: 2026,
        downloadedAt: "2026-01-01T00:00:00.000Z",
        data: structuredClone(schedule)
    })) as unknown as typeof queries.getSchedule

    return new TeamRatingService(
        teamRatingRepository as any
    )
}


function createSnapshot(date: string, teams: TeamRatingSnapshot["teams"]): TeamRatingSnapshot {
    return {
        date,
        teams
    }
}


function createCompletedGame(gamePk: number, awayTeamId: number, homeTeamId: number, awayScore: number, homeScore: number): any {
    return {
        gamePk,
        status: {
            abstractGameState: "Final",
            detailedState: "Final",
            codedGameState: "F"
        },
        teams: {
            away: {
                team: {
                    id: awayTeamId
                },
                score: awayScore
            },
            home: {
                team: {
                    id: homeTeamId
                },
                score: homeScore
            }
        }
    }
}


function createScheduledGame(gamePk: number, awayTeamId: number, homeTeamId: number): any {
    return {
        gamePk,
        status: {
            abstractGameState: "Preview",
            detailedState: "Scheduled",
            codedGameState: "S"
        },
        teams: {
            away: {
                team: {
                    id: awayTeamId
                }
            },
            home: {
                team: {
                    id: homeTeamId
                }
            }
        }
    }
}


function createInProgressGame(gamePk: number, awayTeamId: number, homeTeamId: number, awayScore: number, homeScore: number): any {
    return {
        gamePk,
        status: {
            abstractGameState: "Live",
            detailedState: "In Progress",
            codedGameState: "I"
        },
        teams: {
            away: {
                team: {
                    id: awayTeamId
                },
                score: awayScore
            },
            home: {
                team: {
                    id: homeTeamId
                },
                score: homeScore
            }
        }
    }
}