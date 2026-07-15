import assert from "assert"
import seedrandom from "seedrandom"
import fs from "fs"
import path from "path"

import type {
    PitchEnvironmentTarget,
    Player,
    PlayerImportRaw
} from "../src/sim/service/interfaces.js"

import { RollChartService } from "../src/sim/service/roll-chart-service.js"
import { GameInfo, GamePlayers, PlayerChange, SimRolls, SimService } from "../src/sim/service/sim-service.js"
import { StatService } from "../src/sim/service/stat-service.js"
import { RunnerService } from "../src/sim/service/runner-service.js"
import { SubstitutionService } from "../src/sim/service/substitution-service.js"
import { PlayerRatingService } from "../src/importer/service/player-rating-service.js"
import { BaselineGameService } from "../src/importer/service/baseline-game-service.js"
import { DownloaderService } from "../src/importer/service/downloader-service.js"
import { Handedness, simService } from "../src/sim/index.js"

const season = 2025
const baseDataDir = "data"

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const readJson = async <T>(filePath: string): Promise<T> => {
    return JSON.parse(await fs.promises.readFile(filePath, "utf8"))
}

const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK)
        return true
    } catch {
        return false
    }
}

const createServices = () => {
    const rollChartService = new RollChartService()
    const statService = new StatService()
    const simRolls = new SimRolls(rollChartService)
    const gamePlayers = new GamePlayers()
    const runnerService = new RunnerService(simRolls)
    const gameInfo = new GameInfo(gamePlayers)
    const substitutionService = new SubstitutionService()

    const simService = new SimService(
        rollChartService,
        simRolls,
        runnerService,
        gameInfo,
        substitutionService,
        {} as PitchEnvironmentTarget
    )

    const baselineGameService = new BaselineGameService(
        simService
    )

    const playerRatingService = new PlayerRatingService(
        simService,
        statService,
        baselineGameService
    )

    return {
        playerRatingService
    }
}   
const baselineGameService = new BaselineGameService(simService)
const downloaderService = new DownloaderService(baseDataDir, 1000)

const players = await downloaderService.buildSeasonPlayerImports(
    season,
    new Set([])
)

const services = createServices()

const pitchEnvironmentPath = path.join(
    baseDataDir,
    String(season),
    "_pitch_environment_target.json"
)

if (!await fileExists(pitchEnvironmentPath)) {
    throw new Error(
        `Missing pitch environment target: ${pitchEnvironmentPath}. ` +
        `Run npm run generate:all ${season} first.`
    )
}

