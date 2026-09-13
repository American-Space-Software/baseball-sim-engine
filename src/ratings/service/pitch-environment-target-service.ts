import {
    queries
} from "baseball-database"

import type {
    StatExport
} from "baseball-database"

import type {
    PitchEnvironmentTarget
} from "../../sim/service/interfaces.js"

import {
    PitchEnvironmentService
} from "../../importer/service/pitch-environment-service.js"

import type {
    PitchEnvironmentStats
} from "../../importer/service/pitch-environment-service.js"

import {
    DownloadService
} from "../../importer/service/download-service.js"

import {
    PitchEnvironmentTargetRepository
} from "../repository/pitch-environment-target-repository.js"


interface PitchEnvironmentTargetOptions {
    forceRebuild?: boolean
}


interface PitchEnvironmentState {
    season: number
    startDate: string
    endDateExclusive: string
    stats: PitchEnvironmentStats
}


class PitchEnvironmentTargetService {

    private readonly homeFieldAdvantageCache = new Map<number, number>()
    private state?: PitchEnvironmentState

    public constructor(private readonly pitchEnvironmentTargetRepository: PitchEnvironmentTargetRepository, private readonly downloadService: DownloadService) {}

    public async getForDate(gameDate: string, options: PitchEnvironmentTargetOptions = {}): Promise<PitchEnvironmentTarget> {
        this.validateGameDate(gameDate)

        const season = Number(
            gameDate.slice(
                0,
                4
            )
        )

        if (!options.forceRebuild) {
            const cached = await this.pitchEnvironmentTargetRepository.read(
                gameDate
            )

            if (cached) {
                if (cached.homeFieldAdvantage === 0) {
                    cached.homeFieldAdvantage = await this.getHomeFieldAdvantage(
                        season
                    )

                    this.validateTarget(
                        gameDate,
                        cached
                    )

                    await this.pitchEnvironmentTargetRepository.write(
                        gameDate,
                        cached
                    )
                } else {
                    this.validateTarget(
                        gameDate,
                        cached
                    )
                }

                return cached
            }
        }

        const stats = this.getPitchEnvironmentStats(
            season,
            gameDate,
            options.forceRebuild === true
        )

        if (Number(stats.hitterTotals?.pa ?? 0) <= 0) {
            throw new Error(`No backward-looking pitch-environment statistics were available for ${gameDate}`)
        }

        const homeFieldAdvantage = await this.getHomeFieldAdvantage(
            season
        )

        const target = PitchEnvironmentService.getPitchEnvironmentTargetForStats(
            season,
            stats,
            homeFieldAdvantage
        )

        this.validateTarget(
            gameDate,
            target
        )

        await this.pitchEnvironmentTargetRepository.write(
            gameDate,
            target
        )

        return target
    }

    public clearImportCache(season?: number): void {
        if (
            season === undefined ||
            this.state?.season === season
        ) {
            this.state = undefined
        }

        if (season === undefined) {
            this.homeFieldAdvantageCache.clear()
            return
        }

        this.homeFieldAdvantageCache.delete(
            this.getHomeFieldAdvantageSeason(
                season
            )
        )
    }

    private getPitchEnvironmentStats(season: number, gameDate: string, forceRebuild: boolean): PitchEnvironmentStats {
        const startDate = this.addDays(
            gameDate,
            -162
        )

        if (
            !forceRebuild &&
            this.state &&
            this.state.season === season &&
            this.addDays(
                this.state.endDateExclusive,
                1
            ) === gameDate
        ) {
            const outgoingEndDate = this.addDays(
                this.state.startDate,
                1
            )

            const outgoingStats = this.getPitchEnvironmentStatsForDateRange(
                season,
                this.state.startDate,
                outgoingEndDate
            )

            const incomingStats = this.getPitchEnvironmentStatsForDateRange(
                season,
                this.state.endDateExclusive,
                gameDate
            )

            const stats = PitchEnvironmentService.clonePitchEnvironmentStats(
                this.state.stats
            )

            PitchEnvironmentService.subtractPitchEnvironmentStats(
                stats,
                outgoingStats
            )

            PitchEnvironmentService.addPitchEnvironmentStats(
                stats,
                incomingStats
            )

            this.state = {
                season,
                startDate,
                endDateExclusive: gameDate,
                stats
            }

            return PitchEnvironmentService.clonePitchEnvironmentStats(
                stats
            )
        }

        const stats = this.getPitchEnvironmentStatsForDateRange(
            season,
            startDate,
            gameDate
        )

        this.state = {
            season,
            startDate,
            endDateExclusive: gameDate,
            stats
        }

        return PitchEnvironmentService.clonePitchEnvironmentStats(
            stats
        )
    }

