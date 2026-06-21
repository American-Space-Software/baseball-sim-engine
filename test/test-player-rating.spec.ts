import assert from "assert"
import seedrandom from "seedrandom"

import type {
    PitchEnvironmentTarget,
    Player,
    PlayerImportRaw,
    RatingTuning
} from "../src/sim/service/interfaces.js"

import { RollChartService } from "../src/sim/service/roll-chart-service.js"
import { GameInfo, GamePlayers, PlayerChange, SimRolls, SimService } from "../src/sim/service/sim-service.js"
import { StatService } from "../src/sim/service/stat-service.js"
import { RunnerService } from "../src/sim/service/runner-service.js"
import { SubstitutionService } from "../src/sim/service/substitution-service.js"
import { PitchEnvironmentService } from "../src/importer/service/pitch-environment-service.js"
import { PlayerRatingService } from "../src/importer/service/player-rating-service.js"
import { BaselineGameService } from "../src/importer/service/baseline-game-service.js"
import { DownloaderService } from "../src/importer/service/downloader-service.js"
import { Handedness, simService } from "../src/sim/index.js"

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

const baselineGameService = new BaselineGameService(simService)
const downloaderService = new DownloaderService(baseDataDir, 1000)
const players = await downloaderService.buildSeasonPlayerImports(season, new Set([]))
const services = createServices()

const pitchEnvironment = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
    season,
    players
)


type ElasticityDirection = "up" | "down"
type ElasticitySide = "hitter" | "pitcher"
type HitterElasticityStat = "contact" | "plateDiscipline" | "gapPower" | "homerunPower"
type PitcherElasticityStat = "power" | "control" | "movement"
type ElasticityStat = HitterElasticityStat | PitcherElasticityStat

type ElasticityMetricSpec = {
    metric: string
    expected: ElasticityDirection
    primary?: boolean
    compressionThreshold?: number
    excessiveThreshold?: number
}

type ElasticityDiagnosticSpec = {
    label: string
    side: ElasticitySide
    stat: ElasticityStat
    metrics: ElasticityMetricSpec[]
}

class RatingTestHarness {

    static readonly ratingLevels = [30, 50, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170]
    static readonly gamesPerRating = 150
    static readonly samplesPerRating = 5

    static readonly specs: ElasticityDiagnosticSpec[] = [
        {
            label: "HITTER contact",
            side: "hitter",
            stat: "contact",
            metrics: [
                { metric: "avg", expected: "up", primary: true, compressionThreshold: 0.025, excessiveThreshold: 0.120 },
                { metric: "babip", expected: "up", primary: true, compressionThreshold: 0.020, excessiveThreshold: 0.110 },
                { metric: "soPercent", expected: "down", primary: true, compressionThreshold: 0.020, excessiveThreshold: 0.120 },
                { metric: "obp", expected: "up", compressionThreshold: 0.020, excessiveThreshold: 0.120 },
                { metric: "ops", expected: "up", compressionThreshold: 0.050, excessiveThreshold: 0.250 }
            ]
        },
        {
            label: "HITTER plateDiscipline",
            side: "hitter",
            stat: "plateDiscipline",
            metrics: [
                { metric: "bbPercent", expected: "up", primary: true, compressionThreshold: 0.020, excessiveThreshold: 0.120 },
                { metric: "obp", expected: "up", primary: true, compressionThreshold: 0.020, excessiveThreshold: 0.120 },
                { metric: "soPercent", expected: "down", compressionThreshold: 0.010, excessiveThreshold: 0.100 },
                { metric: "ops", expected: "up", compressionThreshold: 0.030, excessiveThreshold: 0.220 }
            ]
        },
        {
            label: "HITTER gapPower",
            side: "hitter",
            stat: "gapPower",
            metrics: [
                { metric: "doublePercent", expected: "up", primary: true, compressionThreshold: 0.010, excessiveThreshold: 0.080 },
                { metric: "xbhPercent", expected: "up", primary: true, compressionThreshold: 0.015, excessiveThreshold: 0.120 },
                { metric: "slg", expected: "up", primary: true, compressionThreshold: 0.040, excessiveThreshold: 0.250 },
                { metric: "ops", expected: "up", compressionThreshold: 0.040, excessiveThreshold: 0.250 },
                { metric: "triplePercent", expected: "up", compressionThreshold: 0.001, excessiveThreshold: 0.030 }
            ]
        },
        {
            label: "HITTER homerunPower",
            side: "hitter",
            stat: "homerunPower",
            metrics: [
                { metric: "homeRunPercent", expected: "up", primary: true, compressionThreshold: 0.015, excessiveThreshold: 0.100 },
                { metric: "slg", expected: "up", primary: true, compressionThreshold: 0.050, excessiveThreshold: 0.300 },
                { metric: "ops", expected: "up", compressionThreshold: 0.050, excessiveThreshold: 0.300 },
                { metric: "xbhPercent", expected: "up", compressionThreshold: 0.015, excessiveThreshold: 0.120 }
            ]
        },
        {
            label: "PITCHER power",
            side: "pitcher",
            stat: "power",
            metrics: [
                { metric: "soPercent", expected: "up", primary: true, compressionThreshold: 0.020, excessiveThreshold: 0.120 },
                { metric: "era", expected: "down", compressionThreshold: 0.300, excessiveThreshold: 3.000 },
                { metric: "avg", expected: "down", compressionThreshold: 0.015, excessiveThreshold: 0.100 },
                { metric: "ops", expected: "down", compressionThreshold: 0.035, excessiveThreshold: 0.250 }
            ]
        },
        {
            label: "PITCHER control",
            side: "pitcher",
            stat: "control",
            metrics: [
                { metric: "bbPercent", expected: "down", primary: true, compressionThreshold: 0.020, excessiveThreshold: 0.120 },
                { metric: "obp", expected: "down", primary: true, compressionThreshold: 0.020, excessiveThreshold: 0.120 },
                { metric: "era", expected: "down", compressionThreshold: 0.250, excessiveThreshold: 3.000 },
                { metric: "ops", expected: "down", compressionThreshold: 0.030, excessiveThreshold: 0.220 }
            ]
        },
        {
            label: "PITCHER movement",
            side: "pitcher",
            stat: "movement",
            metrics: [
                { metric: "homeRunPercent", expected: "down", primary: true, compressionThreshold: 0.010, excessiveThreshold: 0.080 },
                { metric: "slg", expected: "down", primary: true, compressionThreshold: 0.040, excessiveThreshold: 0.250 },
                { metric: "babip", expected: "down", compressionThreshold: 0.015, excessiveThreshold: 0.100 },
                { metric: "avg", expected: "down", compressionThreshold: 0.015, excessiveThreshold: 0.100 },
                { metric: "ops", expected: "down", compressionThreshold: 0.040, excessiveThreshold: 0.250 },
                { metric: "era", expected: "down", compressionThreshold: 0.300, excessiveThreshold: 3.000 }
            ]
        }
    ]

