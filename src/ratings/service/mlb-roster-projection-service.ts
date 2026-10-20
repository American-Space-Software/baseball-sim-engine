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
const MIN_CATCHERS = 2
const RECENT_GAME_COUNT = 14
const PREVIOUS_ROSTER_DAYS = 60
const POSTSEASON_GAME_TYPES = new Set([
    "F",
    "D",
    "L",
    "W"
])
class MlbRosterProjectionService {

    public project(gameDate: string, team: MlbTeam, roster: MlbRosterEntry[], gamePk?: number): RosterProjection {
        return this.projectRoster(
            gameDate,
            team,
            roster,
            gamePk,
            true
        )
    }

    private projectRoster(gameDate: string, team: MlbTeam, roster: MlbRosterEntry[], gamePk?: number, log = false): RosterProjection {
        const rules = this.getRosterRules(
            gameDate,
            team,
            gamePk
        )
        if (
            rules.rosterSize === undefined ||
            roster.length <= rules.rosterSize
        ) {
            return {
                players: roster,
                projected: false
            }
        }
        const previousRoster = this.getPreviousRoster(
            gameDate,
            team,
            rules.rosterSize
        )
        const previousPlayerIds = new Set(
            previousRoster.map(entry =>
                entry.playerId
            )
        )
        const recentAppearances = this.getRecentAppearances(
            gameDate,
            team.id
        )
        const confirmedPlayerIds = this.getConfirmedPlayerIds(
            gameDate,
            team.id,
            gamePk
        )
        const ranked = [...roster].sort((a, b) => {
            const aPrevious = previousPlayerIds.has(a.playerId)
                ? 1
                : 0
            const bPrevious = previousPlayerIds.has(b.playerId)
                ? 1
                : 0
            const aAppearances = recentAppearances.get(
                a.playerId
            ) ?? 0
            const bAppearances = recentAppearances.get(
                b.playerId
            ) ?? 0
            return bPrevious - aPrevious ||
                bAppearances - aAppearances ||
                a.playerId.localeCompare(
                    b.playerId
                )
        })
        const selected = new Map<string, MlbRosterEntry>()
        for (const entry of ranked) {
            if (
                confirmedPlayerIds.has(
                    entry.playerId
                )
            ) {
                selected.set(
                    entry.playerId,
                    entry
                )
            }
        }
        const pitchers = ranked.filter(entry =>
            entry.position === Position.PITCHER
        )
        const hitters = ranked.filter(entry =>
            entry.position !== Position.PITCHER
        )
        const catchers = hitters.filter(entry =>
            entry.position === Position.CATCHER
        )
        const confirmedPitchers = this.countPosition(
            selected,
            Position.PITCHER
        )
        if (
            selected.size > rules.rosterSize ||
            (
                !rules.allowPitcherOverflow &&
                confirmedPitchers > rules.maxPitchers
            )
        ) {
            throw new Error(
                `Unable to project ${team.abbrev} roster on ${gameDate}: too many confirmed players.`
            )
        }
        for (const catcher of catchers) {
            if (
                this.countPosition(
                    selected,
                    Position.CATCHER
                ) >= MIN_CATCHERS
            ) {
                break
            }
            if (selected.size < rules.rosterSize) {
                selected.set(
                    catcher.playerId,
                    catcher
                )
            }
        }
        for (const hitter of hitters) {
            if (
                selected.size >= rules.rosterSize ||
                this.countHitters(selected) >=
                rules.rosterSize - rules.maxPitchers
            ) {
                break
            }
            selected.set(
                hitter.playerId,
                hitter
            )
        }
        for (const pitcher of pitchers) {
            if (
                selected.size >= rules.rosterSize ||
                this.countPosition(
                    selected,
                    Position.PITCHER
                ) >= rules.maxPitchers
            ) {
                break
            }

            selected.set(
                pitcher.playerId,
                pitcher
            )
        }

        for (const hitter of hitters) {
            if (selected.size >= rules.rosterSize) {
                break
            }

            selected.set(
                hitter.playerId,
                hitter
            )
        }

        if (
            rules.allowPitcherOverflow &&
            selected.size < rules.rosterSize
        ) {
            for (const pitcher of pitchers) {
                if (selected.size >= rules.rosterSize) {
                    break
                }

                selected.set(
                    pitcher.playerId,
                    pitcher
                )
            }
        }
        if (selected.size !== rules.rosterSize) {
            throw new Error(
                `Unable to project ${team.abbrev} roster on ${gameDate}: selected ${selected.size} of ${rules.rosterSize} players.`
            )
        }
        const players = roster.filter(entry =>
            selected.has(
                entry.playerId
            )
        )
        if (log) {
            console.log(
                `Projected ${team.abbrev} roster for ${gameDate}: ${roster.length} candidates, ` +
                `${players.length} selected, ${this.countPosition(selected, Position.PITCHER)} pitchers, ` +
                `${previousRoster.length} players in reference roster.`
            )
        }
        return {
            players,
            projected: true
        }
    }