const pitchEnvironment = await readJson<PitchEnvironmentTarget>(
    pitchEnvironmentPath
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

    static readonly ratingLevels = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170]
    static readonly compactRatingLevels = [30, 70, 100, 130, 170]
    static readonly plateAppearancesPerRating = 1250
    static readonly fullContextGamesPerRating = 25
    static readonly realPlayerGames = 150

    static forceGamePlayerRunningRatings(gamePlayer: any, rating: number, lever: "speed" | "steals"): void {
        if (!gamePlayer?.hittingRatings) {
            throw new Error("Cannot force running ratings on invalid game player")
        }

        gamePlayer.hittingRatings.speed = 100
        gamePlayer.hittingRatings.steals = 100
        gamePlayer.hittingRatings[lever] = rating
    }

    static forceAllGameRunningRatings(game: any, rating: number, lever: "speed" | "steals"): void {
        for (const player of this.getAllGamePlayers(game)) {
            if (player?.hittingRatings) {
                this.forceGamePlayerRunningRatings(player, rating, lever)
            }
        }
    }

    static forceAllGameArmRatings(game: any, rating: number): void {
        for (const player of this.getAllGamePlayers(game)) {
            if (player?.hittingRatings) {
                player.hittingRatings.arm = rating
            }
        }
    }

    static getRunningFullContextRows(): any[] {
        const importPlayer = this.createAverageHitterPlayer()
        const baseRatings = this.getRatings(importPlayer)
        const player = this.buildPlayerFromRatings(importPlayer, baseRatings, false)
        const rows: any[] = []

        for (const lever of ["speed", "steals"] as const) {
            for (const rating of this.ratingLevels) {
                const rng = seedrandom(`running-context:${lever}:${rating}`)
                let total: any = {}

                for (let gameIndex = 0; gameIndex < this.fullContextGamesPerRating; gameIndex++) {
                    const game = baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `running-context-${lever}-${rating}-${gameIndex}`)

                    this.forceAllGameRunningRatings(game, rating, lever)

                    while (!game.isComplete) {
                        simService.simPitch(game, rng)
                    }

                    simService.finishGame(game)

                    total = this.addDelta(total, this.aggregateGameHitterResults(game))
                }

                rows.push(this.formatHitterRow(lever, rating, this.getHitterActual(total)))
            }
        }

        return rows
    }

    static getArmFullContextRows(): any[] {
        const importPlayer = this.createAverageHitterPlayer()
        const baseRatings = this.getRatings(importPlayer)
        const player = this.buildPlayerFromRatings(importPlayer, baseRatings, false)
        const rows: any[] = []

        for (const rating of this.ratingLevels) {
            const rng = seedrandom(`arm-context:${rating}`)
            let total: any = {}

            for (let gameIndex = 0; gameIndex < this.fullContextGamesPerRating; gameIndex++) {
                const game = baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `arm-context-${rating}-${gameIndex}`)

                this.forceAllGameArmRatings(game, rating)

                while (!game.isComplete) {
                    simService.simPitch(game, rng)
                }

                simService.finishGame(game)

                total = this.addDelta(total, this.aggregateGameHitterResults(game))
            }

            rows.push(this.formatHitterRow("arm", rating, this.getHitterActual(total)))
        }

        return rows
    }

    static getRunningArmRangeRows(): any[] {
        const runnerService = new RunnerService(new SimRolls(new RollChartService()))
        const rows: any[] = []

        for (const rating of this.ratingLevels) {
            rows.push({
                lever: "speed",
                rating,
                advance75: runnerService.getChanceRunnerSafe(pitchEnvironment, 100, rating, 75),
                advance95: runnerService.getChanceRunnerSafe(pitchEnvironment, 100, rating, 95),
                steal75: runnerService.getStolenBaseSafe(pitchEnvironment, 100, rating, 100, 75)
            })

            rows.push({
                lever: "steals",
                rating,
                steal75: runnerService.getStolenBaseSafe(pitchEnvironment, 100, 100, rating, 75)
            })

            rows.push({
                lever: "arm",
                rating,
                advanceAllowed75: runnerService.getChanceRunnerSafe(pitchEnvironment, rating, 100, 75),
                advanceAllowed95: runnerService.getChanceRunnerSafe(pitchEnvironment, rating, 100, 95),
                stealAllowed75: runnerService.getStolenBaseSafe(pitchEnvironment, rating, 100, 100, 75)
            })
        }

        return rows
    }

    static getRunningArmSummaryRows(rows: any[]): any[] {
        const output: any[] = []

        for (const lever of [...new Set(rows.map(row => row.lever))]) {
            const leverRows = rows.filter(row => row.lever === lever)
            const low = leverRows.find(row => row.rating === 30)
            const avg = leverRows.find(row => row.rating === 100)
            const high = leverRows.find(row => row.rating === 170)

            assert.ok(low, `${lever} missing 30 row`)
            assert.ok(avg, `${lever} missing 100 row`)
            assert.ok(high, `${lever} missing 170 row`)

            output.push({
                lever,
                metric: "RUN/RBI/SB/CS",
                r30: `${low.runs}/${low.rbi}/${low.sb}/${low.cs}`,
                r100: `${avg.runs}/${avg.rbi}/${avg.sb}/${avg.cs}`,
                r170: `${high.runs}/${high.rbi}/${high.sb}/${high.cs}`
            })

            output.push({
                lever,
                metric: "AVG/OBP/SLG",
                r30: `${low.avg}/${low.obp}/${low.slg}`,
                r100: `${avg.avg}/${avg.obp}/${avg.slg}`,
                r170: `${high.avg}/${high.obp}/${high.slg}`
            })

            output.push({
                lever,
                metric: "1B/2B/3B/HR",
                r30: `${low.singles}/${low.doubles}/${low.triples}/${low.hr}`,
                r100: `${avg.singles}/${avg.doubles}/${avg.triples}/${avg.hr}`,
                r170: `${high.singles}/${high.doubles}/${high.triples}/${high.hr}`
            })
        }

        return output
    }

    static getRunningArmCompactRows(rows: any[]): any[] {
        const output: any[] = []

        for (const lever of [...new Set(rows.map(row => row.lever))]) {
            const leverRows = rows.filter(row => row.lever === lever)
            output.push(...this.getCompactRows(leverRows, ["pa", "runs", "rbi", "sb", "cs", "avg", "obp", "slg"]))
        }

        return output
    }

    static getRealPlayerRunningFieldingRows(): any[] {
        const names = [
            "Aaron Judge",
            "Shohei Ohtani",
            "Paul Skenes"
        ]

        return names.map(name => {
            const player: any = this.findPlayer(name)
            const ratings = this.getRatings(player)
            const hittingRatings = ratings.hittingRatings

            const pa = Number(player.hitting?.pa ?? 0)
            const ab = Number(player.hitting?.ab ?? 0)
            const powerOutcomeCount = Math.max(0, ab - Number(player.hitting?.so ?? 0))
            const sbAttempts = Number(player.running?.sbAttempts ?? 0)
            const sb = Number(player.running?.sb ?? 0)
            const cs = Math.max(0, sbAttempts - sb)

            const fielding: any = player.fielding ?? {}
            const chances = Number(fielding.errors ?? 0) + Number(fielding.assists ?? 0) + Number(fielding.putouts ?? 0)
            const inningsAtPosition = Object.values(fielding.inningsAtPosition ?? {})
                .map(value => Number(value))
                .filter(value => Number.isFinite(value) && value > 0)
                .reduce((sum, value) => sum + value, 0)

            return {
                player: name,
                primaryPosition: player.primaryPosition,
                speed: hittingRatings.speed,
                steals: hittingRatings.steals,
                defense: hittingRatings.defense,
                arm: hittingRatings.arm,
                sbPerPA: this.round(this.safeDiv(sb, pa)),
                sbAttemptPerPA: this.round(this.safeDiv(sbAttempts, pa)),
                sbSuccess: this.round(this.safeDiv(sb, sb + cs)),
                triplesPerBIP: this.round(this.safeDiv(Number(player.hitting?.triples ?? 0), powerOutcomeCount)),
                fieldingPct: this.round(this.safeDiv(chances - Number(fielding.errors ?? 0), chances)),
                chancesPerInn: this.round(this.safeDiv(chances, inningsAtPosition)),
                assistsPerInn: this.round(this.safeDiv(Number(fielding.assists ?? 0), inningsAtPosition)),
                putoutsPerInn: this.round(this.safeDiv(Number(fielding.putouts ?? 0), inningsAtPosition)),
                ofAssistPerInn: this.round(this.safeDiv(Number(fielding.outfieldAssists ?? 0), inningsAtPosition))
            }
        })
    }

    static round(value: any, places = 4): number {
        const n = Number(value)
        assert.ok(Number.isFinite(n), `Cannot round non-finite value: ${value}`)
        const factor = Math.pow(10, places)
        return Math.round(n * factor) / factor
    }

    static maybeRound(value: any, places = 4): number | undefined {
        const n = Number(value)
        return Number.isFinite(n) ? this.round(n, places) : undefined
    }

    static safeDiv(numerator: number, denominator: number): number {
        return denominator !== 0 ? numerator / denominator : 0
    }

    static printTable(title: string, rows: any[]): void {
        console.log("")
        console.log(title)
        console.table(rows)
    }

    static findPlayer(name: string): PlayerImportRaw {
        const player = [...players.values()].find(player => `${player.firstName} ${player.lastName}` === name)
        assert.ok(player, `Player not found: ${name}`)
        return player
    }

    static getRatings(player: PlayerImportRaw): { hittingRatings: any, pitchRatings: any } {
        const command = PlayerRatingService.createPlayerFromImportRaw(
            pitchEnvironment,
            player
        )

        return PlayerRatingService.createPlayerFromStatsCommand(
            command
        )
    }

    static createAverageHitterPlayer(): PlayerImportRaw {
        const player = clone(this.findPlayer("Aaron Judge"))
        const hitterReference = (pitchEnvironment as any).importReference.hitter

        assert.ok(hitterReference, "Missing pitchEnvironment.importReference.hitter")

        player.playerId = "average-hitter-rating-test"
        player.firstName = "Average"
        player.lastName = "Hitter"
        player.hitting = clone(hitterReference)
        player.pitching = { ...clone(player.pitching), battersFaced: 0, outs: 0 }

        return player
    }

    static createAveragePitcherPlayer(): PlayerImportRaw {
        const player = clone(this.findPlayer("Paul Skenes"))
        const pitcherReference = (pitchEnvironment as any).importReference.pitcher

        assert.ok(pitcherReference, "Missing pitchEnvironment.importReference.pitcher")

        player.playerId = "average-pitcher-rating-test"
        player.firstName = "Average"
        player.lastName = "Pitcher"
        player.hitting = { ...clone(player.hitting), pa: 0, ab: 0 }
        player.pitching = clone(pitcherReference)

        return player
    }

    static buildPlayerFromRatings(playerImportRaw: PlayerImportRaw, ratings: { hittingRatings: any, pitchRatings: any }, forcePitcher = false): Player {
        const isStarter = Number(playerImportRaw.pitching?.starts ?? 0) > 0

        return {
            _id: playerImportRaw.playerId,
            firstName: playerImportRaw.firstName,
            lastName: playerImportRaw.lastName,
            get fullName() { return `${this.firstName} ${this.lastName}` },
            get displayName() { return this.fullName },
            primaryPosition: forcePitcher ? "P" : playerImportRaw.primaryPosition === "P" ? "1B" : playerImportRaw.primaryPosition,
            secondaryPositions: playerImportRaw.secondaryPositions ?? [],
            zodiacSign: "Aries",
            throws: playerImportRaw.throws,
            hits: playerImportRaw.bats,
            isRetired: false,
            stamina: forcePitcher ? 1 : 0,
            maxPitchCount: forcePitcher ? (isStarter ? 100 : 30) : 0,
            overallRating: 100,
            hittingRatings: clone(ratings.hittingRatings),
            pitchRatings: clone(ratings.pitchRatings),
            age: playerImportRaw.age
        } as Player
    }

    static findGamePlayer(game: any, playerId: string): any {
        return game.away.players.find((player: any) => player._id === playerId) ?? game.home.players.find((player: any) => player._id === playerId)
    }

    static getPlayerTeam(game: any, playerId: string): any {
        return game.away.players.find((player: any) => player._id === playerId) ? game.away : game.home
    }

    static getOpponentTeam(game: any, playerId: string): any {
        return this.getPlayerTeam(game, playerId) === game.away ? game.home : game.away
    }

    static forceOpponentDefense(game: any, hitterPlayerId: string, defenseRating: number): void {
        const defense = this.getOpponentTeam(game, hitterPlayerId)

        for (const player of defense.players) {
            if (player.hittingRatings) {
                player.hittingRatings.defense = defenseRating
            }
        }
    }

    static getAllGamePlayers(game: any): any[] {
        return [...(game.away?.players ?? []), ...(game.home?.players ?? [])]
    }

    static forceAllGameHitterRatings(game: any, rating: number, stat: HitterElasticityStat): void {
        for (const player of this.getAllGamePlayers(game)) {
            if (player?.hittingRatings?.vsR && player?.hittingRatings?.vsL) {
                this.forceGamePlayerHitterRatings(player, rating, stat)
            }
        }
    }

    static forceAllGameDefenseRatings(game: any, rating: number): void {
        for (const player of this.getAllGamePlayers(game)) {
            if (player?.hittingRatings) {
                player.hittingRatings.defense = rating
            }
        }
    }

    static aggregateGameHitterResults(game: any): any {
        let total: any = {}

        for (const player of this.getAllGamePlayers(game)) {
            const snapshot = this.getHitResultSnapshot(player)

            if (snapshot.pa > 0) {
                total = this.addDelta(total, snapshot)
            }
        }

        return total
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

    static forceGamePlayerHitterRatings(gamePlayer: any, rating: number, stat: HitterElasticityStat): void {
        if (!gamePlayer?.hittingRatings?.vsR || !gamePlayer?.hittingRatings?.vsL) {
            throw new Error("Cannot force hitter ratings on invalid game player")
        }

        for (const key of ["contact", "plateDiscipline", "gapPower", "homerunPower"] as const) {
            gamePlayer.hittingRatings.vsR[key] = 100
            gamePlayer.hittingRatings.vsL[key] = 100
        }

        gamePlayer.hittingRatings.vsR[stat] = rating
        gamePlayer.hittingRatings.vsL[stat] = rating

        gamePlayer.hitterChange = {
            vsL: PlayerChange.getHitterChange(gamePlayer.hittingRatings, pitchEnvironment.avgRating, Handedness.L),
            vsR: PlayerChange.getHitterChange(gamePlayer.hittingRatings, pitchEnvironment.avgRating, Handedness.R)
        }
    }

    static getHitResultSnapshot(gamePlayer: any): any {
        const hitResult = gamePlayer?.hitResult ?? {}

        return {
            pa: Number(hitResult.pa ?? 0),
            atBats: Number(hitResult.atBats ?? hitResult.ab ?? 0),
            hits: Number(hitResult.hits ?? 0),
            bb: Number(hitResult.bb ?? 0),
            so: Number(hitResult.so ?? 0),
            hbp: Number(hitResult.hbp ?? 0),
            doubles: Number(hitResult.doubles ?? 0),
            triples: Number(hitResult.triples ?? 0),
            homeRuns: Number(hitResult.homeRuns ?? hitResult.hr ?? 0),
            runs: Number(hitResult.runs ?? 0),
            rbi: Number(hitResult.rbi ?? hitResult.runsBattedIn ?? 0),
            stolenBases: Number(hitResult.stolenBases ?? hitResult.sb ?? 0),
            caughtStealing: Number(hitResult.caughtStealing ?? hitResult.cs ?? 0)
        }
    }

    static getPitchResultSnapshot(gamePlayer: any): any {
        const pitchResult = gamePlayer?.pitchResult ?? {}

        return {
            battersFaced: Number(pitchResult.battersFaced ?? 0),
            outs: Number(pitchResult.outs ?? 0),
            er: Number(pitchResult.er ?? pitchResult.earnedRuns ?? 0),
            hits: Number(pitchResult.hits ?? 0),
            bb: Number(pitchResult.bb ?? 0),
            so: Number(pitchResult.so ?? 0),
            hbp: Number(pitchResult.hbp ?? 0),
            doubles: Number(pitchResult.doubles ?? 0),
            triples: Number(pitchResult.triples ?? 0),
            homeRuns: Number(pitchResult.homeRuns ?? pitchResult.hr ?? 0)
        }
    }

    static addDelta(total: any, delta: any): any {
        const output = clone(total ?? {})

        for (const key of Object.keys(delta)) {
            output[key] = Number(output[key] ?? 0) + Number(delta[key] ?? 0)
        }

        return output
    }

    static getDelta(before: any, after: any): any {
        const output: any = {}

        for (const key of Object.keys(after)) {
            output[key] = Number(after[key] ?? 0) - Number(before[key] ?? 0)
        }

        return output
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
        const runs = Number(total.runs ?? 0)
        const rbi = Number(total.rbi ?? 0)
        const stolenBases = Number(total.stolenBases ?? 0)
        const caughtStealing = Number(total.caughtStealing ?? 0)
        const singles = Math.max(0, hits - doubles - triples - hr)
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
        const ballsInPlay = Math.max(0, ab - so - hr)

        return {
            pa,
            ab,
            hits,
            singles,
            doubles,
            triples,
            homeRuns: hr,
            bb,
            so,
            runs,
            rbi,
            stolenBases,
            caughtStealing,
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
            bbPercent: this.safeDiv(bb, pa),
            runsPerPA: this.safeDiv(runs, pa),
            rbiPerPA: this.safeDiv(rbi, pa),
            stolenBasePercent: this.safeDiv(stolenBases, pa),
            caughtStealingPercent: this.safeDiv(caughtStealing, pa)
        }
    }

    static getPitcherActual(total: any): any {
        const bf = Number(total.battersFaced ?? 0)
        const outs = Number(total.outs ?? 0)
        const er = Number(total.er ?? total.earnedRuns ?? 0)
        const hits = Number(total.hits ?? 0)
        const bb = Number(total.bb ?? 0)
        const so = Number(total.so ?? 0)
        const hbp = Number(total.hbp ?? 0)
        const doubles = Number(total.doubles ?? 0)
        const triples = Number(total.triples ?? 0)
        const hr = Number(total.homeRuns ?? total.hr ?? 0)
        const singles = Math.max(0, hits - doubles - triples - hr)
        const ab = Math.max(0, bf - bb - hbp)
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
        const ballsInPlay = Math.max(0, ab - so - hr)

        return {
            battersFaced: bf,
            outs,
            er,
            hits,
            singles,
            doubles,
            triples,
            homeRuns: hr,
            bb,
            so,
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

    static formatHitterRow(lever: string, rating: number, actual: any): any {
        return {
            lever,
            rating,
            pa: actual.pa,
            avg: this.round(actual.avg),
            obp: this.round(actual.obp),
            slg: this.round(actual.slg),
            ops: this.round(actual.ops),
            bb: this.round(actual.bbPercent),
            so: this.round(actual.soPercent),
            babip: this.round(actual.babip),
            singles: this.round(actual.singlePercent),
            doubles: this.round(actual.doublePercent),
            triples: this.round(actual.triplePercent),
            hr: this.round(actual.homeRunPercent),
            xbh: this.round(actual.xbhPercent),
            runs: this.round(actual.runsPerPA),
            rbi: this.round(actual.rbiPerPA),
            sb: this.round(actual.stolenBasePercent),
            cs: this.round(actual.caughtStealingPercent)
        }
    }

    static formatPitcherRow(lever: string, rating: number, actual: any): any {
        return {
            lever,
            rating,
            bf: actual.battersFaced,
            era: this.round(actual.era),
            avg: this.round(actual.avg),
            obp: this.round(actual.obp),
            slg: this.round(actual.slg),
            ops: this.round(actual.ops),
            bb: this.round(actual.bbPercent),
            so: this.round(actual.soPercent),
            babip: this.round(actual.babip),
            singles: this.round(actual.singlePercent),
            doubles: this.round(actual.doublePercent),
            triples: this.round(actual.triplePercent),
            hr: this.round(actual.homeRunPercent),
            xbh: this.round(actual.xbhPercent)
        }
    }

    static getHitterSummaryRows(rows: any[]): any[] {
        const output: any[] = []

        for (const lever of [...new Set(rows.map(row => row.lever))]) {
            const leverRows = rows.filter(row => row.lever === lever)
            const low = leverRows.find(row => row.rating === 30)
            const avg = leverRows.find(row => row.rating === 100)
            const high = leverRows.find(row => row.rating === 170)

            assert.ok(low, `${lever} missing 30 row`)
            assert.ok(avg, `${lever} missing 100 row`)
            assert.ok(high, `${lever} missing 170 row`)

            output.push({ lever, metric: "AVG/OBP/SLG", r30: `${low.avg}/${low.obp}/${low.slg}`, r100: `${avg.avg}/${avg.obp}/${avg.slg}`, r170: `${high.avg}/${high.obp}/${high.slg}` })
            output.push({ lever, metric: "BB/SO/BABIP", r30: `${low.bb}/${low.so}/${low.babip}`, r100: `${avg.bb}/${avg.so}/${avg.babip}`, r170: `${high.bb}/${high.so}/${high.babip}` })
            output.push({ lever, metric: "1B/2B/HR/XBH", r30: `${low.singles}/${low.doubles}/${low.hr}/${low.xbh}`, r100: `${avg.singles}/${avg.doubles}/${avg.hr}/${avg.xbh}`, r170: `${high.singles}/${high.doubles}/${high.hr}/${high.xbh}` })
            output.push({ lever, metric: "RUN/RBI/SB/CS", r30: `${low.runs}/${low.rbi}/${low.sb}/${low.cs}`, r100: `${avg.runs}/${avg.rbi}/${avg.sb}/${avg.cs}`, r170: `${high.runs}/${high.rbi}/${high.sb}/${high.cs}` })
        }

        return output
    }

    static getPitcherSummaryRows(rows: any[]): any[] {
        const output: any[] = []

        for (const lever of [...new Set(rows.map(row => row.lever))]) {
            const leverRows = rows.filter(row => row.lever === lever)
            const low = leverRows.find(row => row.rating === 30)
            const avg = leverRows.find(row => row.rating === 100)
            const high = leverRows.find(row => row.rating === 170)

            assert.ok(low, `${lever} missing 30 row`)
            assert.ok(avg, `${lever} missing 100 row`)
            assert.ok(high, `${lever} missing 170 row`)

            output.push({ lever, metric: "ERA/AVG/OBP", r30: `${low.era}/${low.avg}/${low.obp}`, r100: `${avg.era}/${avg.avg}/${avg.obp}`, r170: `${high.era}/${high.avg}/${high.obp}` })
            output.push({ lever, metric: "SLG/BB/SO", r30: `${low.slg}/${low.bb}/${low.so}`, r100: `${avg.slg}/${avg.bb}/${avg.so}`, r170: `${high.slg}/${high.bb}/${high.so}` })
            output.push({ lever, metric: "1B/2B/HR/XBH", r30: `${low.singles}/${low.doubles}/${low.hr}/${low.xbh}`, r100: `${avg.singles}/${avg.doubles}/${avg.hr}/${avg.xbh}`, r170: `${high.singles}/${high.doubles}/${high.hr}/${high.xbh}` })
        }

        return output
    }

    static getCompactRows(rows: any[], columns: string[]): any[] {
        return rows
            .filter(row => this.compactRatingLevels.includes(row.rating))
            .map(row => {
                const output: any = {
                    lever: row.lever,
                    rating: row.rating
                }

                for (const column of columns) {
                    output[column] = row[column]
                }

                return output
            })
    }

    static getCompactHitterRows(rows: any[]): any[] {
        const output: any[] = []

        for (const lever of [...new Set(rows.map(row => row.lever))]) {
            const leverRows = rows.filter(row => row.lever === lever)

            if (lever === "contact") output.push(...this.getCompactRows(leverRows, ["pa", "avg", "obp", "slg", "babip", "so"]))
            else if (lever === "plateDiscipline") output.push(...this.getCompactRows(leverRows, ["pa", "obp", "bb", "so", "avg"]))
            else if (lever === "gapPower") output.push(...this.getCompactRows(leverRows, ["pa", "doubles", "triples", "hr", "xbh", "slg"]))
            else if (lever === "homerunPower") output.push(...this.getCompactRows(leverRows, ["pa", "hr", "slg", "ops", "runs", "rbi"]))
            else output.push(...this.getCompactRows(leverRows, ["pa", "avg", "obp", "slg", "babip"]))
        }

        return output
    }

    static getCompactPitcherRows(rows: any[]): any[] {
        const output: any[] = []

        for (const lever of [...new Set(rows.map(row => row.lever))]) {
            const leverRows = rows.filter(row => row.lever === lever)

            if (lever === "power") output.push(...this.getCompactRows(leverRows, ["bf", "era", "avg", "so", "bb", "babip"]))
            else if (lever === "control") output.push(...this.getCompactRows(leverRows, ["bf", "era", "obp", "bb", "so", "avg"]))
            else if (lever === "movement") output.push(...this.getCompactRows(leverRows, ["bf", "era", "slg", "hr", "doubles", "xbh"]))
            else output.push(...this.getCompactRows(leverRows, ["bf", "era", "avg", "obp", "slg"]))
        }

        return output
    }

    static toPowerChartRates(input: any): any {
        const out = Number(input.out ?? 0)
        const singles = Number(input.singles ?? 0)
        const doubles = Number(input.doubles ?? 0)
        const triples = Number(input.triples ?? 0)
        const hr = Number(input.hr ?? 0)
        const total = out + singles + doubles + triples + hr
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)

        return {
            out: this.round(this.safeDiv(out, total)),
            hit: this.round(this.safeDiv(singles + doubles + triples + hr, total)),
            singles: this.round(this.safeDiv(singles, total)),
            doubles: this.round(this.safeDiv(doubles, total)),
            triples: this.round(this.safeDiv(triples, total)),
            hr: this.round(this.safeDiv(hr, total)),
            xbh: this.round(this.safeDiv(doubles + triples + hr, total)),
            tb: this.round(this.safeDiv(totalBases, total))
        }
    }

    static getPowerChartRatesForLever(side: ElasticitySide, stat: ElasticityStat, rating: number): any {
        const rollChartService = new RollChartService()

        if (side === "hitter") {
            const hitter = this.createAverageHitterPlayer()
            const baseRatings = this.getRatings(hitter)
            const ratings = this.forceHitterRatings(baseRatings, rating, stat as HitterElasticityStat)
            const change = PlayerChange.getHitterChange(ratings.hittingRatings, pitchEnvironment.avgRating, Handedness.R)
            return this.toPowerChartRates(rollChartService.buildHitterPowerRollInput(pitchEnvironment, change))
        }

        const pitcher = this.createAveragePitcherPlayer()
        const baseRatings = this.getRatings(pitcher)
        const ratings = this.forcePitcherRatings(baseRatings, rating, stat as PitcherElasticityStat)
        const change = PlayerChange.getPitcherChange(ratings.pitchRatings, pitchEnvironment.avgRating, Handedness.R)
        return this.toPowerChartRates(rollChartService.buildPitcherPowerRollInput(pitchEnvironment, change))
    }

    static getUnderlyingPowerChartElasticityRows(): any[] {
        const specs = [
            { side: "hitter" as const, lever: "contact", primary: "out", secondary: "singles" },
            { side: "hitter" as const, lever: "gapPower", primary: "doubles", secondary: "triples" },
            { side: "hitter" as const, lever: "homerunPower", primary: "hr", secondary: "tb" },
            { side: "pitcher" as const, lever: "power", primary: "out", secondary: "hit" },
            { side: "pitcher" as const, lever: "control", primary: "out", secondary: "hit" },
            { side: "pitcher" as const, lever: "movement", primary: "hr", secondary: "xbh" }
        ]

        return specs.map(spec => {
            const low = this.getPowerChartRatesForLever(spec.side, spec.lever as ElasticityStat, 30)
            const avg = this.getPowerChartRatesForLever(spec.side, spec.lever as ElasticityStat, 100)
            const high = this.getPowerChartRatesForLever(spec.side, spec.lever as ElasticityStat, 170)

            return {
                side: spec.side,
                lever: spec.lever,
                primary: spec.primary,
                p30: low[spec.primary],
                p100: avg[spec.primary],
                p170: high[spec.primary],
                pDelta: this.round(high[spec.primary] - low[spec.primary]),
                secondary: spec.secondary,
                s30: low[spec.secondary],
                s100: avg[spec.secondary],
                s170: high[spec.secondary],
                sDelta: this.round(high[spec.secondary] - low[spec.secondary])
            }
        })
    }

    static assertUnderlyingChanges(): void {
        const rows = this.getUnderlyingChangeRows()

        for (const row of rows) {
            const expected = this.round((row.rating / 100) - 1)

            if (row.side === "hitter") {
                if (row.lever === "contact") assert.strictEqual(row.contact, expected)
                if (row.lever === "plateDiscipline") assert.strictEqual(row.discipline, expected)
                if (row.lever === "gapPower") assert.strictEqual(row.gap, expected)
                if (row.lever === "homerunPower") assert.strictEqual(row.hr, expected)
            }

            if (row.side === "pitcher") {
                if (row.lever === "power") assert.strictEqual(row.power, expected)
                if (row.lever === "control") assert.strictEqual(row.control, expected)
                if (row.lever === "movement") assert.strictEqual(row.movement, expected)
            }
        }
    }

    static getUnderlyingChangeRows(): any[] {
        const hitter = this.createAverageHitterPlayer()
        const hitterBase = this.getRatings(hitter)
        const pitcher = this.createAveragePitcherPlayer()
        const pitcherBase = this.getRatings(pitcher)
        const rows: any[] = []

        for (const rating of this.ratingLevels) {
            for (const stat of ["contact", "plateDiscipline", "gapPower", "homerunPower"] as const) {
                const ratings = this.forceHitterRatings(hitterBase, rating, stat)
                const change = PlayerChange.getHitterChange(ratings.hittingRatings, pitchEnvironment.avgRating, Handedness.R)

                rows.push({
                    side: "hitter",
                    lever: stat,
                    rating,
                    contact: this.maybeRound(change.contactChange),
                    discipline: this.maybeRound(change.plateDisiplineChange),
                    gap: this.maybeRound(change.gapPowerChange),
                    hr: this.maybeRound(change.hrPowerChange)
                })
            }

            for (const stat of ["power", "control", "movement"] as const) {
                const ratings = this.forcePitcherRatings(pitcherBase, rating, stat)
                const change = PlayerChange.getPitcherChange(ratings.pitchRatings, pitchEnvironment.avgRating, Handedness.R)

                rows.push({
                    side: "pitcher",
                    lever: stat,
                    rating,
                    power: this.maybeRound(change.powerChange),
                    control: this.maybeRound(change.controlChange),
                    movement: this.maybeRound(change.movementChange)
                })
            }
        }

        return rows
    }

    static simHitterPlateAppearances(playerImportRaw: PlayerImportRaw, ratings: any, seed: string, targetPa = this.plateAppearancesPerRating, prepareGame?: (game: any, playerId: string) => void): any {
        const player = this.buildPlayerFromRatings(playerImportRaw, ratings, false)
        const rng = seedrandom(seed)
        let total: any = {}
        let gameIndex = 0

        while (Number(total.pa ?? 0) < targetPa) {
            const game = baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `pa-sweep-${player._id}-${gameIndex}`)

            if (prepareGame) {
                prepareGame(game, player._id)
            }

            let previous = this.getHitResultSnapshot(this.findGamePlayer(game, player._id))

            while (!game.isComplete && Number(total.pa ?? 0) < targetPa) {
                simService.simPitch(game, rng)

                const current = this.getHitResultSnapshot(this.findGamePlayer(game, player._id))

                if (current.pa > previous.pa) {
                    total = this.addDelta(total, this.getDelta(previous, current))
                }

                previous = current
            }

            gameIndex++
        }

        return this.getHitterActual(total)
    }

    static simPitcherPlateAppearances(playerImportRaw: PlayerImportRaw, ratings: any, seed: string, targetPa = this.plateAppearancesPerRating): any {
        const player = this.buildPlayerFromRatings(playerImportRaw, ratings, true)
        const rng = seedrandom(seed)
        let total: any = {}
        let gameIndex = 0

        while (Number(total.battersFaced ?? 0) < targetPa) {
            const game = baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `pitcher-pa-sweep-${player._id}-${gameIndex}`)
            let previous = this.getPitchResultSnapshot(this.findGamePlayer(game, player._id))

            while (!game.isComplete && Number(total.battersFaced ?? 0) < targetPa) {
                simService.simPitch(game, rng)

                const current = this.getPitchResultSnapshot(this.findGamePlayer(game, player._id))

                if (current.battersFaced > previous.battersFaced) {
                    total = this.addDelta(total, this.getDelta(previous, current))
                }

                previous = current
            }

            gameIndex++
        }

        return this.getPitcherActual(total)
    }

    static simTeamHitterFullContextGames(stat: HitterElasticityStat, rating: number, seed: string, games = this.fullContextGamesPerRating): any {
        const importPlayer = this.createAverageHitterPlayer()
        const baseRatings = this.getRatings(importPlayer)
        const player = this.buildPlayerFromRatings(importPlayer, baseRatings, false)
        const rng = seedrandom(seed)
        let total: any = {}

        for (let gameIndex = 0; gameIndex < games; gameIndex++) {
            const game = baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `team-hitter-context-${stat}-${rating}-${gameIndex}`)

            this.forceAllGameHitterRatings(game, rating, stat)

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            simService.finishGame(game)

            total = this.addDelta(total, this.aggregateGameHitterResults(game))
        }

        return this.getHitterActual(total)
    }

    static simSingleAnchorHitterFullContextGames(stat: HitterElasticityStat, rating: number, seed: string, games = this.fullContextGamesPerRating): any {
        return this.simTeamHitterFullContextGames(stat, rating, seed, games)
    }

    static getSingleLeverHitterPaRows(stat: HitterElasticityStat): any[] {
        const importPlayer = this.createAverageHitterPlayer()
        const baseRatings = this.getRatings(importPlayer)
        const rows: any[] = []

        for (const rating of this.ratingLevels) {
            const ratings = this.forceHitterRatings(baseRatings, rating, stat)
            const actual = this.simHitterPlateAppearances(importPlayer, ratings, `hitter-pa:${stat}:${rating}`)
            rows.push(this.formatHitterRow(stat, rating, actual))
        }

        return rows
    }

    static getSingleLeverPitcherPaRows(stat: PitcherElasticityStat): any[] {
        const importPlayer = this.createAveragePitcherPlayer()
        const baseRatings = this.getRatings(importPlayer)
        const rows: any[] = []

        for (const rating of this.ratingLevels) {
            const ratings = this.forcePitcherRatings(baseRatings, rating, stat)
            const actual = this.simPitcherPlateAppearances(importPlayer, ratings, `pitcher-pa:${stat}:${rating}`)
            rows.push(this.formatPitcherRow(stat, rating, actual))
        }

        return rows
    }

    static getSingleLeverTeamHitterContextRows(stat: HitterElasticityStat): any[] {
        const rows: any[] = []

        for (const rating of this.ratingLevels) {
            const actual = this.simTeamHitterFullContextGames(stat, rating, `team-hitter-context:${stat}:${rating}`)
            rows.push(this.formatHitterRow(stat, rating, actual))
        }

        return rows
    }

    static getSingleLeverAnchorContextRows(stat: HitterElasticityStat): any[] {
        return this.getSingleLeverTeamHitterContextRows(stat)
    }

    static getDefenseFullContextRows(): any[] {
        const importPlayer = this.createAverageHitterPlayer()
        const baseRatings = this.getRatings(importPlayer)
        const player = this.buildPlayerFromRatings(importPlayer, baseRatings, false)
        const rows: any[] = []

        for (const rating of this.ratingLevels) {
            const rng = seedrandom(`team-defense-context:${rating}`)
            let total: any = {}

            for (let gameIndex = 0; gameIndex < this.fullContextGamesPerRating; gameIndex++) {
                const game = baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `team-defense-context-${rating}-${gameIndex}`)

                this.forceAllGameDefenseRatings(game, rating)

                while (!game.isComplete) {
                    simService.simPitch(game, rng)
                }

                simService.finishGame(game)

                total = this.addDelta(total, this.aggregateGameHitterResults(game))
            }

            rows.push(this.formatHitterRow("teamDefense", rating, this.getHitterActual(total)))
        }

        return rows
    }

    static getRunningArmRows(): any[] {
        const runnerService = new RunnerService(new SimRolls(new RollChartService()))
        const rows: any[] = []

        for (const rating of this.ratingLevels) {
            rows.push({ lever: "speed", rating, advance75: runnerService.getChanceRunnerSafe(pitchEnvironment, 100, rating, 75), advance95: runnerService.getChanceRunnerSafe(pitchEnvironment, 100, rating, 95), steal75: runnerService.getStolenBaseSafe(pitchEnvironment, 100, rating, 100, 75) })
            rows.push({ lever: "steals", rating, steal75: runnerService.getStolenBaseSafe(pitchEnvironment, 100, 100, rating, 75) })
            rows.push({ lever: "arm", rating, advanceAllowed75: runnerService.getChanceRunnerSafe(pitchEnvironment, rating, 100, 75), advanceAllowed95: runnerService.getChanceRunnerSafe(pitchEnvironment, rating, 100, 95), stealAllowed75: runnerService.getStolenBaseSafe(pitchEnvironment, rating, 100, 100, 75) })
        }

        return rows
    }

    static getAllHitterPaRows(): any[] {
        return [
            ...this.getSingleLeverHitterPaRows("contact"),
            ...this.getSingleLeverHitterPaRows("plateDiscipline"),
            ...this.getSingleLeverHitterPaRows("gapPower"),
            ...this.getSingleLeverHitterPaRows("homerunPower")
        ]
    }

    static getAllPitcherPaRows(): any[] {
        return [
            ...this.getSingleLeverPitcherPaRows("power"),
            ...this.getSingleLeverPitcherPaRows("control"),
            ...this.getSingleLeverPitcherPaRows("movement")
        ]
    }

    static getAllAnchorContextRows(): any[] {
        return [
            ...this.getSingleLeverTeamHitterContextRows("contact"),
            ...this.getSingleLeverTeamHitterContextRows("plateDiscipline"),
            ...this.getSingleLeverTeamHitterContextRows("gapPower"),
            ...this.getSingleLeverTeamHitterContextRows("homerunPower")
        ]
    }

    static getElasticityRows(rows: any[], specs: { lever: string, metric: string, expected: ElasticityDirection }[]): any[] {
        return specs.map(spec => {
            const leverRows = rows.filter(row => row.lever === spec.lever)
            const low = leverRows.find(row => row.rating === 30)
            const avg = leverRows.find(row => row.rating === 100)
            const high = leverRows.find(row => row.rating === 170)

            assert.ok(low, `${spec.lever} missing 30 row`)
            assert.ok(avg, `${spec.lever} missing 100 row`)
            assert.ok(high, `${spec.lever} missing 170 row`)

            const lowValue = Number(low[spec.metric])
            const avgValue = Number(avg[spec.metric])
            const highValue = Number(high[spec.metric])
            const delta = highValue - lowValue
            const expectedOk = spec.expected === "up" ? delta > 0 : delta < 0

            return {
                lever: spec.lever,
                metric: spec.metric,
                expected: spec.expected,
                r30: this.round(lowValue),
                r100: this.round(avgValue),
                r170: this.round(highValue),
                delta: this.round(delta),
                status: expectedOk ? "OK" : "CHECK"
            }
        })
    }

    static getHitterElasticityRows(rows: any[]): any[] {
        return this.getElasticityRows(rows, [
            { lever: "contact", metric: "avg", expected: "up" },
            { lever: "contact", metric: "babip", expected: "up" },
            { lever: "contact", metric: "so", expected: "down" },
            { lever: "plateDiscipline", metric: "obp", expected: "up" },
            { lever: "plateDiscipline", metric: "bb", expected: "up" },
            { lever: "plateDiscipline", metric: "so", expected: "down" },
            { lever: "gapPower", metric: "doubles", expected: "up" },
            { lever: "gapPower", metric: "xbh", expected: "up" },
            { lever: "homerunPower", metric: "hr", expected: "up" },
            { lever: "homerunPower", metric: "slg", expected: "up" }
        ])
    }

    static getPitcherElasticityRows(rows: any[]): any[] {
        return this.getElasticityRows(rows, [
            { lever: "power", metric: "so", expected: "up" },
            { lever: "power", metric: "avg", expected: "down" },
            { lever: "control", metric: "bb", expected: "down" },
            { lever: "control", metric: "obp", expected: "down" },
            { lever: "movement", metric: "hr", expected: "down" },
            { lever: "movement", metric: "slg", expected: "down" }
        ])
    }

    static formatHitterRatingsForTable(ratings: any): any {
        return {
            contactR: ratings.hittingRatings?.vsR?.contact,
            contactL: ratings.hittingRatings?.vsL?.contact,
            discR: ratings.hittingRatings?.vsR?.plateDiscipline,
            discL: ratings.hittingRatings?.vsL?.plateDiscipline,
            gapR: ratings.hittingRatings?.vsR?.gapPower,
            gapL: ratings.hittingRatings?.vsL?.gapPower,
            hrR: ratings.hittingRatings?.vsR?.homerunPower,
            hrL: ratings.hittingRatings?.vsL?.homerunPower,
            speed: ratings.hittingRatings?.speed,
            steals: ratings.hittingRatings?.steals,
            defense: ratings.hittingRatings?.defense,
            arm: ratings.hittingRatings?.arm
        }
    }

    static formatPitcherRatingsForTable(ratings: any): any {
        return {
            power: ratings.pitchRatings?.power,
            controlR: ratings.pitchRatings?.vsR?.control,
            controlL: ratings.pitchRatings?.vsL?.control,
            movementR: ratings.pitchRatings?.vsR?.movement,
            movementL: ratings.pitchRatings?.vsL?.movement
        }
    }

    static formatActualForTable(actual: any): any {
        return {
            avg: this.maybeRound(actual.avg),
            obp: this.maybeRound(actual.obp),
            slg: this.maybeRound(actual.slg),
            ops: this.maybeRound(actual.ops),
            bb: this.maybeRound(actual.bbPercent),
            so: this.maybeRound(actual.soPercent),
            babip: this.maybeRound(actual.babip),
            singles: this.maybeRound(actual.singlePercent),
            doubles: this.maybeRound(actual.doublePercent),
            triples: this.maybeRound(actual.triplePercent),
            hr: this.maybeRound(actual.homeRunPercent),
            xbh: this.maybeRound(actual.xbhPercent),
            sb: this.maybeRound(actual.stolenBasePercent),
            cs: this.maybeRound(actual.caughtStealingPercent),
            sbCount: this.maybeRound(actual.stolenBases, 0),
            csCount: this.maybeRound(actual.caughtStealing, 0),
            era: this.maybeRound(actual.era)
        }
    }

    static formatDiffForTable(actual: any, target: any): any {
        return {
            avg: this.maybeRound(Number(actual.avg) - Number(target.avg)),
            obp: this.maybeRound(Number(actual.obp) - Number(target.obp)),
            slg: this.maybeRound(Number(actual.slg) - Number(target.slg)),
            ops: this.maybeRound(Number(actual.ops) - Number(target.ops)),
            bb: this.maybeRound(Number(actual.bbPercent) - Number(target.bbPercent)),
            so: this.maybeRound(Number(actual.soPercent) - Number(target.soPercent)),
            babip: this.maybeRound(Number(actual.babip) - Number(target.babip)),
            singles: this.maybeRound(Number(actual.singlePercent) - Number(target.singlePercent)),
            doubles: this.maybeRound(Number(actual.doublePercent) - Number(target.doublePercent)),
            triples: this.maybeRound(Number(actual.triplePercent) - Number(target.triplePercent)),
            hr: this.maybeRound(Number(actual.homeRunPercent) - Number(target.homeRunPercent)),
            xbh: this.maybeRound(Number(actual.xbhPercent) - Number(target.xbhPercent)),
            sb: this.maybeRound(Number(actual.stolenBasePercent) - Number(target.stolenBasePercent)),
            cs: this.maybeRound(Number(actual.caughtStealingPercent) - Number(target.caughtStealingPercent)),
            sbCount: this.maybeRound(Number(actual.stolenBases) - Number(target.stolenBases), 0),
            csCount: this.maybeRound(Number(actual.caughtStealing) - Number(target.caughtStealing), 0),
            era: this.maybeRound(Number(actual.era) - Number(target.era))
        }
    }

    static getRealPlayerDiagnostic(name: string): any {
        const player = this.findPlayer(name)
        const ratings = this.getRatings(player)
        const result = services.playerRatingService.evaluatePlayerRatings(
            pitchEnvironment,
            [player],
            seedrandom(`real-player-diagnostic:${name}`),
            this.realPlayerGames
        )

        return {
            name,
            player,
            ratings,
            hitter: result.actual.hitterCount > 0 ? { actual: result.actual.hitter, target: result.target.hitter } : undefined,
            pitcher: result.actual.pitcherCount > 0 ? { actual: result.actual.pitcher, target: result.target.pitcher } : undefined
        }
    }

}