    static average(values: number[]): number {
        assert.ok(values.length > 0, "Cannot average empty values")
        return values.reduce((sum, value) => sum + value, 0) / values.length
    }

    static round(value: any, places = 3): number {
        const n = Number(value)
        assert.ok(Number.isFinite(n), `Cannot round non-finite value: ${value}`)
        const factor = Math.pow(10, places)
        return Math.round(n * factor) / factor
    }

    static assertAtLeast(actual: number, expected: number, label: string): void {
        assert.ok(actual >= expected, `${label} expected >= ${expected}, got ${actual}`)
    }

    static assertGreater(actual: number, expected: number, label: string): void {
        assert.ok(actual > expected, `${label} expected > ${expected}, got ${actual}`)
    }

    static splitWidth(a: number, b: number): number {
        return Math.abs(Number(a) - Number(b))
    }

    static assertFiniteNumbers(value: any, path = "value"): void {
        if (typeof value === "number") {
            assert.ok(Number.isFinite(value), `${path} is not finite: ${value}`)
            return
        }

        if (Array.isArray(value)) {
            value.forEach((item, index) => this.assertFiniteNumbers(item, `${path}[${index}]`))
            return
        }

        if (value && typeof value === "object") {
            for (const key of Object.keys(value)) {
                this.assertFiniteNumbers(value[key], `${path}.${key}`)
            }
        }
    }

    static findPlayer(name: string): PlayerImportRaw {
        const player = [...players.values()].find(player => `${player.firstName} ${player.lastName}` === name)

        assert.ok(player, `Player not found: ${name}`)

        return player
    }

    static getRatings(player: PlayerImportRaw, ratingTuning: RatingTuning): { hittingRatings: any, pitchRatings: any } {
        const command = PlayerRatingService.createPlayerFromImportRaw(pitchEnvironment, player)

        Object.assign(command, { ratingTuning })

        return PlayerRatingService.createPlayerFromStatsCommand(command)
    }

    static printPlayerDiagnostic(name: string, player: PlayerImportRaw): void {
        const ratings = this.getRatings(player, createTuning())

        console.log("")
        console.log("============================================================")
        console.log(`[PLAYER RATING REPORT] ${name}`)
        console.log("============================================================")

        console.log("[PLAYER IMPORT]", {
            playerId: player.playerId,
            name: `${player.firstName} ${player.lastName}`,
            primaryPosition: player.primaryPosition,
            bats: player.bats,
            throws: player.throws,
            age: player.age,
            pa: player.hitting?.pa,
            battersFaced: player.pitching?.battersFaced,
            outs: player.pitching?.outs,
            runs: player.hitting?.runs,
            runsAllowed: player.pitching?.runsAllowed,
            er: player.hitting?.er,
            earnedRuns: player.hitting?.earnedRuns,
            earnedRunsAllowed: player.pitching?.earnedRunsAllowed
        })

        console.log("[GENERATED RATINGS]", {
            hitting: ratings.hittingRatings,
            pitching: ratings.pitchRatings
        })

        const result = services.playerRatingService.evaluatePlayerRatings(
            pitchEnvironment,
            createTuning(),
            [player],
            seedrandom(`player-rating-diagnostic:${name}`),
            gamesPerPlayer
        )

        console.log("[SIM SUMMARY]", {
            gamesPerPlayer,
            playerCount: result.actual.playerCount,
            hitterCount: result.actual.hitterCount,
            pitcherCount: result.actual.pitcherCount,
            twoWayCount: result.actual.twoWayCount,
            hitterScore: this.round(result.actual.hitterScore, 3),
            pitcherScore: this.round(result.actual.pitcherScore, 3),
            score: this.round(result.score, 3)
        })

        if (result.actual.hitterCount > 0) {
            console.log("[HITTER SIM VS REAL]", {
                count: result.actual.hitterCount,
                avg: { actual: this.round(result.actual.hitter.avg), target: this.round(result.target.hitter.avg), diff: this.round(result.diff.hitter.avg) },
                obp: { actual: this.round(result.actual.hitter.obp), target: this.round(result.target.hitter.obp), diff: this.round(result.diff.hitter.obp) },
                slg: { actual: this.round(result.actual.hitter.slg), target: this.round(result.target.hitter.slg), diff: this.round(result.diff.hitter.slg) },
                ops: { actual: this.round(result.actual.hitter.ops), target: this.round(result.target.hitter.ops), diff: this.round(result.diff.hitter.ops) },
                soPercent: { actual: this.round(result.actual.hitter.soPercent), target: this.round(result.target.hitter.soPercent), diff: this.round(result.diff.hitter.soPercent) },
                bbPercent: { actual: this.round(result.actual.hitter.bbPercent), target: this.round(result.target.hitter.bbPercent), diff: this.round(result.diff.hitter.bbPercent) }
            })
        }

        if (result.actual.pitcherCount > 0) {
            console.log("[PITCHER SIM VS REAL]", {
                count: result.actual.pitcherCount,
                era: { actual: this.round(result.actual.pitcher.era), target: this.round(result.target.pitcher.era), diff: this.round(result.diff.pitcher.era) },
                soPercent: { actual: this.round(result.actual.pitcher.soPercent), target: this.round(result.target.pitcher.soPercent), diff: this.round(result.diff.pitcher.soPercent) },
                bbPercent: { actual: this.round(result.actual.pitcher.bbPercent), target: this.round(result.target.pitcher.bbPercent), diff: this.round(result.diff.pitcher.bbPercent) },
                homeRunPercent: { actual: this.round(result.actual.pitcher.homeRunPercent), target: this.round(result.target.pitcher.homeRunPercent), diff: this.round(result.diff.pitcher.homeRunPercent) }
            })
        }
    }

