import type {
    GamePlayer,
    GameSubstitution
} from "../../sim/service/interfaces.js"

import type {
    GameBoxscoreViewModel
} from "./game-web-service.js"


class BoxscoreService {

    public getBoxscoreInfo(substitutions: GameSubstitution[], boxscoreViewModel: GameBoxscoreViewModel): BoxscoreInfoViewModel {
        const lineup = boxscoreViewModel.team.lineupIds
        const teamId = boxscoreViewModel.team._id
        const players = boxscoreViewModel.team.players

        const teamSubstitutions = substitutions.filter(substitution => substitution.teamId === teamId).sort((a, b) => (a.playIndex ?? 0) - (b.playIndex ?? 0))
        const subNumberByPlayerId = this.getSubNumberByPlayerId(teamSubstitutions)
        const pitchingSubstitutions = teamSubstitutions.filter(substitution => substitution.isPitchingChange)
        const lineupSubstitutions = teamSubstitutions.filter(substitution => substitution.lineupIndex !== undefined)

        const batterSeedIds = this.getBatterAppearanceIds(lineup, lineupSubstitutions)
        const pitcherSeedIds = this.getPitcherAppearanceIds(pitchingSubstitutions)

        const batters = this.getRowsFromSubstitutions(
            batterSeedIds,
            players,
            subNumberByPlayerId,
            player => lineup.includes(player._id) || this.hasBattingLine(player)
        )

        const pitchers = this.getRowsFromSubstitutions(
            pitcherSeedIds,
            players,
            subNumberByPlayerId,
            player => player._id === boxscoreViewModel.team.currentPitcherId || this.hasPitchingLine(player)
        )

        const doubles = players.filter(player => player.hitResult.doubles > 0).map(player => this.getStatSummary(player, player.hitResult.doubles))
        const triples = players.filter(player => player.hitResult.triples > 0).map(player => this.getStatSummary(player, player.hitResult.triples))
        const homeRuns = players.filter(player => player.hitResult.homeRuns > 0).map(player => this.getStatSummary(player, player.hitResult.homeRuns))
        const totalBases = players.map(player => ({ player, totalBases: this.getTotalBases(player) })).filter(value => value.totalBases > 0).map(value => this.getStatSummary(value.player, value.totalBases))
        const rbi = players.filter(player => player.hitResult.rbi > 0).map(player => this.getStatSummary(player, player.hitResult.rbi))

        return {
            lineup,
            batters,
            pitchers,
            doubles,
            triples,
            homeRuns,
            totalBases,
            rbi
        }
    }

    public getSubNumberByPlayerId(substitutions: GameSubstitution[]): Map<string, number> {
        const subNumberByPlayerId = new Map<string, number>()
        let subNumber = 1

        for (const substitution of substitutions) {
            if (!substitution.inPlayerId || subNumberByPlayerId.has(substitution.inPlayerId)) {
                continue
            }

            subNumberByPlayerId.set(substitution.inPlayerId, subNumber)
            subNumber++
        }

        return subNumberByPlayerId
    }

    public getRowsFromSubstitutions(seedIds: string[], players: GamePlayer[], subNumberByPlayerId: Map<string, number>, includePlayer: (player: GamePlayer) => boolean): BoxscorePlayerRow[] {
        const rows: BoxscorePlayerRow[] = []
        const used = new Set<string>()

        for (const playerId of seedIds) {
            const player = this.getPlayer(players, playerId)

            if (!player || !includePlayer(player)) {
                continue
            }

            rows.push({
                player,
                subNumber: subNumberByPlayerId.get(player._id)
            })

            used.add(player._id)
        }

        for (const player of players) {
            if (used.has(player._id) || !includePlayer(player)) {
                continue
            }

            rows.push({
                player,
                subNumber: subNumberByPlayerId.get(player._id)
            })

            used.add(player._id)
        }

        return rows
    }

    public getPlayer(players: GamePlayer[], playerId: string): GamePlayer | undefined {
        return players.find(player => player._id === playerId)
    }

