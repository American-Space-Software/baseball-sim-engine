import assert from "assert"

import path from "path"


import { DownloaderService } from "../src/importer/service/downloader-service.js"

describe("Downloader Service", function () {


    it("combines the current and previous season schedules newest-first for current-season ratings", async () => {
        const currentSeason =
            new Date().getUTCFullYear()

        const service =
            new DownloaderService(
                path.resolve("data"),
                0
            )

        const subject =
            service as any

        subject.getSeasonGames = async (season: number): Promise<any[]> => {
            if (season === currentSeason - 1) {
                return [
                    {
                        gamePk: 101,
                        officialDate: `${currentSeason - 1}-09-01`
                    },
                    {
                        gamePk: 102,
                        officialDate: `${currentSeason - 1}-09-02`
                    }
                ]
            }

            if (season === currentSeason) {
                return [
                    {
                        gamePk: 201,
                        officialDate: `${currentSeason}-04-01`
                    },
                    {
                        gamePk: 202,
                        officialDate: `${currentSeason}-04-02`
                    }
                ]
            }

            throw new Error(
                `Unexpected season ${season}.`
            )
        }

        const games =
            await subject.getRollingCurrentSeasonGames(
                currentSeason
            )

        assert.deepEqual(
            games.map((row: any) => ({
                sourceSeason: row.sourceSeason,
                gamePk: row.game.gamePk,
                gameDate: row.game.officialDate
            })),
            [
                {
                    sourceSeason: currentSeason,
                    gamePk: 202,
                    gameDate: `${currentSeason}-04-02`
                },
                {
                    sourceSeason: currentSeason,
                    gamePk: 201,
                    gameDate: `${currentSeason}-04-01`
                },
                {
                    sourceSeason: currentSeason - 1,
                    gamePk: 102,
                    gameDate: `${currentSeason - 1}-09-02`
                },
                {
                    sourceSeason: currentSeason - 1,
                    gamePk: 101,
                    gameDate: `${currentSeason - 1}-09-01`
                }
            ]
        )
    })


    it("limits each player to their latest 162 games while continuing backward for players with fewer games", async () => {
        const currentSeason =
            new Date().getUTCFullYear()

        const service =
            new DownloaderService(
                path.resolve("data"),
                0
            )

        const subject =
            service as any

        const accumulatedGamePksByPlayer =
            new Map<string, number[]>()

        subject.getRollingCurrentSeasonGames = async (): Promise<any[]> => {
            return Array.from(
                {
                    length: 200
                },
                (_, index) => {
                    const gamePk =
                        200 - index

                    return {
                        sourceSeason: gamePk > 100
                            ? currentSeason
                            : currentSeason - 1,
                        game: {
                            gamePk,
                            officialDate: `${currentSeason - 1}-01-01`
                        }
                    }
                }
            )
        }

        subject.getOrDownloadGame = async (_season: number, gamePk: number): Promise<any> => {
            return {
                downloaded: false,
                data: {
                    gamePk,
                    playerIds: gamePk <= 50
                        ? ["player-a", "player-b"]
                        : ["player-a"]
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
                    accumulatedGamePksByPlayer.get(playerId) ?? []

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
            currentSeason
        )

        const playerAGames =
            accumulatedGamePksByPlayer.get("player-a") ?? []

        const playerBGames =
            accumulatedGamePksByPlayer.get("player-b") ?? []

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