    static createAverageHitterPlayer(): PlayerImportRaw {
        const player = clone(this.findPlayer("Aaron Judge"))
        const hitterReference = (pitchEnvironment as any).importReference.hitter

        assert.ok(hitterReference, "Missing pitchEnvironment.importReference.hitter")

        player.playerId = "average-hitter-elasticity"
        player.firstName = "Average"
        player.lastName = "Hitter"
        player.hitting = clone(hitterReference)
        player.pitching = {
            ...clone(player.pitching),
            battersFaced: 0,
            outs: 0
        }

        return player
    }

    static createAveragePitcherPlayer(): PlayerImportRaw {
        const player = clone(this.findPlayer("Paul Skenes"))
        const pitcherReference = (pitchEnvironment as any).importReference.pitcher

        assert.ok(pitcherReference, "Missing pitchEnvironment.importReference.pitcher")

        player.playerId = "average-pitcher-elasticity"
        player.firstName = "Average"
        player.lastName = "Pitcher"
        player.hitting = {
            ...clone(player.hitting),
            pa: 0,
            ab: 0
        }
        player.pitching = clone(pitcherReference)

        return player
    }

    static forceHitterRatings(baseRatings: any, rating: number, stat: HitterElasticityStat): any {
        const ratings = clone(baseRatings)

        for (const key of ["contact", "plateDiscipline", "gapPower", "homerunPower"] as const) {
            ratings.hittingRatings.vsR[key] = 100
            ratings.hittingRatings.vsL[key] = 100
        }

        ratings.hittingRatings.vsR[stat] = rating
        ratings.hittingRatings.vsL[stat] = rating

        return ratings
    }

    static forcePitcherRatings(baseRatings: any, rating: number, stat: PitcherElasticityStat): any {
        const ratings = clone(baseRatings)

        ratings.pitchRatings.power = 100
        ratings.pitchRatings.vsR.control = 100
        ratings.pitchRatings.vsL.control = 100
        ratings.pitchRatings.vsR.movement = 100
        ratings.pitchRatings.vsL.movement = 100

        if (stat === "power") {
            ratings.pitchRatings.power = rating
        } else {
            ratings.pitchRatings.vsR[stat] = rating
            ratings.pitchRatings.vsL[stat] = rating
        }

        return ratings
    }

    static buildPlayerFromRatings(playerImportRaw: PlayerImportRaw, ratings: { hittingRatings: any, pitchRatings: any }, forcePitcher = false): Player {
        const isPitcher = forcePitcher
        const isStarter = Number(playerImportRaw.pitching?.starts ?? 0) > 0

        return {
            _id: playerImportRaw.playerId,
            firstName: playerImportRaw.firstName,
            lastName: playerImportRaw.lastName,
            get fullName() { return `${this.firstName} ${this.lastName}` },
            get displayName() { return this.fullName },
            primaryPosition: isPitcher ? "P" : playerImportRaw.primaryPosition,
            secondaryPositions: playerImportRaw.secondaryPositions ?? [],
            zodiacSign: "Aries",
            throws: playerImportRaw.throws,
            hits: playerImportRaw.bats,
            isRetired: false,
            stamina: isPitcher ? 1 : 0,
            maxPitchCount: isPitcher ? (isStarter ? 100 : 30) : 0,
            overallRating: 100,
            hittingRatings: clone(ratings.hittingRatings),
            pitchRatings: clone(ratings.pitchRatings),
            age: playerImportRaw.age
        } as Player
    }

    static findGamePlayer(game: any, playerId: string): any {
        return game.away.players.find((player: any) => player._id === playerId) ?? game.home.players.find((player: any) => player._id === playerId)
    }

