import assert from "assert"

import {
    PitchingRoleType
} from "baseball-sim-engine"

import type {
    PitcherAppearanceService
} from "../src/ratings/service/pitcher-appearance-service.js"

import { PitcherWorkloadService } from "../src/ratings/service/pitcher-workload-service.js"
import type { PitcherAppearance } from "../src/ratings/repository/pitcher-appearance-repository.js"


interface TestPitcherAppearance {
    playerId: string
    playerName?: string
    pitches?: number
    outs?: number
    inningsPitched?: string
    battersFaced?: number
    gamesStarted?: number
    gamesFinished?: number
    saves?: number
    holds?: number
    blownSaves?: number
    entryInning?: number
}

interface TestGameFeedOptions {
    awayTeamId?: number
    homeTeamId?: number
    awayPitchers?: TestPitcherAppearance[]
    homePitchers?: TestPitcherAppearance[]
}


class PitcherWorkloadTestHarness {

    public buildScheduledGame(gamePk: number | string): any {
        return {
            gamePk,
            status: {
                abstractGameState: "Final",
                detailedState: "Final",
                codedGameState: "F"
            }
        }
    }

    public buildGameFeed(options: TestGameFeedOptions): any {
        const awayTeamId = options.awayTeamId ?? 1
        const homeTeamId = options.homeTeamId ?? 2
        const awayPitchers = options.awayPitchers ?? []
        const homePitchers = options.homePitchers ?? []

        return {
            gameData: {
                teams: {
                    away: {
                        id: awayTeamId
                    },
                    home: {
                        id: homeTeamId
                    }
                }
            },
            liveData: {
                boxscore: {
                    teams: {
                        away: this.buildBoxscoreTeam(
                            awayTeamId,
                            awayPitchers
                        ),
                        home: this.buildBoxscoreTeam(
                            homeTeamId,
                            homePitchers
                        )
                    }
                },
                plays: {
                    allPlays: [
                        ...this.buildPitcherPlays(
                            awayPitchers
                        ),
                        ...this.buildPitcherPlays(
                            homePitchers
                        )
                    ]
                }
            }
        }
    }

    public buildSingleGameData(gameDate: string, gamePk: number | string, pitchers: TestPitcherAppearance[], teamId: number = 1): {
        gamesByDate: Record<string, any[]>
        feedsById: Record<string, any>
    } {
        return {
            gamesByDate: {
                [gameDate]: [
                    this.buildScheduledGame(
                        gamePk
                    )
                ]
            },
            feedsById: {
                [String(gamePk)]: this.buildGameFeed({
                    awayTeamId: teamId,
                    awayPitchers: pitchers
                })
            }
        }
    }

    public buildService(gamesByDate: Record<string, any[]>, feedsById: Record<string, any>): PitcherWorkloadService {
        const appearancesByDate = new Map<string, PitcherAppearance[]>()

        for (const [gameDate, scheduledGames] of Object.entries(gamesByDate)) {
            const appearances: PitcherAppearance[] = []

            for (const scheduledGame of scheduledGames) {
                const gamePk = String(
                    scheduledGame?.gamePk ??
                    ""
                )

                const feed = feedsById[gamePk]

                if (!feed) {
                    continue
                }

                appearances.push(
                    ...this.getPitcherAppearances(
                        feed,
                        gamePk,
                        gameDate
                    )
                )
            }

            appearancesByDate.set(
                gameDate,
                appearances
            )
        }

        const pitcherAppearanceService = {
            getForDate: async (gameDate: string): Promise<PitcherAppearance[]> =>
                structuredClone(
                    appearancesByDate.get(gameDate) ??
                    []
                )
        } as PitcherAppearanceService

        return new PitcherWorkloadService(
            pitcherAppearanceService
        )
    }

    public getRole(roles: Awaited<ReturnType<PitcherWorkloadService["getBullpenRoles"]>>, role: PitchingRoleType, priority: number = 1) {
        return roles.find(assignment =>
            assignment.role === role &&
            assignment.priority === priority
        )
    }

    public assertValidBullpenRoles(roles: Awaited<ReturnType<PitcherWorkloadService["getBullpenRoles"]>>, expectedPitcherIds: string[]): void {
        assert.equal(
            roles.length,
            expectedPitcherIds.length
        )

        assert.equal(
            new Set(
                roles.map(role =>
                    role.playerId
                )
            ).size,
            roles.length
        )

        assert.deepEqual(
            roles
                .map(role =>
                    role.playerId
                )
                .sort(),
            [...expectedPitcherIds].sort()
        )

        const requiredRoles = [
            PitchingRoleType.CLOSER,
            PitchingRoleType.SETUP,
            PitchingRoleType.MIDDLE,
            PitchingRoleType.LONG,
            PitchingRoleType.MOP_UP
        ]

        for (const role of requiredRoles) {
            const assignments = roles
                .filter(assignment =>
                    assignment.role === role
                )
                .sort((a, b) =>
                    a.priority -
                    b.priority
                )

            assert.ok(
                assignments.length > 0,
                `No ${role} assignment was created.`
            )

            assignments.forEach((assignment, index) => {
                assert.equal(
                    assignment.priority,
                    index + 1
                )

                assert.equal(
                    assignment.profile.playerId,
                    assignment.playerId
                )

                assert.equal(
                    assignment.workload.playerId,
                    assignment.playerId
                )
            })
        }
    }

