import {
    queries
} from "baseball-database"
import {  PitcherAppearanceRepository } from "../repository/pitcher-appearance-repository.js"
import type { PitcherAppearance } from "../repository/pitcher-appearance-repository.js"




class PitcherAppearanceService {

    public constructor(
        private readonly pitcherAppearanceRepository: PitcherAppearanceRepository
    ) {}

    public async getForDate(gameDate: string): Promise<PitcherAppearance[]> {
        const existing = await this.pitcherAppearanceRepository.read(
            gameDate
        )

        if (existing) {
            return existing
        }

        const appearances = this.buildForDate(
            gameDate
        )

        await this.pitcherAppearanceRepository.write(
            gameDate,
            appearances
        )

        return appearances
    }

    private buildForDate(gameDate: string): PitcherAppearance[] {
        const season = Number(
            gameDate.slice(0, 4)
        )

        const schedule = queries.getSchedule(
            season
        )

        if (!schedule) {
            throw new Error(
                `MLB schedule not found for season ${season}.`
            )
        }

        const scheduledGames = (schedule.data?.dates ?? [])
            .filter(date =>
                String(date?.date ?? "") === gameDate
            )
            .flatMap(date =>
                date?.games ?? []
            )
            .filter(game =>
                this.isCompletedGame(game) &&
                this.getScheduledGameDate(
                    game,
                    gameDate
                ) === gameDate
            )

        return scheduledGames.flatMap(scheduledGame => {
            const gameId = scheduledGame?.gamePk

            if (!gameId) {
                return []
            }

            const storedGame = queries.getGame(
                Number(gameId)
            )

            if (!storedGame) {
                throw new Error(
                    `MLB game feed ${gameId} was not found while building pitcher appearances for ${gameDate}.`
                )
            }

            return this.getPitcherAppearances(
                storedGame.data,
                gameId,
                gameDate
            )
        })
    }

    private getPitcherAppearances(feed: any, gameId: number | string, gameDate: string): PitcherAppearance[] {
        const appearances: PitcherAppearance[] = []

        for (const side of ["away", "home"] as const) {
            const boxscoreTeam =
                feed?.liveData?.boxscore?.teams?.[side]

            const teamId = String(
                boxscoreTeam?.team?.id ??
                feed?.gameData?.teams?.[side]?.id ??
                ""
            )

            const pitcherIds = new Set(
                (boxscoreTeam?.pitchers ?? []).map(
                    (playerId: number | string) =>
                        String(playerId)
                )
            )

            const players =
                boxscoreTeam?.players ??
                {}

            for (const boxscorePlayer of Object.values(players) as any[]) {
                const playerId = String(
                    boxscorePlayer?.person?.id ??
                    boxscorePlayer?.personId ??
                    ""
                )

                if (
                    !playerId ||
                    !pitcherIds.has(playerId)
                ) {
                    continue
                }

                const pitching =
                    boxscorePlayer?.stats?.pitching ??
                    {}

                const pitches = this.getNumber(
                    pitching.numberOfPitches ??
                    pitching.pitches
                )

                const outs = this.getPitchingOuts(
                    pitching
                )

                const battersFaced = this.getNumber(
                    pitching.battersFaced
                )

                if (
                    pitches <= 0 &&
                    outs <= 0 &&
                    battersFaced <= 0
                ) {
                    continue
                }

                appearances.push({
                    playerId,
                    playerName: String(
                        boxscorePlayer?.person?.fullName ??
                        boxscorePlayer?.person?.fullNameFirstLast ??
                        playerId
                    ),
                    gameId: String(gameId),
                    gameDate,
                    teamId,
                    pitches,
                    outs,
                    inningsPitched: outs / 3,
                    battersFaced,
                    gamesStarted: this.getNumber(
                        pitching.gamesStarted
                    ),
                    gamesFinished: this.getNumber(
                        pitching.gamesFinished
                    ),
                    saves: this.getNumber(
                        pitching.saves
                    ),
                    holds: this.getNumber(
                        pitching.holds
                    ),
                    blownSaves: this.getNumber(
                        pitching.blownSaves
                    ),
                    entryInning: this.getPitcherEntryInning(
                        feed,
                        playerId
                    )
                })
            }
        }

        return appearances
    }

    private getPitcherEntryInning(feed: any, playerId: string): number | undefined {
        for (const play of feed?.liveData?.plays?.allPlays ?? []) {
            const matchupPitcherId = String(
                play?.matchup?.pitcher?.id ??
                ""
            )

            if (matchupPitcherId !== playerId) {
                continue
            }

            const inning = Number(
                play?.about?.inning
            )

            if (
                Number.isFinite(inning) &&
                inning > 0
            ) {
                return inning
            }
        }

        return undefined
    }

    private getPitchingOuts(pitching: any): number {
        const directOuts = this.getNumber(
            pitching?.outs ??
            pitching?.outsRecorded
        )

        if (directOuts > 0) {
            return directOuts
        }

        const inningsPitched = String(
            pitching?.inningsPitched ??
            pitching?.ip ??
            "0.0"
        )

        const [
            wholeInningsText,
            partialOutsText = "0"
        ] = inningsPitched.split(".")

        return this.getNumber(
            wholeInningsText
        ) * 3 +
            this.getNumber(
                partialOutsText
            )
    }

    private getScheduledGameDate(game: any, fallbackDate: string): string {
        return String(
            game?.officialDate ??
            game?.gameDate?.slice?.(0, 10) ??
            fallbackDate
        )
    }

    private isCompletedGame(game: any): boolean {
        const abstractGameState = String(
            game?.status?.abstractGameState ??
            ""
        )

        const detailedState = String(
            game?.status?.detailedState ??
            ""
        )

        const codedGameState = String(
            game?.status?.codedGameState ??
            ""
        )

        const statusCode = String(
            game?.status?.statusCode ??
            ""
        )

        if (
            detailedState === "Postponed" ||
            detailedState === "Cancelled" ||
            detailedState === "Suspended" ||
            codedGameState === "C" ||
            codedGameState === "D" ||
            statusCode === "CO" ||
            statusCode === "DR"
        ) {
            return false
        }

        return abstractGameState === "Final" ||
            detailedState === "Final" ||
            detailedState === "Game Over" ||
            detailedState === "Completed Early" ||
            codedGameState === "F"
    }

    private getNumber(value: unknown): number {
        const number = Number(
            value ??
            0
        )

        return Number.isFinite(number)
            ? number
            : 0
    }

}


export {
    PitcherAppearanceService
}