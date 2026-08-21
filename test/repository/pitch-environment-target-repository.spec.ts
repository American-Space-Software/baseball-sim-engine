import { strict as assert } from "assert"
import fs from "fs"
import os from "os"
import path from "path"

import { afterEach, beforeEach, describe, it } from "mocha"

import { PitchEnvironmentTargetRepository } from "../../src/ratings/repository/pitch-environment-target-repository.js"

import type {
    PitchEnvironmentTarget
} from "../../src/sim/service/interfaces.js"


describe("PitchEnvironmentTargetRepository", function () {

    let rootDir: string
    let dataDir: string
    let repository: PitchEnvironmentTargetRepository

    beforeEach(async function () {
        rootDir = await fs.promises.mkdtemp(
            path.join(
                os.tmpdir(),
                "pitch-environment-target-repository-"
            )
        )

        dataDir = path.join(
            rootDir,
            "data"
        )

        repository = new PitchEnvironmentTargetRepository(
            dataDir
        )
    })

    afterEach(async function () {
        await fs.promises.rm(
            rootDir,
            {
                recursive: true,
                force: true
            }
        )
    })

    it("returns undefined when the pitch environment file does not exist", async function () {
        assert.equal(
            await repository.read(
                "2026-08-21"
            ),
            undefined
        )
    })

    it("writes and reads a pitch environment target", async function () {
        const target = buildTarget(
            100
        )

        await repository.write(
            "2026-08-21",
            target
        )

        assert.deepEqual(
            await repository.read(
                "2026-08-21"
            ),
            target
        )

        assert.equal(
            fs.existsSync(
                path.join(
                    dataDir,
                    "2026",
                    "pitch-environment",
                    "2026-08-21.json"
                )
            ),
            true
        )
    })

    it("replaces the pitch environment target for the same game date", async function () {
        await repository.write(
            "2026-08-21",
            buildTarget(
                100
            )
        )

        await repository.write(
            "2026-08-21",
            buildTarget(
                110
            )
        )

        assert.deepEqual(
            await repository.read(
                "2026-08-21"
            ),
            buildTarget(
                110
            )
        )
    })

    it("stores pitch environment targets for different dates separately", async function () {
        const first = buildTarget(
            100
        )

        const second = buildTarget(
            110
        )

        await repository.write(
            "2026-08-20",
            first
        )

        await repository.write(
            "2026-08-21",
            second
        )

        assert.deepEqual(
            await repository.read(
                "2026-08-20"
            ),
            first
        )

        assert.deepEqual(
            await repository.read(
                "2026-08-21"
            ),
            second
        )
    })

    it("stores pitch environment targets for different seasons separately", async function () {
        const first = buildTarget(
            100
        )

        const second = buildTarget(
            110
        )

        await repository.write(
            "2025-08-21",
            first
        )

        await repository.write(
            "2026-08-21",
            second
        )

        assert.deepEqual(
            await repository.read(
                "2025-08-21"
            ),
            first
        )

        assert.deepEqual(
            await repository.read(
                "2026-08-21"
            ),
            second
        )
    })

    function buildTarget(avgRating: number): PitchEnvironmentTarget {
        return {
            avgRating,
            outcome: {
                avg: 0.245,
                bbPercent: 0.084,
                soPercent: 0.222,
                babip: 0.294,
                doublePercent: 0.045,
                triplePercent: 0.004,
                homeRunPercent: 0.031
            },
            battedBall: {
                contactRollInput: {
                    groundball: 44,
                    flyBall: 36,
                    lineDrive: 20
                }
            },
            swing: {
                swingAtBallsPercent: 28,
                inZoneContactPercent: 84,
                outZoneContactPercent: 60
            },
            importReference: {
                hitter: {
                    pa: 1000
                }
            }
        } as PitchEnvironmentTarget
    }

})