    private getRosterRules(gameDate: string, team: MlbTeam, gamePk?: number): RosterRules {
        const postseason = this.isPostseason(
            gameDate,
            team.id,
            gamePk
        )
        const rules = this.getBaseRosterRules(
            gameDate,
            postseason
        )

        if (
            postseason ||
            !this.isDoubleheader(
                gameDate,
                team.id
            )
        ) {
            return rules
        }

        return {
            rosterSize: rules.rosterSize === undefined
                ? undefined
                : rules.rosterSize + 1,
            maxPitchers: rules.maxPitchers === undefined
                ? undefined
                : rules.maxPitchers + 1,
            allowPitcherOverflow: rules.allowPitcherOverflow
        }
    }

    private getBaseRosterRules(gameDate: string, postseason: boolean): RosterRules {
        const year = Number(
            gameDate.slice(
                0,
                4
            )
        )
        const monthDay = gameDate.slice(
            5
        )

        if (year < 2020) {
            if (postseason) {
                return {
                    rosterSize: 25,
                    maxPitchers: 13,
                    allowPitcherOverflow: true
                }
            }

            if (monthDay >= "09-01") {
                return {
                    rosterSize: undefined,
                    maxPitchers: undefined,
                    allowPitcherOverflow: true
                }
            }

            return {
                rosterSize: 25,
                maxPitchers: 13,
                allowPitcherOverflow: true
            }
        }

        if (year === 2020) {
            if (postseason) {
                return {
                    rosterSize: 28,
                    maxPitchers: 14,
                    allowPitcherOverflow: true
                }
            }

            if (gameDate < "2020-08-06") {
                return {
                    rosterSize: 30,
                    maxPitchers: 15,
                    allowPitcherOverflow: true
                }
            }

            return {
                rosterSize: 28,
                maxPitchers: 14,
                allowPitcherOverflow: true
            }
        }

        if (year === 2021) {
            if (postseason) {
                return {
                    rosterSize: 26,
                    maxPitchers: 13,
                    allowPitcherOverflow: true
                }
            }

            if (monthDay >= "09-01") {
                return {
                    rosterSize: 28,
                    maxPitchers: 14,
                    allowPitcherOverflow: true
                }
            }

            return {
                rosterSize: 26,
                maxPitchers: 13,
                allowPitcherOverflow: true
            }
        }

        if (
            year === 2022 &&
            gameDate <= "2022-05-01"
        ) {
            return {
                rosterSize: 28,
                maxPitchers: 14,
                allowPitcherOverflow: true
            }
        }

        if (
            year === 2022 &&
            gameDate <= "2022-06-19"
        ) {
            return {
                rosterSize: 26,
                maxPitchers: 14,
                allowPitcherOverflow: false
            }
        }

        if (postseason) {
            return {
                rosterSize: 26,
                maxPitchers: 13,
                allowPitcherOverflow: false
            }
        }

        if (monthDay >= "09-01") {
            return {
                rosterSize: 28,
                maxPitchers: 14,
                allowPitcherOverflow: false
            }
        }

        return {
            rosterSize: 26,
            maxPitchers: 13,
            allowPitcherOverflow: false
        }
    }

