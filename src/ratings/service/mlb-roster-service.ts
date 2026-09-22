import {
    queries,
    syncRosters
} from "baseball-database"

import {
    Position
} from "../../sim/service/enums.js"


const MLB_TEAM_ABBREVIATIONS = new Map<number, string>([
    [108, "LAA"],
    [109, "ARI"],
    [110, "BAL"],
    [111, "BOS"],
    [112, "CHC"],
    [113, "CIN"],
    [114, "CLE"],
    [115, "COL"],
    [116, "DET"],
    [117, "HOU"],
    [118, "KC"],
    [119, "LAD"],
    [120, "WSH"],
    [121, "NYM"],
    [133, "ATH"],
    [134, "PIT"],
    [135, "SD"],
    [136, "SEA"],
    [137, "SF"],
    [138, "STL"],
    [139, "TB"],
    [140, "TEX"],
    [141, "TOR"],
    [142, "MIN"],
    [143, "PHI"],
    [144, "ATL"],
    [145, "CWS"],
    [146, "MIA"],
    [147, "NYY"],
    [158, "MIL"]
])


const MLB_TEAM_COLORS = new Map<number, MlbTeamColors>([
    [108, { color1: "#BA0C2F", color2: "#FFFFFF" }],
    [109, { color1: "#A6192E", color2: "#FFFFFF" }],
    [110, { color1: "#010101", color2: "#FC4C02" }],
    [111, { color1: "#0C2340", color2: "#FFFFFF" }],
    [112, { color1: "#002F6C", color2: "#FFFFFF" }],
    [113, { color1: "#BA0C2F", color2: "#FFFFFF" }],
    [114, { color1: "#0C2340", color2: "#C8102E" }],
    [115, { color1: "#330072", color2: "#C4CED4" }],
    [116, { color1: "#0C2340", color2: "#FA4616" }],
    [117, { color1: "#041E42", color2: "#CF4520" }],
    [118, { color1: "#0032A0", color2: "#FFFFFF" }],
    [119, { color1: "#002F6C", color2: "#FFFFFF" }],
    [120, { color1: "#BA0C2F", color2: "#FFFFFF" }],
    [121, { color1: "#002D72", color2: "#FFFFFF" }],
    [133, { color1: "#024638", color2: "#FFB81C" }],
    [134, { color1: "#010101", color2: "#FFC72C" }],
    [135, { color1: "#3E342F", color2: "#FFC72C" }],
    [136, { color1: "#0C2340", color2: "#A2AAAD" }],
    [137, { color1: "#010101", color2: "#FA4616" }],
    [138, { color1: "#BA0C2F", color2: "#FEDB00" }],
    [139, { color1: "#041E42", color2: "#FFFFFF" }],
    [140, { color1: "#002D72", color2: "#FFFFFF" }],
    [141, { color1: "#003DA5", color2: "#FFFFFF" }],
    [142, { color1: "#0C2340", color2: "#FFFFFF" }],
    [143, { color1: "#BA0C2F", color2: "#FFFFFF" }],
    [144, { color1: "#0C2340", color2: "#FFFFFF" }],
    [145, { color1: "#010101", color2: "#C4CED4" }],
    [146, { color1: "#010101", color2: "#00A3E0" }],
    [147, { color1: "#0C2340", color2: "#FFFFFF" }],
    [158, { color1: "#13294B", color2: "#FFC72C" }]
])


class MlbRosterService {

    public async getTeams(season: number): Promise<MlbTeam[]> {
        const schedule = queries.getSchedule(season)

        if (!schedule) {
            throw new Error(`MLB schedule not found for season ${season}.`)
        }

        const teams = new Map<number, MlbTeam>()

        for (const date of schedule.data.dates ?? []) {
            for (const game of date.games ?? []) {
                for (const side of ["away", "home"] as const) {
                    const scheduledTeam = game?.teams?.[side]?.team
                    const teamId = Number(scheduledTeam?.id)

                    if (!Number.isFinite(teamId) || teamId <= 0) {
                        continue
                    }

                    const abbrev = MLB_TEAM_ABBREVIATIONS.get(teamId)

                    if (!abbrev) {
                        continue
                    }

                    const colors = MLB_TEAM_COLORS.get(teamId)

                    teams.set(teamId, {
                        id: teamId,
                        name: String(scheduledTeam?.name ?? teamId),
                        abbrev,
                        colors
                    })
                }
            }
        }

        return Array.from(teams.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        )
    }

    public async syncRosters(gameDate: string): Promise<void> {
        this.validateGameDate(gameDate)

        await syncRosters(gameDate)
    }

    public async getRoster(gameDate: string, team: MlbTeam): Promise<MlbRosterEntry[]> {
        this.validateGameDate(gameDate)

        const roster = queries.getRoster(
            gameDate,
            team.id
        )

        return roster.map(rosterEntry => {
            const player = queries.getPlayer(rosterEntry.playerId)

            if (!player) {
                throw new Error(
                    `Player ${rosterEntry.playerId} from ${team.name} roster on ${gameDate} does not exist in baseball-database.`
                )
            }

            return {
                playerId: String(player.playerId),
                fullName: player.fullName,
                position: this.mapPosition(rosterEntry.position)
            }
        })
    }

    public async getRosters(gameDate: string): Promise<MlbTeamRoster[]> {
        this.validateGameDate(gameDate)

        const teams = await this.getTeams(
            Number(
                gameDate.slice(0, 4)
            )
        )

        return Promise.all(
            teams.map(async team => ({
                team,
                players: await this.getRoster(
                    gameDate,
                    team
                )
            }))
        )
    }

    private validateGameDate(gameDate: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
            throw new Error(`Invalid MLB roster date: ${gameDate}.`)
        }

        const parsed = new Date(`${gameDate}T12:00:00.000Z`)

        if (
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== gameDate
        ) {
            throw new Error(`Invalid MLB roster date: ${gameDate}.`)
        }
    }

    private mapPosition(abbr: string): Position {
        switch (abbr) {
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
            case "DH":
                return Position.DESIGNATED_HITTER
            default:
                return Position.DESIGNATED_HITTER
        }
    }

}


interface MlbTeamColors {
    color1: string
    color2: string
}


interface MlbTeam {
    id: number
    name: string
    abbrev: string
    colors?: MlbTeamColors
}


interface MlbRosterEntry {
    playerId: string
    fullName: string
    position: Position
}


interface MlbTeamRoster {
    team: MlbTeam
    players: MlbRosterEntry[]
}


export {
    MlbRosterService
}


export type {
    MlbRosterEntry,
    MlbTeam,
    MlbTeamColors,
    MlbTeamRoster
}