import assert from "assert"
import seedrandom from "seedrandom"

import type {
    PitchEnvironmentTarget,
    PlayerImportRaw,
    RatingTuning
} from "../src/sim/service/interfaces.js"

import { RollChartService } from "../src/sim/service/roll-chart-service.js"
import { GameInfo, GamePlayers, SimRolls, SimService } from "../src/sim/service/sim-service.js"
import { StatService } from "../src/sim/service/stat-service.js"
import { RunnerService } from "../src/sim/service/runner-service.js"
import { SubstitutionService } from "../src/sim/service/substitution-service.js"
import { PitchEnvironmentService } from "../src/importer/service/pitch-environment-service.js"
import { PlayerRatingService } from "../src/importer/service/player-rating-service.js"
import { BaselineGameService } from "../src/importer/service/baseline-game-service.js"
import { DownloaderService } from "../src/importer/service/downloader-service.js"

const season = 2025
const baseDataDir = "data"
const gamesPerPlayer = 150

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const createServices = () => {
    const rollChartService = new RollChartService()
    const statService = new StatService()
    const simRolls = new SimRolls(rollChartService)
    const gamePlayers = new GamePlayers()
    const runnerService = new RunnerService(simRolls)
    const gameInfo = new GameInfo(gamePlayers)
    const substitutionService = new SubstitutionService()
    const simService = new SimService(rollChartService, simRolls, runnerService, gameInfo, substitutionService, {} as PitchEnvironmentTarget)
    const baselineGameService = new BaselineGameService(simService)
    const pitchEnvironmentService = new PitchEnvironmentService(simService, statService, baselineGameService)
    const playerRatingService = new PlayerRatingService(simService, statService, baselineGameService)

    return {
        pitchEnvironmentService,
        playerRatingService
    }
}

const createTuning = (mutate?: (tuning: RatingTuning) => void): RatingTuning => {
    const tuning = clone(PlayerRatingService.seedRatingTuning())

    if (mutate) {
        mutate(tuning)
    }

    return tuning
}

const downloaderService = new DownloaderService(baseDataDir, 1000)
const players = await downloaderService.buildSeasonPlayerImports(season, new Set([]))
const services = createServices()

const pitchEnvironment = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
    season,
    players
)