    private isDoubleheader(gameDate: string, teamId: number): boolean {
        const schedule = queries.getSchedule(
            Number(
                gameDate.slice(
                    0,
                    4
                )
            )
        )
        const games = (
            schedule?.data.dates ?? []
        )
            .filter(date =>
                date.date === gameDate
            )
            .flatMap(date =>
                date.games ?? []
            )
            .filter(game =>
                Number(
                    game.teams?.away?.team?.id
                ) === teamId ||
                Number(
                    game.teams?.home?.team?.id
                ) === teamId
            )

        return games.length >= 2
    }

    private isPostseason(gameDate: string, teamId: number, gamePk?: number): boolean {
        const schedule = queries.getSchedule(
            Number(
                gameDate.slice(
                    0,
                    4
                )
            )
        )
        const dates = schedule?.data.dates ?? []
        const scheduleDate = dates.find(date =>
            date.date === gameDate
        )
        const games = scheduleDate?.games ?? []
        const game = games.find(game =>
            gamePk
                ? Number(
                    game.gamePk
                ) === gamePk
                : Number(
                    game.teams?.away?.team?.id
                ) === teamId ||
                Number(
                    game.teams?.home?.team?.id
                ) === teamId
        )
        if (game) {
            return POSTSEASON_GAME_TYPES.has(
                String(
                    game.gameType ?? ""
                )
            )
        }
        const postseasonDates = dates
            .filter(date =>
                (
                    date.games ?? []
                ).some(game =>
                    POSTSEASON_GAME_TYPES.has(
                        String(
                            game.gameType ?? ""
                        )
                    )
                )
            )
            .map(date =>
                date.date
            )
            .sort()
        if (postseasonDates.length === 0) {
            return false
        }
        return gameDate >= postseasonDates[0]
    }

