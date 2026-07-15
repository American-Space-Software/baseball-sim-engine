import assert from "assert"
import fs from "fs"
import os from "os"
import path from "path"

import { DownloaderService } from "../src/importer/service/downloader-service.js"

describe("Downloader Service", function () {
    let baseDataDir: string

    beforeEach(async function () {
        baseDataDir = await fs.promises.mkdtemp(
            path.join(
                os.tmpdir(),
                "baseball-sim-engine-downloader-"
            )
        )
    })

    afterEach(async function () {
        await fs.promises.rm(
            baseDataDir,
            {
                recursive: true,
                force: true
            }
        )
    })

    it("combines the current and previous season schedules newest-first before the cutoff date", async function () {
        const season = 2026
        const cutoffDate = "2026-04-03"

        const service = new DownloaderService(
            baseDataDir,
            0
        )

        const subject = service as any

        subject.getSeasonGames = async (requestedSeason: number): Promise<any[]> => {
            if (requestedSeason === season - 1) {
                return [
                    {
                        gamePk: 101,
                        officialDate: "2025-09-01"
                    },
                    {
                        gamePk: 102,
                        officialDate: "2025-09-02"
                    }
                ]
            }

            if (requestedSeason === season) {
                return [
                    {
                        gamePk: 201,
                        officialDate: "2026-04-01"
                    },
                    {
                        gamePk: 202,
                        officialDate: "2026-04-02"
                    },
                    {
                        gamePk: 203,
                        officialDate: "2026-04-03"
                    },
                    {
                        gamePk: 204,
                        officialDate: "2026-04-04"
                    }
                ]
            }

            throw new Error(
                `Unexpected season ${requestedSeason}.`
            )
        }

        const games = await subject.getRollingGamesBeforeDate(
            season,
            cutoffDate
        )

        assert.deepEqual(
            games.map((row: any) => ({
                sourceSeason: row.sourceSeason,
                gamePk: row.game.gamePk,
                gameDate: row.game.officialDate
            })),
            [
                {
                    sourceSeason: season,
                    gamePk: 202,
                    gameDate: "2026-04-02"
                },
                {
                    sourceSeason: season,
                    gamePk: 201,
                    gameDate: "2026-04-01"
                },
                {
                    sourceSeason: season - 1,
                    gamePk: 102,
                    gameDate: "2025-09-02"
                },
                {
                    sourceSeason: season - 1,
                    gamePk: 101,
                    gameDate: "2025-09-01"
                }
            ]
        )
    })

    it("limits each player to their latest 162 games while continuing backward for players with fewer games", async function () {
        const season = new Date().getUTCFullYear()

        const service = new DownloaderService(
            baseDataDir,
            0
        )

        const subject = service as any

        const accumulatedGamePksByPlayer = new Map<string, number[]>()

        subject.getRollingGamesBeforeDate = async (
            requestedSeason: number,
            cutoffDate: string
        ): Promise<any[]> => {
            assert.equal(
                requestedSeason,
                season
            )

            assert.match(
                cutoffDate,
                /^\d{4}-\d{2}-\d{2}$/
            )

            return Array.from(
                {
                    length: 200
                },
                (_, index) => {
                    const gamePk = 200 - index

                    return {
                        sourceSeason: gamePk > 100
                            ? season
                            : season - 1,

                        game: {
                            gamePk,
                            officialDate: gamePk > 100
                                ? `${season}-04-01`
                                : `${season - 1}-09-01`
                        }
                    }
                }
            )
        }

        subject.getOrDownloadGame = async (_sourceSeason: number, gamePk: number): Promise<any> => {
            return {
                downloaded: false,

                data: {
                    gamePk,

                    playerIds: gamePk <= 50
                        ? [
                            "player-a",
                            "player-b"
                        ]
                        : [
                            "player-a"
                        ]
                }
            }
        }

        subject.isGameComplete = (): boolean => {
            return true
        }

        subject.getParticipatingPlayerIds = (gameData: any): Set<string> => {
            return new Set(
                gameData.playerIds
            )
        }

        subject.accumulateGameIntoSeasonPlayerImports = (
            _season: number,
            gamePk: number,
            _gameData: any,
            players: Map<string, any>,
            eligiblePlayerIds: Set<string>
        ): void => {
            for (const playerId of eligiblePlayerIds) {
                const accumulatedGamePks =
                    accumulatedGamePksByPlayer.get(playerId) ??
                    []

                accumulatedGamePks.push(
                    gamePk
                )

                accumulatedGamePksByPlayer.set(
                    playerId,
                    accumulatedGamePks
                )

                if (!players.has(playerId)) {
                    players.set(
                        playerId,
                        {
                            playerId
                        }
                    )
                }
            }
        }

        subject.finalizePlayerImportRaw = (): void => {}

        subject.writeResultsFile = async (): Promise<void> => {}

        await service.buildSeasonPlayerImports(
            season,
            undefined,
            true
        )

        const playerAGames =
            accumulatedGamePksByPlayer.get("player-a") ??
            []

        const playerBGames =
            accumulatedGamePksByPlayer.get("player-b") ??
            []

        assert.equal(
            playerAGames.length,
            162
        )

        assert.equal(
            playerAGames[0],
            200
        )

        assert.equal(
            playerAGames[playerAGames.length - 1],
            39
        )

        assert.equal(
            playerBGames.length,
            50
        )

        assert.equal(
            playerBGames[0],
            50
        )

        assert.equal(
            playerBGames[playerBGames.length - 1],
            1
        )

        assert.equal(
            playerAGames.includes(38),
            false
        )

        assert.equal(
            playerBGames.includes(38),
            true
        )
    })
})