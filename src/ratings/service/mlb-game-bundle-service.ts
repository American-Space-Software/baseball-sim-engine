import fs from "fs"
import path from "path"
import { queries } from "baseball-database"
import type { PitchEnvironmentTarget, Player, StadiumEnvironment } from "../../sim/service/interfaces.js"
import { BaseballSavantService } from "./baseball-savant-service.js"
import { GameLineupService } from "./game-lineup-service.js"
import type { TeamBundle } from "./game-lineup-service.js"
import { MlbRosterProjectionService } from "./mlb-roster-projection-service.js"
import { MlbRosterService } from "./mlb-roster-service.js"
import type { MlbRosterEntry, MlbTeam } from "./mlb-roster-service.js"
import { PlayerRatingService } from "./player-rating-service.js"
import { PlayerStatService } from "./player-stat-service.js"
import type { PlayerStats } from "./player-stat-service.js"
import { TeamRatingService } from "./team-rating-service.js"
import type { TeamRating } from "../repository/team-rating-repository.js"

const TEAM_RATING_ADVANTAGE_PER_100_RATING_POINTS = 0.00

const defaultBaseDataDir = process.env.DATA_DIR ?? "data"

class MlbGameBundleService {

    public constructor(
        private readonly mlbRosterService: MlbRosterService,
        private readonly gameLineupService: GameLineupService,
        private readonly playerRatingService: PlayerRatingService,
        private readonly playerStatService: PlayerStatService,
        private readonly baseballSavantService: BaseballSavantService,
        private readonly teamRatingService: TeamRatingService,
        private readonly mlbRosterProjectionService: MlbRosterProjectionService,
        private readonly baseDataDir = defaultBaseDataDir
    ) {}

