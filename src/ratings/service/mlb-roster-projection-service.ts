import dayjs from "dayjs"
import {
    queries
} from "baseball-database"
import {
    Position
} from "../../sim/service/enums.js"
import type {
    MlbRosterEntry,
    MlbTeam
} from "./mlb-roster-service.js"
const ROSTER_SIZE = 26
const MAX_PITCHERS = 13
const MIN_CATCHERS = 2
const RECENT_GAME_COUNT = 14
const PREVIOUS_ROSTER_DAYS = 60
class MlbRosterProjectionService {
    public project(gameDate: string, team: MlbTeam, roster: MlbRosterEntry[], gamePk?: number): RosterProjection {
        if (roster.length <= ROSTER_SIZE) {
            return {
                players: roster,
                projected: false
            }
        }
        const previousRoster = this.getPreviousRoster(gameDate, team.id)
        const previousPlayerIds = new Set(previousRoster.map(entry => entry.playerId))
        const recentAppearances = this.getRecentAppearances(gameDate, team.id)
        const confirmedPlayerIds = this.getConfirmedPlayerIds(gameDate, team.id, gamePk)
        const rotationPitcherIds = this.getRecentStartingPitcherIds(gameDate, team.id)
        const ranked = [...roster].sort((a, b) => {
            const aPrevious = previousPlayerIds.has(a.playerId) ? 1 : 0
            const bPrevious = previousPlayerIds.has(b.playerId) ? 1 : 0
            const aAppearances = recentAppearances.get(a.playerId) ?? 0
            const bAppearances = recentAppearances.get(b.playerId) ?? 0
            return bPrevious - aPrevious ||
                bAppearances - aAppearances ||
                a.playerId.localeCompare(b.playerId)
        })
        const selected = new Map<string, MlbRosterEntry>()
        for (const entry of ranked) {
            if (confirmedPlayerIds.has(entry.playerId)) {
                selected.set(entry.playerId, entry)
            }
        }
        const confirmedPitchers = Array.from(selected.values()).filter(entry =>
            entry.position === Position.PITCHER
        ).length
        if (selected.size > ROSTER_SIZE || confirmedPitchers > MAX_PITCHERS) {
            throw new Error(`Unable to project ${team.abbrev} roster on ${gameDate}: too many confirmed players.`)
        }
        for (const entry of ranked) {
            if (
                entry.position === Position.PITCHER &&
                rotationPitcherIds.has(entry.playerId)
            ) {
                selected.set(entry.playerId, entry)
            }
        }
        if (
            selected.size > ROSTER_SIZE ||
            this.countPosition(selected, Position.PITCHER) > MAX_PITCHERS
        ) {
            throw new Error(`Unable to project ${team.abbrev} roster on ${gameDate}: too many required pitchers.`)
        }
        const pitchers = ranked.filter(entry => entry.position === Position.PITCHER)
        const hitters = ranked.filter(entry => entry.position !== Position.PITCHER)
        const catchers = hitters.filter(entry => entry.position === Position.CATCHER)
        for (const catcher of catchers) {
            if (this.countPosition(selected, Position.CATCHER) >= MIN_CATCHERS) {
                break
            }
            if (selected.size < ROSTER_SIZE) {
                selected.set(catcher.playerId, catcher)
            }
        }
        for (const hitter of hitters) {
            if (selected.size >= ROSTER_SIZE || this.countHitters(selected) >= ROSTER_SIZE - MAX_PITCHERS) {
                break
            }
            selected.set(hitter.playerId, hitter)
        }
        for (const pitcher of pitchers) {
            if (selected.size >= ROSTER_SIZE || this.countPosition(selected, Position.PITCHER) >= MAX_PITCHERS) {
                break
            }
            selected.set(pitcher.playerId, pitcher)
        }
        for (const hitter of hitters) {
            if (selected.size >= ROSTER_SIZE) {
                break
            }
            selected.set(hitter.playerId, hitter)
        }
        for (const pitcher of pitchers) {
            if (selected.size >= ROSTER_SIZE || this.countPosition(selected, Position.PITCHER) >= MAX_PITCHERS) {
                break
            }
            selected.set(pitcher.playerId, pitcher)
        }
        if (selected.size !== ROSTER_SIZE) {
            throw new Error(`Unable to project ${team.abbrev} roster on ${gameDate}: selected ${selected.size} of ${ROSTER_SIZE} players.`)
        }
        const players = roster.filter(entry => selected.has(entry.playerId))
        console.log(
            `Projected ${team.abbrev} roster for ${gameDate}: ${roster.length} candidates, ` +
            `${players.length} selected, ${this.countPosition(selected, Position.PITCHER)} pitchers, ` +
            `${previousRoster.length} players in reference roster.`
        )
        return {
            players,
            projected: true
        }
    }
    private getPreviousRoster(gameDate: string, teamId: number): MlbRosterEntry[] {
        const earliestDate = dayjs(gameDate).subtract(PREVIOUS_ROSTER_DAYS, "day").format("YYYY-MM-DD")
        const schedule = queries.getSchedule(Number(gameDate.slice(0, 4)))
        const dates = (schedule?.data.dates ?? [])
            .filter(date =>
                date.date < gameDate &&
                date.date >= earliestDate &&
                (date.games ?? []).some(game =>
                    Number(game?.teams?.away?.team?.id) === teamId ||
                    Number(game?.teams?.home?.team?.id) === teamId
                )
            )
            .sort((a, b) => b.date.localeCompare(a.date))
        for (const date of dates) {
            const roster = queries.getRoster(date.date, teamId)
            if (roster.length === ROSTER_SIZE) {
                return roster.map(entry => ({
                    playerId: String(entry.playerId),
                    fullName: "",
                    position: this.mapPosition(entry.position)
                }))
            }
        }
        return []
    }
    private getRecentAppearances(gameDate: string, teamId: number): Map<string, number> {
        const schedule = queries.getSchedule(Number(gameDate.slice(0, 4)))
        const appearances = new Map<string, number>()
        const games = (schedule?.data.dates ?? [])
            .filter(date => date.date < gameDate)
            .flatMap(date => (date.games ?? []).filter(game =>
                Number(game?.teams?.away?.team?.id) === teamId ||
                Number(game?.teams?.home?.team?.id) === teamId
            ).map(game => ({
                gamePk: game.gamePk,
                date: date.date
            })))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, RECENT_GAME_COUNT)
        for (const game of games) {
            const feed = queries.getGame(Number(game.gamePk))?.data
            if (!feed) {
                continue
            }
            const side = Number(feed.gameData?.teams?.home?.id) === teamId
                ? "home"
                : "away"
            const boxscore = feed.liveData?.boxscore?.teams?.[side]
            if (!boxscore) {
                continue
            }
            const playerIds = new Set([
                ...(boxscore.batters ?? []),
                ...(boxscore.pitchers ?? [])
            ].map(String))
            for (const playerId of playerIds) {
                appearances.set(
                    playerId,
                    (appearances.get(playerId) ?? 0) + 1
                )
            }
        }
        return appearances
    }
    private getConfirmedPlayerIds(gameDate: string, teamId: number, gamePk?: number): Set<string> {
        const confirmed = new Set<string>()
        const schedule = queries.getSchedule(Number(gameDate.slice(0, 4)))
        const scheduleDate = (schedule?.data.dates ?? []).find(date => date.date === gameDate)
        const scheduledGame = (scheduleDate?.games ?? []).find(game =>
            gamePk
                ? Number(game.gamePk) === gamePk
                : Number(game.teams?.away?.team?.id) === teamId ||
                Number(game.teams?.home?.team?.id) === teamId
        )
        if (!scheduledGame) {
            return confirmed
        }
        const side = Number(scheduledGame.teams?.home?.team?.id) === teamId
            ? "home"
            : "away"
        const scheduledTeam = scheduledGame.teams?.[side]
        if (scheduledTeam && "probablePitcher" in scheduledTeam) {
            const pitcher = scheduledTeam.probablePitcher
            if (pitcher && typeof pitcher === "object" && "id" in pitcher && pitcher.id) {
                confirmed.add(String(pitcher.id))
            }
        }
        const feed = queries.getGame(Number(scheduledGame.gamePk))?.data
        if (!feed) {
            return confirmed
        }
        const startingPitcherId = feed.liveData?.boxscore?.teams?.[side]?.pitchers?.[0]
        if (startingPitcherId) {
            confirmed.add(String(startingPitcherId))
        }
        const players = Object.values(
            feed.liveData?.boxscore?.teams?.[side]?.players ?? {}
        )
        for (const player of players) {
            const battingOrder = "battingOrder" in player
                ? Number(player.battingOrder)
                : NaN
            if (
                Number.isInteger(battingOrder) &&
                battingOrder >= 100 &&
                battingOrder <= 900 &&
                battingOrder % 100 === 0 &&
                player.person?.id
            ) {
                confirmed.add(String(player.person.id))
            }
        }
        return confirmed
    }
    private getRecentStartingPitcherIds(gameDate: string, teamId: number): Set<string> {
        const schedule = queries.getSchedule(Number(gameDate.slice(0, 4)))
        const games = (schedule?.data.dates ?? [])
            .filter(date => date.date < gameDate)
            .flatMap(date => (date.games ?? []).filter(game =>
                Number(game?.teams?.away?.team?.id) === teamId ||
                Number(game?.teams?.home?.team?.id) === teamId
            ).map(game => ({
                gamePk: Number(game.gamePk),
                date: date.date
            })))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, RECENT_GAME_COUNT)
        const starters = new Set<string>()
        for (const game of games) {
            const feed = queries.getGame(game.gamePk)?.data
            if (!feed) {
                continue
            }
            const side = Number(feed.gameData?.teams?.home?.id) === teamId
                ? "home"
                : "away"
            const startingPitcherId = feed.liveData?.boxscore?.teams?.[side]?.pitchers?.[0]
            if (startingPitcherId) {
                starters.add(String(startingPitcherId))
            }
        }
        return starters
    }
    private countPosition(selected: Map<string, MlbRosterEntry>, position: Position): number {
        return Array.from(selected.values()).filter(entry => entry.position === position).length
    }
    private countHitters(selected: Map<string, MlbRosterEntry>): number {
        return Array.from(selected.values()).filter(entry => entry.position !== Position.PITCHER).length
    }
    private mapPosition(position: string): Position {
        switch (position) {
            case "P": return Position.PITCHER
            case "C": return Position.CATCHER
            case "1B": return Position.FIRST_BASE
            case "2B": return Position.SECOND_BASE
            case "3B": return Position.THIRD_BASE
            case "SS": return Position.SHORTSTOP
            case "LF": return Position.LEFT_FIELD
            case "CF": return Position.CENTER_FIELD
            case "RF": return Position.RIGHT_FIELD
            default: return Position.DESIGNATED_HITTER
        }
    }
}
interface RosterProjection {
    players: MlbRosterEntry[]
    projected: boolean
}
export {
    MlbRosterProjectionService
}
export type {
    RosterProjection
}
