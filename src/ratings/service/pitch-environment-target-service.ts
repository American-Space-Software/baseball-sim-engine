import {
    PitchEnvironmentService
} from "../../importer/service/pitch-environment-service.js"

import {
    PlayerImportService
} from "../../importer/service/player-import-service.js"

import type {
    PitchEnvironmentTarget
} from "../../sim/service/interfaces.js"

import {
    PitchEnvironmentTargetRepository
} from "../repository/pitch-environment-target-repository.js"


class PitchEnvironmentTargetService {

    public constructor(
        private readonly pitchEnvironmentTargetRepository: PitchEnvironmentTargetRepository,
        private readonly playerImportService: PlayerImportService
    ) {}

    public async getForDate(gameDate: string, options: PitchEnvironmentTargetOptions = {}): Promise<PitchEnvironmentTarget> {
        const season = this.getSeason(
            gameDate
        )

        if (!options.forceRebuild) {
            const cached = await this.pitchEnvironmentTargetRepository.read(
                gameDate
            )

            if (cached) {
                this.validateTarget(
                    cached,
                    gameDate
                )

                return cached
            }
        }

        const players = await this.playerImportService.buildCorePlayerImports(
            season,
            gameDate
        )

        if (players.size === 0) {
            throw new Error(
                `No backward-looking player imports were available for ${gameDate}.`
            )
        }

        const target = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
            season,
            players,
            0
        )

        this.validateTarget(
            target,
            gameDate
        )

        await this.pitchEnvironmentTargetRepository.write(
            gameDate,
            target
        )

        return target
    }

    public clearImportCache(season?: number): void {
        this.playerImportService.clearCache(
            season
        )
    }

    private getSeason(gameDate: string): number {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
            throw new Error(
                `Invalid pitch-environment game date: ${gameDate}.`
            )
        }

        const parsed = new Date(
            `${gameDate}T12:00:00.000Z`
        )

        if (
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== gameDate
        ) {
            throw new Error(
                `Invalid pitch-environment game date: ${gameDate}.`
            )
        }

        return Number(
            gameDate.slice(
                0,
                4
            )
        )
    }

    private validateTarget(target: PitchEnvironmentTarget, gameDate: string): void {
        if (
            !target ||
            typeof target !== "object"
        ) {
            throw new Error(
                `Pitch environment target is empty for ${gameDate}.`
            )
        }

        if (
            !Number.isFinite(
                Number(target.avgRating)
            ) ||
            Number(target.avgRating) <= 0
        ) {
            throw new Error(
                `Pitch environment target has an invalid avgRating for ${gameDate}.`
            )
        }

        const hitterPlateAppearances = Number(
            target.importReference
                ?.hitter
                ?.pa ??
            0
        )

        if (
            !Number.isFinite(hitterPlateAppearances) ||
            hitterPlateAppearances <= 0
        ) {
            throw new Error(
                `Pitch environment target has no hitter plate appearances for ${gameDate}.`
            )
        }
    }

}


interface PitchEnvironmentTargetOptions {
    forceRebuild?: boolean
}


export {
    PitchEnvironmentTargetService
}


export type {
    PitchEnvironmentTargetOptions
}