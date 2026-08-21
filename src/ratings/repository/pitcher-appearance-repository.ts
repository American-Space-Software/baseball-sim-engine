import fs from "fs"
import path from "path"


class PitcherAppearanceRepository {

    public constructor(private readonly dataDir: string) {}

    public async read(gameDate: string): Promise<PitcherAppearance[] | undefined> {
        const filePath = this.getFilePath(gameDate)

        try {
            return JSON.parse(
                await fs.promises.readFile(
                    filePath,
                    "utf8"
                )
            ) as PitcherAppearance[]
        } catch (error: unknown) {
            if (this.isMissingFile(error)) {
                return undefined
            }

            throw error
        }
    }

    public async write(gameDate: string, appearances: PitcherAppearance[]): Promise<void> {
        const filePath = this.getFilePath(gameDate)

        await fs.promises.mkdir(
            path.dirname(filePath),
            {
                recursive: true
            }
        )

        await fs.promises.writeFile(
            filePath,
            JSON.stringify(
                appearances,
                null,
                2
            ),
            "utf8"
        )
    }

    private getFilePath(gameDate: string): string {
        return path.join(
            this.dataDir,
            gameDate.slice(0, 4),
            "pitcher-appearances",
            `${gameDate}.json`
        )
    }

    private isMissingFile(error: unknown): boolean {
        return error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
    }
}


interface PitcherAppearance {
    playerId: string
    playerName: string
    gameId: string
    gameDate: string
    teamId: string

    pitches: number
    outs: number
    inningsPitched: number
    battersFaced: number

    gamesStarted: number
    gamesFinished: number
    saves: number
    holds: number
    blownSaves: number

    entryInning?: number
}


export {
    PitcherAppearanceRepository
}


export type {
    PitcherAppearance
}