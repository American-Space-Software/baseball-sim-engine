import { queries } from "baseball-database"
import type { PitchEnvironmentTarget, Player, StadiumEnvironment } from "../../sim/service/interfaces.js"
import { BaseballSavantService } from "./baseball-savant-service.js"
import { GameLineupService } from "./game-lineup-service.js"
import type { TeamBundle } from "./game-lineup-service.js"
import { MlbRosterService } from "./mlb-roster-service.js"
import type { MlbRosterEntry, MlbTeam } from "./mlb-roster-service.js"
import { PitchEnvironmentTargetService } from "./pitch-environment-target-service.js"
import { PlayerRatingService } from "./player-rating-service.js"
import { PlayerStatService } from "./player-stat-service.js"
import type { PlayerStats } from "./player-stat-service.js"
import { TeamRatingService } from "./team-rating-service.js"
import type { TeamRating } from "../repository/team-rating-repository.js"

const TEAM_RATING_ADVANTAGE_PER_100_RATING_POINTS = 0.00

class MlbGameBundleService {

    public constructor(private readonly mlbRosterService: MlbRosterService, private readonly gameLineupService: GameLineupService, private readonly playerRatingService: PlayerRatingService, private readonly pitchEnvironmentTargetService: PitchEnvironmentTargetService, private readonly playerStatService: PlayerStatService, private readonly baseballSavantService: BaseballSavantService, private readonly teamRatingService: TeamRatingService) {}

    public async build(gameDate: string): Promise<MlbDailyBundle> {
        this.validateGameDate(gameDate)

        const season = Number(gameDate.slice(0, 4))
        const schedule = queries.getSchedule(season)

        if (!schedule) {
            throw new Error(`MLB schedule not found for season ${season}.`)
        }

        const scheduleDate = (schedule.data.dates ?? []).find(date => String(date?.date ?? "") === gameDate)

        await this.mlbRosterService.syncRosters(gameDate)

        const [teams, pitchEnvironmentTarget, teamRatings] = await Promise.all([
            this.mlbRosterService.getTeams(season),
            this.pitchEnvironmentTargetService.getForDate(gameDate),
            this.teamRatingService.getRatingsForDate(gameDate)
        ])

        const stadiumEnvironments = await this.baseballSavantService.getStadiumEnvironments(
            season,
            teams
        )

        const games = (scheduleDate?.games ?? []).map(scheduledGame => {
            const gamePk = Number(scheduledGame?.gamePk)
            const awayTeamId = Number(scheduledGame?.teams?.away?.team?.id)
            const homeTeamId = Number(scheduledGame?.teams?.home?.team?.id)

            if (!Number.isSafeInteger(gamePk) || gamePk <= 0) {
                throw new Error(`Invalid MLB game PK for ${gameDate}.`)
            }

            return {
                gamePk,
                awayTeam: this.getTeam(teams, awayTeamId, gamePk),
                homeTeam: this.getTeam(teams, homeTeamId, gamePk)
            }
        })

        const rosterEntries = await Promise.all(
            games.flatMap(game => [
                this.getGameRoster(gameDate, game.gamePk, game.awayTeam),
                this.getGameRoster(gameDate, game.gamePk, game.homeTeam)
            ])
        )

        const playerIds = new Set(rosterEntries.flatMap(roster => roster.entries.map(entry => String(entry.playerId))))

        const [ratings, statsByPlayerId] = await Promise.all([
            this.playerRatingService.buildPlayerRatingsForDate(season, gameDate, pitchEnvironmentTarget, playerIds),
            Promise.resolve(this.playerStatService.getStats(gameDate, playerIds))
        ])

        const rosters = new Map(
            rosterEntries.map(roster => [
                this.getRosterKey(roster.gamePk, roster.team.id),
                roster.entries
            ])
        )

        const bundles = await Promise.all(
            games.map(async game => {
                const awayRoster = rosters.get(this.getRosterKey(game.gamePk, game.awayTeam.id))
                const homeRoster = rosters.get(this.getRosterKey(game.gamePk, game.homeTeam.id))

                if (!awayRoster) {
                    throw new Error(`Roster for ${game.awayTeam.abbrev} was not found for game ${game.gamePk}.`)
                }

                if (!homeRoster) {
                    throw new Error(`Roster for ${game.homeTeam.abbrev} was not found for game ${game.gamePk}.`)
                }

                const awayTeamRating = teamRatings.teams[String(game.awayTeam.id)]
                const homeTeamRating = teamRatings.teams[String(game.homeTeam.id)]

                const [away, home] = await Promise.all([
                    this.gameLineupService.build(gameDate, game.awayTeam, awayRoster, ratings, game.gamePk),
                    this.gameLineupService.build(gameDate, game.homeTeam, homeRoster, ratings, game.gamePk)
                ])

                return {
                    gamePk: game.gamePk,
                    away: this.addTeamRating(this.addPlayerStats(away, season, statsByPlayerId), awayTeamRating),
                    home: this.addTeamRating(this.addPlayerStats(home, season, statsByPlayerId), homeTeamRating),
                    homeFieldAdvantage: this.getHomeFieldAdvantage(
                        pitchEnvironmentTarget,
                        awayTeamRating,
                        homeTeamRating
                    )
                }
            })
        )

        return {
            date: gameDate,
            pitchEnvironmentTarget,
            stadiumEnvironments,
            games: bundles
        }
    }

