import { strict as assert } from "assert"
import fs from "fs"
import os from "os"
import path from "path"

import { afterEach, beforeEach, describe, it } from "mocha"

import { PlayerImportService } from "../src/importer/service/player-import-service.js"

import type { DatedStatExport, PlayerImportSelection, PlayerImportState } from "../src/importer/service/player-import-service.js"
import type { PlayerImportRaw } from "../src/sim/service/interfaces.js"
import type { StatAccumulatorService } from "../src/importer/service/stat-accumulator-service.js"
import type { StatExport } from "baseball-database"

describe("PlayerImportService", function () {

    let baseDataDir: string
    let accumulationCalls: AccumulationCall[]

    beforeEach(async function () {
        baseDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "baseball-sim-engine-player-import-"))
        accumulationCalls = []
    })

    afterEach(async function () {
        await fs.promises.rm(baseDataDir, {
            recursive: true,
            force: true
        })
    })

    it("uses each player's latest 162 appearances before the game date", async function () {
        const service = createService()
        const subject = service as any

        const statExports = Array.from({ length: 200 }, (_, index) => {
            const gameNumber = index + 1

            return makeDatedStatExport(
                `2026-${String(Math.floor(index / 28) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
                [
                    {
                        gamePk: gameNumber,
                        playerId: "player-a"
                    }
                ]
            )
        })

        statExports.push(
            makeDatedStatExport(
                "2026-08-01",
                Array.from({ length: 50 }, (_, index) => ({
                    gamePk: 1001 + index,
                    playerId: "player-b"
                }))
            )
        )

        const state: PlayerImportState = {
            season: 2026,
            currentDate: "2026-12-30",
            statExports,
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        subject.addAppearancesToState(
            state,
            statExports
        )

        subject.getOrCreateState = async (): Promise<PlayerImportState> => state
        subject.getStatExport = (): StatExport => makeStatExport([])
        subject.removeUnneededDates = (): void => {}

        await service.buildCorePlayerImports(
            2026,
            "2026-12-31",
            new Set([
                "player-a",
                "player-b"
            ])
        )

        assert.equal(accumulationCalls.length, 1)

        const playerASelection = accumulationCalls[0].selections.find(selection =>
            selection.playerId === "player-a"
        )

        const playerBSelection = accumulationCalls[0].selections.find(selection =>
            selection.playerId === "player-b"
        )

        assert.ok(playerASelection)
        assert.ok(playerBSelection)

        assert.equal(playerASelection.gamePks.length, 162)
        assert.equal(playerASelection.gamePks.includes(38), false)
        assert.equal(playerASelection.gamePks.includes(39), true)
        assert.equal(playerASelection.gamePks.includes(200), true)

        assert.equal(playerBSelection.gamePks.length, 50)
        assert.equal(playerBSelection.gamePks.includes(1001), true)
        assert.equal(playerBSelection.gamePks.includes(1050), true)
    })

    it("loads the requested range once and stores each game date separately", async function () {
        const service = createService()
        const subject = service as any

        
        const requestedRanges: { startDate: string, endDateExclusive: string }[] = []

        subject.getStatExport = (startDate: string, endDateExclusive: string): StatExport => {
            requestedRanges.push({
                startDate,
                endDateExclusive
            })

            return makeStatExport([
                {
                    gamePk: 101,
                    playerId: "player-a",
                    gameDate: "2026-07-01"
                },
                {
                    gamePk: 102,
                    playerId: "player-a",
                    gameDate: "2026-07-02"
                },
                {
                    gamePk: 103,
                    playerId: "player-a",
                    gameDate: "2026-07-03"
                }
            ])
        }

        const state: PlayerImportState = {
            season: 2026,
            currentDate: "2026-07-01",
            statExports: [],
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        subject.removeUnneededDates = (): void => {}

        await subject.advanceState(
            state,
            "2026-07-04"
        )

        assert.deepEqual(
            requestedRanges,
            [
                {
                    startDate: "2026-07-01",
                    endDateExclusive: "2026-07-04"
                }
            ]
        )

        assert.deepEqual(
            state.statExports.map(statExport =>
                statExport.date
            ),
            [
                "2026-07-01",
                "2026-07-02",
                "2026-07-03"
            ]
        )

        assert.deepEqual(
            Array.from(state.players.keys()),
            [
                "player-a"
            ]
        )

        assert.equal(accumulationCalls.length, 1)
        assert.equal(state.currentDate, "2026-07-04")
    })

    it("does not load the requested game date into the core history", async function () {
        const service = createService()
        const subject = service as any

        const requestedRanges: { startDate: string, endDateExclusive: string }[] = []

        subject.getStatExport = (startDate: string, endDateExclusive: string): StatExport => {
            requestedRanges.push({
                startDate,
                endDateExclusive
            })

            return makeStatExport([
                {
                    gamePk: 101,
                    playerId: "player-a",
                    gameDate: "2026-07-08"
                },
                {
                    gamePk: 102,
                    playerId: "player-a",
                    gameDate: "2026-07-09"
                }
            ])
        }

        const state: PlayerImportState = {
            season: 2026,
            currentDate: "2026-07-08",
            statExports: [],
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        subject.removeUnneededDates = (): void => {}

        await subject.advanceState(
            state,
            "2026-07-10"
        )

        assert.deepEqual(
            requestedRanges,
            [
                {
                    startDate: "2026-07-08",
                    endDateExclusive: "2026-07-10"
                }
            ]
        )

        assert.deepEqual(
            state.statExports.map(statExport =>
                statExport.date
            ),
            [
                "2026-07-08",
                "2026-07-09"
            ]
        )

        assert.equal(
            state.statExports.some(statExport =>
                statExport.date === "2026-07-10"
            ),
            false
        )

        assert.deepEqual(
            Array.from(state.players.keys()),
            [
                "player-a"
            ]
        )
    })

    it("does not reload dates when advancing to the same date", async function () {
        const service = createService()
        const subject = service as any

        let exportsLoaded = 0

        subject.getStatExport = (): StatExport => {
            exportsLoaded++

            return makeStatExport([])
        }

        const state: PlayerImportState = {
            season: 2026,
            currentDate: "2026-07-10",
            statExports: [
                makeDatedStatExport(
                    "2026-07-09",
                    [
                        {
                            gamePk: 101,
                            playerId: "player-a"
                        }
                    ]
                )
            ],
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        await subject.advanceState(state, "2026-07-10")

        assert.equal(exportsLoaded, 0)
        assert.equal(state.statExports.length, 1)
    })

    it("rejects moving an existing state backward", async function () {
        const service = createService()
        const subject = service as any

        const state: PlayerImportState = {
            season: 2026,
            currentDate: "2026-07-10",
            statExports: [],
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        await assert.rejects(
            subject.advanceState(state, "2026-07-09"),
            /Cannot move player import state backward from 2026-07-10 to 2026-07-09/
        )
    })

    it("removes dates older than every player's required 162-game window", function () {
        const service = createService()
        const subject = service as any

        const statExports: DatedStatExport[] = []

        for (let index = 0; index < 170; index++) {
            statExports.push(
                makeDatedStatExport(
                    addDays("2026-01-01", index),
                    [
                        {
                            gamePk: index + 1,
                            playerId: "player-a"
                        },
                        {
                            gamePk: 1001 + index,
                            playerId: "player-b"
                        }
                    ]
                )
            )
        }

        const state: PlayerImportState = {
            season: 2026,
            currentDate: addDays("2026-01-01", 170),
            statExports,
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        subject.addAppearancesToState(
            state,
            statExports
        )

        subject.removeUnneededDates(
            state
        )

        assert.equal(state.statExports.length, 162)
        assert.equal(
            state.statExports[0].date,
            addDays("2026-01-01", 8)
        )
        assert.equal(
            state.statExports.at(-1)?.date,
            addDays("2026-01-01", 169)
        )

        assert.equal(
            state.appearancesByPlayer["player-a"].length,
            162
        )
        assert.equal(
            state.appearancesByPlayer["player-b"].length,
            162
        )

        assert.equal(
            state.appearancesByPlayer["player-a"][0].gamePk,
            9
        )
        assert.equal(
            state.appearancesByPlayer["player-b"][0].gamePk,
            1009
        )
    })

    it("retains an older date when one player still needs it", function () {
        const service = createService()
        const subject = service as any

        const statExports: DatedStatExport[] = []

        for (let index = 0; index < 170; index++) {
            const appearances: AppearanceInput[] = [
                {
                    gamePk: index + 1,
                    playerId: "player-a"
                }
            ]

            if (index < 50) {
                appearances.push({
                    gamePk: 1001 + index,
                    playerId: "player-b"
                })
            }

            statExports.push(makeDatedStatExport(addDays("2026-01-01", index), appearances))
        }

        const state: PlayerImportState = {
            season: 2026,
            currentDate: addDays("2026-01-01", 170),
            statExports,
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        subject.removeUnneededDates(state)

        assert.equal(state.statExports[0].date, "2026-01-01")
        assert.equal(state.statExports.length, 170)
    })

    it("selects every appearance inside an explicit date range", async function () {
        const service = createService()
        const subject = service as any


        subject.loadDatedStatExports = (): DatedStatExport[] => [
            makeDatedStatExport("2026-07-08", [
                {
                    gamePk: 101,
                    playerId: "player-a"
                }
            ]),
            makeDatedStatExport("2026-07-09", [
                {
                    gamePk: 102,
                    playerId: "player-a"
                },
                {
                    gamePk: 201,
                    playerId: "player-b"
                }
            ]),
            makeDatedStatExport("2026-07-10", [
                {
                    gamePk: 103,
                    playerId: "player-a"
                }
            ])
        ]

        await service.buildDateRangePlayerImports(2026, "2026-07-08", "2026-07-11", new Set(["player-a"]))

        assert.equal(accumulationCalls.length, 1)

        assert.deepEqual(
            accumulationCalls[0].selections,
            [
                {
                    playerId: "player-a",
                    gamePks: [
                        101,
                        102,
                        103
                    ]
                }
            ]
        )
    })

    it("returns appearance counts capped at 162", async function () {
        const service = createService()
        const subject = service as any

        const statExports = Array.from({ length: 200 }, (_, index) =>
            makeDatedStatExport(
                addDays("2026-01-01", index),
                [
                    {
                        gamePk: index + 1,
                        playerId: "player-a"
                    }
                ]
            )
        )

        statExports.push(
            makeDatedStatExport(
                "2026-08-01",
                Array.from({ length: 25 }, (_, index) => ({
                    gamePk: 1001 + index,
                    playerId: "player-b"
                }))
            )
        )

        const state: PlayerImportState = {
            season: 2026,
            currentDate: "2026-12-31",
            statExports,
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        subject.addAppearancesToState(
            state,
            statExports
        )

        subject.getOrCreateState = async (): Promise<PlayerImportState> => state
        subject.advanceState = async (): Promise<void> => {}

        const counts = await service.getAppearanceCountsBeforeDate(
            2026,
            "2026-12-31",
            new Set([
                "player-a",
                "player-b",
                "player-c"
            ])
        )

        assert.equal(
            counts.get("player-a"),
            162
        )
        assert.equal(
            counts.get("player-b"),
            25
        )
        assert.equal(
            counts.get("player-c"),
            0
        )
    })

    it("passes dated exports and typed selections to the accumulator", async function () {
        const service = createService()
        const subject = service as any

        const statExports = [
            makeDatedStatExport(
                "2026-07-01",
                [
                    {
                        gamePk: 101,
                        playerId: "player-a"
                    },
                    {
                        gamePk: 101,
                        playerId: "player-b"
                    }
                ]
            )
        ]

        const state: PlayerImportState = {
            season: 2026,
            currentDate: "2026-07-01",
            statExports: [],
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        subject.getOrCreateState = async (): Promise<PlayerImportState> => state
        subject.getStatExport = (): StatExport => statExports[0].statExport
        subject.removeUnneededDates = (): void => {}

        const players = await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a",
                "player-b"
            ])
        )

        assert.equal(accumulationCalls.length, 1)
        assert.equal(accumulationCalls[0].season, 2026)
        assert.equal(accumulationCalls[0].statExports, state.statExports)

        assert.deepEqual(
            accumulationCalls[0].selections,
            [
                {
                    playerId: "player-a",
                    gamePks: [
                        101
                    ]
                },
                {
                    playerId: "player-b",
                    gamePks: [
                        101
                    ]
                }
            ]
        )

        assert.deepEqual(
            Array.from(players.keys()),
            [
                "player-a",
                "player-b"
            ]
        )
    })

    it("returns cloned results from the in-memory core import cache", async function () {
        const service = createService()
        const subject = service as any

        const state: PlayerImportState = {
            season: 2026,
            currentDate: "2026-07-02",
            statExports: [
                makeDatedStatExport(
                    "2026-07-01",
                    [
                        {
                            gamePk: 101,
                            playerId: "player-a"
                        }
                    ]
                )
            ],
            players: new Map([
                [
                    "player-a",
                    {
                        playerId: "player-a",
                        firstName: "Test",
                        lastName: "Player"
                    } as PlayerImportRaw
                ]
            ]),
            appearancesByPlayer: {}
        }

        subject.getOrCreateState = async (): Promise<PlayerImportState> => state
        subject.advanceState = async (): Promise<void> => {}

        const first = await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ])
        )

        const second = await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ])
        )

        assert.equal(accumulationCalls.length, 0)
        assert.notEqual(first, second)
        assert.notEqual(
            first.get("player-a"),
            second.get("player-a")
        )
        assert.deepEqual(first, second)
    })

    it("force rebuild clears the existing core import cache and state", async function () {
        const service = createService()
        const subject = service as any

        let stateBuilds = 0

        subject.getOrCreateState = async (): Promise<PlayerImportState> => {
            stateBuilds++

            return {
                season: 2026,
                currentDate: "2026-07-02",
                statExports: [
                    makeDatedStatExport(
                        "2026-07-01",
                        [
                            {
                                gamePk: 101,
                                playerId: "player-a"
                            }
                        ]
                    )
                ],
                players: new Map([
                    [
                        "player-a",
                        {
                            playerId: "player-a",
                            firstName: "Test",
                            lastName: "Player"
                        } as PlayerImportRaw
                    ]
                ]),
                appearancesByPlayer: {}
            }
        }

        subject.advanceState = async (): Promise<void> => {}

        await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ])
        )

        await service.buildCorePlayerImports(
            2026,
            "2026-07-02",
            new Set([
                "player-a"
            ]),
            true
        )

        assert.equal(stateBuilds, 2)
        assert.equal(accumulationCalls.length, 0)
    })

    it("writes and then reads season player imports from the results file", async function () {
        const service = createService()
        const subject = service as any

        let builds = 0

        subject.buildCorePlayerImports = async (): Promise<Map<string, PlayerImportRaw>> => {
            builds++

            return new Map([
                [
                    "player-a",
                    {
                        playerId: "player-a",
                        firstName: "Test",
                        lastName: "Player"
                    } as PlayerImportRaw
                ]
            ])
        }

        const first = await service.buildSeasonPlayerImports(2025, new Set(["player-a"]))
        const second = await service.buildSeasonPlayerImports(2025, new Set(["player-a"]))

        assert.equal(builds, 1)
        assert.deepEqual(first, second)
        assert.equal(fs.existsSync(path.join(baseDataDir, "2025", "_results.json")), true)
    })

    it("does not use a season results file created for different player IDs", async function () {
        const service = createService()
        const subject = service as any

        const resultsPath = path.join(baseDataDir, "2025", "_results.json")

        await fs.promises.mkdir(path.dirname(resultsPath), {
            recursive: true
        })

        await fs.promises.writeFile(
            resultsPath,
            JSON.stringify({
                season: 2025,
                playerIds: [
                    "player-a"
                ],
                players: [
                    {
                        playerId: "player-a"
                    }
                ]
            }),
            "utf8"
        )

        let builds = 0

        subject.buildCorePlayerImports = async (): Promise<Map<string, PlayerImportRaw>> => {
            builds++

            return new Map([
                [
                    "player-b",
                    {
                        playerId: "player-b"
                    } as PlayerImportRaw
                ]
            ])
        }

        const players = await service.buildSeasonPlayerImports(2025, new Set(["player-b"]))

        assert.equal(builds, 1)
        assert.equal(players.has("player-b"), true)
    })

    it("builds a single season player import using a filtered player set", async function () {
        const service = createService()
        const subject = service as any

        let requestedPlayerIds: Set<string> | undefined

        subject.buildSeasonPlayerImports = async (_season: number, playerIds?: Set<string>): Promise<Map<string, PlayerImportRaw>> => {
            requestedPlayerIds = playerIds

            return new Map([
                [
                    "player-a",
                    {
                        playerId: "player-a"
                    } as PlayerImportRaw
                ]
            ])
        }

        const player = await service.buildSeasonPlayerImportRaw(2026, "player-a")

        assert.deepEqual(
            Array.from(requestedPlayerIds ?? []),
            [
                "player-a"
            ]
        )

        assert.equal(player?.playerId, "player-a")
    })

    it("rejects an invalid core import date", async function () {
        const service = createService()

        await assert.rejects(
            service.buildCorePlayerImports(2026, "not-a-date"),
            /Invalid date: not-a-date/
        )
    })

    it("rejects an invalid date-range boundary", async function () {
        const service = createService()

        await assert.rejects(
            service.buildDateRangePlayerImports(2026, "2026-07-01", "invalid"),
            /Invalid date: invalid/
        )
    })

    it("rejects a date range whose start is not before its end", async function () {
        const service = createService()

        await assert.rejects(
            service.buildDateRangePlayerImports(2026, "2026-07-10", "2026-07-10"),
            /Start date 2026-07-10 must be before end date 2026-07-10/
        )
    })

    it("clears all internal caches and states", function () {
        const service = createService()
        const subject = service as any

        subject.importCache.set(
            "core:2026:2026-07-01:*",
            new Map()
        )

        subject.states.push({
            season: 2026,
            currentDate: "2026-07-01",
            statExports: [],
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        })

        service.clearCache()

        assert.equal(subject.importCache.size, 0)
        assert.equal(subject.states.length, 0)
    })

    it("clears only the requested season", function () {
        const service = createService()
        const subject = service as any

        subject.importCache.set(
            "core:2025:2025-07-01:*",
            new Map()
        )

        subject.importCache.set(
            "core:2026:2026-07-01:*",
            new Map()
        )

        subject.states.push(
            {
                season: 2025,
                currentDate: "2025-07-01",
                statExports: [],
                players: new Map<string, PlayerImportRaw>(),
                appearancesByPlayer: {}
            },
            {
                season: 2026,
                currentDate: "2026-07-01",
                statExports: [],
                players: new Map<string, PlayerImportRaw>(),
                appearancesByPlayer: {}
            }
        )

        service.clearCache(
            2026
        )

        assert.equal(
            subject.importCache.has("core:2025:2025-07-01:*"),
            true
        )

        assert.equal(
            subject.importCache.has("core:2026:2026-07-01:*"),
            false
        )

        assert.deepEqual(
            subject.states.map((state: PlayerImportState) =>
                state.season
            ),
            [
                2025
            ]
        )
    })

    function createService(): PlayerImportService {
        const statAccumulatorService = {
            accumulateStatExportsIntoPlayerImports(season: number, statExports: DatedStatExport[], selections: PlayerImportSelection[], players: Map<string, PlayerImportRaw>): void {
                accumulationCalls.push({
                    season,
                    statExports,
                    selections: structuredClone(selections)
                })

                for (const selection of selections) {
                    players.set(
                        selection.playerId,
                        {
                            playerId: selection.playerId,
                            firstName: "Test",
                            lastName: "Player"
                        } as PlayerImportRaw
                    )
                }
            }
        } as StatAccumulatorService

        const service = new PlayerImportService(baseDataDir, statAccumulatorService)
        const subject = service as any

        subject.finalizePlayers = (): void => {}

        return service
    }

    function makeDatedStatExport(date: string, appearances: AppearanceInput[]): DatedStatExport {
        return {
            date,
            statExport: makeStatExport(appearances)
        }
    }

    function makeStatExport(appearances: AppearanceInput[]): StatExport {
        const gameDatesByPk = new Map<number, string>()

        for (const appearance of appearances) {
            gameDatesByPk.set(
                appearance.gamePk,
                appearance.gameDate ?? "2026-07-01"
            )
        }

        return {
            games: Array.from(gameDatesByPk.entries()).map(([gamePk, gameDate]) => ({
                gamePk,
                gameDate
            })),
            appearances: appearances.map(appearance => ({
                gamePk: appearance.gamePk,
                playerId: appearance.playerId,
                teamId: 1,
                appearedAsBatter: true,
                appearedAsPitcher: false,
                appearedAsRunner: false,
                appearedAsFielder: false,
                startedAsBatter: true,
                startedAsPitcher: false,
                startedAsFielder: false
            })) as any,
            plateAppearances: [],
            pitches: [],
            runnerMovements: [],
            fieldingCredits: [],
            defensiveEvents: []
        }
    }

    function addDays(value: string, days: number): string {
        const date = new Date(`${value}T12:00:00.000Z`)

        date.setUTCDate(date.getUTCDate() + days)

        return date.toISOString().slice(0, 10)
    }
})

interface AppearanceInput {
    gamePk: number
    playerId: string
    gameDate?: string
}

interface AccumulationCall {
    season: number
    statExports: DatedStatExport[]
    selections: PlayerImportSelection[]
}