    static assertForcedRatingSurvived(gamePlayer: any, ratings: any, side: ElasticitySide, stat: ElasticityStat): void {
        assert.ok(gamePlayer, "Forced player was not found in game")

        if (side === "hitter") {
            const hitterStat = stat as HitterElasticityStat
            assert.equal(gamePlayer.hittingRatings.vsR[hitterStat], ratings.hittingRatings.vsR[hitterStat], `GamePlayer vsR ${hitterStat} was not preserved`)
            assert.equal(gamePlayer.hittingRatings.vsL[hitterStat], ratings.hittingRatings.vsL[hitterStat], `GamePlayer vsL ${hitterStat} was not preserved`)
            assert.equal(gamePlayer.hitterChange.vsR.contactChange, PlayerChange.getHitterChange(gamePlayer.hittingRatings, pitchEnvironment.avgRating, Handedness.R).contactChange)
            assert.equal(gamePlayer.hitterChange.vsL.contactChange, PlayerChange.getHitterChange(gamePlayer.hittingRatings, pitchEnvironment.avgRating, Handedness.L).contactChange)
            return
        }

        const pitcherStat = stat as PitcherElasticityStat

        if (pitcherStat === "power") {
            assert.equal(gamePlayer.pitchRatings.power, ratings.pitchRatings.power, "GamePlayer pitcher power was not preserved")
        } else {
            assert.equal(gamePlayer.pitchRatings.vsR[pitcherStat], ratings.pitchRatings.vsR[pitcherStat], `GamePlayer vsR ${pitcherStat} was not preserved`)
            assert.equal(gamePlayer.pitchRatings.vsL[pitcherStat], ratings.pitchRatings.vsL[pitcherStat], `GamePlayer vsL ${pitcherStat} was not preserved`)
        }

        assert.equal(gamePlayer.pitcherChange.vsR.controlChange, PlayerChange.getPitcherChange(gamePlayer.pitchRatings, pitchEnvironment.avgRating, Handedness.R).controlChange)
        assert.equal(gamePlayer.pitcherChange.vsL.controlChange, PlayerChange.getPitcherChange(gamePlayer.pitchRatings, pitchEnvironment.avgRating, Handedness.L).controlChange)
    }

    static evaluateForcedRatings(playerImportRaw: PlayerImportRaw, forcedRatings: any, seed: string, games: number, side: ElasticitySide, stat: ElasticityStat): any {
        const player = this.buildPlayerFromRatings(playerImportRaw, forcedRatings, side === "pitcher")
        const rng = seedrandom(seed)

        return side === "hitter"
            ? this.simForcedHitter(player, forcedRatings, rng, games, stat)
            : this.simForcedPitcher(player, forcedRatings, rng, games, stat)
    }

    static simForcedHitter(player: Player, forcedRatings: any, rng: () => number, games: number, stat: ElasticityStat): any {
        let total: any = {}

        for (let i = 0; i < games; i++) {
            const game = baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `elasticity-hitter-${player._id}-${i}`)

            const gamePlayerBefore = this.findGamePlayer(game, player._id)
            this.assertForcedRatingSurvived(gamePlayerBefore, forcedRatings, "hitter", stat)

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            simService.finishGame(game)

            const gamePlayerAfter = this.findGamePlayer(game, player._id)

            if (gamePlayerAfter?.hitResult) {
                total = baselineGameService.mergeHitResults(total, gamePlayerAfter.hitResult)
            }
        }

