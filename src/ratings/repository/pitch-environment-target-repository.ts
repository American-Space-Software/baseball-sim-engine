import fs from "fs"
import path from "path"

import type {
    PitchEnvironmentTarget
} from "../../sim/service/interfaces.js"


class PitchEnvironmentTargetRepository {

    public constructor(private readonly dataDir: string) {}

    public async read(gameDate: string): Promise<PitchEnvironmentTarget | undefined> {
        const filePath = this.getFilePath(
            gameDate
        )

        try {
            return JSON.parse(
                await fs.promises.readFile(
                    filePath,
                    "utf8"
                )
            ) as PitchEnvironmentTarget
        } catch (error: unknown) {
            if (this.isMissingFile(error)) {
                return undefined
            }

            throw error
        }
    }

    public async write(gameDate: string, target: PitchEnvironmentTarget): Promise<void> {
        const filePath = this.getFilePath(
            gameDate
        )

        await fs.promises.mkdir(
            path.dirname(
                filePath
            ),
            {
                recursive: true
            }
        )

        await fs.promises.writeFile(
            filePath,
            `${JSON.stringify(target, null, 2)}\n`,
            "utf8"
        )
    }

    private getFilePath(gameDate: string): string {
        return path.join(
            this.dataDir,
            gameDate.slice(0, 4),
            "pitch-environment",
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
    PitchEnvironmentTargetRepository
}