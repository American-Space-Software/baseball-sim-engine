import fs from "fs"
import path from "path"


interface PlayerRatingsRow {
    playerId: string
    firstName: string
    lastName: string
    primaryPosition: any
    age: number
    throws: any
    hits: any
    overallRating: number
    hittingRatings: any
    pitchRatings: any
}


class PlayerRatingsRepository {

    public constructor(private readonly dataDir: string) {}

    public async read(gameDate: string): Promise<PlayerRatingsRow[]> {
        const filePath = this.getFilePath(gameDate)

        try {
            const parsed = JSON.parse(
                await fs.promises.readFile(
                    filePath,
                    "utf8"
                )
            )

            if (!Array.isArray(parsed)) {
                throw new Error(`Historical player ratings file is not an array: ${filePath}`)
            }

            return parsed as PlayerRatingsRow[]
        } catch (error: unknown) {
            if (this.isMissingFile(error)) {
                return []
            }

            throw error
        }
    }

    public async write(gameDate: string, ratings: PlayerRatingsRow[]): Promise<void> {
        const filePath = this.getFilePath(gameDate)

        await fs.promises.mkdir(path.dirname(filePath), {
            recursive: true
        })

        await fs.promises.writeFile(filePath, JSON.stringify(ratings, null, 2), "utf8")
    }

    private getFilePath(gameDate: string): string {
        return path.join(
            this.dataDir,
            gameDate.slice(0, 4),
            "player-ratings",
            `${gameDate}.json`
        )
    }

    private isMissingFile(error: unknown): boolean {
        return error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
    }

}


export {
    PlayerRatingsRepository
}


export type {
    PlayerRatingsRow
}