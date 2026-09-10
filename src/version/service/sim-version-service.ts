import crypto from "crypto"
import fs from "fs"
import path from "path"

import seedrandom from "seedrandom"

import {
    simService
} from "../../sim/index.js"

import type {
    Game,
    PitchEnvironmentTarget
} from "../../sim/index.js"

import { BaselineGameService } from "../../importer/service/baseline-game-service.js"


interface PackageJson {
    name?: string
    version?: string
    simVersion?: number
    simHash?: string
    [key: string]: unknown
}

interface SimVersion {
    version: number
    hash: string
}

class SimVersionService {

    private readonly season = 2025
    private readonly games = 100
    private readonly rootDir = process.cwd()

    public constructor(private readonly dataDir: string) {}

    public generate(): SimVersion {
        const pitchEnvironment = this.getPitchEnvironment()
        const baselineGameService = new BaselineGameService(simService)
        const gameHashes: string[] = []

        for (let gameIndex = 0; gameIndex < this.games; gameIndex++) {
            const seed = `sim-version-${gameIndex}`
            const game = baselineGameService.buildStartedBaselineGame(
                structuredClone(pitchEnvironment),
                seed
            )

            const rng = seedrandom(seed)

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            gameHashes.push(this.hashGame(game))
        }

        const hash = this.hash(JSON.stringify(gameHashes))
        const packageJson = this.readPackageJson()
        const currentVersion = packageJson.simVersion ?? 0

        if (packageJson.simHash === hash) {
            return {
                version: currentVersion,
                hash
            }
        }

        const version = currentVersion + 1

        packageJson.simVersion = version
        packageJson.simHash = hash

        this.writePackageJson(packageJson)

        return {
            version,
            hash
        }
    }

    public read(): SimVersion | undefined {
        const packageJson = this.readPackageJson()

        if (
            packageJson.simVersion == undefined ||
            packageJson.simHash == undefined
        ) {
            return undefined
        }

        return {
            version: packageJson.simVersion,
            hash: packageJson.simHash
        }
    }

    private getPitchEnvironment(): PitchEnvironmentTarget {
        return JSON.parse(
            fs.readFileSync(
                path.resolve(
                    this.dataDir,
                    String(this.season),
                    "_pitch_environment_target.json"
                ),
                "utf8"
            )
        ) as PitchEnvironmentTarget
    }

    private hashGame(game: Game): string {
        return this.hash(JSON.stringify(game))
    }

    private hash(value: string): string {
        return crypto
            .createHash("sha256")
            .update(value)
            .digest("hex")
    }

    private readPackageJson(): PackageJson {
        return JSON.parse(
            fs.readFileSync(
                this.getPackageJsonPath(),
                "utf8"
            )
        ) as PackageJson
    }

    private writePackageJson(packageJson: PackageJson): void {
        fs.writeFileSync(
            this.getPackageJsonPath(),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            "utf8"
        )
    }

    private getPackageJsonPath(): string {
        return path.resolve(
            this.rootDir,
            "package.json"
        )
    }

}


export type {
    SimVersion
}

export {
    SimVersionService
}