    public async build(gameDate: string): Promise<MlbDailyBundle> {
        const bundleStartedAt = performance.now()
        let stageStartedAt = bundleStartedAt
        const checkpoint = (stage: string): void => {
            const now = performance.now()
            // console.log(`[BUNDLE PERF] ${gameDate} ${stage}: ${(now - stageStartedAt).toFixed(0)}ms stage, ${(now - bundleStartedAt).toFixed(0)}ms total.`)
            stageStartedAt = now
        }
        // console.log(`[BUNDLE PERF] ${gameDate} START ${new Date().toISOString()}`)
        this.validateGameDate(gameDate)
        const season = Number(gameDate.slice(0, 4))
        const schedule = queries.getSchedule(season)
        if (!schedule) {
            throw new Error(`MLB schedule not found for season ${season}.`)
        }
        const scheduleDate = (schedule.data.dates ?? []).find(date => String(date?.date ?? "") === gameDate)
        checkpoint("schedule")
        await this.mlbRosterService.syncRosters(gameDate)
        checkpoint("roster synchronization")
        const sharedLoadStartedAt = performance.now()
        const [teams, activeRosters, pitchEnvironmentTarget, teamRatings] = await Promise.all([
            this.mlbRosterService.getTeams(season).then(value => {
                // console.log(`[BUNDLE PERF] ${gameDate} getTeams: ${(performance.now() - sharedLoadStartedAt).toFixed(0)}ms elapsed.`)
                return value
            }),
            this.mlbRosterService.getRosters(gameDate).then(value => {
                // console.log(`[BUNDLE PERF] ${gameDate} getRosters: ${(performance.now() - sharedLoadStartedAt).toFixed(0)}ms elapsed.`)
                return value
            }),
            this.getPitchEnvironmentTarget(season).then(value => {
                // console.log(`[BUNDLE PERF] ${gameDate} pitch environment: ${(performance.now() - sharedLoadStartedAt).toFixed(0)}ms elapsed.`)
                return value
            }),
            this.teamRatingService.getRatingsForDate(gameDate).then(value => {
                // console.log(`[BUNDLE PERF] ${gameDate} team ratings: ${(performance.now() - sharedLoadStartedAt).toFixed(0)}ms elapsed.`)
                return value
            })
        ])
        checkpoint("shared data loading")
        const stadiumEnvironments = await this.baseballSavantService.getStadiumEnvironments(
            season,
            teams
        )
        checkpoint("stadium environments")
        const games = (scheduleDate?.games ?? []).map(scheduledGame => {
            const gamePk = Number(scheduledGame?.gamePk)
            const awayTeamId = Number(scheduledGame?.teams?.away?.team?.id)
            const homeTeamId = Number(scheduledGame?.teams?.home?.team?.id)
            const scheduleAwayScore = Number(scheduledGame?.teams?.away?.score)
            const scheduleHomeScore = Number(scheduledGame?.teams?.home?.score)
            const scheduledGameDate = String(scheduledGame?.gameDate ?? "")
            if (!Number.isSafeInteger(gamePk) || gamePk <= 0) {
                throw new Error(`Invalid MLB game PK for ${gameDate}.`)
            }
            const gameFeed = queries.getGame(gamePk)?.data
            const feedStatus = gameFeed?.gameData?.status
            const scheduleStatus = scheduledGame?.status
            const status =
                scheduleStatus?.detailedState === "Postponed" ||
                scheduleStatus?.detailedState === "Cancelled"
                    ? scheduleStatus
                    : feedStatus ?? scheduleStatus
            const linescore = gameFeed?.liveData?.linescore
            const currentInning = Number(linescore?.currentInning)
            const feedAwayScore = Number(linescore?.teams?.away?.runs)
            const feedHomeScore = Number(linescore?.teams?.home?.runs)
            const awayScore = Number.isFinite(feedAwayScore)
                ? feedAwayScore
                : scheduleAwayScore
            const homeScore = Number.isFinite(feedHomeScore)
                ? feedHomeScore
                : scheduleHomeScore
            return {
                gamePk,
                gameDate: scheduledGameDate,
                awayTeam: this.getTeam(teams, awayTeamId, gamePk),
                homeTeam: this.getTeam(teams, homeTeamId, gamePk),
                score: Number.isFinite(awayScore) && Number.isFinite(homeScore)
                    ? {
                        away: awayScore,
                        home: homeScore
                    }
                    : undefined,
                status: {
                    abstractGameState: String(status?.abstractGameState ?? ""),
                    detailedState: String(status?.detailedState ?? ""),
                    currentInning: Number.isFinite(currentInning)
                        ? currentInning
                        : undefined,
                    inningState: linescore?.inningState
                        ? String(linescore.inningState)
                        : undefined
                }
            }
        })
        const scheduledTeamIds = new Set(
            games.flatMap(game => [
                game.awayTeam.id,
                game.homeTeam.id
            ])
        )
        const inactiveRosters = activeRosters.filter(roster =>
            !scheduledTeamIds.has(roster.team.id)
        )
        checkpoint("scheduled game lookup")
        // console.log(`[BUNDLE PERF] ${gameDate} game roster projections START`)
        const rosterEntries = await Promise.all(
            games.flatMap(game => {
                const allowPreviousRoster =
                    game.status.detailedState === "Postponed" ||
                    game.status.detailedState === "Cancelled"
                return [
                    this.getGameRoster(gameDate, game.gamePk, game.awayTeam, allowPreviousRoster),
                    this.getGameRoster(gameDate, game.gamePk, game.homeTeam, allowPreviousRoster)
                ]
            })
        )
        checkpoint("game roster projections")
        const playerIds = new Set([
            ...activeRosters.flatMap(roster =>
                roster.players.map(player => String(player.playerId))
            ),
            ...rosterEntries.flatMap(roster =>
                roster.entries.map(player => String(player.playerId))
            )
        ])
        checkpoint("player ID collection")
        // console.log(`[BUNDLE PERF] ${gameDate} player ratings START (${playerIds.size} IDs)`)
        const ratings = await this.playerRatingService.buildPlayerRatingsForDate(
            season,
            gameDate,
            pitchEnvironmentTarget,
            playerIds
        )
        checkpoint(`player ratings (${ratings.size} players)`)
        // console.log(`[BUNDLE PERF] ${gameDate} player stats START`)
        const statsByPlayerId = this.playerStatService.getStats(
            gameDate,
            playerIds
        )
        checkpoint(`player stats (${statsByPlayerId.size} players)`)
        const rosters = new Map(
            rosterEntries.map(roster => [
                this.getRosterKey(roster.gamePk, roster.team.id),
                roster.entries
            ])
        )
        checkpoint("game roster map")
        // console.log(`[BUNDLE PERF] ${gameDate} scheduled game lineups START`)
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
                    date: gameDate,
                    gameDate: game.gameDate,
                    away: this.addTeamRating(
                        this.addPlayerStats(away, season, statsByPlayerId),
                        awayTeamRating
                    ),
                    home: this.addTeamRating(
                        this.addPlayerStats(home, season, statsByPlayerId),
                        homeTeamRating
                    ),
                    score: game.score,
                    status: game.status,
                    homeFieldAdvantage: this.getHomeFieldAdvantage(
                        pitchEnvironmentTarget,
                        awayTeamRating,
                        homeTeamRating
                    )
                }
            })
        )
        checkpoint(`scheduled game lineups (${bundles.length} games)`)
        // console.log(`[BUNDLE PERF] ${gameDate} inactive team lineups START`)
        const inactiveTeams = await Promise.all(
            inactiveRosters.map(async roster => {
                const bundle = await this.gameLineupService.build(
                    gameDate,
                    roster.team,
                    roster.players,
                    ratings
                )

                return this.addTeamRating(
                    this.addPlayerStats(bundle, season, statsByPlayerId),
                    teamRatings.teams[String(roster.team.id)]
                )
            })
        )
        checkpoint(`inactive team lineups (${inactiveTeams.length} teams)`)
        bundles.sort((a, b) =>
            new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()
        )
        inactiveTeams.sort((a, b) =>
            a.team.name.localeCompare(b.team.name)
        )
        checkpoint("sorting")
        // console.log(`[BUNDLE PERF] ${gameDate} BUILD COMPLETE: ${(performance.now() - bundleStartedAt).toFixed(0)}ms total ${new Date().toISOString()}`)
        return {
            date: gameDate,
            pitchEnvironmentTarget,
            stadiumEnvironments,
            games: bundles,
            inactiveTeams
        }
    }

    private async getPitchEnvironmentTarget(season: number): Promise<PitchEnvironmentTarget> {
        const filePath = path.join(
            this.baseDataDir,
            String(season),
            "_pitch_environment_target.json"
        )
        let raw: string
        try {
            raw = await fs.promises.readFile(
                filePath,
                "utf8"
            )
        } catch (error: any) {
            if (error?.code === "ENOENT") {
                throw new Error(`Pitch environment target not found: ${filePath}`)
            }
            throw error
        }
        const target = JSON.parse(raw) as PitchEnvironmentTarget
        if (target.season !== season) {
            throw new Error(`Pitch environment target season ${target.season} does not match requested season ${season}: ${filePath}`)
        }
        if (!target.pitchEnvironmentTuning) {
            throw new Error(`Pitch environment target has no tuning for season ${season}: ${filePath}`)
        }
        return target
    }

    private async getGameRoster(gameDate: string, gamePk: number, team: MlbTeam, allowPreviousRoster = false): Promise<MlbGameRoster> {
        const roster = await this.gameLineupService.getRoster(
            gameDate,
            team,
            gamePk
        )
        try {
            const projection = this.mlbRosterProjectionService.project(
                gameDate,
                team,
                roster,
                gamePk
            )
            return {
                gamePk,
                team,
                entries: projection.players
            }
        } catch (error) {
            if (!allowPreviousRoster) {
                throw error
            }
            const previousRoster = await this.getPreviousProjectedRoster(
                gameDate,
                team
            )
            if (!previousRoster) {
                throw error
            }
            return {
                gamePk,
                team,
                entries: previousRoster
            }
        }
    }

    private async getPreviousProjectedRoster(gameDate: string, team: MlbTeam): Promise<MlbRosterEntry[] | undefined> {
        const schedule = queries.getSchedule(
            Number(
                gameDate.slice(
                    0,
                    4
                )
            )
        )
        const dates = (
            schedule?.data.dates ?? []
        )
            .filter(date =>
                date.date < gameDate &&
                (
                    date.games ?? []
                ).some(game =>
                    Number(
                        game?.teams?.away?.team?.id
                    ) === team.id ||
                    Number(
                        game?.teams?.home?.team?.id
                    ) === team.id
                )
            )
            .sort((a, b) =>
                b.date.localeCompare(
                    a.date
                )
            )
        for (const date of dates) {
            const gamePk = Number(
                (
                    date.games ?? []
                ).find(game =>
                    Number(
                        game?.teams?.away?.team?.id
                    ) === team.id ||
                    Number(
                        game?.teams?.home?.team?.id
                    ) === team.id
                )?.gamePk
            )
            try {
                const roster = await this.mlbRosterService.getRoster(
                    date.date,
                    team
                )
                const projection = this.mlbRosterProjectionService.project(
                    date.date,
                    team,
                    roster,
                    Number.isSafeInteger(gamePk) && gamePk > 0
                        ? gamePk
                        : undefined
                )
                return projection.players
            } catch {
                continue
            }
        }
        return undefined
    }

    private addPlayerStats(bundle: TeamBundle, season: number, statsByPlayerId: Map<string, PlayerStats>): MlbTeamBundle {
        return {
            ...bundle,
            playerStats: bundle.players.map(player =>
                this.buildPlayerStats(player, season, statsByPlayerId.get(player._id))
            )
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

interface MlbGameScore {
    away: number
    home: number
}

interface MlbGameStatus {
    abstractGameState: string
    detailedState: string
    currentInning?: number
    inningState?: string
}

interface MlbGameBundle {
    gamePk: number
    date: string
    gameDate: string
    away: MlbTeamBundle
    home: MlbTeamBundle
    score?: MlbGameScore
    status: MlbGameStatus
    homeFieldAdvantage: number
}

interface MlbDailyBundle {
    date: string
    pitchEnvironmentTarget: PitchEnvironmentTarget
    stadiumEnvironments: StadiumEnvironment[]
    games: MlbGameBundle[]
    inactiveTeams: MlbTeamBundle[]
}

export {
    MlbGameBundleService
}

export type {
    MlbDailyBundle,
    MlbGameBundle,
    MlbGameScore,
    MlbGameStatus,
    MlbHittingStats,
    MlbPitchingStats,
    MlbPlayerStats,
    MlbTeamBundle
}
