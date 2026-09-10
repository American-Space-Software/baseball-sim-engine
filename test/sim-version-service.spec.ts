import { strict as assert } from "assert"

import crypto from "crypto"
import fs from "fs"
import os from "os"
import path from "path"

import { afterEach, beforeEach, describe, it } from "mocha"

import {
    simService
} from "../src/sim/index.js"

import { BaselineGameService } from "../src/importer/service/baseline-game-service.js"
import { SimVersionService } from "../src/version/service/sim-version-service.js"


class SimVersionServiceTestHarness {

    public readonly rootDir: string
    public readonly dataDir: string
    public readonly originalCwd: string
    public readonly originalBuildStartedBaselineGame: any
    public readonly originalSimPitch: any

    public constructor() {
        this.originalCwd = process.cwd()
        this.rootDir = fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "sim-version-service-"
            )
        )
        this.dataDir = path.join(
            this.rootDir,
            "data"
        )

        fs.mkdirSync(
            path.join(
                this.dataDir,
                "2025"
            ),
            {
                recursive: true
            }
        )

        process.chdir(
            this.rootDir
        )

        this.originalBuildStartedBaselineGame =
            BaselineGameService.prototype.buildStartedBaselineGame

        this.originalSimPitch =
            simService.simPitch
    }

    public createService(): SimVersionService {
        return new SimVersionService(
            this.dataDir
        )
    }

    public writePackageJson(packageJson: Record<string, unknown>): void {
        fs.writeFileSync(
            path.join(
                this.rootDir,
                "package.json"
            ),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            "utf8"
        )
    }

    public readPackageJson(): Record<string, any> {
        return JSON.parse(
            fs.readFileSync(
                path.join(
                    this.rootDir,
                    "package.json"
                ),
                "utf8"
            )
        )
    }

    public writePitchEnvironment(value: Record<string, unknown>): void {
        fs.writeFileSync(
            path.join(
                this.dataDir,
                "2025",
                "_pitch_environment_target.json"
            ),
            JSON.stringify(value),
            "utf8"
        )
    }

    public useDeterministicGames(resultOffset = 0): void {
        BaselineGameService.prototype.buildStartedBaselineGame =
            function (_pitchEnvironmentTarget: any, seed?: string): any {
                return {
                    isComplete: false,
                    seed,
                    pitches: 0,
                    score: {
                        away: 0,
                        home: 0
                    }
                }
            } as any

        simService.simPitch =
            function (game: any): void {
                game.pitches++
                game.score.away = game.pitches + resultOffset
                game.score.home = game.pitches * 2 + resultOffset

                if (game.pitches === 2) {
                    game.isComplete = true
                }
            } as any
    }

    public getExpectedHash(resultOffset = 0): string {
        const gameHashes: string[] = []

        for (let gameIndex = 0; gameIndex < 100; gameIndex++) {
            const game = {
                isComplete: true,
                seed: `sim-version-${gameIndex}`,
                pitches: 2,
                score: {
                    away: 2 + resultOffset,
                    home: 4 + resultOffset
                }
            }

            gameHashes.push(
                crypto
                    .createHash("sha256")
                    .update(JSON.stringify(game))
                    .digest("hex")
            )
        }

        return crypto
            .createHash("sha256")
            .update(JSON.stringify(gameHashes))
            .digest("hex")
    }

    public close(): void {
        BaselineGameService.prototype.buildStartedBaselineGame =
            this.originalBuildStartedBaselineGame

        simService.simPitch =
            this.originalSimPitch

        process.chdir(
            this.originalCwd
        )

        fs.rmSync(
            this.rootDir,
            {
                recursive: true,
                force: true
            }
        )
    }

}


describe("SimVersionService", function () {

    let harness: SimVersionServiceTestHarness

    beforeEach(function () {
        harness = new SimVersionServiceTestHarness()
        harness.writePitchEnvironment({
            season: 2025
        })
    })

    afterEach(function () {
        harness?.close()
    })

    it("returns undefined when package.json does not contain a sim version", function () {
        harness.writePackageJson({
            name: "baseball-sim-engine",
            version: "1.0.0"
        })

        const result = harness.createService().read()

        assert.equal(
            result,
            undefined
        )
    })

    it("reads the current sim version from package.json", function () {
        harness.writePackageJson({
            name: "baseball-sim-engine",
            version: "1.0.0",
            simVersion: 7,
            simHash: "abc123"
        })

        const result = harness.createService().read()

        assert.deepEqual(
            result,
            {
                version: 7,
                hash: "abc123"
            }
        )
    })

    it("creates version one when no previous sim version exists", function () {
        harness.writePackageJson({
            name: "baseball-sim-engine",
            version: "1.0.0"
        })

        harness.useDeterministicGames()

        const result = harness.createService().generate()
        const packageJson = harness.readPackageJson()

        assert.deepEqual(
            result,
            {
                version: 1,
                hash: harness.getExpectedHash()
            }
        )

        assert.equal(
            packageJson.simVersion,
            1
        )

        assert.equal(
            packageJson.simHash,
            harness.getExpectedHash()
        )

        assert.equal(
            packageJson.name,
            "baseball-sim-engine"
        )

        assert.equal(
            packageJson.version,
            "1.0.0"
        )
    })

    it("keeps the current version when the generated game hash is unchanged", function () {
        const hash = harness.getExpectedHash()

        harness.writePackageJson({
            name: "baseball-sim-engine",
            version: "1.0.0",
            simVersion: 4,
            simHash: hash
        })

        harness.useDeterministicGames()

        const before = fs.readFileSync(
            path.join(
                harness.rootDir,
                "package.json"
            ),
            "utf8"
        )

        const result = harness.createService().generate()

        const after = fs.readFileSync(
            path.join(
                harness.rootDir,
                "package.json"
            ),
            "utf8"
        )

        assert.deepEqual(
            result,
            {
                version: 4,
                hash
            }
        )

        assert.equal(
            after,
            before
        )
    })

    it("increments the version when the generated game hash changes", function () {
        harness.writePackageJson({
            name: "baseball-sim-engine",
            version: "1.0.0",
            simVersion: 4,
            simHash: harness.getExpectedHash()
        })

        harness.useDeterministicGames(
            1
        )

        const result = harness.createService().generate()
        const packageJson = harness.readPackageJson()
        const expectedHash = harness.getExpectedHash(
            1
        )

        assert.deepEqual(
            result,
            {
                version: 5,
                hash: expectedHash
            }
        )

        assert.equal(
            packageJson.simVersion,
            5
        )

        assert.equal(
            packageJson.simHash,
            expectedHash
        )
    })

    it("uses the supplied data directory for the pitch environment", function () {
        const pitchEnvironment = {
            season: 2025,
            marker: "supplied-data-directory"
        }

        harness.writePitchEnvironment(
            pitchEnvironment
        )

        const service = harness.createService()
        const result = (service as any).getPitchEnvironment()

        assert.deepEqual(
            result,
            pitchEnvironment
        )
    })

})
