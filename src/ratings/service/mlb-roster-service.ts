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
                        throw new Error(`MLB team abbreviation not configured for team ${teamId}.`)
                    }

                    teams.set(teamId, {
                        id: teamId,
                        name: String(scheduledTeam?.name ?? teamId),
                        abbrev
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


interface MlbTeam {
    id: number
    name: string
    abbrev: string
}


interface MlbRosterEntry {
    playerId: string
    fullName: string
    position: Position
}


export {
    MlbRosterService
}


export type {
    MlbTeam,
    MlbRosterEntry
}