const fullName = (player: PlayerImportRaw): string => {
    return `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim()
}

const findPlayer = (name: string): PlayerImportRaw => {
    const normalizedName = name.toLowerCase()

    const matches = Array.from(players.values())
        .filter(player => fullName(player).toLowerCase() === normalizedName)

    if (matches.length === 1) {
        return matches[0]
    }

    const fuzzyMatches = Array.from(players.values())
        .filter(player => fullName(player).toLowerCase().includes(normalizedName))

    if (fuzzyMatches.length === 1) {
        return fuzzyMatches[0]
    }

    const candidates = [...matches, ...fuzzyMatches]
        .map(player => ({
            playerId: player.playerId,
            name: fullName(player),
            position: player.primaryPosition,
            pa: player.hitting?.pa,
            battersFaced: player.pitching?.battersFaced
        }))

    assert.fail(`Expected exactly one match for ${name}. matches=${JSON.stringify(candidates, null, 2)}`)
}

const getRatings = (player: PlayerImportRaw, tuning?: RatingTuning): any => {
    const command = PlayerRatingService.createPlayerFromImportRaw(
        pitchEnvironment,
        player
    ) as any

    if (tuning) {
        command.ratingTuning = tuning
    }

    return PlayerRatingService.createPlayerFromStatsCommand(command)
}

const assertFiniteNumbers = (value: any, path: string = "result"): void => {
    if (typeof value === "string") return

    if (value === null || value === undefined) {
        assert.fail(`${path} is ${value}`)
    }

    if (typeof value === "number") {
        assert.ok(Number.isFinite(value), `${path} is not finite: ${value}`)
        return
    }

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            assertFiniteNumbers(value[i], `${path}[${i}]`)
        }

        return
    }

    if (typeof value !== "object") return

    for (const key of Object.keys(value)) {
        assertFiniteNumbers(value[key], `${path}.${key}`)
    }
}

const assertGreater = (actual: number, expectedGreaterThan: number, label: string): void => {
    assert.ok(
        actual > expectedGreaterThan,
        `${label} expected ${actual} > ${expectedGreaterThan}`
    )
}

const assertAtLeast = (actual: number, expectedAtLeast: number, label: string): void => {
    assert.ok(
        actual >= expectedAtLeast,
        `${label} expected ${actual} >= ${expectedAtLeast}`
    )
}

const splitWidth = (left: number, right: number): number => {
    return Math.abs(Number(left) - Number(right))
}

const average = (values: number[]): number => {
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

const round = (value: any, digits: number = 3): number | undefined => {
    const number = Number(value)

    if (!Number.isFinite(number)) {
        return undefined
    }

    return Number(number.toFixed(digits))
}

const metricRow = (actual: any, target: any, key: string, digits: number = 3) => {
    const actualValue = Number(actual?.[key])
    const targetValue = Number(target?.[key])
    const diff = actualValue - targetValue

    return {
        actual: round(actualValue, digits),
        target: round(targetValue, digits),
        diff: round(diff, digits)
    }
}

const printHitterReport = (result: any): void => {
    console.log("[HITTER SIM VS REAL]", {
        count: result.actual?.hitterCount,
        avg: metricRow(result.actual?.hitter, result.target?.hitter, "avg"),
        obp: metricRow(result.actual?.hitter, result.target?.hitter, "obp"),
        slg: metricRow(result.actual?.hitter, result.target?.hitter, "slg"),
        ops: metricRow(result.actual?.hitter, result.target?.hitter, "ops"),
        soPercent: metricRow(result.actual?.hitter, result.target?.hitter, "soPercent"),
        bbPercent: metricRow(result.actual?.hitter, result.target?.hitter, "bbPercent")
    })
}

const printPitcherReport = (result: any): void => {
    console.log("[PITCHER SIM VS REAL]", {
        count: result.actual?.pitcherCount,
        era: metricRow(result.actual?.pitcher, result.target?.pitcher, "era"),
        soPercent: metricRow(result.actual?.pitcher, result.target?.pitcher, "soPercent"),
        bbPercent: metricRow(result.actual?.pitcher, result.target?.pitcher, "bbPercent"),
        homeRunPercent: metricRow(result.actual?.pitcher, result.target?.pitcher, "homeRunPercent")
    })
}

const summarizeRatings = (ratings: any): any => {
    return {
        hitting: ratings.hittingRatings ? {
            vsR: ratings.hittingRatings.vsR,
            vsL: ratings.hittingRatings.vsL,
            contactProfile: ratings.hittingRatings.contactProfile,
            speed: ratings.hittingRatings.speed,
            steals: ratings.hittingRatings.steals,
            defense: ratings.hittingRatings.defense,
            arm: ratings.hittingRatings.arm
        } : undefined,
        pitching: ratings.pitchRatings ? {
            power: ratings.pitchRatings.power,
            vsR: ratings.pitchRatings.vsR,
            vsL: ratings.pitchRatings.vsL,
            contactProfile: ratings.pitchRatings.contactProfile,
            pitches: ratings.pitchRatings.pitches
        } : undefined
    }
}

const evaluatePlayer = (player: PlayerImportRaw): any => {
    return services.playerRatingService.evaluatePlayerRatings(
        pitchEnvironment,
        createTuning(),
        [player],
        seedrandom(`player-rating-report:${season}:${player.playerId}`),
        gamesPerPlayer
    )
}

const printPlayerDiagnostic = (label: string, player: PlayerImportRaw): void => {
    const ratings = getRatings(player, createTuning())

    assertFiniteNumbers(ratings, `${label}.ratings`)

    console.log("")
    console.log("============================================================")
    console.log(`[PLAYER RATING REPORT] ${label}`)
    console.log("============================================================")
    console.log("[PLAYER IMPORT]", {
        playerId: player.playerId,
        name: fullName(player),
        primaryPosition: player.primaryPosition,
        bats: player.bats,
        throws: player.throws,
        age: player.age,
        pa: player.hitting?.pa,
        battersFaced: player.pitching?.battersFaced,
        outs: player.pitching?.outs,
        runs: (player.pitching as any)?.runs,
        runsAllowed: (player.pitching as any)?.runsAllowed,
        er: (player.pitching as any)?.er,
        earnedRuns: (player.pitching as any)?.earnedRuns,
        earnedRunsAllowed: (player.pitching as any)?.earnedRunsAllowed,
        pitchingKeys: Object.keys(player.pitching ?? {}).sort()
    })

    console.log("[GENERATED RATINGS]", summarizeRatings(ratings))

    const result = evaluatePlayer(player)

    console.log("[SIM SUMMARY]", {
        gamesPerPlayer,
        playerCount: result.actual?.playerCount,
        hitterCount: result.actual?.hitterCount,
        pitcherCount: result.actual?.pitcherCount,
        twoWayCount: result.actual?.twoWayCount,
        hitterScore: round(result.actual?.hitterScore),
        pitcherScore: round(result.actual?.pitcherScore),
        score: round(result.score)
    })

    if (Number(result.actual?.hitterCount ?? 0) > 0) {
        printHitterReport(result)
    }

    if (Number(result.actual?.pitcherCount ?? 0) > 0) {
        printPitcherReport(result)
    }

    assert.ok(Number(result.actual?.playerCount ?? 0) > 0)
}

describe("Player Rating Real Player Diagnostics", () => {

    it("should calculate pitch environment target from the full imported season", () => {
        assert.ok(players.size > 100, `Expected full season player import. players=${players.size}`)
        assert.ok(pitchEnvironment)
        assert.ok(pitchEnvironment.outcome)
        assert.ok(pitchEnvironment.pitch)
        assert.ok(pitchEnvironment.swing)
        assert.ok(pitchEnvironment.battedBall)
    })

    it("should print Aaron Judge ratings and 150-game simulated results vs real stats", function () {
        this.timeout(300000)

        printPlayerDiagnostic("Aaron Judge", findPlayer("Aaron Judge"))
    })

    it("should print Paul Skenes ratings and 150-game simulated results vs real stats", function () {
        this.timeout(300000)

        printPlayerDiagnostic("Paul Skenes", findPlayer("Paul Skenes"))
    })

    it("should print Shohei Ohtani ratings and 150-game simulated results vs real stats", function () {
        this.timeout(300000)

        printPlayerDiagnostic("Shohei Ohtani", findPlayer("Shohei Ohtani"))
    })

})

describe("Player Rating Basic Generation", () => {

    it("should generate deterministic ratings for the same real hitter input", () => {
        const player = findPlayer("Aaron Judge")

        const first = getRatings(player, createTuning())
        const second = getRatings(player, createTuning())

        assert.deepEqual(first, second)
    })

    it("should generate complete finite ratings for Aaron Judge", () => {
        const ratings = getRatings(findPlayer("Aaron Judge"), createTuning())

        assertFiniteNumbers(ratings.hittingRatings, "hittingRatings")
        assertFiniteNumbers(ratings.pitchRatings, "pitchRatings")
    })

    it("should generate complete finite ratings for Paul Skenes", () => {
        const ratings = getRatings(findPlayer("Paul Skenes"), createTuning())

        assertFiniteNumbers(ratings.hittingRatings, "hittingRatings")
        assertFiniteNumbers(ratings.pitchRatings, "pitchRatings")
    })

    it("should generate at least three pitch types for Paul Skenes", () => {
        const ratings = getRatings(findPlayer("Paul Skenes"), createTuning())

        assert.ok(Array.isArray(ratings.pitchRatings.pitches))
        assertAtLeast(ratings.pitchRatings.pitches.length, 3, "pitch count")
    })

    it("should generate two-way finite ratings for Shohei Ohtani", () => {
        const ratings = getRatings(findPlayer("Shohei Ohtani"), createTuning())

        assertFiniteNumbers(ratings.hittingRatings, "hittingRatings")
        assertFiniteNumbers(ratings.pitchRatings, "pitchRatings")
        assert.ok(Array.isArray(ratings.pitchRatings.pitches))
        assertAtLeast(ratings.pitchRatings.pitches.length, 3, "pitch count")
    })

})

describe("Player Rating Tuning Direction", () => {

    it("should keep ratings unchanged when all rating tuning scales are zero", () => {
        const player = findPlayer("Shohei Ohtani")

        const baseline = getRatings(player, createTuning())
        const zero = getRatings(player, createTuning(tuning => {
            tuning.hitting.contactScale = 0
            tuning.hitting.plateDisciplineScale = 0
            tuning.hitting.gapPowerScale = 0
            tuning.hitting.homerunPowerScale = 0
            tuning.hitting.splitScale = 0
            tuning.pitching.powerScale = 0
            tuning.pitching.controlScale = 0
            tuning.pitching.movementScale = 0
            tuning.pitching.splitScale = 0
            tuning.running.speedScale = 0
            tuning.running.stealsScale = 0
            tuning.fielding.defenseScale = 0
            tuning.fielding.armScale = 0
        }))

        assert.deepEqual(zero, baseline)
    })

    it("should tune hitter contact upward when hitting contactScale increases", () => {
        const player = findPlayer("Aaron Judge")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.hitting.contactScale = 0.25
        }))

        assertGreater(tuned.hittingRatings.vsR.contact, baseline.hittingRatings.vsR.contact, "vsR contact")
        assertGreater(tuned.hittingRatings.vsL.contact, baseline.hittingRatings.vsL.contact, "vsL contact")
    })

    it("should tune hitter plate discipline upward when hitting plateDisciplineScale increases", () => {
        const player = findPlayer("Aaron Judge")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.hitting.plateDisciplineScale = 0.25
        }))

        assertGreater(tuned.hittingRatings.vsR.plateDiscipline, baseline.hittingRatings.vsR.plateDiscipline, "vsR plateDiscipline")
        assertGreater(tuned.hittingRatings.vsL.plateDiscipline, baseline.hittingRatings.vsL.plateDiscipline, "vsL plateDiscipline")
    })

    it("should tune hitter gap power upward when hitting gapPowerScale increases", () => {
        const player = findPlayer("Aaron Judge")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.hitting.gapPowerScale = 0.25
        }))

        assertGreater(tuned.hittingRatings.vsR.gapPower, baseline.hittingRatings.vsR.gapPower, "vsR gapPower")
        assertGreater(tuned.hittingRatings.vsL.gapPower, baseline.hittingRatings.vsL.gapPower, "vsL gapPower")
    })

    it("should tune hitter home run power upward when hitting homerunPowerScale increases", () => {
        const player = findPlayer("Aaron Judge")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.hitting.homerunPowerScale = 0.25
        }))

        assertGreater(tuned.hittingRatings.vsR.homerunPower, baseline.hittingRatings.vsR.homerunPower, "vsR homerunPower")
        assertGreater(tuned.hittingRatings.vsL.homerunPower, baseline.hittingRatings.vsL.homerunPower, "vsL homerunPower")
    })

    it("should tune hitter split wider when hitting splitScale increases", () => {
        const player = findPlayer("Aaron Judge")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.hitting.splitScale = 0.25
        }))

        assertAtLeast(
            splitWidth(tuned.hittingRatings.vsR.contact, tuned.hittingRatings.vsL.contact),
            splitWidth(baseline.hittingRatings.vsR.contact, baseline.hittingRatings.vsL.contact),
            "contact split"
        )

        assertAtLeast(
            splitWidth(tuned.hittingRatings.vsR.homerunPower, tuned.hittingRatings.vsL.homerunPower),
            splitWidth(baseline.hittingRatings.vsR.homerunPower, baseline.hittingRatings.vsL.homerunPower),
            "home run power split"
        )
    })

    it("should tune pitcher power upward when pitching powerScale increases", () => {
        const player = findPlayer("Paul Skenes")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.pitching.powerScale = 0.25
        }))

        assertGreater(tuned.pitchRatings.power, baseline.pitchRatings.power, "pitcher power")
    })

    it("should tune pitcher control upward when pitching controlScale increases", () => {
        const player = findPlayer("Paul Skenes")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.pitching.controlScale = 0.25
        }))

        assertGreater(tuned.pitchRatings.vsR.control, baseline.pitchRatings.vsR.control, "vsR control")
        assertGreater(tuned.pitchRatings.vsL.control, baseline.pitchRatings.vsL.control, "vsL control")
    })

    it("should tune pitcher movement upward when pitching movementScale increases", () => {
        const player = findPlayer("Paul Skenes")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.pitching.movementScale = 0.25
        }))

        assertGreater(tuned.pitchRatings.vsR.movement, baseline.pitchRatings.vsR.movement, "vsR movement")
        assertGreater(tuned.pitchRatings.vsL.movement, baseline.pitchRatings.vsL.movement, "vsL movement")
    })

    it("should tune pitcher split wider when pitching splitScale increases", () => {
        const player = findPlayer("Shohei Ohtani")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.pitching.splitScale = 0.25
        }))

        assertAtLeast(
            splitWidth(tuned.pitchRatings.vsR.control, tuned.pitchRatings.vsL.control),
            splitWidth(baseline.pitchRatings.vsR.control, baseline.pitchRatings.vsL.control),
            "control split"
        )

        assertAtLeast(
            splitWidth(tuned.pitchRatings.vsR.movement, tuned.pitchRatings.vsL.movement),
            splitWidth(baseline.pitchRatings.vsR.movement, baseline.pitchRatings.vsL.movement),
            "movement split"
        )
    })

    it("should tune speed upward when running speedScale increases", () => {
        const player = findPlayer("Shohei Ohtani")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.running.speedScale = 0.25
        }))

        assertGreater(tuned.hittingRatings.speed, baseline.hittingRatings.speed, "speed")
    })

    it("should tune steals upward when running stealsScale increases", () => {
        const player = findPlayer("Shohei Ohtani")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.running.stealsScale = 0.25
        }))

        assertGreater(tuned.hittingRatings.steals, baseline.hittingRatings.steals, "steals")
    })

    it("should tune defense upward when fielding defenseScale increases", () => {
        const player = findPlayer("Aaron Judge")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.fielding.defenseScale = 0.25
        }))

        assertGreater(tuned.hittingRatings.defense, baseline.hittingRatings.defense, "defense")
    })

    it("should tune arm upward when fielding armScale increases", () => {
        const player = findPlayer("Aaron Judge")
        const baseline = getRatings(player, createTuning())
        const tuned = getRatings(player, createTuning(tuning => {
            tuning.fielding.armScale = 0.25
        }))

        assertGreater(tuned.hittingRatings.arm, baseline.hittingRatings.arm, "arm")
    })

})