    private getPitchEnvironmentStatsForDateRange(season: number, startDate: string, endDateExclusive: string): PitchEnvironmentStats {
        const statExport = queries.getStatExport(
            startDate,
            endDateExclusive
        ) as StatExport

        if ((statExport.games ?? []).length === 0) {
            return PitchEnvironmentService.createPitchEnvironmentStats()
        }

        return PitchEnvironmentService.getPitchEnvironmentStatsForStatExport(
            season,
            statExport
        )
    }

    private async getHomeFieldAdvantage(requestedSeason: number): Promise<number> {
        const season = this.getHomeFieldAdvantageSeason(
            requestedSeason
        )

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
            throw new Error(`MLB schedule not found for home-field calculation in ${season}`)
        }

        let homeWins = 0
        let awayWins = 0

        for (const date of schedule.data.dates ?? []) {
            for (const scheduledGame of date.games ?? []) {
                if (!this.isCompleteGame(scheduledGame)) {
                    continue
                }

                const gamePk = Number(
                    scheduledGame.gamePk
                )

                const game = queries.getGame(
                    gamePk
                )

                if (!game) {
                    throw new Error(`Completed game ${gamePk} was not found in baseball-database`)
                }

                const homeRuns = Number(
                    game.data?.liveData?.linescore?.teams?.home?.runs
                )

                const awayRuns = Number(
                    game.data?.liveData?.linescore?.teams?.away?.runs
                )

                if (
                    !Number.isFinite(homeRuns) ||
                    !Number.isFinite(awayRuns) ||
                    homeRuns === awayRuns
                ) {
                    continue
                }

                if (homeRuns > awayRuns) {
                    homeWins++
                } else {
                    awayWins++
                }
            }
        }

        const decisions = homeWins + awayWins

        if (decisions === 0) {
            throw new Error(`No completed games were found for home-field calculation in ${season}`)
        }

        const homeFieldAdvantage = (homeWins / decisions) - 0.5

        this.homeFieldAdvantageCache.set(
            season,
            homeFieldAdvantage
        )

        return homeFieldAdvantage
    }

    private getHomeFieldAdvantageSeason(requestedSeason: number): number {
        const currentSeason = new Date().getUTCFullYear()

        return requestedSeason === currentSeason
            ? requestedSeason - 1
            : requestedSeason
    }

    private isCompleteGame(game: any): boolean {
        const status = game?.status

        return status?.abstractGameState === "Final" ||
            status?.detailedState === "Final" ||
            status?.codedGameState === "F"
    }

    private validateTarget(gameDate: string, target: PitchEnvironmentTarget): void {
        if (
            !Number.isFinite(target.avgRating) ||
            target.avgRating <= 0
        ) {
            throw new Error(`Pitch environment target has an invalid avgRating for ${gameDate}`)
        }

        if (
            !Number.isFinite(target.importReference?.hitter?.pa) ||
            target.importReference.hitter.pa <= 0
        ) {
            throw new Error(`Pitch environment target has no hitter plate appearances for ${gameDate}`)
        }

        if (!Number.isFinite(target.homeFieldAdvantage)) {
            throw new Error(`Pitch environment target has an invalid homeFieldAdvantage for ${gameDate}`)
        }
    }

    private validateGameDate(gameDate: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
            throw new Error(`Invalid pitch-environment game date: ${gameDate}`)
        }

        const parsed = new Date(
            `${gameDate}T12:00:00.000Z`
        )

        if (
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== gameDate
        ) {
            throw new Error(`Invalid pitch-environment game date: ${gameDate}`)
        }
    }

    private addDays(value: string, days: number): string {
        const date = new Date(
            `${value}T12:00:00.000Z`
        )

        date.setUTCDate(
            date.getUTCDate() +
            days
        )

        return date.toISOString().slice(
            0,
            10
        )
    }

}


export {
    PitchEnvironmentTargetService
}


export type {
    PitchEnvironmentTargetOptions
}
