import fs from "fs"
import path from "path"


class TeamRatingRepository {

    public constructor(
        private readonly baseDataDir: string
    ) {}

    public async get(date: string): Promise<TeamRatingSnapshot | undefined> {
        const filePath = this.getFilePath(date)

        try {
            const snapshot = JSON.parse(
                await fs.promises.readFile(filePath, "utf8")
            ) as TeamRatingSnapshot

            this.validateSnapshot(snapshot, date)

            return snapshot
        } catch (error: any) {
            if (error?.code === "ENOENT") {
                return undefined
            }

            throw error
        }
    }

    public async getLatestBefore(date: string): Promise<TeamRatingSnapshot | undefined> {
        const directory = path.join(
            this.baseDataDir,
            String(this.getSeason(date)),
            "team-ratings"
        )

        let entries: string[]

        try {
            entries = await fs.promises.readdir(directory)
        } catch (error: any) {
            if (error?.code === "ENOENT") {
                return undefined
            }

            throw error
        }

        const latestDate = entries
            .filter(entry => entry.endsWith(".json"))
            .map(entry => entry.slice(0, -5))
            .filter(snapshotDate => snapshotDate < date)
            .sort()
            .at(-1)

        if (!latestDate) {
            return undefined
        }

        return await this.get(latestDate)
    }

    public async put(snapshot: TeamRatingSnapshot): Promise<void> {
        this.validateSnapshot(snapshot, snapshot.date)

        const filePath = this.getFilePath(snapshot.date)

        await fs.promises.mkdir(
            path.dirname(filePath),
            {
                recursive: true
            }
        )

        await fs.promises.writeFile(
            filePath,
            JSON.stringify(snapshot, null, 2),
            "utf8"
        )
    }

    private getFilePath(date: string): string {
        return path.join(
            this.baseDataDir,
            String(this.getSeason(date)),
            "team-ratings",
            `${date}.json`
        )
    }

    private getSeason(date: string): number {
        this.validateDate(date)
        return Number(date.slice(0, 4))
    }

    private validateSnapshot(snapshot: TeamRatingSnapshot, expectedDate: string): void {
        if (!snapshot || typeof snapshot !== "object") {
            throw new Error(`Invalid team rating snapshot for ${expectedDate}.`)
        }

        if (snapshot.date !== expectedDate) {
            throw new Error(`Invalid team rating snapshot date ${snapshot.date} for ${expectedDate}.`)
        }

        if (!snapshot.teams || typeof snapshot.teams !== "object" || Array.isArray(snapshot.teams)) {
            throw new Error(`Invalid team ratings for ${expectedDate}.`)
        }

        for (const [teamId, rating] of Object.entries(snapshot.teams)) {
            if (!teamId) {
                throw new Error(`Invalid team ID in team ratings for ${expectedDate}.`)
            }

            if (
                !rating ||
                !Number.isFinite(rating.rating) ||
                !Number.isFinite(rating.rd) ||
                !Number.isFinite(rating.vol)
            ) {
                throw new Error(`Invalid team rating for team ${teamId} on ${expectedDate}.`)
            }
        }
    }

    private validateDate(date: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`Invalid team rating date ${date}.`)
        }

        const parsed = new Date(`${date}T00:00:00Z`)

        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
            throw new Error(`Invalid team rating date ${date}.`)
        }
    }

}


interface TeamRating {
    rating: number
    rd: number
    vol: number
}


interface TeamRatingSnapshot {
    date: string
    teams: Record<string, TeamRating>
}


export {
    TeamRatingRepository
}


export type {
    TeamRating,
    TeamRatingSnapshot
}