describe("Player Rating Diagnostics", function () {


    it("should print running, defense, steals, speed, and arm diagnostics", function () {
        const defenseRows = RatingTestHarness.getDefenseFullContextRows()
        const runningRows = RatingTestHarness.getRunningFullContextRows()
        const armRows = RatingTestHarness.getArmFullContextRows()
        const runningArmRows = [...runningRows, ...armRows]
        const rangeRows = RatingTestHarness.getRunningArmRangeRows()
        const generatedRows = RatingTestHarness.getRealPlayerRunningFieldingRows()

        RatingTestHarness.printTable("[GENERATED RUNNING/FIELDING RATINGS]", generatedRows)

        RatingTestHarness.printTable("[RUNNING/ARM FULL-CONTEXT SUMMARY]", RatingTestHarness.getRunningArmSummaryRows(runningArmRows))
        RatingTestHarness.printTable("[RUNNING/ARM FULL-CONTEXT COMPACT DETAIL]", RatingTestHarness.getRunningArmCompactRows(runningArmRows))

        RatingTestHarness.printTable("[TEAM DEFENSE FULL-CONTEXT SUMMARY]", RatingTestHarness.getHitterSummaryRows(defenseRows))
        RatingTestHarness.printTable("[TEAM DEFENSE FULL-CONTEXT COMPACT DETAIL]", RatingTestHarness.getCompactHitterRows(defenseRows))

        RatingTestHarness.printTable("[RUNNING/ARM DIRECT RANGE TABLE]", rangeRows)

        assert.ok(generatedRows.length > 0)
        assert.ok(runningRows.length > 0)
        assert.ok(armRows.length > 0)
        assert.ok(defenseRows.length > 0)
        assert.ok(rangeRows.length > 0)
    })


    it("should validate underlying rating plumbing and print compact roll-chart elasticity", function () {
        RatingTestHarness.assertUnderlyingChanges()

        const powerChartRows = RatingTestHarness.getUnderlyingPowerChartElasticityRows()

        RatingTestHarness.printTable("[UNDERLYING POWER CHART ELASTICITY]", powerChartRows)

        assert.ok(powerChartRows.length > 0)
    })

    it("should print isolated hitter PA elasticity diagnostics", function () {
        const rows = RatingTestHarness.getAllHitterPaRows()

        RatingTestHarness.printTable("[ISOLATED HITTER PA ELASTICITY]", RatingTestHarness.getHitterElasticityRows(rows))
        RatingTestHarness.printTable("[ISOLATED HITTER PA SUMMARY]", RatingTestHarness.getHitterSummaryRows(rows))
        RatingTestHarness.printTable("[ISOLATED HITTER PA COMPACT DETAIL]", RatingTestHarness.getCompactHitterRows(rows))

        assert.ok(rows.length > 0)
    })

    it("should print isolated pitcher PA elasticity diagnostics", function () {
        const rows = RatingTestHarness.getAllPitcherPaRows()

        RatingTestHarness.printTable("[ISOLATED PITCHER PA ELASTICITY]", RatingTestHarness.getPitcherElasticityRows(rows))
        RatingTestHarness.printTable("[ISOLATED PITCHER PA SUMMARY]", RatingTestHarness.getPitcherSummaryRows(rows))
        RatingTestHarness.printTable("[ISOLATED PITCHER PA COMPACT DETAIL]", RatingTestHarness.getCompactPitcherRows(rows))

        assert.ok(rows.length > 0)
    })

    it("should print single-anchor hitter full-context game diagnostics", function () {
        const rows = RatingTestHarness.getAllAnchorContextRows()

        RatingTestHarness.printTable("[SINGLE-ANCHOR HITTER FULL-CONTEXT SUMMARY]", RatingTestHarness.getHitterSummaryRows(rows))
        RatingTestHarness.printTable("[SINGLE-ANCHOR HITTER FULL-CONTEXT COMPACT DETAIL]", RatingTestHarness.getCompactHitterRows(rows))

        assert.ok(rows.length > 0)
    })

    it("should print running and defense diagnostics", function () {
        const defenseRows = RatingTestHarness.getDefenseFullContextRows()
        const runningArmRows = RatingTestHarness.getRunningArmRows()

        RatingTestHarness.printTable("[TEAM DEFENSE FULL-CONTEXT SUMMARY]", RatingTestHarness.getHitterSummaryRows(defenseRows))
        RatingTestHarness.printTable("[TEAM DEFENSE FULL-CONTEXT COMPACT DETAIL]", RatingTestHarness.getCompactHitterRows(defenseRows))
        RatingTestHarness.printTable("[RUNNING/ARM RANGES]", runningArmRows)

        assert.ok(defenseRows.length > 0)
        assert.ok(runningArmRows.length > 0)
    })

    it("should compare generated real player builds against real life", function () {
        const judge = RatingTestHarness.getRealPlayerDiagnostic("Aaron Judge")
        const ohtani = RatingTestHarness.getRealPlayerDiagnostic("Shohei Ohtani")
        const skenes = RatingTestHarness.getRealPlayerDiagnostic("Paul Skenes")

        assert.ok(judge.hitter, "Missing Judge hitter diagnostic")
        assert.ok(ohtani.hitter, "Missing Ohtani hitter diagnostic")
        assert.ok(ohtani.pitcher, "Missing Ohtani pitcher diagnostic")
        assert.ok(skenes.pitcher, "Missing Skenes pitcher diagnostic")

        RatingTestHarness.printTable("[REAL PLAYER HITTER RATINGS]", [
            { player: "Aaron Judge", ...RatingTestHarness.formatHitterRatingsForTable(judge.ratings) },
            { player: "Shohei Ohtani", ...RatingTestHarness.formatHitterRatingsForTable(ohtani.ratings) }
        ])

        RatingTestHarness.printTable("[REAL PLAYER PITCHER RATINGS]", [
            { player: "Shohei Ohtani", ...RatingTestHarness.formatPitcherRatingsForTable(ohtani.ratings) },
            { player: "Paul Skenes", ...RatingTestHarness.formatPitcherRatingsForTable(skenes.ratings) }
        ])

        RatingTestHarness.printTable("[REAL PLAYER HITTER SIM VS REAL]", [
            { player: "Aaron Judge", row: "SIM", ...RatingTestHarness.formatActualForTable(judge.hitter.actual) },
            { player: "Aaron Judge", row: "REAL", ...RatingTestHarness.formatActualForTable(judge.hitter.target) },
            { player: "Aaron Judge", row: "DIFF", ...RatingTestHarness.formatDiffForTable(judge.hitter.actual, judge.hitter.target) },

            { player: "Shohei Ohtani H", row: "SIM", ...RatingTestHarness.formatActualForTable(ohtani.hitter.actual) },
            { player: "Shohei Ohtani H", row: "REAL", ...RatingTestHarness.formatActualForTable(ohtani.hitter.target) },
            { player: "Shohei Ohtani H", row: "DIFF", ...RatingTestHarness.formatDiffForTable(ohtani.hitter.actual, ohtani.hitter.target) }
        ])

        RatingTestHarness.printTable("[REAL PLAYER PITCHER SIM VS REAL]", [
            { player: "Shohei Ohtani P", row: "SIM", ...RatingTestHarness.formatActualForTable(ohtani.pitcher.actual) },
            { player: "Shohei Ohtani P", row: "REAL", ...RatingTestHarness.formatActualForTable(ohtani.pitcher.target) },
            { player: "Shohei Ohtani P", row: "DIFF", ...RatingTestHarness.formatDiffForTable(ohtani.pitcher.actual, ohtani.pitcher.target) },

            { player: "Paul Skenes", row: "SIM", ...RatingTestHarness.formatActualForTable(skenes.pitcher.actual) },
            { player: "Paul Skenes", row: "REAL", ...RatingTestHarness.formatActualForTable(skenes.pitcher.target) },
            { player: "Paul Skenes", row: "DIFF", ...RatingTestHarness.formatDiffForTable(skenes.pitcher.actual, skenes.pitcher.target) }
        ])
    })


})