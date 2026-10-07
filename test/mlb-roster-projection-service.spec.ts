import assert from "node:assert/strict"
import {
    afterEach,
    describe,
    it,
    mock
} from "node:test"
import {
    queries
} from "baseball-database"
import { Position } from "../src/sim/service/enums.js"
import { MlbRosterProjectionService } from "../src/ratings/service/mlb-roster-projection-service.js"
import type { MlbRosterEntry, MlbTeam } from "../src/ratings/service/mlb-roster-service.js"
const GAME_DATE = "2026-10-03"
const PREVIOUS_DATE = "2026-09-30"
const TEAM_ID = 114
const GAME_PK = 12345
const team: MlbTeam = {
    id: TEAM_ID,
    name: "Cleveland Guardians",
    abbrev: "CLE"
}
const service = new MlbRosterProjectionService()
interface ScheduleGame {
    date: string
    gamePk: number
    probablePitcherId?: number
}
interface TestBoxscorePlayer {
    person: {
        id: number
    }
    battingOrder: string
}
const createPlayer = (id: number, position: Position): MlbRosterEntry => ({
    playerId: String(id),
    fullName: `Player ${id}`,
    position
})
const createRoster = (pitcherCount: number, hitterCount: number, catcherCount = 2): MlbRosterEntry[] => [
    ...Array.from({ length: pitcherCount }, (_, index) =>
        createPlayer(1000 + index, Position.PITCHER)
    ),
    ...Array.from({ length: catcherCount }, (_, index) =>
        createPlayer(2000 + index, Position.CATCHER)
    ),
    ...Array.from({ length: hitterCount - catcherCount }, (_, index) =>
        createPlayer(3000 + index, Position.FIRST_BASE)
    )
]
const createSchedule = (dates: ScheduleGame[]) => ({
    data: {
        dates: dates.map(date => ({
            date: date.date,
            games: [{
                gamePk: date.gamePk,
                teams: {
                    away: {
                        team: {
                            id: 145
                        }
                    },
                    home: {
                        team: {
                            id: TEAM_ID
                        },
                        probablePitcher: date.probablePitcherId
                            ? { id: date.probablePitcherId }
                            : undefined
                    }
                }
            }]
        }))
    }
})
const createGame = (gamePk: number, batters: number[] = [], pitchers: number[] = []) => ({
    gamePk,
    data: {
        gameData: {
            teams: {
                away: {
                    id: 145
                },
                home: {
                    id: TEAM_ID
                }
            }
        },
        liveData: {
            boxscore: {
                teams: {
                    home: {
                        batters,
                        pitchers,
                        players: {} as Record<string, TestBoxscorePlayer>
                    }
                }
            }
        }
    }
})
const mockDatabase = (
    dates: ScheduleGame[] = [],
    rosters: Record<string, MlbRosterEntry[]> = {},
    games: Record<number, ReturnType<typeof createGame>> = {}
): void => {
    mock.method(queries, "getSchedule", () =>
        createSchedule(dates)
    )
    mock.method(queries, "getRoster", (date: string) =>
        (rosters[date] ?? []).map(entry => ({
            playerId: Number(entry.playerId),
            position: entry.position
        }))
    )
    mock.method(queries, "getGame", (gamePk: number) =>
        games[gamePk]
    )
}
const playerIds = (roster: MlbRosterEntry[]): string[] =>
    roster.map(player => player.playerId)
const countPitchers = (roster: MlbRosterEntry[]): number =>
    roster.filter(player => player.position === Position.PITCHER).length
const countCatchers = (roster: MlbRosterEntry[]): number =>
    roster.filter(player => player.position === Position.CATCHER).length
