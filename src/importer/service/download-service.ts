import {
    downloadSeason,
    hooks,
    queries
} from "baseball-database"

import { PlayerRatingInputRepository } from "../../ratings/repository/player-rating-input-repository.js"
import { SchemaService } from "./schema-service.js"
import { PlayerRatingSeasonInputRepository } from "../../ratings/repository/player-rating-season-input-repository.js"


class DownloadService {

    private readonly firstRatingSeason = 2008

    public constructor(
        private readonly schemaService: SchemaService,
        private readonly playerRatingInputRepository: PlayerRatingInputRepository,
        private readonly playerRatingSeasonInputRepository: PlayerRatingSeasonInputRepository
    ) {}

    public async syncSeason(season: number, force = false): Promise<Set<number>> {
        this.validateSeason(
            season
        )

        this.prepare()

        const gamePks = await downloadSeason(
            season,
            force
        )

        this.playerRatingSeasonInputRepository.create(
            season
        )

        return gamePks
    }

    public async syncRatingHistory(endSeason: number, force = false): Promise<Map<number, Set<number>>> {
        this.validateEndSeason(
            endSeason
        )

        this.prepare()

        const results = new Map<number, Set<number>>()
        const currentSeason = new Date().getUTCFullYear()

        for (let season = this.firstRatingSeason; season <= endSeason; season++) {
            const seasonInputsExist = this.playerRatingSeasonInputRepository.getBySeason(
                season
            ).length > 0

            if (
                force ||
                season === currentSeason ||
                !this.isRatingSeasonComplete(season)
            ) {
                const gamePks = await downloadSeason(
                    season,
                    force
                )

                this.playerRatingSeasonInputRepository.create(
                    season
                )

                results.set(
                    season,
                    gamePks
                )

                continue
            }

            if (!seasonInputsExist) {
                results.set(
                    season,
                    this.rebuildPreparedRatingSeason(
                        season
                    )
                )
            }
        }

        return results
    }

    public async rebuildRatingSeason(season: number): Promise<Set<number>> {
        this.validateSeason(
            season
        )

        this.prepare()

        return this.rebuildPreparedRatingSeason(
            season
        )
    }

    public async rebuildRatingHistory(endSeason: number): Promise<Map<number, Set<number>>> {
        this.validateEndSeason(
            endSeason
        )

        this.prepare()

        const results = new Map<number, Set<number>>()

        for (let season = this.firstRatingSeason; season <= endSeason; season++) {
            results.set(
                season,
                this.rebuildPreparedRatingSeason(
                    season
                )
            )
        }

        return results
    }

    private rebuildPreparedRatingSeason(season: number): Set<number> {
        const gamePks = queries.getCompletedGamePksByDateRange(
            `${season}-01-01`,
            `${season + 1}-01-01`
        )

        const rebuiltGamePks = new Set<number>()
        const startedAt = Date.now()

        console.log(
            `\nRebuilding player rating inputs for ${season} from ${gamePks.length} stored games.`
        )

        this.schemaService.transaction(() => {
            for (let index = 0; index < gamePks.length; index++) {
                const gamePk = gamePks[index]

                this.playerRatingInputRepository.create(
                    gamePk
                )

                rebuiltGamePks.add(
                    gamePk
                )

                const completed = index + 1

                if (
                    completed === gamePks.length ||
                    completed % 100 === 0
                ) {
                    console.log(
                        `[${completed}/${gamePks.length}] Rebuilt player rating inputs.`
                    )
                }
            }

            console.log(
                `Building ${season} player rating season inputs.`
            )

            this.playerRatingSeasonInputRepository.create(
                season
            )
        })

        const elapsedSeconds = Number(
            ((Date.now() - startedAt) / 1000).toFixed(2)
        )

        console.log(
            `Finished rebuilding ${rebuiltGamePks.size} games and the ${season} season inputs in ${elapsedSeconds}s.`
        )

        return rebuiltGamePks
    }


    private isRatingSeasonComplete(season: number): boolean {
        const schedule = queries.getSchedule(
            season
        )

        if (!schedule) {
            return false
        }

        const expectedGamePks = new Set<number>()

        for (const date of schedule.data?.dates ?? []) {
            for (const scheduledGame of date?.games ?? []) {
                if (!this.isCompletedScheduleGame(scheduledGame)) {
                    continue
                }

                const gamePk = Number(
                    scheduledGame.gamePk
                )

                if (Number.isSafeInteger(gamePk) && gamePk > 0) {
                    expectedGamePks.add(
                        gamePk
                    )
                }
            }
        }

        if (expectedGamePks.size === 0) {
            return false
        }

        const storedGamePks = new Set(
            queries.getCompletedGamePksByDateRange(
                `${season}-01-01`,
                `${season + 1}-01-01`
            )
        )

        return Array.from(expectedGamePks).every(gamePk =>
            storedGamePks.has(gamePk)
        )
    }

    private isCompletedScheduleGame(game: any): boolean {
        const abstractGameState = String(
            game?.status?.abstractGameState ??
            ""
        )

        const detailedState = String(
            game?.status?.detailedState ??
            ""
        )

        const codedGameState = String(
            game?.status?.codedGameState ??
            ""
        )

        const statusCode = String(
            game?.status?.statusCode ??
            ""
        )

        if (
            detailedState === "Postponed" ||
            detailedState === "Cancelled" ||
            detailedState === "Suspended" ||
            codedGameState === "C" ||
            codedGameState === "D" ||
            statusCode === "CO" ||
            statusCode === "DR"
        ) {
            return false
        }

        return abstractGameState === "Final" ||
            detailedState === "Final" ||
            detailedState === "Game Over" ||
            detailedState === "Completed Early" ||
            codedGameState === "F"
    }

    private prepare(): void {
        this.schemaService.load()

        hooks.setGameSyncHooks([
            {
                run: game => {
                    this.playerRatingInputRepository.create(
                        game.gamePk
                    )
                }
            }
        ])
    }

    private validateSeason(season: number): void {
        if (!Number.isInteger(season) || season <= 0) {
            throw new Error(
                `Season must be a positive integer: ${season}.`
            )
        }
    }

    private validateEndSeason(endSeason: number): void {
        if (!Number.isInteger(endSeason) || endSeason < this.firstRatingSeason) {
            throw new Error(
                `End season must be an integer greater than or equal to ${this.firstRatingSeason}: ${endSeason}.`
            )
        }
    }
}


export {
    DownloadService
}