        return this.getHitterActual(total)
    }

    static simForcedPitcher(player: Player, forcedRatings: any, rng: () => number, games: number, stat: ElasticityStat): any {
        let total: any = {}

        for (let i = 0; i < games; i++) {
            const game = baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `elasticity-pitcher-${player._id}-${i}`)

            const gamePlayerBefore = this.findGamePlayer(game, player._id)
            this.assertForcedRatingSurvived(gamePlayerBefore, forcedRatings, "pitcher", stat)

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            simService.finishGame(game)

            const gamePlayerAfter = this.findGamePlayer(game, player._id)

            if (gamePlayerAfter?.pitchResult) {
                total = baselineGameService.mergePitchResults(total, gamePlayerAfter.pitchResult)
            }
        }

        return this.getPitcherActual(total)
    }

    static safeDiv(numerator: number, denominator: number): number {
        return denominator !== 0 ? numerator / denominator : 0
    }

    static getHitterActual(total: any): any {
        const pa = Number(total.pa ?? 0)
        const ab = Number(total.atBats ?? total.ab ?? 0)
        const hits = Number(total.hits ?? 0)
        const bb = Number(total.bb ?? 0)
        const so = Number(total.so ?? 0)
        const hbp = Number(total.hbp ?? 0)
        const doubles = Number(total.doubles ?? 0)
        const triples = Number(total.triples ?? 0)
        const hr = Number(total.homeRuns ?? total.hr ?? 0)
        const singles = Math.max(0, hits - doubles - triples - hr)
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
        const ballsInPlay = Math.max(0, ab - so - hr)

        return {
            pa,
            avg: this.safeDiv(hits, ab),
            obp: this.safeDiv(hits + bb + hbp, pa),
            slg: this.safeDiv(totalBases, ab),
            ops: this.safeDiv(hits + bb + hbp, pa) + this.safeDiv(totalBases, ab),
            babip: this.safeDiv(hits - hr, ballsInPlay),
            singlePercent: this.safeDiv(singles, pa),
            doublePercent: this.safeDiv(doubles, pa),
            triplePercent: this.safeDiv(triples, pa),
            homeRunPercent: this.safeDiv(hr, pa),
            xbhPercent: this.safeDiv(doubles + triples + hr, pa),
            soPercent: this.safeDiv(so, pa),
            bbPercent: this.safeDiv(bb, pa)
        }
    }

    static getPitcherActual(total: any): any {
        const bf = Number(total.battersFaced ?? 0)
        const outs = Number(total.outs ?? 0)
        const er = Number(total.er ?? total.earnedRuns ?? 0)
        const hits = Number(total.hits ?? 0)
        const bb = Number(total.bb ?? 0)
        const hbp = Number(total.hbp ?? 0)
        const so = Number(total.so ?? 0)
        const doubles = Number(total.doubles ?? 0)
        const triples = Number(total.triples ?? 0)
        const hr = Number(total.homeRuns ?? total.hr ?? 0)
        const singles = Math.max(0, hits - doubles - triples - hr)
        const ab = Math.max(0, bf - bb - hbp)
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
        const ballsInPlay = Math.max(0, ab - so - hr)

        return {
            battersFaced: bf,
            era: this.safeDiv(er * 27, outs),
            avg: this.safeDiv(hits, ab),
            obp: this.safeDiv(hits + bb + hbp, bf),
            slg: this.safeDiv(totalBases, ab),
            ops: this.safeDiv(hits + bb + hbp, bf) + this.safeDiv(totalBases, ab),
            babip: this.safeDiv(hits - hr, ballsInPlay),
            singlePercent: this.safeDiv(singles, bf),
            doublePercent: this.safeDiv(doubles, bf),
            triplePercent: this.safeDiv(triples, bf),
            homeRunPercent: this.safeDiv(hr, bf),
            xbhPercent: this.safeDiv(doubles + triples + hr, bf),
            soPercent: this.safeDiv(so, bf),
            bbPercent: this.safeDiv(bb, bf)
        }
    }

    static makeRow(rating: number, actual: any): any {
        return {
            rating,
            avg: actual.avg,
            obp: actual.obp,
            slg: actual.slg,
            ops: actual.ops,
            babip: actual.babip,
            singlePercent: actual.singlePercent,
            doublePercent: actual.doublePercent,
            triplePercent: actual.triplePercent,
            homeRunPercent: actual.homeRunPercent,
            xbhPercent: actual.xbhPercent,
            soPercent: actual.soPercent,
            bbPercent: actual.bbPercent,
            era: actual.era
        }
    }

    static averageRows(rows: any[]): any {
        const output: any = {}

        assert.ok(rows.length > 0, "Cannot average empty rows")

        for (const key of Object.keys(rows[0])) {
            if (key === "rating") {
                output.rating = rows[0].rating
            } else {
                const values = rows.map(row => Number(row[key])).filter(value => Number.isFinite(value))
                output[key] = values.length > 0 ? this.average(values) : NaN
            }
        }

        return output
    }

    static runSpec(spec: ElasticityDiagnosticSpec): string[] {
        const importPlayer =
            spec.side === "hitter"
                ? this.createAverageHitterPlayer()
                : this.createAveragePitcherPlayer()

        const baseRatings = this.getRatings(importPlayer, createTuning())
        const rows: any[] = []

        for (const rating of this.ratingLevels) {
            const sampleRows: any[] = []

            for (let sample = 0; sample < this.samplesPerRating; sample++) {
                const forcedRatings =
                    spec.side === "hitter"
                        ? this.forceHitterRatings(baseRatings, rating, spec.stat as HitterElasticityStat)
                        : this.forcePitcherRatings(baseRatings, rating, spec.stat as PitcherElasticityStat)

                const actual = this.evaluateForcedRatings(
                    importPlayer,
                    forcedRatings,
                    `${spec.side}:${spec.stat}:sample:${sample}`,
                    this.gamesPerRating,
                    spec.side,
                    spec.stat
                )

                sampleRows.push(this.makeRow(rating, actual))
            }

            rows.push(this.averageRows(sampleRows))
        }

        return this.printDiagnostic(spec, rows)
    }

    static printDiagnostic(spec: ElasticityDiagnosticSpec, rows: any[]): string[] {
        const flags: string[] = []
        const metricNames = spec.metrics.map(metric => metric.metric)

        console.log("")
        console.log("============================================================")
        console.log(`[RATING ELASTICITY] ${spec.label}`)
        console.log("============================================================")

        for (const row of rows) {
            console.log(`${row.rating}: ${metricNames.map(metric => `${metric}=${this.round(row[metric], 4)}`).join(" ")}`)
        }

        console.log("")
        console.log(`[RATING ELASTICITY ADJACENT DELTAS] ${spec.label}`)

        for (let i = 1; i < rows.length; i++) {
            const previous = rows[i - 1]
            const current = rows[i]

            console.log(
                `${previous.rating}->${current.rating}: ${metricNames
                    .map(metric => `${metric}=${this.round(Number(current[metric]) - Number(previous[metric]), 4)}`)
                    .join(" ")}`
            )
        }

        console.log("")
        console.log(`[RATING ELASTICITY WIDE DELTAS] ${spec.label}`)

        const low = rows.find(row => row.rating === 70)
        const averageRating = rows.find(row => row.rating === 100)
        const elite = rows.find(row => row.rating === 150)
        const superElite = rows.find(row => row.rating === 170)

        assert.ok(low, `${spec.label} missing 70 row`)
        assert.ok(averageRating, `${spec.label} missing 100 row`)
        assert.ok(elite, `${spec.label} missing 150 row`)
        assert.ok(superElite, `${spec.label} missing 170 row`)

        for (const metricSpec of spec.metrics) {
            const lowValue = Number(low[metricSpec.metric])
            const averageValue = Number(averageRating[metricSpec.metric])
            const eliteValue = Number(elite[metricSpec.metric])
            const superEliteValue = Number(superElite[metricSpec.metric])

            assert.ok(Number.isFinite(lowValue), `${spec.label} ${metricSpec.metric} low value is not finite`)
            assert.ok(Number.isFinite(averageValue), `${spec.label} ${metricSpec.metric} average value is not finite`)
            assert.ok(Number.isFinite(eliteValue), `${spec.label} ${metricSpec.metric} elite value is not finite`)
            assert.ok(Number.isFinite(superEliteValue), `${spec.label} ${metricSpec.metric} super elite value is not finite`)

            const lowToSuperElite = this.signedDelta(lowValue, superEliteValue, metricSpec.expected)

            console.log(
                `${metricSpec.metric}: ` +
                `70->100=${this.round(this.signedDelta(lowValue, averageValue, metricSpec.expected), 4)} ` +
                `100->150=${this.round(this.signedDelta(averageValue, eliteValue, metricSpec.expected), 4)} ` +
                `100->170=${this.round(this.signedDelta(averageValue, superEliteValue, metricSpec.expected), 4)} ` +
                `70->170=${this.round(lowToSuperElite, 4)}`
            )

            if (metricSpec.primary && lowToSuperElite <= 0) {
                flags.push(`${spec.label} ${metricSpec.metric} has wrong wide direction from 70->170: ${this.round(lowToSuperElite, 4)}`)
            }

            if (metricSpec.primary && metricSpec.compressionThreshold !== undefined && lowToSuperElite > 0 && lowToSuperElite < metricSpec.compressionThreshold) {
                flags.push(`${spec.label} ${metricSpec.metric} may be compressed from 70->170: ${this.round(lowToSuperElite, 4)} < ${metricSpec.compressionThreshold}`)
            }

            if (metricSpec.primary && metricSpec.excessiveThreshold !== undefined && lowToSuperElite > metricSpec.excessiveThreshold) {
                flags.push(`${spec.label} ${metricSpec.metric} may be too sensitive from 70->170: ${this.round(lowToSuperElite, 4)} > ${metricSpec.excessiveThreshold}`)
            }
        }

        if (flags.length > 0) {
            console.log("")
            console.log(`[RATING ELASTICITY DIAGNOSTIC FLAGS] ${spec.label}`)
            for (const flag of flags) console.log(flag)
        }

        return flags
    }

    static signedDelta(low: number, high: number, expected: ElasticityDirection): number {
        const delta = high - low
        return expected === "up" ? delta : -delta
    }

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

        RatingTestHarness.printPlayerDiagnostic("Aaron Judge", RatingTestHarness.findPlayer("Aaron Judge"))
    })

    it("should print Paul Skenes ratings and 150-game simulated results vs real stats", function () {

        RatingTestHarness.printPlayerDiagnostic("Paul Skenes", RatingTestHarness.findPlayer("Paul Skenes"))
    })

    it("should print Shohei Ohtani ratings and 150-game simulated results vs real stats", function () {

        RatingTestHarness.printPlayerDiagnostic("Shohei Ohtani", RatingTestHarness.findPlayer("Shohei Ohtani"))
    })
    

})

