import {
    queries
} from "baseball-database"

import type {
    PitchEnvironmentTarget
} from "../../sim/service/interfaces.js"

import {
    GameLineupService
} from "./game-lineup-service.js"

import type {
    TeamBundle
} from "./game-lineup-service.js"

import {
    MlbRosterService
} from "./mlb-roster-service.js"

import type {
    MlbRosterEntry,
    MlbTeam
} from "./mlb-roster-service.js"

import {
    PitchEnvironmentTargetService
} from "./pitch-environment-target-service.js"

import {
    PlayerRatingService
} from "./player-rating-service.js"


class MlbGameBundleService {

    public constructor(
        private readonly mlbRosterService: MlbRosterService,
        private readonly gameLineupService: GameLineupService,
        private readonly playerRatingService: PlayerRatingService,
        private readonly pitchEnvironmentTargetService: PitchEnvironmentTargetService
    ) {}

    public async build(gameDate: string): Promise<MlbDailyBundle> {
        this.validateGameDate(
            gameDate
        )

        const season = Number(
            gameDate.slice(0, 4)
        )

        const schedule = queries.getSchedule(
            season
        )

        if (!schedule) {
            throw new Error(
                `MLB schedule not found for season ${season}.`
            )
        }

        const scheduleDate = (schedule.data.dates ?? []).find(date =>
            String(date?.date ?? "") === gameDate
        )

        await this.mlbRosterService.syncRosters(
            gameDate
        )

        const [
            teams,
            pitchEnvironmentTarget
        ] = await Promise.all([
            this.mlbRosterService.getTeams(
                season
            ),
            this.pitchEnvironmentTargetService.getForDate(
                gameDate
            )
        ])

        const games = (scheduleDate?.games ?? []).map(scheduledGame => {
            const gamePk = Number(
                scheduledGame?.gamePk
            )

            const awayTeamId = Number(
                scheduledGame?.teams?.away?.team?.id
            )

            const homeTeamId = Number(
                scheduledGame?.teams?.home?.team?.id
            )

            if (
                !Number.isSafeInteger(gamePk) ||
                gamePk <= 0
            ) {
                throw new Error(
                    `Invalid MLB game PK for ${gameDate}.`
                )
            }

            return {
                gamePk,
                awayTeam: this.getTeam(
                    teams,
                    awayTeamId,
                    gamePk
                ),
                homeTeam: this.getTeam(
                    teams,
                    homeTeamId,
                    gamePk
                )
            }
        })

        const rosterEntries = await Promise.all(
            games.flatMap(game => [
                this.getGameRoster(
                    gameDate,
                    game.gamePk,
                    game.awayTeam
                ),
                this.getGameRoster(
                    gameDate,
                    game.gamePk,
                    game.homeTeam
                )
            ])
        )

        const playerIds = new Set(
            rosterEntries.flatMap(roster =>
                roster.entries.map(entry =>
                    String(entry.playerId)
                )
            )
        )

        const ratings = await this.playerRatingService.buildPlayerRatingsForDate(
            season,
            gameDate,
            pitchEnvironmentTarget,
            playerIds
        )

        const rosters = new Map(
            rosterEntries.map(roster => [
                this.getRosterKey(
                    roster.gamePk,
                    roster.team.id
                ),
                roster.entries
            ])
        )

        const bundles = await Promise.all(
            games.map(async game => {
                const awayRoster = rosters.get(
                    this.getRosterKey(
                        game.gamePk,
                        game.awayTeam.id
                    )
                )

                const homeRoster = rosters.get(
                    this.getRosterKey(
                        game.gamePk,
                        game.homeTeam.id
                    )
                )

                if (!awayRoster) {
                    throw new Error(
                        `Roster for ${game.awayTeam.abbrev} was not found for game ${game.gamePk}.`
                    )
                }

                if (!homeRoster) {
                    throw new Error(
                        `Roster for ${game.homeTeam.abbrev} was not found for game ${game.gamePk}.`
                    )
                }

                const [
                    away,
                    home
                ] = await Promise.all([
                    this.gameLineupService.build(
                        gameDate,
                        game.awayTeam,
                        awayRoster,
                        ratings,
                        game.gamePk
                    ),
                    this.gameLineupService.build(
                        gameDate,
                        game.homeTeam,
                        homeRoster,
                        ratings,
                        game.gamePk
                    )
                ])

                return {
                    gamePk: game.gamePk,
                    away,
                    home
                }
            })
        )

        return {
            date: gameDate,
            pitchEnvironmentTarget,
            games: bundles
        }
    }

    private async getGameRoster(gameDate: string, gamePk: number, team: MlbTeam): Promise<MlbGameRoster> {
        return {
            gamePk,
            team,
            entries: await this.gameLineupService.getRoster(
                gameDate,
                team,
                gamePk
            )
        }
    }

    private getRosterKey(gamePk: number, teamId: number): string {
        return `${gamePk}:${teamId}`
    }

    private getTeam(teams: MlbTeam[], teamId: number, gamePk: number): MlbTeam {
        const team = teams.find(team =>
            team.id === teamId
        )

        if (!team) {
            throw new Error(
                `MLB team ${teamId} for game ${gamePk} was not found.`
            )
        }

        return team
    }

    private validateGameDate(gameDate: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
            throw new Error(
                `Invalid MLB game date: ${gameDate}.`
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
                `Invalid MLB game date: ${gameDate}.`
            )
        }
    }

}


interface MlbGameRoster {
    gamePk: number
    team: MlbTeam
    entries: MlbRosterEntry[]
}


interface MlbGameBundle {
    gamePk: number
    away: TeamBundle
    home: TeamBundle
}


interface MlbDailyBundle {
    date: string
    pitchEnvironmentTarget: PitchEnvironmentTarget
    games: MlbGameBundle[]
}


export {
    MlbGameBundleService
}


export type {
    MlbDailyBundle,
    MlbGameBundle
}