    private getPreviousRoster(gameDate: string, team: MlbTeam, rosterSize: number): MlbRosterEntry[] {
        const earliestDate = dayjs(
            gameDate
        ).subtract(
            PREVIOUS_ROSTER_DAYS,
            "day"
        ).format(
            "YYYY-MM-DD"
        )
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
                date.date >= earliestDate &&
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
            const storedRoster = queries.getRoster(
                date.date,
                team.id
            )
            const roster = storedRoster.map(entry => ({
                playerId: String(
                    entry.playerId
                ),
                fullName: "",
                position: this.mapPosition(
                    entry.position
                )
            }))
            if (roster.length === rosterSize) {
                return roster
            }

        }
        return []
    }

    private getRecentAppearances(gameDate: string, teamId: number): Map<string, number> {
        const schedule = queries.getSchedule(
            Number(
                gameDate.slice(
                    0,
                    4
                )
            )
        )
        const appearances = new Map<string, number>()
        const games = (
            schedule?.data.dates ?? []
        )
            .filter(date =>
                date.date < gameDate
            )
            .flatMap(date =>
                (
                    date.games ?? []
                )
                    .filter(game =>
                        Number(
                            game?.teams?.away?.team?.id
                        ) === teamId ||
                        Number(
                            game?.teams?.home?.team?.id
                        ) === teamId
                    )
                    .map(game => ({
                        gamePk: game.gamePk,
                        date: date.date
                    }))
            )
            .sort((a, b) =>
                b.date.localeCompare(
                    a.date
                )
            )
            .slice(
                0,
                RECENT_GAME_COUNT
            )
        for (const game of games) {
            const feed = queries.getGame(
                Number(
                    game.gamePk
                )
            )?.data
            if (!feed) {
                continue
            }
            const side = Number(
                feed.gameData?.teams?.home?.id
            ) === teamId
                ? "home"
                : "away"
            const boxscore =
                feed.liveData?.boxscore?.teams?.[side]
            if (!boxscore) {
                continue
            }
            const playerIds = new Set(
                [
                    ...(boxscore.batters ?? []),
                    ...(boxscore.pitchers ?? [])
                ].map(
                    String
                )
            )
            for (const playerId of playerIds) {
                appearances.set(
                    playerId,
                    (
                        appearances.get(
                            playerId
                        ) ?? 0
                    ) + 1
                )
            }
        }
        return appearances
    }

    private getConfirmedPlayerIds(gameDate: string, teamId: number, gamePk?: number): Set<string> {
        const confirmed = new Set<string>()
        const schedule = queries.getSchedule(
            Number(
                gameDate.slice(
                    0,
                    4
                )
            )
        )
        const scheduleDate = (
            schedule?.data.dates ?? []
        ).find(date =>
            date.date === gameDate
        )
        const scheduledGame = (
            scheduleDate?.games ?? []
        ).find(game =>
            gamePk
                ? Number(
                    game.gamePk
                ) === gamePk
                : Number(
                    game.teams?.away?.team?.id
                ) === teamId ||
                Number(
                    game.teams?.home?.team?.id
                ) === teamId
        )
        if (!scheduledGame) {
            return confirmed
        }
        const side = Number(
            scheduledGame.teams?.home?.team?.id
        ) === teamId
            ? "home"
            : "away"
        const scheduledTeam =
            scheduledGame.teams?.[side]
        if (
            scheduledTeam &&
            "probablePitcher" in scheduledTeam
        ) {
            const pitcher =
                scheduledTeam.probablePitcher
            if (
                pitcher &&
                typeof pitcher === "object" &&
                "id" in pitcher &&
                pitcher.id
            ) {
                confirmed.add(
                    String(
                        pitcher.id
                    )
                )
            }
        }
        const feed = queries.getGame(
            Number(
                scheduledGame.gamePk
            )
        )?.data
        if (!feed) {
            return confirmed
        }
        const startingPitcherId =
            feed.liveData?.boxscore?.teams?.[side]?.pitchers?.[0]
        if (startingPitcherId) {
            confirmed.add(
                String(
                    startingPitcherId
                )
            )
        }
        const players = Object.values(
            feed.liveData?.boxscore?.teams?.[side]?.players ?? {}
        )
        for (const player of players) {
            const battingOrder =
                "battingOrder" in player
                    ? Number(
                        player.battingOrder
                    )
                    : NaN
            if (
                Number.isInteger(
                    battingOrder
                ) &&
                battingOrder >= 100 &&
                battingOrder <= 900 &&
                battingOrder % 100 === 0 &&
                player.person?.id
            ) {
                confirmed.add(
                    String(
                        player.person.id
                    )
                )
            }
        }
        return confirmed
    }

    private countPosition(selected: Map<string, MlbRosterEntry>, position: Position): number {
        return Array.from(
            selected.values()
        ).filter(entry =>
            entry.position === position
        ).length
    }

    private countHitters(selected: Map<string, MlbRosterEntry>): number {
        return Array.from(
            selected.values()
        ).filter(entry =>
            entry.position !== Position.PITCHER
        ).length
    }

    private mapPosition(position: string): Position {
        switch (position) {
            case "P":
                return Position.PITCHER
            case "C":
                return Position.CATCHER
            case "1B":
                return Position.FIRST_BASE
            case "2B":
                return Position.SECOND_BASE
            case "3B":
                return Position.THIRD_BASE
            case "SS":
                return Position.SHORTSTOP
            case "LF":
                return Position.LEFT_FIELD
            case "CF":
                return Position.CENTER_FIELD
            case "RF":
                return Position.RIGHT_FIELD
            default:
                return Position.DESIGNATED_HITTER
        }
    }
}

interface RosterRules {
    rosterSize?: number
    maxPitchers?: number
    allowPitcherOverflow: boolean
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