describe("Player Rating Basic Generation", () => {

    it("should generate deterministic ratings for the same real hitter input", () => {
        const player = RatingTestHarness.findPlayer("Aaron Judge")

        const first = RatingTestHarness.getRatings(player, createTuning())
        const second = RatingTestHarness.getRatings(player, createTuning())

        assert.deepEqual(first, second)
    })

    it("should generate complete finite ratings for Aaron Judge", () => {
        const ratings = RatingTestHarness.getRatings(RatingTestHarness.findPlayer("Aaron Judge"), createTuning())

        RatingTestHarness.assertFiniteNumbers(ratings.hittingRatings, "hittingRatings")
        RatingTestHarness.assertFiniteNumbers(ratings.pitchRatings, "pitchRatings")
    })

    it("should generate complete finite ratings for Paul Skenes", () => {
        const ratings = RatingTestHarness.getRatings(RatingTestHarness.findPlayer("Paul Skenes"), createTuning())

        RatingTestHarness.assertFiniteNumbers(ratings.hittingRatings, "hittingRatings")
        RatingTestHarness.assertFiniteNumbers(ratings.pitchRatings, "pitchRatings")
    })

    it("should generate at least three pitch types for Paul Skenes", () => {
        const ratings = RatingTestHarness.getRatings(RatingTestHarness.findPlayer("Paul Skenes"), createTuning())

        assert.ok(Array.isArray(ratings.pitchRatings.pitches))
        RatingTestHarness.assertAtLeast(ratings.pitchRatings.pitches.length, 3, "pitch count")
    })

    it("should generate two-way finite ratings for Shohei Ohtani", () => {
        const ratings = RatingTestHarness.getRatings(RatingTestHarness.findPlayer("Shohei Ohtani"), createTuning())

        RatingTestHarness.assertFiniteNumbers(ratings.hittingRatings, "hittingRatings")
        RatingTestHarness.assertFiniteNumbers(ratings.pitchRatings, "pitchRatings")
        assert.ok(Array.isArray(ratings.pitchRatings.pitches))
        RatingTestHarness.assertAtLeast(ratings.pitchRatings.pitches.length, 3, "pitch count")
    })

})

