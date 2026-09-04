import {
    queries
} from "baseball-database"

import {
    PitchEnvironmentService
} from "../../importer/service/pitch-environment-service.js"

import {
    PlayerImportService
} from "../../importer/service/player-import-service.js"

import {
    DownloadService
} from "../../importer/service/download-service.js"

import type {
    PitchEnvironmentTarget
} from "../../sim/service/interfaces.js"

import {
    PitchEnvironmentTargetRepository
} from "../repository/pitch-environment-target-repository.js"


class PitchEnvironmentTargetService {

    private readonly homeFieldAdvantageCache = new Map<number, number>()

    public constructor(
        private readonly pitchEnvironmentTargetRepository: PitchEnvironmentTargetRepository,
        private readonly playerImportService: PlayerImportService,
        private readonly downloadService: DownloadService
    ) {}

    public async getForDate(gameDate: string, options: PitchEnvironmentTargetOptions = {}): Promise<PitchEnvironmentTarget> {
        const season = this.getSeason(
            gameDate
        )

        if (!options.forceRebuild) {
            const cached = await this.pitchEnvironmentTargetRepository.read(
                gameDate
            )

            if (cached) {
                if (Number(cached.homeFieldAdvantage ?? 0) === 0) {
                    cached.homeFieldAdvantage = await this.getSeasonHomeFieldAdvantage(
                        this.getHomeFieldReferenceSeason(season)
                    )

                    this.validateTarget(
                        cached,
                        gameDate
                    )

                    await this.pitchEnvironmentTargetRepository.write(
                        gameDate,
                        cached
                    )
                } else {
                    this.validateTarget(
                        cached,
                        gameDate
                    )
                }

                return cached
            }
        }

        const players = await this.playerImportService.buildCorePlayerImports(
            season,
            gameDate
        )

        if (players.size === 0) {
            throw new Error(
                `No backward-looking player imports were available for ${gameDate}.`
            )
        }

        const homeFieldAdvantage = await this.getSeasonHomeFieldAdvantage(
            this.getHomeFieldReferenceSeason(season)
        )

        const target = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
            season,
            players,
            homeFieldAdvantage
        )

        this.validateTarget(
            target,
            gameDate
        )

        await this.pitchEnvironmentTargetRepository.write(
            gameDate,
            target
        )

        return target
    }

    public clearImportCache(season?: number): void {
        this.playerImportService.clearCache(
            season
        )

        if (season === undefined) {
            this.homeFieldAdvantageCache.clear()
            return
        }

        this.homeFieldAdvantageCache.delete(
            this.getHomeFieldReferenceSeason(season)
        )
    }

    private getHomeFieldReferenceSeason(season: number): number {
        const currentSeason = new Date().getUTCFullYear()

        return season === currentSeason
            ? season - 1
            : season
    }

    private async getSeasonHomeFieldAdvantage(season: number): Promise<number> {
        const cached = this.homeFieldAdvantageCache.get(
            season
        )

        if (cached !== undefined) {
            return cached
        }

        await this.downloadService.syncSeason(
            season
        )

        const schedule = queries.getSchedule(
            season
        )

        if (!schedule) {
            throw new Error(
                `Schedule ${season} was not found after synchronization.`
            )
        }

        let homeWins = 0
        let awayWins = 0

        for (const date of schedule.data?.dates ?? []) {
            for (const scheduledGame of date?.games ?? []) {
                const gamePk = Number(
                    scheduledGame?.gamePk
                )

                if (
                    !gamePk ||
                    !this.isCompletedScheduleGame(scheduledGame)
                ) {
                    continue
                }

                const storedGame = queries.getGame(
                    gamePk
                )

                if (!storedGame) {
                    throw new Error(
                        `Completed game ${gamePk} was not found in baseball-database.`
                    )
                }

                const homeScore = Number(
                    storedGame.data
                        ?.liveData
                        ?.linescore
                        ?.teams
                        ?.home
                        ?.runs
                )

                const awayScore = Number(
                    storedGame.data
                        ?.liveData
                        ?.linescore
                        ?.teams
                        ?.away
                        ?.runs
                )

                if (
                    !Number.isFinite(homeScore) ||
                    !Number.isFinite(awayScore) ||
                    homeScore === awayScore
                ) {
                    continue
                }

                if (homeScore > awayScore) {
                    homeWins++
                } else {
                    awayWins++
                }
            }
        }

        const completedGames =
            homeWins +
            awayWins

        if (completedGames === 0) {
            throw new Error(
                `No completed games were found for home-field calculation in ${season}.`
            )
        }

        const homeFieldAdvantage =
            homeWins / completedGames - 0.5

        this.homeFieldAdvantageCache.set(
            season,
            homeFieldAdvantage
        )

        return homeFieldAdvantage
    }

    private isCompletedScheduleGame(game: any): boolean {
        const abstractState = String(
            game?.status?.abstractGameState ?? ""
        )

        const detailedState = String(
            game?.status?.detailedState ?? ""
        )

        const codedState = String(
            game?.status?.codedGameState ?? ""
        )

        return abstractState === "Final" ||
            codedState === "F" ||
            detailedState === "Final" ||
            detailedState === "Game Over" ||
            detailedState === "Completed Early"
    }

    private getSeason(gameDate: string): number {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
            throw new Error(
                `Invalid pitch-environment game date: ${gameDate}.`
            )
        }

        const parsed = new Date(
            `${gameDate}T12:00:00.000Z`
        )

        if (
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== gameDate
        ) {
            throw new Error(
                `Invalid pitch-environment game date: ${gameDate}.`
            )
        }

        return Number(
            gameDate.slice(
                0,
                4
            )
        )
    }

    private validateTarget(target: PitchEnvironmentTarget, gameDate: string): void {
        if (
            !target ||
            typeof target !== "object"
        ) {
            throw new Error(
                `Pitch environment target is empty for ${gameDate}.`
            )
        }

        if (
            !Number.isFinite(
                Number(target.avgRating)
            ) ||
            Number(target.avgRating) <= 0
        ) {
            throw new Error(
                `Pitch environment target has an invalid avgRating for ${gameDate}.`
            )
        }

        const hitterPlateAppearances = Number(
            target.importReference
                ?.hitter
                ?.pa ??
            0
        )

        if (
            !Number.isFinite(hitterPlateAppearances) ||
            hitterPlateAppearances <= 0
        ) {
            throw new Error(
                `Pitch environment target has no hitter plate appearances for ${gameDate}.`
            )
        }
    }

}


interface PitchEnvironmentTargetOptions {
    forceRebuild?: boolean
}


export {
    PitchEnvironmentTargetService
}


export type {
    PitchEnvironmentTargetOptions
}