describe("MlbRosterProjectionService", () => {
    afterEach(() => {
        mock.restoreAll()
    })
    it("returns an existing 26-player roster without projecting", () => {
        const roster = createRoster(13, 13)
        const result = service.project(GAME_DATE, team, roster)
        assert.equal(result.projected, false)
        assert.strictEqual(result.players, roster)
        assert.equal(result.players.length, 26)
    })
    it("returns a smaller roster without projecting", () => {
        const roster = createRoster(12, 12)
        const result = service.project(GAME_DATE, team, roster)
        assert.equal(result.projected, false)
        assert.strictEqual(result.players, roster)
        assert.equal(result.players.length, 24)
    })
    it("projects an expanded roster to 26 players", () => {
        mockDatabase()
        const roster = createRoster(19, 20)
        const result = service.project(GAME_DATE, team, roster)
        assert.equal(result.projected, true)
        assert.equal(result.players.length, 26)
        assert.equal(countPitchers(result.players), 13)
        assert.equal(countCatchers(result.players), 2)
    })
    it("never selects more than 13 pitchers", () => {
        mockDatabase()
        const roster = createRoster(20, 20)
        const result = service.project(GAME_DATE, team, roster)
        assert.equal(result.players.length, 26)
        assert.equal(countPitchers(result.players), 13)
    })
    it("selects at least two catchers when available", () => {
        mockDatabase()
        const roster = createRoster(18, 20, 4)
        const result = service.project(GAME_DATE, team, roster)
        assert.equal(result.players.length, 26)
        assert.ok(countCatchers(result.players) >= 2)
    })
    it("does not invent a second catcher when only one is available", () => {
        mockDatabase()
        const roster = createRoster(18, 20, 1)
        const result = service.project(GAME_DATE, team, roster)
        assert.equal(result.players.length, 26)
        assert.equal(countCatchers(result.players), 1)
    })
    it("prioritizes players from the most recent 26-player roster", () => {
        const roster = createRoster(19, 20)
        const previousRoster = [
            ...roster.filter(player => player.position === Position.PITCHER).slice(6, 19),
            ...roster.filter(player => player.position !== Position.PITCHER).slice(0, 13)
        ]
        assert.equal(previousRoster.length, 26)
        mockDatabase(
            [
                { date: PREVIOUS_DATE, gamePk: 100 },
                { date: GAME_DATE, gamePk: GAME_PK }
            ],
            {
                [PREVIOUS_DATE]: previousRoster
            }
        )
        const result = service.project(GAME_DATE, team, roster)
        assert.equal(result.players.length, 26)
        assert.equal(countPitchers(result.players), 13)
        assert.equal(countCatchers(result.players), 2)
        assert.deepEqual(
            new Set(playerIds(result.players)),
            new Set(playerIds(previousRoster))
        )
    })
    it("ignores an expanded previous roster and finds an earlier 26-player roster", () => {
        const roster = createRoster(19, 20)
        const referencePlayer = roster.find(player => player.playerId === "3017")!
        const earlierRoster = [
            ...roster.filter(player => player.position === Position.PITCHER).slice(0, 13),
            ...roster.filter(player =>
                player.position !== Position.PITCHER &&
                player.playerId !== referencePlayer.playerId
            ).slice(0, 12),
            referencePlayer
        ]
        assert.equal(earlierRoster.length, 26)
        mockDatabase(
            [
                { date: "2026-09-28", gamePk: 101 },
                { date: "2026-10-01", gamePk: 102 },
                { date: GAME_DATE, gamePk: GAME_PK }
            ],
            {
                "2026-09-28": earlierRoster,
                "2026-10-01": roster
            }
        )
        const result = service.project(GAME_DATE, team, roster)
        assert.equal(result.players.length, 26)
        assert.deepEqual(
            new Set(playerIds(result.players)),
            new Set(playerIds(earlierRoster))
        )
    })
    it("prioritizes recent appearances when no reference roster exists", () => {
        const roster = createRoster(19, 20)
        const recentPitcher = roster.find(player => player.playerId === "1018")!
        const recentHitter = roster.find(player => player.playerId === "3017")!
        mockDatabase(
            [
                { date: PREVIOUS_DATE, gamePk: 100 },
                { date: GAME_DATE, gamePk: GAME_PK }
            ],
            {},
            {
                100: createGame(
                    100,
                    [Number(recentHitter.playerId)],
                    [Number(recentPitcher.playerId)]
                )
            }
        )
        const result = service.project(GAME_DATE, team, roster)
        const selectedIds = new Set(playerIds(result.players))
        assert.equal(result.players.length, 26)
        assert.ok(selectedIds.has(recentPitcher.playerId))
        assert.ok(selectedIds.has(recentHitter.playerId))
    })
    it("preserves every recent starting pitcher in an expanded roster", () => {
        const roster = createRoster(19, 20)
        const starters = roster
            .filter(player => player.position === Position.PITCHER)
            .slice(14, 19)
        const dates = starters.map((_starter, index) => ({
            date: `2026-09-${String(25 + index).padStart(2, "0")}`,
            gamePk: 200 + index
        }))
        const games = Object.fromEntries(
            starters.map((starter, index) => [
                200 + index,
                createGame(
                    200 + index,
                    [],
                    [Number(starter.playerId)]
                )
            ])
        )
        mockDatabase(
            [
                ...dates,
                { date: GAME_DATE, gamePk: GAME_PK }
            ],
            {},
            games
        )
        const result = service.project(GAME_DATE, team, roster)
        const selectedIds = new Set(playerIds(result.players))
        assert.equal(result.players.length, 26)
        assert.equal(countPitchers(result.players), 13)
        for (const starter of starters) {
            assert.ok(selectedIds.has(starter.playerId))
        }
    })
    it("uses each player's appearance only once per game", () => {
        const roster = createRoster(19, 20)
        const recentPitcher = roster.find(player => player.playerId === "1018")!
        mockDatabase(
            [
                { date: PREVIOUS_DATE, gamePk: 100 },
                { date: GAME_DATE, gamePk: GAME_PK }
            ],
            {},
            {
                100: createGame(
                    100,
                    [],
                    [
                        Number(recentPitcher.playerId),
                        Number(recentPitcher.playerId)
                    ]
                )
            }
        )
        const result = service.project(GAME_DATE, team, roster)
        assert.ok(
            result.players.some(player => player.playerId === recentPitcher.playerId)
        )
        assert.equal(result.players.length, 26)
    })
    it("preserves the current game's probable starting pitcher", () => {
        const roster = createRoster(19, 20)
        const startingPitcher = roster.find(player => player.playerId === "1018")!
        mockDatabase(
            [
                {
                    date: GAME_DATE,
                    gamePk: GAME_PK,
                    probablePitcherId: Number(startingPitcher.playerId)
                }
            ],
            {},
            {
                [GAME_PK]: createGame(GAME_PK)
            }
        )
        const result = service.project(GAME_DATE, team, roster, GAME_PK)
        assert.ok(
            result.players.some(player => player.playerId === startingPitcher.playerId)
        )
        assert.equal(result.players.length, 26)
    })
    it("preserves the probable pitcher without a game feed", () => {
        const roster = createRoster(19, 20)
        const startingPitcher = roster.find(player => player.playerId === "1018")!
        mockDatabase(
            [
                {
                    date: GAME_DATE,
                    gamePk: GAME_PK,
                    probablePitcherId: Number(startingPitcher.playerId)
                }
            ]
        )
        const result = service.project(GAME_DATE, team, roster, GAME_PK)
        assert.ok(
            result.players.some(player => player.playerId === startingPitcher.playerId)
        )
        assert.equal(result.players.length, 26)
    })
    it("uses the boxscore's first pitcher when no probable pitcher exists", () => {
        const roster = createRoster(19, 20)
        const startingPitcher = roster.find(player => player.playerId === "1018")!
        mockDatabase(
            [
                { date: GAME_DATE, gamePk: GAME_PK }
            ],
            {},
            {
                [GAME_PK]: createGame(
                    GAME_PK,
                    [],
                    [Number(startingPitcher.playerId)]
                )
            }
        )
        const result = service.project(GAME_DATE, team, roster, GAME_PK)
        assert.ok(
            result.players.some(player => player.playerId === startingPitcher.playerId)
        )
    })
    it("preserves confirmed starting hitters", () => {
        const roster = createRoster(19, 20)
        const confirmedHitter = roster.find(player => player.playerId === "3017")!
        const game = createGame(GAME_PK)
        game.data.liveData.boxscore.teams.home.players[
            `ID${confirmedHitter.playerId}`
        ] = {
            person: {
                id: Number(confirmedHitter.playerId)
            },
            battingOrder: "100"
        }
        mockDatabase(
            [
                { date: GAME_DATE, gamePk: GAME_PK }
            ],
            {},
            {
                [GAME_PK]: game
            }
        )
        const result = service.project(GAME_DATE, team, roster, GAME_PK)
        assert.ok(
            result.players.some(player => player.playerId === confirmedHitter.playerId)
        )
    })
    it("does not treat substitutes as confirmed starting hitters", () => {
        const roster = createRoster(19, 20)
        const substitute = roster.find(player => player.playerId === "3017")!
        const game = createGame(GAME_PK)
        game.data.liveData.boxscore.teams.home.players[
            `ID${substitute.playerId}`
        ] = {
            person: {
                id: Number(substitute.playerId)
            },
            battingOrder: "101"
        }
        mockDatabase(
            [
                { date: GAME_DATE, gamePk: GAME_PK }
            ],
            {},
            {
                [GAME_PK]: game
            }
        )
        const result = service.project(GAME_DATE, team, roster, GAME_PK)
        assert.equal(result.players.length, 26)
        assert.ok(
            !result.players.some(player => player.playerId === substitute.playerId)
        )
    })
    it("does not exceed the pitcher limit when the boxscore lists additional pitchers", () => {
        const roster = createRoster(19, 20)
        const game = createGame(GAME_PK)
        const pitcherIds = roster
            .filter(player => player.position === Position.PITCHER)
            .slice(0, 14)
            .map(player => Number(player.playerId))
        game.data.liveData.boxscore.teams.home.pitchers = pitcherIds
        for (let index = 0; index < pitcherIds.length; index++) {
            game.data.liveData.boxscore.teams.home.players[
                `ID${pitcherIds[index]}`
            ] = {
                person: {
                    id: pitcherIds[index]
                },
                battingOrder: String((index + 1) * 100)
            }
        }
        mockDatabase(
            [
                { date: GAME_DATE, gamePk: GAME_PK }
            ],
            {},
            {
                [GAME_PK]: game
            }
        )
        const result = service.project(GAME_DATE, team, roster, GAME_PK)
        assert.equal(result.players.length, 26)
        assert.ok(countPitchers(result.players) <= 13)
    })
    it("throws when the available player composition cannot fill 26 spots", () => {
        mockDatabase()
        const roster = createRoster(25, 10)
        assert.throws(
            () => service.project(GAME_DATE, team, roster),
            /selected \d+ of 26 players/
        )
    })
    it("does not mutate the input roster", () => {
        mockDatabase()
        const roster = createRoster(19, 20)
        const originalIds = playerIds(roster)
        service.project(GAME_DATE, team, roster)
        assert.deepEqual(playerIds(roster), originalIds)
    })
    it("preserves the original input order in the projected roster", () => {
        mockDatabase()
        const roster = createRoster(19, 20)
        const result = service.project(GAME_DATE, team, roster)
        const selectedIds = new Set(playerIds(result.players))
        const expectedOrder = roster
            .filter(player => selectedIds.has(player.playerId))
            .map(player => player.playerId)
        assert.deepEqual(playerIds(result.players), expectedOrder)
    })
})
