import glicko2 from "glicko2"

import {
    queries
} from "baseball-database"

import {
    TeamRatingRepository
} from "../repository/team-rating-repository.js"

import type {
    TeamRating,
    TeamRatingSnapshot
} from "../repository/team-rating-repository.js"


const GLICKO_SETTINGS = {
    tau: 0.5,
    rating: 1500,
    rd: 25,
    vol: 0.06
}


class TeamRatingService {

    public constructor(
        private readonly teamRatingRepository: TeamRatingRepository
    ) {}

    public async getRatingsForDate(gameDate: string): Promise<TeamRatingSnapshot> {
        this.validateDate(gameDate)

        const previousDate = this.addDays(gameDate, -1)
        const previousDaySnapshot = await this.teamRatingRepository.get(previousDate)

        if (previousDaySnapshot) {
            return previousDaySnapshot
        }

        const season = Number(gameDate.slice(0, 4))
        const latest = await this.teamRatingRepository.getLatestBefore(gameDate)
        const schedule = queries.getSchedule(season)

        if (!schedule) {
            throw new Error(`MLB schedule not found for season ${season}.`)
        }

        const teamIds = this.getTeamIds(schedule.data)
        const dates = this.getCompletedDates(schedule.data, gameDate, latest?.date)

        if (latest && dates.length === 0) {
            return latest
        }

        const ratings = latest
            ? structuredClone(latest.teams)
            : this.createDefaultRatings(teamIds)

        for (const teamId of teamIds) {
            if (!ratings[teamId]) {
                ratings[teamId] = this.createDefaultRating()
            }
        }

        for (const date of dates) {
            const snapshot = this.updateRatingPeriod(
                date.date,
                ratings,
                date.games
            )

            await this.teamRatingRepository.put(snapshot)

            Object.assign(
                ratings,
                snapshot.teams
            )
        }

        if (dates.length > 0) {
            return {
                date: dates.at(-1)!.date,
                teams: structuredClone(ratings)
            }
        }

        return {
            date: previousDate,
            teams: structuredClone(ratings)
        }
    }

    private updateRatingPeriod(date: string, ratings: Record<string, TeamRating>, games: any[]): TeamRatingSnapshot {
        const ranking = new glicko2.Glicko2(GLICKO_SETTINGS)
        const players = new Map<string, any>()

        for (const [teamId, rating] of Object.entries(ratings)) {
            players.set(
                teamId,
                ranking.makePlayer(
                    rating.rating,
                    rating.rd,
                    rating.vol
                )
            )
        }

        const matches: any[] = []

        for (const game of games) {
            const awayTeamId = String(game?.teams?.away?.team?.id ?? "")
            const homeTeamId = String(game?.teams?.home?.team?.id ?? "")

            if (!awayTeamId || !homeTeamId) {
                throw new Error(`Completed MLB game ${game?.gamePk ?? "unknown"} does not contain both team IDs.`)
            }

            const awayPlayer = this.getOrCreatePlayer(ranking, players, ratings, awayTeamId)
            const homePlayer = this.getOrCreatePlayer(ranking, players, ratings, homeTeamId)
            const awayScore = Number(game?.teams?.away?.score)
            const homeScore = Number(game?.teams?.home?.score)

            if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) {
                throw new Error(`Completed MLB game ${game?.gamePk ?? "unknown"} does not contain valid scores.`)
            }

            const awayResult = awayScore > homeScore
                ? 1
                : awayScore < homeScore
                    ? 0
                    : 0.5

            matches.push([
                awayPlayer,
                homePlayer,
                awayResult
            ])
        }

        ranking.updateRatings(matches)

        const teams: Record<string, TeamRating> = {}

        for (const [teamId, player] of players.entries()) {
            teams[teamId] = {
                rating: player.getRating(),
                rd: player.getRd(),
                vol: player.getVol()
            }
        }

        return {
            date,
            teams
        }
    }

    private getOrCreatePlayer(ranking: any, players: Map<string, any>, ratings: Record<string, TeamRating>, teamId: string): any {
        const existing = players.get(teamId)

        if (existing) {
            return existing
        }

        const rating = this.createDefaultRating()
        const player = ranking.makePlayer(rating.rating, rating.rd, rating.vol)

        ratings[teamId] = rating
        players.set(teamId, player)

        return player
    }

    private getCompletedDates(schedule: any, gameDate: string, latestDate?: string): CompletedScheduleDate[] {
        return (schedule?.dates ?? [])
            .map((entry: any) => ({
                date: String(entry?.date ?? ""),
                games: (entry?.games ?? []).filter((game: any) => this.isCompletedGameWithScore(game))
            }))
            .filter((entry: CompletedScheduleDate) => entry.date < gameDate)
            .filter((entry: CompletedScheduleDate) => !latestDate || entry.date > latestDate)
            .filter((entry: CompletedScheduleDate) => entry.games.length > 0)
            .sort((a: CompletedScheduleDate, b: CompletedScheduleDate) => a.date.localeCompare(b.date))
    }

    private getTeamIds(schedule: any): string[] {
        const teamIds = new Set<string>()

        for (const entry of schedule?.dates ?? []) {
            for (const game of entry?.games ?? []) {
                const awayTeamId = String(game?.teams?.away?.team?.id ?? "")
                const homeTeamId = String(game?.teams?.home?.team?.id ?? "")

                if (awayTeamId) {
                    teamIds.add(awayTeamId)
                }

                if (homeTeamId) {
                    teamIds.add(homeTeamId)
                }
            }
        }

        return Array.from(teamIds)
    }

    private createDefaultRatings(teamIds: string[]): Record<string, TeamRating> {
        const ratings: Record<string, TeamRating> = {}

        for (const teamId of teamIds) {
            ratings[teamId] = this.createDefaultRating()
        }

        return ratings
    }

    private createDefaultRating(): TeamRating {
        return {
            rating: GLICKO_SETTINGS.rating,
            rd: GLICKO_SETTINGS.rd,
            vol: GLICKO_SETTINGS.vol
        }
    }

    private isCompletedGameWithScore(game: any): boolean {
        const abstractState = String(game?.status?.abstractGameState ?? "")
        const detailedState = String(game?.status?.detailedState ?? "")
        const codedState = String(game?.status?.codedGameState ?? "")
        const awayScore = Number(game?.teams?.away?.score)
        const homeScore = Number(game?.teams?.home?.score)

        const isFinal =
            abstractState === "Final" ||
            detailedState === "Final" ||
            detailedState === "Game Over" ||
            detailedState === "Completed Early" ||
            codedState === "F"

        return isFinal &&
            Number.isFinite(awayScore) &&
            Number.isFinite(homeScore)
    }

    private addDays(date: string, days: number): string {
        const value = new Date(`${date}T12:00:00Z`)

        value.setUTCDate(
            value.getUTCDate() + days
        )

        return value.toISOString().slice(0, 10)
    }

    private validateDate(date: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`Invalid team rating date ${date}.`)
        }

        const parsed = new Date(`${date}T00:00:00Z`)

        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
            throw new Error(`Invalid team rating date ${date}.`)
        }
    }

}


interface CompletedScheduleDate {
    date: string
    games: any[]
}


export {
    GLICKO_SETTINGS,
    TeamRatingService
}