    private async getGameRoster(gameDate: string, gamePk: number, team: MlbTeam): Promise<MlbGameRoster> {
        return {
            gamePk,
            team,
            entries: await this.gameLineupService.getRoster(gameDate, team, gamePk)
        }
    }

    private addPlayerStats(bundle: TeamBundle, season: number, statsByPlayerId: Map<string, PlayerStats>): MlbTeamBundle {
        return {
            ...bundle,
            playerStats: bundle.players.map(player => this.buildPlayerStats(player, season, statsByPlayerId.get(player._id)))
        }
    }

    private addTeamRating(bundle: MlbTeamBundle, teamRating: TeamRating | undefined): MlbTeamBundle {
        return {
            ...bundle,
            teamRating
        }
    }

    private getHomeFieldAdvantage(_pitchEnvironmentTarget: PitchEnvironmentTarget, awayTeamRating: TeamRating | undefined, homeTeamRating: TeamRating | undefined): number {
        if (!awayTeamRating || !homeTeamRating) {
            return 0
        }

        const ratingDifference = homeTeamRating.rating - awayTeamRating.rating

        return ratingDifference / 100 * TEAM_RATING_ADVANTAGE_PER_100_RATING_POINTS
    }

    private buildPlayerStats(player: Player, season: number, stats?: PlayerStats): MlbPlayerStats {
        const hitting = stats?.seasonHitterStats.find(entry => entry.season === season)?.stats
        const pitching = stats?.seasonPitcherStats.find(entry => entry.season === season)?.stats

        return {
            playerId: player._id,
            hitting: {
                avg: hitting?.avg ?? 0,
                obp: hitting?.obp ?? 0,
                slg: hitting?.slg ?? 0,
                ops: hitting?.ops ?? 0
            },
            pitching: {
                era: pitching?.era ?? 0,
                whip: this.getWhip(pitching?.hits ?? 0, pitching?.bb ?? 0, pitching?.outs ?? 0),
                soPercent: pitching?.soPercent ?? 0,
                bbPercent: pitching?.bbPercent ?? 0
            }
        }
    }

    private getWhip(hits: number, walks: number, outs: number): number {
        if (outs <= 0) return 0
        return (hits + walks) / (outs / 3)
    }

    private getRosterKey(gamePk: number, teamId: number): string {
        return `${gamePk}:${teamId}`
    }

    private getTeam(teams: MlbTeam[], teamId: number, gamePk: number): MlbTeam {
        const team = teams.find(team => team.id === teamId)

        if (!team) {
            throw new Error(`MLB team ${teamId} for game ${gamePk} was not found.`)
        }

        return team
    }

    private validateGameDate(gameDate: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
            throw new Error(`Invalid MLB game date: ${gameDate}.`)
        }

        const parsed = new Date(`${gameDate}T12:00:00.000Z`)

        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== gameDate) {
            throw new Error(`Invalid MLB game date: ${gameDate}.`)
        }
    }

}

interface MlbGameRoster {
    gamePk: number
    team: MlbTeam
    entries: MlbRosterEntry[]
}

interface MlbHittingStats {
    avg: number
    obp: number
    slg: number
    ops: number
}

interface MlbPitchingStats {
    era: number
    whip: number
    soPercent: number
    bbPercent: number
}

interface MlbPlayerStats {
    playerId: string
    hitting: MlbHittingStats
    pitching: MlbPitchingStats
}

interface MlbTeamBundle extends TeamBundle {
    playerStats: MlbPlayerStats[]
    teamRating?: TeamRating
}

interface MlbGameBundle {
    gamePk: number
    away: MlbTeamBundle
    home: MlbTeamBundle
    homeFieldAdvantage: number
}

interface MlbDailyBundle {
    date: string
    pitchEnvironmentTarget: PitchEnvironmentTarget
    stadiumEnvironments: StadiumEnvironment[]
    games: MlbGameBundle[]
}

export {
    MlbGameBundleService
}

export type {
    MlbDailyBundle,
    MlbGameBundle,
    MlbHittingStats,
    MlbPitchingStats,
    MlbPlayerStats,
    MlbTeamBundle
}