describe("Player Rating Tuning Direction", () => {

    it("should keep ratings unchanged when all rating tuning scales are zero", () => {
        const player = RatingTestHarness.findPlayer("Shohei Ohtani")

        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const zero = RatingTestHarness.getRatings(player, createTuning(tuning => {
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
        const player = RatingTestHarness.findPlayer("Aaron Judge")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.hitting.contactScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.hittingRatings.vsR.contact, baseline.hittingRatings.vsR.contact, "vsR contact")
        RatingTestHarness.assertGreater(tuned.hittingRatings.vsL.contact, baseline.hittingRatings.vsL.contact, "vsL contact")
    })

    it("should tune hitter plate discipline upward when hitting plateDisciplineScale increases", () => {
        const player = RatingTestHarness.findPlayer("Aaron Judge")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.hitting.plateDisciplineScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.hittingRatings.vsR.plateDiscipline, baseline.hittingRatings.vsR.plateDiscipline, "vsR plateDiscipline")
        RatingTestHarness.assertGreater(tuned.hittingRatings.vsL.plateDiscipline, baseline.hittingRatings.vsL.plateDiscipline, "vsL plateDiscipline")
    })

    it("should tune hitter gap power upward when hitting gapPowerScale increases", () => {
        const player = RatingTestHarness.findPlayer("Aaron Judge")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.hitting.gapPowerScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.hittingRatings.vsR.gapPower, baseline.hittingRatings.vsR.gapPower, "vsR gapPower")
        RatingTestHarness.assertGreater(tuned.hittingRatings.vsL.gapPower, baseline.hittingRatings.vsL.gapPower, "vsL gapPower")
    })

    it("should tune hitter home run power upward when hitting homerunPowerScale increases", () => {
        const player = RatingTestHarness.findPlayer("Aaron Judge")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.hitting.homerunPowerScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.hittingRatings.vsR.homerunPower, baseline.hittingRatings.vsR.homerunPower, "vsR homerunPower")
        RatingTestHarness.assertGreater(tuned.hittingRatings.vsL.homerunPower, baseline.hittingRatings.vsL.homerunPower, "vsL homerunPower")
    })

    it("should tune hitter split wider when hitting splitScale increases", () => {
        const player = RatingTestHarness.findPlayer("Aaron Judge")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.hitting.splitScale = 0.25
        }))

        RatingTestHarness.assertAtLeast(
            RatingTestHarness.splitWidth(tuned.hittingRatings.vsR.contact, tuned.hittingRatings.vsL.contact),
            RatingTestHarness.splitWidth(baseline.hittingRatings.vsR.contact, baseline.hittingRatings.vsL.contact),
            "contact split"
        )

        RatingTestHarness.assertAtLeast(
            RatingTestHarness.splitWidth(tuned.hittingRatings.vsR.homerunPower, tuned.hittingRatings.vsL.homerunPower),
            RatingTestHarness.splitWidth(baseline.hittingRatings.vsR.homerunPower, baseline.hittingRatings.vsL.homerunPower),
            "home run power split"
        )
    })

    it("should tune pitcher power upward when pitching powerScale increases", () => {
        const player = RatingTestHarness.findPlayer("Paul Skenes")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.pitching.powerScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.pitchRatings.power, baseline.pitchRatings.power, "pitcher power")
    })

    it("should tune pitcher control upward when pitching controlScale increases", () => {
        const player = RatingTestHarness.findPlayer("Paul Skenes")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.pitching.controlScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.pitchRatings.vsR.control, baseline.pitchRatings.vsR.control, "vsR control")
        RatingTestHarness.assertGreater(tuned.pitchRatings.vsL.control, baseline.pitchRatings.vsL.control, "vsL control")
    })

    it("should tune pitcher movement upward when pitching movementScale increases", () => {
        const player = RatingTestHarness.findPlayer("Paul Skenes")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.pitching.movementScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.pitchRatings.vsR.movement, baseline.pitchRatings.vsR.movement, "vsR movement")
        RatingTestHarness.assertGreater(tuned.pitchRatings.vsL.movement, baseline.pitchRatings.vsL.movement, "vsL movement")
    })

    it("should tune pitcher split wider when pitching splitScale increases", () => {
        const player = RatingTestHarness.findPlayer("Shohei Ohtani")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.pitching.splitScale = 0.25
        }))

        RatingTestHarness.assertAtLeast(
            RatingTestHarness.splitWidth(tuned.pitchRatings.vsR.control, tuned.pitchRatings.vsL.control),
            RatingTestHarness.splitWidth(baseline.pitchRatings.vsR.control, baseline.pitchRatings.vsL.control),
            "control split"
        )

        RatingTestHarness.assertAtLeast(
            RatingTestHarness.splitWidth(tuned.pitchRatings.vsR.movement, tuned.pitchRatings.vsL.movement),
            RatingTestHarness.splitWidth(baseline.pitchRatings.vsR.movement, baseline.pitchRatings.vsL.movement),
            "movement split"
        )
    })

    it("should tune speed upward when running speedScale increases", () => {
        const player = RatingTestHarness.findPlayer("Shohei Ohtani")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.running.speedScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.hittingRatings.speed, baseline.hittingRatings.speed, "speed")
    })

    it("should tune steals upward when running stealsScale increases", () => {
        const player = RatingTestHarness.findPlayer("Shohei Ohtani")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.running.stealsScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.hittingRatings.steals, baseline.hittingRatings.steals, "steals")
    })

    it("should tune defense upward when fielding defenseScale increases", () => {
        const player = RatingTestHarness.findPlayer("Aaron Judge")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.fielding.defenseScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.hittingRatings.defense, baseline.hittingRatings.defense, "defense")
    })

    it("should tune arm upward when fielding armScale increases", () => {
        const player = RatingTestHarness.findPlayer("Aaron Judge")
        const baseline = RatingTestHarness.getRatings(player, createTuning())
        const tuned = RatingTestHarness.getRatings(player, createTuning(tuning => {
            tuning.fielding.armScale = 0.25
        }))

        RatingTestHarness.assertGreater(tuned.hittingRatings.arm, baseline.hittingRatings.arm, "arm")
    })

})

