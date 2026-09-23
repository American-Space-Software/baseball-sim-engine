import fs from "fs"
import path from "path"

import {
    PlayerRatingsRepository
} from "../repository/player-ratings-repository.js"

import {
    MlbRosterService
} from "./mlb-roster-service.js"

import {
    PlayerRatingService
} from "./player-rating-service.js"

import type {
    PitchEnvironmentTarget
} from "../../sim/service/interfaces.js"

import type {
    PlayerRatingsRow
} from "../repository/player-ratings-repository.js"

import type {
    MlbTeam
} from "./mlb-roster-service.js"


const defaultBaseDataDir = process.env.DATA_DIR ?? "data"


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
        private readonly playerRatingService: PlayerRatingService,
        private readonly mlbRosterService: MlbRosterService,
        private readonly baseDataDir = defaultBaseDataDir
    ) {}

    public async build(gameDate: string): Promise<MlbPlayerPool> {
        const rosters = await this.mlbRosterService.getRosters(
            gameDate
        )

        const teamByPlayerId = new Map<string, MlbTeam>()
        const playerIds = new Set<string>()

        for (const roster of rosters) {
            for (const player of roster.players) {
                const playerId = String(
                    player.playerId
                )

                playerIds.add(
                    playerId
                )

                teamByPlayerId.set(
                    playerId,
                    roster.team
                )
            }
        }

        if (playerIds.size === 0) {
            return {
                date: gameDate,
                players: []
            }
        }

        const season = Number(
            gameDate.slice(
                0,
                4
            )
        )

        const pitchEnvironmentTarget = await this.getPitchEnvironmentTarget(
            season
        )

        await this.playerRatingService.buildPlayerRatingsForDate(
            season,
            gameDate,
            pitchEnvironmentTarget,
            playerIds
        )

        const ratings = await this.playerRatingsRepository.read(
            gameDate
        )

        return {
            date: gameDate,
            players: ratings
                .filter(player =>
                    playerIds.has(
                        String(player.playerId)
                    )
                )
                .map(player => ({
                    ...player,
                    team: teamByPlayerId.get(
                        String(player.playerId)
                    )
                }))
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
                throw new Error(
                    `Pitch environment target not found: ${filePath}`
                )
            }

            throw error
        }

        const target = JSON.parse(
            raw
        ) as PitchEnvironmentTarget

        if (target.season !== season) {
            throw new Error(
                `Pitch environment target season ${target.season} does not match requested season ${season}: ${filePath}`
            )
        }

        if (!target.pitchEnvironmentTuning) {
            throw new Error(
                `Pitch environment target has no tuning for season ${season}: ${filePath}`
            )
        }

        return target
    }

}


export {
    MlbPlayerPoolService
}


export type {
    MlbPlayerPool,
    MlbPlayerPoolPlayer
}
