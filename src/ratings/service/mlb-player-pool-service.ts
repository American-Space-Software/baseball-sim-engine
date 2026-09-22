import {
    PlayerRatingsRepository
} from "../repository/player-ratings-repository.js"

import {
    MlbRosterService
} from "./mlb-roster-service.js"

import type {
    PlayerRatingsRow
} from "../repository/player-ratings-repository.js"

import type {
    MlbTeam
} from "./mlb-roster-service.js"


interface MlbPlayerPoolPlayer extends PlayerRatingsRow {
    team?: MlbTeam
}


interface MlbPlayerPool {
    date: string
    players: MlbPlayerPoolPlayer[]
}


class MlbPlayerPoolService {

    public constructor(
        private readonly playerRatingsRepository: PlayerRatingsRepository,
        private readonly mlbRosterService: MlbRosterService
    ) {}

    public async build(gameDate: string): Promise<MlbPlayerPool> {
        const [
            ratings,
            rosters
        ] = await Promise.all([
            this.playerRatingsRepository.read(
                gameDate
            ),
            this.mlbRosterService.getRosters(
                gameDate
            )
        ])

        const teamByPlayerId = new Map<string, MlbTeam>()

        for (const roster of rosters) {
            for (const player of roster.players) {
                teamByPlayerId.set(
                    player.playerId,
                    roster.team
                )
            }
        }

        return {
            date: gameDate,
            players: ratings.map(player => ({
                ...player,
                team: teamByPlayerId.get(
                    player.playerId
                )
            }))
        }
    }

}


export {
    MlbPlayerPoolService
}


export type {
    MlbPlayerPool,
    MlbPlayerPoolPlayer
}