    private getPitcherAppearances(feed: any, gameId: string, gameDate: string): PitcherAppearance[] {
        const appearances: PitcherAppearance[] = []

        for (const side of [
            "away",
            "home"
        ] as const) {
            const boxscoreTeam = feed?.liveData?.boxscore?.teams?.[side]

            const teamId = String(
                boxscoreTeam?.team?.id ??
                feed?.gameData?.teams?.[side]?.id ??
                ""
            )

            const pitcherIds = new Set(
                (boxscoreTeam?.pitchers ?? []).map(
                    (playerId: number | string) =>
                        String(playerId)
                )
            )

            for (const boxscorePlayer of Object.values(boxscoreTeam?.players ?? {}) as any[]) {
                const playerId = String(
                    boxscorePlayer?.person?.id ??
                    ""
                )

                if (
                    !playerId ||
                    !pitcherIds.has(playerId)
                ) {
                    continue
                }

                const pitching = boxscorePlayer?.stats?.pitching ?? {}
                const pitches = this.getNumber(
                    pitching.numberOfPitches ??
                    pitching.pitches
                )

                const outs = this.getPitchingOuts(
                    pitching
                )

                const battersFaced = this.getNumber(
                    pitching.battersFaced
                )

                if (
                    pitches <= 0 &&
                    outs <= 0 &&
                    battersFaced <= 0
                ) {
                    continue
                }

                appearances.push({
                    playerId,
                    playerName: String(
                        boxscorePlayer?.person?.fullName ??
                        playerId
                    ),
                    gameId,
                    gameDate,
                    teamId,
                    pitches,
                    outs,
                    inningsPitched: outs / 3,
                    battersFaced,
                    gamesStarted: this.getNumber(
                        pitching.gamesStarted
                    ),
                    gamesFinished: this.getNumber(
                        pitching.gamesFinished
                    ),
                    saves: this.getNumber(
                        pitching.saves
                    ),
                    holds: this.getNumber(
                        pitching.holds
                    ),
                    blownSaves: this.getNumber(
                        pitching.blownSaves
                    ),
                    entryInning: this.getPitcherEntryInning(
                        feed,
                        playerId
                    )
                })
            }
        }

        return appearances
    }

    private getPitcherEntryInning(feed: any, playerId: string): number | undefined {
        for (const play of feed?.liveData?.plays?.allPlays ?? []) {
            if (
                String(
                    play?.matchup?.pitcher?.id ??
                    ""
                ) !== playerId
            ) {
                continue
            }

            const inning = Number(
                play?.about?.inning
            )

            if (
                Number.isFinite(inning) &&
                inning > 0
            ) {
                return inning
            }
        }

        return undefined
    }

    private getPitchingOuts(pitching: any): number {
        const directOuts = this.getNumber(
            pitching?.outs ??
            pitching?.outsRecorded
        )

        if (directOuts > 0) {
            return directOuts
        }

        const inningsPitched = String(
            pitching?.inningsPitched ??
            pitching?.ip ??
            "0.0"
        )

        const [
            wholeInningsText,
            partialOutsText = "0"
        ] = inningsPitched.split(".")

        return this.getNumber(
            wholeInningsText
        ) * 3 +
            this.getNumber(
                partialOutsText
            )
    }

    private buildBoxscoreTeam(teamId: number, appearances: TestPitcherAppearance[]): any {
        const players: Record<string, any> = {}
        const pitcherIds: string[] = []

        for (const appearance of appearances) {
            const playerId = String(
                appearance.playerId
            )

            pitcherIds.push(
                playerId
            )

            players[`ID${playerId}`] = {
                person: {
                    id: Number(playerId),
                    fullName:
                        appearance.playerName ??
                        `Pitcher ${playerId}`
                },
                stats: {
                    pitching: this.buildPitchingStats(
                        appearance
                    )
                }
            }
        }

        return {
            team: {
                id: teamId
            },
            pitchers: pitcherIds,
            players
        }
    }

    private buildPitchingStats(appearance: TestPitcherAppearance): any {
        const stats: any = {
            numberOfPitches:
                appearance.pitches ??
                0,
            battersFaced:
                appearance.battersFaced ??
                0,
            gamesStarted:
                appearance.gamesStarted ??
                0,
            gamesFinished:
                appearance.gamesFinished ??
                0,
            saves:
                appearance.saves ??
                0,
            holds:
                appearance.holds ??
                0,
            blownSaves:
                appearance.blownSaves ??
                0
        }

        if (appearance.outs !== undefined) {
            stats.outs = appearance.outs
        }

        if (appearance.inningsPitched !== undefined) {
            stats.inningsPitched = appearance.inningsPitched
        }

        return stats
    }

    private buildPitcherPlays(appearances: TestPitcherAppearance[]): any[] {
        return appearances
            .filter(appearance =>
                appearance.entryInning !== undefined
            )
            .map(appearance => ({
                about: {
                    inning:
                        appearance.entryInning
                },
                matchup: {
                    pitcher: {
                        id: Number(
                            appearance.playerId
                        )
                    }
                }
            }))
    }

    private getNumber(value: unknown): number {
        const number = Number(
            value ??
            0
        )

        return Number.isFinite(number)
            ? number
            : 0
    }

}


const harness = new PitcherWorkloadTestHarness()