describe("Player Rating Gameplay Plumbing", () => {
    it("hitter gap power directly changes doubles in hitter power roll input", () => {
        const rollChartService = new RollChartService()
        const base = pitchEnvironment.battedBall.powerRollInput

        const low = rollChartService.buildHitterPowerRollInput(pitchEnvironment, {
            plateDisiplineChange: 0,
            contactChange: 0,
            gapPowerChange: -0.7,
            hrPowerChange: 0,
            speedChange: 0,
            stealsChange: 0,
            defenseChange: 0,
            armChange: 0
        } as any)

        const average = rollChartService.buildHitterPowerRollInput(pitchEnvironment, {
            plateDisiplineChange: 0,
            contactChange: 0,
            gapPowerChange: 0,
            hrPowerChange: 0,
            speedChange: 0,
            stealsChange: 0,
            defenseChange: 0,
            armChange: 0
        } as any)

        const high = rollChartService.buildHitterPowerRollInput(pitchEnvironment, {
            plateDisiplineChange: 0,
            contactChange: 0,
            gapPowerChange: 0.7,
            hrPowerChange: 0,
            speedChange: 0,
            stealsChange: 0,
            defenseChange: 0,
            armChange: 0
        } as any)

        assert.strictEqual(average.doubles, base.doubles)

        assert.ok(low.doubles < average.doubles, `Expected low gap power doubles below average. low=${low.doubles} average=${average.doubles}`)
        assert.ok(high.doubles > average.doubles, `Expected high gap power doubles above average. high=${high.doubles} average=${average.doubles}`)

        assert.ok(high.doubles - low.doubles >= Math.max(2, Math.round(base.doubles * 0.75)), `Expected meaningful doubles spread. low=${low.doubles} high=${high.doubles} base=${base.doubles}`)

        assert.strictEqual(low.out + low.singles + low.doubles + low.triples + low.hr, 1000)
        assert.strictEqual(average.out + average.singles + average.doubles + average.triples + average.hr, 1000)
        assert.strictEqual(high.out + high.singles + high.doubles + high.triples + high.hr, 1000)
    })

    it("hitter gap power and speed both contribute to triples in hitter power roll input", () => {
        const rollChartService = new RollChartService()
        const base = pitchEnvironment.battedBall.powerRollInput

        const lowGapLowSpeed = rollChartService.buildHitterPowerRollInput(pitchEnvironment, {
            plateDisiplineChange: 0,
            contactChange: 0,
            gapPowerChange: -0.7,
            hrPowerChange: 0,
            speedChange: -0.7,
            stealsChange: 0,
            defenseChange: 0,
            armChange: 0
        } as any)

        const average = rollChartService.buildHitterPowerRollInput(pitchEnvironment, {
            plateDisiplineChange: 0,
            contactChange: 0,
            gapPowerChange: 0,
            hrPowerChange: 0,
            speedChange: 0,
            stealsChange: 0,
            defenseChange: 0,
            armChange: 0
        } as any)

        const highGapHighSpeed = rollChartService.buildHitterPowerRollInput(pitchEnvironment, {
            plateDisiplineChange: 0,
            contactChange: 0,
            gapPowerChange: 0.7,
            hrPowerChange: 0,
            speedChange: 0.7,
            stealsChange: 0,
            defenseChange: 0,
            armChange: 0
        } as any)

        assert.strictEqual(average.triples, base.triples)

        assert.ok(lowGapLowSpeed.triples <= average.triples, `Expected low gap/speed triples not above average. low=${lowGapLowSpeed.triples} average=${average.triples}`)
        assert.ok(highGapHighSpeed.triples >= average.triples, `Expected high gap/speed triples not below average. high=${highGapHighSpeed.triples} average=${average.triples}`)

        if (base.triples >= 2) {
            assert.ok(highGapHighSpeed.triples > lowGapLowSpeed.triples, `Expected meaningful triples spread. low=${lowGapLowSpeed.triples} high=${highGapHighSpeed.triples} base=${base.triples}`)
        }

        assert.strictEqual(lowGapLowSpeed.out + lowGapLowSpeed.singles + lowGapLowSpeed.doubles + lowGapLowSpeed.triples + lowGapLowSpeed.hr, 1000)
        assert.strictEqual(average.out + average.singles + average.doubles + average.triples + average.hr, 1000)
        assert.strictEqual(highGapHighSpeed.out + highGapHighSpeed.singles + highGapHighSpeed.doubles + highGapHighSpeed.triples + highGapHighSpeed.hr, 1000)
    })
})


describe("Player Rating Elasticity Diagnostics", () => {

    it("should print hitter rating elasticity by stat", function () {

        const flags = RatingTestHarness.specs
            .filter(spec => spec.side === "hitter")
            .flatMap(spec => RatingTestHarness.runSpec(spec))

        if (flags.length > 0) {
            console.log("")
            console.log("[HITTER ELASTICITY SUMMARY FLAGS]")
            for (const flag of flags) console.log(flag)
        }

        assert.ok(true)
    })

    it("should print pitcher rating elasticity by stat", function () {

        const flags = RatingTestHarness.specs
            .filter(spec => spec.side === "pitcher")
            .flatMap(spec => RatingTestHarness.runSpec(spec))

        if (flags.length > 0) {
            console.log("")
            console.log("[PITCHER ELASTICITY SUMMARY FLAGS]")
            for (const flag of flags) console.log(flag)
        }

        assert.ok(true)
    })

})