    public hasBattingLine(player: GamePlayer): boolean {
        return player.hitResult.atBats > 0 ||
            player.hitResult.runs > 0 ||
            player.hitResult.hits > 0 ||
            player.hitResult.doubles > 0 ||
            player.hitResult.triples > 0 ||
            player.hitResult.homeRuns > 0 ||
            player.hitResult.rbi > 0 ||
            player.hitResult.bb > 0 ||
            player.hitResult.hbp > 0 ||
            player.hitResult.so > 0
    }

    public hasPitchingLine(player: GamePlayer): boolean {
        return player.pitchResult.battersFaced > 0 ||
            player.pitchResult.pitches > 0 ||
            player.pitchResult.strikes > 0 ||
            player.pitchResult.hits > 0 ||
            player.pitchResult.runs > 0 ||
            player.pitchResult.er > 0 ||
            player.pitchResult.homeRuns > 0 ||
            player.pitchResult.bb > 0 ||
            player.pitchResult.so > 0 ||
            player.pitchResult.hbp > 0
    }

    public getPitcherAppearanceIds(pitchingSubstitutions: GameSubstitution[]): string[] {
        const substitutions = [...pitchingSubstitutions].sort((a, b) => (a.playIndex ?? 0) - (b.playIndex ?? 0))
        const ids: string[] = []
        const used = new Set<string>()

        const add = (playerId?: string): void => {
            if (!playerId || used.has(playerId)) {
                return
            }

            ids.push(playerId)
            used.add(playerId)
        }

        if (substitutions.length > 0) {
            add(substitutions[0].outPlayerId)
        }

        for (const substitution of substitutions) {
            add(substitution.inPlayerId)
        }

        return ids
    }

    public getBatterAppearanceIds(lineup: string[], substitutions: GameSubstitution[]): string[] {
        const lineupSubstitutions = substitutions.filter(substitution => substitution.lineupIndex !== undefined).sort((a, b) => (a.playIndex ?? 0) - (b.playIndex ?? 0))
        const originalLineup = [...lineup]

        for (const substitution of [...lineupSubstitutions].reverse()) {
            if (substitution.lineupIndex === undefined) {
                continue
            }

            if (originalLineup[substitution.lineupIndex] === substitution.inPlayerId) {
                originalLineup[substitution.lineupIndex] = substitution.outPlayerId
            }
        }

        const ids: string[] = []
        const used = new Set<string>()

        const add = (playerId?: string): void => {
            if (!playerId || used.has(playerId)) {
                return
            }

            ids.push(playerId)
            used.add(playerId)
        }

        for (let lineupIndex = 0; lineupIndex < originalLineup.length; lineupIndex++) {
            add(originalLineup[lineupIndex])

            for (const substitution of lineupSubstitutions) {
                if (substitution.lineupIndex === lineupIndex) {
                    add(substitution.inPlayerId)
                }
            }
        }

        return ids
    }

    private getTotalBases(player: GamePlayer): number {
        const singles = player.hitResult.hits - player.hitResult.doubles - player.hitResult.triples - player.hitResult.homeRuns

        return singles + (player.hitResult.doubles * 2) + (player.hitResult.triples * 3) + (player.hitResult.homeRuns * 4)
    }

    private getStatSummary(player: GamePlayer, value: number): BoxscoreStatSummary {
        return {
            playerId: player._id,
            name: player.fullName,
            value
        }
    }

}


interface BoxscorePlayerRow {
    player: GamePlayer
    subNumber?: number
}


interface BoxscoreStatSummary {
    playerId: string
    name: string
    value: number
}


interface BoxscoreInfoViewModel {
    lineup: string[]
    batters: BoxscorePlayerRow[]
    pitchers: BoxscorePlayerRow[]
    doubles: BoxscoreStatSummary[]
    triples: BoxscoreStatSummary[]
    homeRuns: BoxscoreStatSummary[]
    totalBases: BoxscoreStatSummary[]
    rbi: BoxscoreStatSummary[]
}


export {
    BoxscoreService
}


export type {
    BoxscoreInfoViewModel,
    BoxscorePlayerRow,
    BoxscoreStatSummary
}