describe("PitcherWorkloadService workloads", function () {
    it("returns an empty workload when the pitcher did not appear in the previous five days", async () => {
        const service = harness.buildService({}, {})
        const workload = await service.getPitcherWorkload("2026-07-14", "100")

        assert.equal(workload.playerId, "100")
        assert.deepEqual(workload.appearances, [])
        assert.equal(workload.lastAppearanceDate, undefined)
        assert.equal(workload.lastAppearancePitchCount, 0)
        assert.equal(workload.daysSinceLastAppearance, undefined)
        assert.equal(workload.appearancesYesterday, 0)
        assert.equal(workload.appearancesLastThreeDays, 0)
        assert.equal(workload.appearancesLastFiveDays, 0)
        assert.equal(workload.consecutiveDaysPitched, 0)
        assert.equal(workload.pitchesYesterday, 0)
        assert.equal(workload.pitchesLastThreeDays, 0)
        assert.equal(workload.pitchesLastFiveDays, 0)
    })

    it("collects a pitcher appearance from yesterday", async () => {
        const data = harness.buildSingleGameData("2026-07-13", 1001, [
            {
                playerId: "200",
                playerName: "Test Pitcher",
                pitches: 18,
                outs: 3,
                battersFaced: 4
            }
        ])

        const service = harness.buildService(data.gamesByDate, data.feedsById)
        const workload = await service.getPitcherWorkload("2026-07-14", "200")

        assert.equal(workload.appearances.length, 1)

        assert.deepEqual(workload.appearances[0], {
            playerId: "200",
            playerName: "Test Pitcher",
            gameId: "1001",
            gameDate: "2026-07-13",
            teamId: "1",
            pitches: 18,
            outs: 3,
            inningsPitched: 1,
            battersFaced: 4,
            gamesStarted: 0,
            gamesFinished: 0,
            saves: 0,
            holds: 0,
            blownSaves: 0,
            entryInning: undefined
        })

        assert.equal(workload.lastAppearanceDate, "2026-07-13")
        assert.equal(workload.lastAppearancePitchCount, 18)
        assert.equal(workload.daysSinceLastAppearance, 1)
        assert.equal(workload.appearancesYesterday, 1)
        assert.equal(workload.appearancesLastThreeDays, 1)
        assert.equal(workload.appearancesLastFiveDays, 1)
        assert.equal(workload.consecutiveDaysPitched, 1)
        assert.equal(workload.pitchesYesterday, 18)
        assert.equal(workload.pitchesLastThreeDays, 18)
        assert.equal(workload.pitchesLastFiveDays, 18)
    })

    it("collects appearances across the full five-day window", async () => {
        const gamesByDate = {
            "2026-07-13": [harness.buildScheduledGame(1101)],
            "2026-07-12": [harness.buildScheduledGame(1102)],
            "2026-07-10": [harness.buildScheduledGame(1103)],
            "2026-07-09": [harness.buildScheduledGame(1104)]
        }

        const feedsById = {
            "1101": harness.buildGameFeed({
                awayPitchers: [{ playerId: "201", pitches: 12, outs: 3, battersFaced: 4 }]
            }),
            "1102": harness.buildGameFeed({
                homePitchers: [{ playerId: "201", pitches: 16, outs: 4, battersFaced: 6 }]
            }),
            "1103": harness.buildGameFeed({
                awayPitchers: [{ playerId: "201", pitches: 21, outs: 6, battersFaced: 8 }]
            }),
            "1104": harness.buildGameFeed({
                homePitchers: [{ playerId: "201", pitches: 25, outs: 7, battersFaced: 10 }]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)
        const workload = await service.getPitcherWorkload("2026-07-14", "201")

        assert.equal(workload.appearances.length, 4)

        assert.deepEqual(
            workload.appearances.map(appearance => appearance.gameDate),
            ["2026-07-09", "2026-07-10", "2026-07-12", "2026-07-13"]
        )

        assert.equal(workload.lastAppearanceDate, "2026-07-13")
        assert.equal(workload.lastAppearancePitchCount, 12)
        assert.equal(workload.daysSinceLastAppearance, 1)
        assert.equal(workload.appearancesYesterday, 1)
        assert.equal(workload.appearancesLastThreeDays, 2)
        assert.equal(workload.appearancesLastFiveDays, 4)
        assert.equal(workload.pitchesYesterday, 12)
        assert.equal(workload.pitchesLastThreeDays, 28)
        assert.equal(workload.pitchesLastFiveDays, 74)
    })

    it("counts consecutive pitching days until the first day without an appearance", async () => {
        const gamesByDate = {
            "2026-07-13": [harness.buildScheduledGame(1201)],
            "2026-07-12": [harness.buildScheduledGame(1202)],
            "2026-07-11": [harness.buildScheduledGame(1203)],
            "2026-07-09": [harness.buildScheduledGame(1204)]
        }

        const feedsById = {
            "1201": harness.buildGameFeed({
                awayPitchers: [{ playerId: "202", pitches: 10, outs: 3, battersFaced: 3 }]
            }),
            "1202": harness.buildGameFeed({
                awayPitchers: [{ playerId: "202", pitches: 12, outs: 3, battersFaced: 4 }]
            }),
            "1203": harness.buildGameFeed({
                awayPitchers: [{ playerId: "202", pitches: 9, outs: 2, battersFaced: 3 }]
            }),
            "1204": harness.buildGameFeed({
                awayPitchers: [{ playerId: "202", pitches: 20, outs: 5, battersFaced: 7 }]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)
        const workload = await service.getPitcherWorkload("2026-07-14", "202")

        assert.equal(workload.consecutiveDaysPitched, 3)
        assert.equal(workload.appearancesLastFiveDays, 4)
    })

    it("combines multiple appearances from a doubleheader", async () => {
        const gamesByDate = {
            "2026-07-13": [
                harness.buildScheduledGame(1301),
                harness.buildScheduledGame(1302)
            ]
        }

        const feedsById = {
            "1301": harness.buildGameFeed({
                awayPitchers: [{ playerId: "203", pitches: 11, outs: 2, battersFaced: 3 }]
            }),
            "1302": harness.buildGameFeed({
                homePitchers: [{ playerId: "203", pitches: 17, outs: 4, battersFaced: 6 }]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)
        const workload = await service.getPitcherWorkload("2026-07-14", "203")

        assert.equal(workload.appearances.length, 2)
        assert.equal(workload.appearancesYesterday, 2)
        assert.equal(workload.pitchesYesterday, 28)
        assert.equal(workload.pitchesLastThreeDays, 28)
        assert.equal(workload.pitchesLastFiveDays, 28)
        assert.equal(workload.consecutiveDaysPitched, 1)

        assert.deepEqual(
            workload.appearances.map(appearance => appearance.gameId),
            ["1301", "1302"]
        )
    })

    it("tracks workload across teams after a trade", async () => {
        const gamesByDate = {
            "2026-07-12": [harness.buildScheduledGame(1401)],
            "2026-07-13": [harness.buildScheduledGame(1402)]
        }

        const feedsById = {
            "1401": harness.buildGameFeed({
                awayTeamId: 10,
                homeTeamId: 11,
                awayPitchers: [{ playerId: "204", pitches: 24, outs: 5, battersFaced: 7 }]
            }),
            "1402": harness.buildGameFeed({
                awayTeamId: 20,
                homeTeamId: 21,
                homePitchers: [{ playerId: "204", pitches: 14, outs: 3, battersFaced: 4 }]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)
        const workload = await service.getPitcherWorkload("2026-07-14", "204")

        assert.deepEqual(
            workload.appearances.map(appearance => appearance.teamId),
            ["10", "21"]
        )

        assert.equal(workload.pitchesYesterday, 14)
        assert.equal(workload.pitchesLastThreeDays, 38)
        assert.equal(workload.pitchesLastFiveDays, 38)
        assert.equal(workload.consecutiveDaysPitched, 2)
    })

    it("returns workloads only for requested pitchers", async () => {
        const data = harness.buildSingleGameData("2026-07-13", 1501, [
            { playerId: "205", pitches: 8, outs: 2, battersFaced: 3 },
            { playerId: "206", pitches: 19, outs: 4, battersFaced: 6 },
            { playerId: "999", pitches: 30, outs: 6, battersFaced: 9 }
        ])

        const service = harness.buildService(data.gamesByDate, data.feedsById)
        const workloads = await service.getPitcherWorkloads("2026-07-14", ["205", "206", "207"])

        assert.equal(workloads.size, 3)
        assert.equal(workloads.get("205")?.pitchesYesterday, 8)
        assert.equal(workloads.get("206")?.pitchesYesterday, 19)
        assert.equal(workloads.get("207")?.pitchesYesterday, 0)
        assert.equal(workloads.has("999"), false)
    })

    it("ignores players who were not listed in the boxscore pitchers array", async () => {
        const feed = harness.buildGameFeed({
            awayPitchers: [{ playerId: "208", pitches: 13, outs: 3, battersFaced: 4 }]
        })

        feed.liveData.boxscore.teams.away.players.ID209 = {
            person: {
                id: 209,
                fullName: "Position Player"
            },
            stats: {
                pitching: {
                    numberOfPitches: 5,
                    outs: 1,
                    battersFaced: 1
                }
            }
        }

        const gamesByDate = {
            "2026-07-13": [harness.buildScheduledGame(1601)]
        }

        const feedsById = {
            "1601": feed
        }

        const service = harness.buildService(gamesByDate, feedsById)
        const workloads = await service.getPitcherWorkloads("2026-07-14", ["208", "209"])

        assert.equal(workloads.get("208")?.appearances.length, 1)
        assert.equal(workloads.get("209")?.appearances.length, 0)
    })

    it("ignores pitching entries with no pitches, outs, or batters faced", async () => {
        const data = harness.buildSingleGameData("2026-07-13", 1701, [
            { playerId: "210", pitches: 0, outs: 0, battersFaced: 0 }
        ])

        const service = harness.buildService(data.gamesByDate, data.feedsById)
        const workload = await service.getPitcherWorkload("2026-07-14", "210")

        assert.deepEqual(workload.appearances, [])
        assert.equal(workload.pitchesLastFiveDays, 0)
    })

    it("calculates outs from inningsPitched when direct outs are absent", async () => {
        const data = harness.buildSingleGameData("2026-07-13", 1801, [
            {
                playerId: "211",
                pitches: 27,
                inningsPitched: "2.2",
                battersFaced: 10
            }
        ])

        const service = harness.buildService(data.gamesByDate, data.feedsById)
        const workload = await service.getPitcherWorkload("2026-07-14", "211")

        assert.equal(workload.appearances.length, 1)
        assert.equal(workload.appearances[0].outs, 8)
        assert.equal(workload.appearances[0].inningsPitched, 8 / 3)
    })

    it("does not include appearances from the target game date", async () => {
        const gamesByDate = {
            "2026-07-14": [harness.buildScheduledGame(1901)],
            "2026-07-13": [harness.buildScheduledGame(1902)]
        }

        const feedsById = {
            "1901": harness.buildGameFeed({
                awayPitchers: [{ playerId: "212", pitches: 40, outs: 6, battersFaced: 9 }]
            }),
            "1902": harness.buildGameFeed({
                awayPitchers: [{ playerId: "212", pitches: 15, outs: 3, battersFaced: 4 }]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)
        const workload = await service.getPitcherWorkload("2026-07-14", "212")

        assert.equal(workload.appearances.length, 1)
        assert.equal(workload.appearances[0].gameId, "1902")
        assert.equal(workload.pitchesYesterday, 15)
    })

    it("handles a five-day window that crosses into the previous year", async () => {
        const gamesByDate = {
            "2025-12-31": [harness.buildScheduledGame(2001)],
            "2025-12-30": [harness.buildScheduledGame(2002)]
        }

        const feedsById = {
            "2001": harness.buildGameFeed({
                awayPitchers: [{ playerId: "213", pitches: 17, outs: 3, battersFaced: 4 }]
            }),
            "2002": harness.buildGameFeed({
                homePitchers: [{ playerId: "213", pitches: 22, outs: 5, battersFaced: 7 }]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)
        const workload = await service.getPitcherWorkload("2026-01-01", "213")

        assert.equal(workload.appearances.length, 2)
        assert.equal(workload.pitchesYesterday, 17)
        assert.equal(workload.pitchesLastThreeDays, 39)
        assert.equal(workload.pitchesLastFiveDays, 39)
        assert.equal(workload.consecutiveDaysPitched, 2)
    })
})

describe("PitcherWorkloadService bullpen roles", function () {
    it("synthesizes a complete bullpen from recent role usage", async () => {
        const data = harness.buildSingleGameData("2026-07-13", 3001, [
            {
                playerId: "301",
                pitches: 15,
                outs: 3,
                battersFaced: 4,
                gamesFinished: 1,
                saves: 1,
                entryInning: 9
            },
            {
                playerId: "302",
                pitches: 14,
                outs: 3,
                battersFaced: 4,
                holds: 1,
                entryInning: 8
            },
            {
                playerId: "303",
                pitches: 42,
                outs: 9,
                battersFaced: 12,
                entryInning: 5
            },
            {
                playerId: "304",
                pitches: 18,
                outs: 3,
                battersFaced: 5,
                entryInning: 3
            },
            {
                playerId: "305",
                pitches: 17,
                outs: 3,
                battersFaced: 5,
                entryInning: 6
            },
            {
                playerId: "306",
                pitches: 16,
                outs: 3,
                battersFaced: 4,
                entryInning: 7
            }
        ])

        const service = harness.buildService(data.gamesByDate, data.feedsById)
        const playerIds = ["301", "302", "303", "304", "305", "306"]
        const roles = await service.getBullpenRoles("2026-07-14", playerIds)

        harness.assertValidBullpenRoles(roles, playerIds)

        assert.equal(harness.getRole(roles, PitchingRoleType.CLOSER)?.playerId, "301")
        assert.equal(harness.getRole(roles, PitchingRoleType.SETUP)?.playerId, "302")
        assert.equal(harness.getRole(roles, PitchingRoleType.LONG)?.playerId, "303")
        assert.equal(harness.getRole(roles, PitchingRoleType.MOP_UP)?.playerId, "304")

        const middleIds = roles
            .filter(role => role.role === PitchingRoleType.MIDDLE)
            .map(role => role.playerId)
            .sort()

        assert.deepEqual(middleIds, ["305", "306"])
    })

    it("uses saves and games finished to identify the closer", async () => {
        const gamesByDate = {
            "2026-07-13": [harness.buildScheduledGame(3101)],
            "2026-07-12": [harness.buildScheduledGame(3102)],
            "2026-07-11": [harness.buildScheduledGame(3103)]
        }

        const feedsById = {
            "3101": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "311",
                        pitches: 14,
                        outs: 3,
                        battersFaced: 4,
                        gamesFinished: 1,
                        saves: 1,
                        entryInning: 9
                    }
                ]
            }),
            "3102": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "311",
                        pitches: 16,
                        outs: 3,
                        battersFaced: 5,
                        gamesFinished: 1,
                        saves: 1,
                        entryInning: 9
                    }
                ]
            }),
            "3103": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "312",
                        pitches: 13,
                        outs: 3,
                        battersFaced: 4,
                        gamesFinished: 1,
                        entryInning: 9
                    }
                ]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)
        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["311", "312", "313", "314", "315"]
        )

        assert.equal(harness.getRole(roles, PitchingRoleType.CLOSER)?.playerId, "311")
        assert.equal(harness.getRole(roles, PitchingRoleType.CLOSER)?.profile.saves, 2)
        assert.equal(harness.getRole(roles, PitchingRoleType.CLOSER)?.profile.gamesFinished, 2)
    })

    it("uses holds and late-inning appearances to identify the setup reliever", async () => {
        const data = harness.buildSingleGameData("2026-07-13", 3201, [
            {
                playerId: "321",
                pitches: 14,
                outs: 3,
                battersFaced: 4,
                gamesFinished: 1,
                saves: 1,
                entryInning: 9
            },
            {
                playerId: "322",
                pitches: 15,
                outs: 3,
                battersFaced: 5,
                holds: 3,
                entryInning: 8
            },
            {
                playerId: "323",
                pitches: 13,
                outs: 3,
                battersFaced: 4,
                entryInning: 8
            },
            {
                playerId: "324",
                pitches: 35,
                outs: 8,
                battersFaced: 11,
                entryInning: 5
            },
            {
                playerId: "325",
                pitches: 16,
                outs: 3,
                battersFaced: 5,
                entryInning: 4
            }
        ])

        const service = harness.buildService(data.gamesByDate, data.feedsById)
        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["321", "322", "323", "324", "325"]
        )

        const setup = harness.getRole(roles, PitchingRoleType.SETUP)

        assert.equal(setup?.playerId, "322")
        assert.equal(setup?.profile.holds, 3)
        assert.equal(setup?.profile.averageEntryInning, 8)
    })

    it("uses multi-inning usage to identify the long reliever", async () => {
        const data = harness.buildSingleGameData("2026-07-13", 3301, [
            {
                playerId: "331",
                pitches: 14,
                outs: 3,
                battersFaced: 4,
                gamesFinished: 1,
                saves: 1,
                entryInning: 9
            },
            {
                playerId: "332",
                pitches: 15,
                outs: 3,
                battersFaced: 4,
                holds: 1,
                entryInning: 8
            },
            {
                playerId: "333",
                pitches: 48,
                outs: 10,
                battersFaced: 14,
                entryInning: 4
            },
            {
                playerId: "334",
                pitches: 20,
                outs: 4,
                battersFaced: 6,
                entryInning: 5
            },
            {
                playerId: "335",
                pitches: 16,
                outs: 3,
                battersFaced: 5,
                entryInning: 6
            }
        ])

        const service = harness.buildService(data.gamesByDate, data.feedsById)
        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["331", "332", "333", "334", "335"]
        )

        const long = harness.getRole(roles, PitchingRoleType.LONG)

        assert.equal(long?.playerId, "333")
        assert.equal(long?.profile.averageOuts, 10)
        assert.equal(long?.profile.multiInningAppearances, 1)
    })

    it("excludes the starting pitcher from synthesized bullpen roles", async () => {
        const data = harness.buildSingleGameData("2026-07-13", 3401, [
            {
                playerId: "340",
                pitches: 95,
                outs: 18,
                battersFaced: 25,
                gamesStarted: 1,
                entryInning: 1
            },
            {
                playerId: "341",
                pitches: 13,
                outs: 3,
                battersFaced: 4,
                saves: 1,
                gamesFinished: 1,
                entryInning: 9
            },
            {
                playerId: "342",
                pitches: 14,
                outs: 3,
                battersFaced: 4,
                holds: 1,
                entryInning: 8
            },
            {
                playerId: "343",
                pitches: 40,
                outs: 9,
                battersFaced: 12,
                entryInning: 5
            },
            {
                playerId: "344",
                pitches: 17,
                outs: 3,
                battersFaced: 5,
                entryInning: 4
            },
            {
                playerId: "345",
                pitches: 16,
                outs: 3,
                battersFaced: 4,
                entryInning: 6
            }
        ])

        const service = harness.buildService(data.gamesByDate, data.feedsById)

        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["340", "341", "342", "343", "344", "345"],
            "340"
        )

        harness.assertValidBullpenRoles(roles, ["341", "342", "343", "344", "345"])
        assert.equal(roles.some(role => role.playerId === "340"), false)
    })

    it("retains role history accumulated before and after a trade", async () => {
        const gamesByDate = {
            "2026-07-12": [harness.buildScheduledGame(3501)],
            "2026-07-13": [harness.buildScheduledGame(3502)]
        }

        const feedsById = {
            "3501": harness.buildGameFeed({
                awayTeamId: 10,
                awayPitchers: [
                    {
                        playerId: "351",
                        pitches: 14,
                        outs: 3,
                        battersFaced: 4,
                        gamesFinished: 1,
                        saves: 1,
                        entryInning: 9
                    }
                ]
            }),
            "3502": harness.buildGameFeed({
                homeTeamId: 20,
                homePitchers: [
                    {
                        playerId: "351",
                        pitches: 16,
                        outs: 3,
                        battersFaced: 5,
                        gamesFinished: 1,
                        saves: 1,
                        entryInning: 9
                    }
                ]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)

        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["351", "352", "353", "354", "355"]
        )

        const closer = harness.getRole(roles, PitchingRoleType.CLOSER)

        assert.equal(closer?.playerId, "351")
        assert.equal(closer?.profile.saves, 2)

        assert.deepEqual(
            closer?.workload.appearances.map(appearance => appearance.teamId),
            ["10", "20"]
        )
    })

    it("creates deterministic valid roles when no pitcher has recent appearances", async () => {
        const service = harness.buildService({}, {})
        const playerIds = ["401", "402", "403", "404", "405", "406"]
        const roles = await service.getBullpenRoles("2026-07-14", playerIds)

        harness.assertValidBullpenRoles(roles, playerIds)

        assert.equal(harness.getRole(roles, PitchingRoleType.CLOSER)?.playerId, "401")
        assert.equal(harness.getRole(roles, PitchingRoleType.SETUP)?.playerId, "402")
        assert.equal(harness.getRole(roles, PitchingRoleType.LONG)?.playerId, "403")
        assert.equal(harness.getRole(roles, PitchingRoleType.MOP_UP)?.playerId, "404")

        assert.deepEqual(
            roles
                .filter(role => role.role === PitchingRoleType.MIDDLE)
                .map(role => role.playerId),
            ["405", "406"]
        )
    })

    it("rejects a bullpen with fewer than five pitchers after excluding the starter", async () => {
        const service = harness.buildService({}, {})

        await assert.rejects(
            () => service.getBullpenRoles(
                "2026-07-14",
                ["501", "502", "503", "504", "505"],
                "501"
            ),
            /Cannot synthesize bullpen roles with only 4 pitchers/
        )
    })

    it("uses a thirty-day role window while keeping workload limited to five days", async () => {
        const oldData = harness.buildSingleGameData("2026-06-24", 3601, [
            {
                playerId: "361",
                pitches: 15,
                outs: 3,
                battersFaced: 4,
                gamesFinished: 1,
                saves: 1,
                entryInning: 9
            }
        ])

        const service = harness.buildService(oldData.gamesByDate, oldData.feedsById)

        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["361", "362", "363", "364", "365"]
        )

        const closer = harness.getRole(roles, PitchingRoleType.CLOSER)

        assert.equal(closer?.playerId, "361")
        assert.equal(closer?.profile.saves, 1)
        assert.equal(closer?.profile.reliefAppearances, 1)

        assert.equal(closer?.workload.appearances.length, 0)
        assert.equal(closer?.workload.pitchesLastFiveDays, 0)
    })

    it("excludes recent rotation starters from synthesized bullpen roles", async () => {
        const gamesByDate = {
            "2026-07-13": [harness.buildScheduledGame(3701)],
            "2026-07-08": [harness.buildScheduledGame(3702)],
            "2026-07-03": [harness.buildScheduledGame(3703)]
        }

        const feedsById = {
            "3701": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "371",
                        pitches: 94,
                        outs: 18,
                        battersFaced: 25,
                        gamesStarted: 1,
                        entryInning: 1
                    },
                    {
                        playerId: "372",
                        pitches: 14,
                        outs: 3,
                        battersFaced: 4,
                        gamesFinished: 1,
                        saves: 1,
                        entryInning: 9
                    },
                    {
                        playerId: "373",
                        pitches: 15,
                        outs: 3,
                        battersFaced: 5,
                        holds: 1,
                        entryInning: 8
                    },
                    {
                        playerId: "374",
                        pitches: 42,
                        outs: 9,
                        battersFaced: 12,
                        entryInning: 5
                    },
                    {
                        playerId: "375",
                        pitches: 18,
                        outs: 3,
                        battersFaced: 5,
                        entryInning: 6
                    },
                    {
                        playerId: "376",
                        pitches: 17,
                        outs: 3,
                        battersFaced: 5,
                        entryInning: 4
                    },
                    {
                        playerId: "377",
                        pitches: 16,
                        outs: 3,
                        battersFaced: 4,
                        entryInning: 7
                    }
                ]
            }),
            "3702": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "371",
                        pitches: 91,
                        outs: 18,
                        battersFaced: 24,
                        gamesStarted: 1,
                        entryInning: 1
                    }
                ]
            }),
            "3703": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "371",
                        pitches: 88,
                        outs: 17,
                        battersFaced: 23,
                        gamesStarted: 1,
                        entryInning: 1
                    }
                ]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)

        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["371", "372", "373", "374", "375", "376", "377"]
        )

        harness.assertValidBullpenRoles(roles, ["372", "373", "374", "375", "376", "377"])
        assert.equal(roles.some(role => role.playerId === "371"), false)
    })

    it("keeps a pitcher with one recent spot start eligible for the bullpen", async () => {
        const gamesByDate = {
            "2026-07-13": [harness.buildScheduledGame(3801)],
            "2026-07-11": [harness.buildScheduledGame(3802)],
            "2026-07-09": [harness.buildScheduledGame(3803)]
        }

        const feedsById = {
            "3801": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "381",
                        pitches: 65,
                        outs: 12,
                        battersFaced: 18,
                        gamesStarted: 1,
                        entryInning: 1
                    },
                    {
                        playerId: "382",
                        pitches: 13,
                        outs: 3,
                        battersFaced: 4,
                        saves: 1,
                        gamesFinished: 1,
                        entryInning: 9
                    },
                    {
                        playerId: "383",
                        pitches: 14,
                        outs: 3,
                        battersFaced: 4,
                        holds: 1,
                        entryInning: 8
                    },
                    {
                        playerId: "384",
                        pitches: 39,
                        outs: 8,
                        battersFaced: 11,
                        entryInning: 5
                    },
                    {
                        playerId: "385",
                        pitches: 17,
                        outs: 3,
                        battersFaced: 5,
                        entryInning: 6
                    }
                ]
            }),
            "3802": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "381",
                        pitches: 25,
                        outs: 6,
                        battersFaced: 8,
                        entryInning: 5
                    }
                ]
            }),
            "3803": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "381",
                        pitches: 21,
                        outs: 5,
                        battersFaced: 7,
                        entryInning: 6
                    }
                ]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)

        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["381", "382", "383", "384", "385"]
        )

        harness.assertValidBullpenRoles(roles, ["381", "382", "383", "384", "385"])

        const spotStarter = roles.find(role => role.playerId === "381")

        assert.ok(spotStarter)
        assert.equal(spotStarter.profile.starts, 1)
        assert.equal(spotStarter.profile.reliefAppearances, 2)
    })    

    it("keeps a swingman whose relief appearances outnumber recent starts", async () => {
        const gamesByDate = {
            "2026-07-13": [harness.buildScheduledGame(3901)],
            "2026-07-12": [harness.buildScheduledGame(3902)],
            "2026-07-10": [harness.buildScheduledGame(3903)],
            "2026-07-08": [harness.buildScheduledGame(3904)],
            "2026-07-06": [harness.buildScheduledGame(3905)]
        }

        const feedsById = {
            "3901": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "391",
                        pitches: 62,
                        outs: 12,
                        battersFaced: 17,
                        gamesStarted: 1,
                        entryInning: 1
                    },
                    {
                        playerId: "392",
                        pitches: 13,
                        outs: 3,
                        battersFaced: 4,
                        saves: 1,
                        gamesFinished: 1,
                        entryInning: 9
                    },
                    {
                        playerId: "393",
                        pitches: 14,
                        outs: 3,
                        battersFaced: 4,
                        holds: 1,
                        entryInning: 8
                    },
                    {
                        playerId: "394",
                        pitches: 40,
                        outs: 9,
                        battersFaced: 12,
                        entryInning: 5
                    },
                    {
                        playerId: "395",
                        pitches: 17,
                        outs: 3,
                        battersFaced: 5,
                        entryInning: 6
                    }
                ]
            }),
            "3902": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "391",
                        pitches: 58,
                        outs: 11,
                        battersFaced: 16,
                        gamesStarted: 1,
                        entryInning: 1
                    }
                ]
            }),
            "3903": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "391",
                        pitches: 27,
                        outs: 6,
                        battersFaced: 9,
                        entryInning: 5
                    }
                ]
            }),
            "3904": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "391",
                        pitches: 24,
                        outs: 6,
                        battersFaced: 8,
                        entryInning: 6
                    }
                ]
            }),
            "3905": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "391",
                        pitches: 19,
                        outs: 4,
                        battersFaced: 6,
                        entryInning: 7
                    }
                ]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)

        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["391", "392", "393", "394", "395"]
        )

        harness.assertValidBullpenRoles(roles, ["391", "392", "393", "394", "395"])

        const swingman = roles.find(role => role.playerId === "391")

        assert.ok(swingman)
        assert.equal(swingman.profile.starts, 2)
        assert.equal(swingman.profile.reliefAppearances, 3)
    })

    it("reintroduces the least starter-like pitcher when exclusions leave fewer than five bullpen candidates", async () => {
        const gamesByDate = {
            "2026-07-13": [harness.buildScheduledGame(4001)],
            "2026-07-09": [harness.buildScheduledGame(4002)],
            "2026-07-05": [harness.buildScheduledGame(4003)],
            "2026-07-01": [harness.buildScheduledGame(4004)]
        }

        const feedsById = {
            "4001": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "401",
                        pitches: 90,
                        outs: 18,
                        battersFaced: 24,
                        gamesStarted: 1,
                        entryInning: 1
                    },
                    {
                        playerId: "402",
                        pitches: 78,
                        outs: 15,
                        battersFaced: 21,
                        gamesStarted: 1,
                        entryInning: 1
                    },
                    {
                        playerId: "403",
                        pitches: 13,
                        outs: 3,
                        battersFaced: 4,
                        saves: 1,
                        gamesFinished: 1,
                        entryInning: 9
                    },
                    {
                        playerId: "404",
                        pitches: 14,
                        outs: 3,
                        battersFaced: 4,
                        holds: 1,
                        entryInning: 8
                    },
                    {
                        playerId: "405",
                        pitches: 39,
                        outs: 8,
                        battersFaced: 11,
                        entryInning: 5
                    },
                    {
                        playerId: "406",
                        pitches: 17,
                        outs: 3,
                        battersFaced: 5,
                        entryInning: 6
                    }
                ]
            }),
            "4002": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "401",
                        pitches: 92,
                        outs: 18,
                        battersFaced: 25,
                        gamesStarted: 1,
                        entryInning: 1
                    },
                    {
                        playerId: "402",
                        pitches: 32,
                        outs: 7,
                        battersFaced: 10,
                        entryInning: 5
                    }
                ]
            }),
            "4003": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "401",
                        pitches: 89,
                        outs: 17,
                        battersFaced: 23,
                        gamesStarted: 1,
                        entryInning: 1
                    },
                    {
                        playerId: "402",
                        pitches: 76,
                        outs: 14,
                        battersFaced: 20,
                        gamesStarted: 1,
                        entryInning: 1
                    }
                ]
            }),
            "4004": harness.buildGameFeed({
                awayPitchers: [
                    {
                        playerId: "402",
                        pitches: 74,
                        outs: 14,
                        battersFaced: 19,
                        gamesStarted: 1,
                        entryInning: 1
                    }
                ]
            })
        }

        const service = harness.buildService(gamesByDate, feedsById)

        const roles = await service.getBullpenRoles(
            "2026-07-14",
            ["401", "402", "403", "404", "405", "406"]
        )

        harness.assertValidBullpenRoles(roles, ["402", "403", "404", "405", "406"])

        assert.equal(roles.some(role => role.playerId === "401"), false)
        assert.equal(roles.some(role => role.playerId === "402"), true)

        const reintroduced = roles.find(role => role.playerId === "402")

        assert.equal(reintroduced?.profile.starts, 3)
        assert.equal(reintroduced?.profile.reliefAppearances, 1)
    })    

})