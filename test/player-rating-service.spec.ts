import assert from "assert"
import seedrandom from "seedrandom"
import fs from "fs"
import path from "path"

import type {
    PitchEnvironmentTarget,
    Player,
    PlayerRatingInput
} from "../src/sim/service/interfaces.js"

import { RollChartService } from "../src/sim/service/roll-chart-service.js"
import { PlayerChange, SimRolls } from "../src/sim/service/sim-service.js"
import { RunnerService } from "../src/sim/service/runner-service.js"
import { PlayerRatingService } from "../src/importer/service/player-rating-service.js"
import { BaselineGameService } from "../src/importer/service/baseline-game-service.js"
import { Handedness, PlayResult, simService } from "../src/sim/index.js"



import {
    database
} from "baseball-database"
import { PlayerRatingInputRepository } from "../src/importer/repository/player-rating-input-repository.js"
import { StatClassificationService } from "../src/importer/service/stat-classification-service.js"

const season = 2025
const baseDataDir = process.env.DATA_DIR ? process.env.DATA_DIR : "data"


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

    const statClassificationService = new StatClassificationService()
    const playerRatingInputRepository = new PlayerRatingInputRepository(database, statClassificationService)


    const playerRatingService = new PlayerRatingService(playerRatingInputRepository)

    return {
        playerRatingService, playerRatingInputRepository
    }
}   

const baselineGameService = new BaselineGameService(simService)
const services = createServices()

const pitchEnvironmentPath = path.join(baseDataDir, String(season), "_pitch_environment_target.json")

if (!await fileExists(pitchEnvironmentPath)) {
    throw new Error(`Missing pitch environment target: ${pitchEnvironmentPath}. Run npm run generate:all ${season} first.`)
}

const pitchEnvironment = await readJson<PitchEnvironmentTarget>(pitchEnvironmentPath)
const ratingDate = `${season + 1}-01-01`

const diagnosticPlayers = [
    { playerId: "592450", name: "Aaron Judge", role: "hitter" },
    { playerId: "660271", name: "Shohei Ohtani", role: "twoWay" },
    { playerId: "694973", name: "Paul Skenes", role: "pitcher" },
    { playerId: "656941", name: "Kyle Schwarber", role: "hitter" },
    { playerId: "693645", name: "Cam Schlittler", role: "pitcher" },
    { playerId: "650859", name: "Luis Rengifo", role: "hitter" },
    { playerId: "668804", name: "Bryan Reynolds", role: "hitter" },
    { playerId: "656605", name: "Mitch Keller", role: "pitcher" },
    { playerId: "608372", name: "Tomoyuki Sugano", role: "pitcher" }
] as const

const diagnosticPlayerIds = new Set(diagnosticPlayers.map(player => player.playerId))

const playerInputs = services.playerRatingInputRepository.getCareer(
    ratingDate,
    diagnosticPlayerIds
)

const generatedPlayerRatings = await services.playerRatingService.buildPlayerRatingsForDate(
    season,
    ratingDate,
    pitchEnvironment,
    diagnosticPlayerIds
)

for (const diagnosticPlayer of diagnosticPlayers) {
    if (!playerInputs.has(diagnosticPlayer.playerId)) {
        throw new Error(`Missing core player rating input for ${diagnosticPlayer.name} (${diagnosticPlayer.playerId})`)
    }

    if (!generatedPlayerRatings.has(diagnosticPlayer.playerId)) {
        throw new Error(`Missing generated player ratings for ${diagnosticPlayer.name} (${diagnosticPlayer.playerId})`)
    }
}

type ElasticityDirection = "up" | "down"
type ElasticitySide = "hitter" | "pitcher"
type HitterElasticityStat = "contact" | "plateDiscipline" | "gapPower" | "homerunPower"
type PitcherElasticityStat = "power" | "control" | "movement"
type ElasticityStat = HitterElasticityStat | PitcherElasticityStat

class RatingTestHarness {

    static readonly ratingLevels = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170]
    static readonly compactRatingLevels = [30, 70, 100, 130, 170]
    static readonly plateAppearancesPerRating = 1250
    static readonly fullContextGamesPerRating = 25
    static readonly realPlayerPlateAppearances = 1250

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

    static findDiagnosticPlayer(name: string): typeof diagnosticPlayers[number] {
        const diagnosticPlayer = diagnosticPlayers.find(player => player.name === name)
        assert.ok(diagnosticPlayer, `Diagnostic player not configured: ${name}`)
        return diagnosticPlayer
    }

    static findPlayer(name: string): PlayerRatingInput {
        const diagnosticPlayer = this.findDiagnosticPlayer(name)
        const player = playerInputs.get(diagnosticPlayer.playerId)

        assert.ok(player, `Player rating input not found: ${name} (${diagnosticPlayer.playerId})`)
        return player
    }

    static getRatings(player: PlayerRatingInput): { hittingRatings: any, pitchRatings: any } {
        const generatedRatings = generatedPlayerRatings.get(player.playerId)

        if (generatedRatings) {
            return generatedRatings
        }

        return {
            hittingRatings: PlayerRatingService.buildHittingRatings(
                pitchEnvironment,
                player
            ),
            pitchRatings: PlayerRatingService.buildPitchRatings(
                pitchEnvironment,
                player
            )
        }
    }

    static createAverageHitterPlayer(): PlayerRatingInput {
        const player = clone(this.findPlayer("Aaron Judge"))
        const hitterReference = (pitchEnvironment as any).importReference.hitter

        assert.ok(hitterReference, "Missing pitchEnvironment.importReference.hitter")

        player.playerId = "average-hitter-rating-test"
        player.hitting = clone(hitterReference)
        player.pitching = { ...clone(player.pitching), battersFaced: 0, outs: 0 }

        return player
    }

    static createAveragePitcherPlayer(): PlayerRatingInput {
        const player = clone(this.findPlayer("Paul Skenes"))
        const pitcherReference = (pitchEnvironment as any).importReference.pitcher

        assert.ok(pitcherReference, "Missing pitchEnvironment.importReference.pitcher")

        player.playerId = "average-pitcher-rating-test"
        player.hitting = { ...clone(player.hitting), pa: 0, ab: 0 }
        player.pitching = clone(pitcherReference)

        return player
    }

    static buildPlayerFromRatings(playerInput: PlayerRatingInput, ratings: { hittingRatings: any, pitchRatings: any }, forcePitcher = false): Player {
        const isStarter = Number(playerInput.pitching?.starts ?? 0) > 0
        const diagnosticPlayer = diagnosticPlayers.find(player =>
            player.playerId === playerInput.playerId
        )
        const nameParts = String(
            diagnosticPlayer?.name ??
            "Test Player"
        ).split(" ")

        return {
            _id: playerInput.playerId,
            firstName: nameParts[0] ?? "Test",
            lastName: nameParts.slice(1).join(" ") || "Player",
            get fullName() { return `${this.firstName} ${this.lastName}` },
            get displayName() { return this.fullName },
            primaryPosition: forcePitcher ? "P" : "1B",
            zodiacSign: "Aries",
            throws: Handedness.R,
            hits: Handedness.R,
            isRetired: false,
            stamina: forcePitcher ? 1 : 0,
            maxPitchCount: forcePitcher ? (isStarter ? 100 : 30) : 0,
            overallRating: 100,
            hittingRatings: clone(ratings.hittingRatings),
            pitchRatings: clone(ratings.pitchRatings),
            age: 27
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

    static toPowerChartRates(chart: any): any {
        const counts = {
            out: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            hr: 0
        }

        for (const result of chart.entries.values()) {
            if (result === PlayResult.OUT) counts.out++
            else if (result === PlayResult.SINGLE) counts.singles++
            else if (result === PlayResult.DOUBLE) counts.doubles++
            else if (result === PlayResult.TRIPLE) counts.triples++
            else if (result === PlayResult.HR) counts.hr++
        }

        const total = counts.out + counts.singles + counts.doubles + counts.triples + counts.hr
        const totalBases = counts.singles + (counts.doubles * 2) + (counts.triples * 3) + (counts.hr * 4)

        return {
            out: this.round(this.safeDiv(counts.out, total)),
            hit: this.round(this.safeDiv(counts.singles + counts.doubles + counts.triples + counts.hr, total)),
            singles: this.round(this.safeDiv(counts.singles, total)),
            doubles: this.round(this.safeDiv(counts.doubles, total)),
            triples: this.round(this.safeDiv(counts.triples, total)),
            hr: this.round(this.safeDiv(counts.hr, total)),
            xbh: this.round(this.safeDiv(counts.doubles + counts.triples + counts.hr, total)),
            tb: this.round(this.safeDiv(totalBases, total))
        }
    }

    static getPowerChartRatesForLever(side: ElasticitySide, stat: ElasticityStat, rating: number): any {
        const rollChartService = new RollChartService()
        const neutralHitterChange = PlayerChange.getHitterChange(
            this.forceHitterRatings(this.getRatings(this.createAverageHitterPlayer()), 100, "contact").hittingRatings,
            pitchEnvironment.avgRating,
            Handedness.R
        )
        const neutralPitcherChange = PlayerChange.getPitcherChange(
            this.forcePitcherRatings(this.getRatings(this.createAveragePitcherPlayer()), 100, "power").pitchRatings,
            pitchEnvironment.avgRating,
            Handedness.R
        )

        if (side === "hitter") {
            const hitter = this.createAverageHitterPlayer()
            const baseRatings = this.getRatings(hitter)
            const ratings = this.forceHitterRatings(baseRatings, rating, stat as HitterElasticityStat)
            const hitterChange = PlayerChange.getHitterChange(ratings.hittingRatings, pitchEnvironment.avgRating, Handedness.R)
            const chart = rollChartService.getMatchupPowerRollChart(pitchEnvironment, hitterChange, neutralPitcherChange)

            return this.toPowerChartRates(chart)
        }

        const pitcher = this.createAveragePitcherPlayer()
        const baseRatings = this.getRatings(pitcher)
        const ratings = this.forcePitcherRatings(baseRatings, rating, stat as PitcherElasticityStat)
        const pitcherChange = PlayerChange.getPitcherChange(ratings.pitchRatings, pitchEnvironment.avgRating, Handedness.R)
        const chart = rollChartService.getMatchupPowerRollChart(pitchEnvironment, neutralHitterChange, pitcherChange)

        return this.toPowerChartRates(chart)
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

    static simHitterPlateAppearances(playerInput: PlayerRatingInput, ratings: any, seed: string, targetPa = this.plateAppearancesPerRating, prepareGame?: (game: any, playerId: string) => void): any {
        const player = this.buildPlayerFromRatings(playerInput, ratings, false)
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

    static simPitcherPlateAppearances(playerInput: PlayerRatingInput, ratings: any, seed: string, targetPa = this.plateAppearancesPerRating): any {
        const player = this.buildPlayerFromRatings(playerInput, ratings, true)
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

    static getHitterTarget(player: PlayerRatingInput): any {
        const hitting: any = player.hitting ?? {}
        const running: any = player.running ?? {}

        return this.getHitterActual({
            pa: Number(hitting.pa ?? hitting.plateAppearances ?? 0),
            atBats: Number(hitting.ab ?? hitting.atBats ?? 0),
            hits: Number(hitting.hits ?? 0),
            bb: Number(hitting.bb ?? hitting.walks ?? 0),
            so: Number(hitting.so ?? hitting.strikeouts ?? 0),
            hbp: Number(hitting.hbp ?? hitting.hitByPitch ?? 0),
            doubles: Number(hitting.doubles ?? 0),
            triples: Number(hitting.triples ?? 0),
            homeRuns: Number(hitting.homeRuns ?? hitting.hr ?? 0),
            runs: Number(hitting.runs ?? 0),
            rbi: Number(hitting.rbi ?? hitting.runsBattedIn ?? 0),
            stolenBases: Number(running.sb ?? running.stolenBases ?? 0),
            caughtStealing: Number(running.cs ?? running.caughtStealing ?? Math.max(0, Number(running.sbAttempts ?? 0) - Number(running.sb ?? 0)))
        })
    }

    static getPitcherTarget(player: PlayerRatingInput): any {
        const pitching: any = player.pitching ?? {}

        return this.getPitcherActual({
            battersFaced: Number(pitching.battersFaced ?? pitching.bf ?? 0),
            outs: Number(pitching.outs ?? 0),
            er: Number(pitching.earnedRuns ?? pitching.er ?? 0),
            hits: Number(pitching.hitsAllowed ?? pitching.hits ?? 0),
            bb: Number(pitching.bbAllowed ?? pitching.bb ?? pitching.walks ?? 0),
            so: Number(pitching.so ?? pitching.strikeouts ?? 0),
            hbp: Number(pitching.hbpAllowed ?? pitching.hbp ?? pitching.hitByPitch ?? 0),
            doubles: Number(pitching.doublesAllowed ?? pitching.doubles ?? 0),
            triples: Number(pitching.triplesAllowed ?? pitching.triples ?? 0),
            homeRuns: Number(pitching.homeRunsAllowed ?? pitching.homeRuns ?? pitching.hr ?? 0)
        })
    }

    static getRealPlayerDiagnostic(name: string): any {
        const diagnosticPlayer = this.findDiagnosticPlayer(name)
        const player = this.findPlayer(name)
        const ratings = this.getRatings(player)
        const hitter = diagnosticPlayer.role === "hitter" || diagnosticPlayer.role === "twoWay"
            ? {
                actual: this.simHitterPlateAppearances(player, ratings, `real-player-hitter:${player.playerId}`, this.realPlayerPlateAppearances),
                target: this.getHitterTarget(player)
            }
            : undefined
        const pitcher = diagnosticPlayer.role === "pitcher" || diagnosticPlayer.role === "twoWay"
            ? {
                actual: this.simPitcherPlateAppearances(player, ratings, `real-player-pitcher:${player.playerId}`, this.realPlayerPlateAppearances),
                target: this.getPitcherTarget(player)
            }
            : undefined

        return {
            name,
            player,
            ratings,
            hitter,
            pitcher
        }
    }

    static getAaronJudgeProbabilityRows(): { ratings: any[], changes: any[], powerChart: any[], results: any[] } {
        const judge = this.findPlayer("Aaron Judge")
        const judgeRatings = this.getRatings(judge)
        const averageHitter = this.createAverageHitterPlayer()
        const averageRatings = this.getRatings(averageHitter)
        const averagePitcher = this.createAveragePitcherPlayer()
        const averagePitcherRatings = this.getRatings(averagePitcher)
        const rollChartService = new RollChartService()

        const neutralPitcherChangeR = PlayerChange.getPitcherChange(
            averagePitcherRatings.pitchRatings,
            pitchEnvironment.avgRating,
            Handedness.R
        )
        const neutralPitcherChangeL = PlayerChange.getPitcherChange(
            averagePitcherRatings.pitchRatings,
            pitchEnvironment.avgRating,
            Handedness.L
        )

        const rows = [
            {
                label: "Average hitter vs RHP",
                ratings: averageRatings.hittingRatings.vsR,
                hitterChange: PlayerChange.getHitterChange(averageRatings.hittingRatings, pitchEnvironment.avgRating, Handedness.R),
                pitcherChange: neutralPitcherChangeR
            },
            {
                label: "Aaron Judge vs RHP",
                ratings: judgeRatings.hittingRatings.vsR,
                hitterChange: PlayerChange.getHitterChange(judgeRatings.hittingRatings, pitchEnvironment.avgRating, Handedness.R),
                pitcherChange: neutralPitcherChangeR
            },
            {
                label: "Average hitter vs LHP",
                ratings: averageRatings.hittingRatings.vsL,
                hitterChange: PlayerChange.getHitterChange(averageRatings.hittingRatings, pitchEnvironment.avgRating, Handedness.L),
                pitcherChange: neutralPitcherChangeL
            },
            {
                label: "Aaron Judge vs LHP",
                ratings: judgeRatings.hittingRatings.vsL,
                hitterChange: PlayerChange.getHitterChange(judgeRatings.hittingRatings, pitchEnvironment.avgRating, Handedness.L),
                pitcherChange: neutralPitcherChangeL
            }
        ]

        const powerChart = rows.map(row => {
            const chart = rollChartService.getMatchupPowerRollChart(
                pitchEnvironment,
                row.hitterChange,
                row.pitcherChange
            )
            const rates = this.toPowerChartRates(chart)
            const babipDenominator = rates.out + rates.singles + rates.doubles + rates.triples

            return {
                player: row.label,
                out: rates.out,
                singles: rates.singles,
                doubles: rates.doubles,
                triples: rates.triples,
                hr: rates.hr,
                hit: rates.hit,
                xbh: rates.xbh,
                chartBabip: this.round(this.safeDiv(rates.singles + rates.doubles + rates.triples, babipDenominator))
            }
        })

        const actual = this.simHitterPlateAppearances(
            judge,
            judgeRatings,
            "aaron-judge-probability-breakdown",
            this.realPlayerPlateAppearances
        )
        const target = this.getHitterTarget(judge)

        return {
            ratings: rows.map(row => ({
                player: row.label,
                contact: row.ratings.contact,
                plateDiscipline: row.ratings.plateDiscipline,
                gapPower: row.ratings.gapPower,
                homerunPower: row.ratings.homerunPower
            })),
            changes: rows.map(row => ({
                player: row.label,
                contact: this.round(row.hitterChange.contactChange),
                plateDiscipline: this.round(row.hitterChange.plateDisiplineChange),
                gapPower: this.round(row.hitterChange.gapPowerChange),
                homerunPower: this.round(row.hitterChange.hrPowerChange)
            })),
            powerChart,
            results: [
                {
                    row: "SIM",
                    ...this.formatActualForTable(actual)
                },
                {
                    row: "REAL",
                    ...this.formatActualForTable(target)
                },
                {
                    row: "DIFF",
                    ...this.formatDiffForTable(actual, target)
                }
            ]
        }
    }

}

enum DiagnosticTest {
    PLAYER_RATING_WINDOWS = "Player Rating Windows",
    PLAYER_RATING_DIAGNOSTICS = "Player Rating Diagnostics",
    AARON_JUDGE = "Aaron Judge Probability Breakdown"
}

const toRun: DiagnosticTest[] = [
    DiagnosticTest.PLAYER_RATING_WINDOWS,
    DiagnosticTest.PLAYER_RATING_DIAGNOSTICS,
    DiagnosticTest.AARON_JUDGE,
]


if (toRun.includes(DiagnosticTest.PLAYER_RATING_WINDOWS)) {
    describe("Player Rating Windows", function () {

        const buildRatings = (value: number, pitches: string[] = ["FF"]): any => {
            return {
                playerId: "1",
                hittingRatings: {
                    speed: value,
                    steals: value,
                    defense: value,
                    arm: value,
                    contactProfile: {
                        groundball: value,
                        flyBall: value,
                        lineDrive: value
                    },
                    vsR: {
                        plateDiscipline: value,
                        contact: value,
                        gapPower: value,
                        homerunPower: value
                    },
                    vsL: {
                        plateDiscipline: value,
                        contact: value,
                        gapPower: value,
                        homerunPower: value
                    }
                },
                pitchRatings: {
                    power: value,
                    contactProfile: {
                        groundball: value,
                        flyBall: value,
                        lineDrive: value
                    },
                    vsR: {
                        control: value,
                        movement: value
                    },
                    vsL: {
                        control: value,
                        movement: value
                    },
                    pitches
                }
            }
        }

        const buildImport = (playerId: string, value: number, plateAppearances = 100, pitchingGames = 0): any => {
            return {
                playerId,
                value,
                firstName: "Test",
                lastName: "Player",
                primaryPosition: pitchingGames > 0 ? "P" : "OF",
                age: 27,
                throws: "R",
                bats: "R",
                hitting: {
                    games: plateAppearances > 0 ? 1 : 0,
                    pa: plateAppearances
                },
                pitching: {
                    games: pitchingGames,
                    battersFaced: pitchingGames > 0 ? 3 : 0,
                    outs: pitchingGames > 0 ? 2 : 0
                }
            }
        }

        const recentWindow = (name: string, minimumDaysAgo: number, maximumDaysAgo: number, minimumPlateAppearances = 0): any => {
            return {
                name,
                weight: 0.10,
                minimumDaysAgo,
                maximumDaysAgo,
                minimumPlateAppearances
            }
        }

        it("calculates non-overlapping calendar ranges", function () {
            const service = PlayerRatingService as any

            assert.deepEqual(
                service.getWindowDateRange("2026-07-20", recentWindow("16-30", 16, 30)),
                {
                    startDate: "2026-06-20",
                    endDateExclusive: "2026-07-05"
                }
            )

            assert.deepEqual(
                service.getWindowDateRange("2026-07-20", recentWindow("8-15", 8, 15)),
                {
                    startDate: "2026-07-05",
                    endDateExclusive: "2026-07-13"
                }
            )

            assert.deepEqual(
                service.getWindowDateRange("2026-07-20", recentWindow("1-7", 1, 7)),
                {
                    startDate: "2026-07-13",
                    endDateExclusive: "2026-07-20"
                }
            )
        })

        it("qualifies a hitter at the minimum plate appearances", function () {
            const service = PlayerRatingService as any

            assert.equal(
                service.hasMinimumWindowSample(
                    buildImport("1", 100, 10),
                    recentWindow("1-7", 1, 7, 10)
                ),
                true
            )
        })

        it("rejects a hitter below the minimum plate appearances", function () {
            const service = PlayerRatingService as any

            assert.equal(
                service.hasMinimumWindowSample(
                    buildImport("1", 100, 9),
                    recentWindow("1-7", 1, 7, 10)
                ),
                false
            )
        })

        it("qualifies a pitcher with a pitching appearance", function () {
            const service = PlayerRatingService as any

            assert.equal(
                service.hasMinimumWindowSample(
                    buildImport("1", 100, 0, 1),
                    recentWindow("1-7", 1, 7, 10)
                ),
                true
            )
        })

        it("rejects a player without a hitting or pitching sample", function () {
            const service = PlayerRatingService as any

            assert.equal(
                service.hasMinimumWindowSample(
                    buildImport("1", 100, 0, 0),
                    recentWindow("1-7", 1, 7, 10)
                ),
                false
            )
        })

        it("normalizes weights when only some windows qualify", function () {
            const service = PlayerRatingService as any
            const ratings = service.buildWeightedPlayerRatings([
                {
                    ratings: buildRatings(100),
                    weight: 0.75
                },
                {
                    ratings: buildRatings(140),
                    weight: 0.025
                }
            ])

            const expected = (100 * (0.75 / 0.775)) + (140 * (0.025 / 0.775))

            assert.equal(ratings.hittingRatings.speed, expected)
            assert.equal(ratings.hittingRatings.vsR.contact, expected)
            assert.equal(ratings.pitchRatings.power, expected)
            assert.equal(ratings.pitchRatings.vsL.movement, expected)
        })

        it("returns core ratings unchanged when only the core sample qualifies", function () {
            const service = PlayerRatingService as any
            const ratings = service.buildWeightedPlayerRatings([
                {
                    ratings: buildRatings(117),
                    weight: 0.75
                }
            ])

            assert.equal(ratings.hittingRatings.speed, 117)
            assert.equal(ratings.hittingRatings.vsR.contact, 117)
            assert.equal(ratings.pitchRatings.power, 117)
            assert.equal(ratings.pitchRatings.vsL.movement, 117)
        })

        it("uses the career set for nonnumeric rating values", function () {
            const service = PlayerRatingService as any
            const career = buildRatings(100, ["FF"])
            const recent = buildRatings(140, ["SL", "CH"])

            const ratings = service.buildWeightedPlayerRatings([
                {
                    ratings: career,
                    weight: 0.50
                },
                {
                    ratings: recent,
                    weight: 0.02
                }
            ])

            assert.equal(ratings.playerId, "1")
            assert.deepEqual(ratings.pitchRatings.pitches, ["FF"])
        })

        it("throws when no rating sets are supplied", function () {
            assert.throws(
                () => (PlayerRatingService as any).buildWeightedPlayerRatings([]),
                /without rating sets/
            )
        })

        it("requests each configured bulk rating window once during initial state creation", async function () {
            const requestedCareer: any[] = []
            const requestedLastAppearances: any[] = []
            const requestedRanges: any[] = []

            const repository = {
                getPlayerIdsForSeason: () => new Set(["1"]),
                getCareer: (endDateExclusive: string, playerIds?: Set<string>) => {
                    requestedCareer.push({ endDateExclusive, playerIds: Array.from(playerIds ?? []) })

                    return new Map([
                        ["1", buildImport("1", 100, 100)]
                    ])
                },
                getLastAppearances: (endDateExclusive: string, appearanceCount: number, playerIds?: Set<string>) => {
                    requestedLastAppearances.push({ endDateExclusive, appearanceCount, playerIds: Array.from(playerIds ?? []) })

                    return new Map([
                        ["1", buildImport("1", 110, 100)]
                    ])
                },
                getForDateRange: (startDate: string, endDateExclusive: string, playerIds?: Set<string>) => {
                    requestedRanges.push({ startDate, endDateExclusive, playerIds: Array.from(playerIds ?? []) })

                    const value = startDate === "2026-06-20" ? 120 : startDate === "2026-07-05" ? 130 : 140

                    return new Map([
                        ["1", buildImport("1", value, 100)]
                    ])
                }
            }

            const service = new PlayerRatingService(repository as unknown as PlayerRatingInputRepository)
            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings

            ratingService.buildPlayerRatings = (_pitchEnvironment: PitchEnvironmentTarget, playerInput: any) => buildRatings(playerInput.value)

            try {
                const ratings = await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1"]))

                assert.deepEqual(requestedCareer, [
                    { endDateExclusive: "2026-07-20", playerIds: ["1"] }
                ])

                assert.deepEqual(requestedLastAppearances, [
                    { endDateExclusive: "2026-07-20", appearanceCount: 162, playerIds: ["1"] }
                ])

                assert.deepEqual(requestedRanges, [
                    { startDate: "2026-06-20", endDateExclusive: "2026-07-05", playerIds: ["1"] },
                    { startDate: "2026-07-05", endDateExclusive: "2026-07-13", playerIds: ["1"] },
                    { startDate: "2026-07-13", endDateExclusive: "2026-07-20", playerIds: ["1"] }
                ])

                const expected = (100 * 0.50) + (110 * 0.30) + (120 * 0.12) + (130 * 0.06) + (140 * 0.02)
                const player = ratings.get("1")

                assert.ok(player)
                assert.equal(player.hittingRatings.speed, expected)
                assert.equal(player.pitchRatings.power, expected)
            } finally {
                ratingService.buildPlayerRatings = originalBuildPlayerRatings
            }
        })

        it("reuses cached ratings when the date and pitch environment are unchanged", async function () {
            let careerCalls = 0
            let lastAppearanceCalls = 0
            let dateRangeCalls = 0

            const repository = {
                getPlayerIdsForSeason: () => new Set(["1"]),
                getCareer: () => {
                    careerCalls++
                    return new Map([["1", buildImport("1", 100, 100)]])
                },
                getLastAppearances: () => {
                    lastAppearanceCalls++
                    return new Map([["1", buildImport("1", 100, 100)]])
                },
                getForDateRange: () => {
                    dateRangeCalls++
                    return new Map([["1", buildImport("1", 100, 100)]])
                }
            }

            const service = new PlayerRatingService(repository as unknown as PlayerRatingInputRepository)
            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings
            ratingService.buildPlayerRatings = (_pitchEnvironment: PitchEnvironmentTarget, playerInput: any) => buildRatings(playerInput.value)

            try {
                const first = await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1"]))
                const second = await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1"]))

                assert.equal(careerCalls, 1)
                assert.equal(lastAppearanceCalls, 1)
                assert.equal(dateRangeCalls, 3)
                assert.deepEqual(second, first)
            } finally {
                ratingService.buildPlayerRatings = originalBuildPlayerRatings
            }
        })

        it("rebuilds only players affected while advancing the state", async function () {
            const careerRequests: string[][] = []
            const lastAppearanceRequests: string[][] = []

            const repository = {
                getPlayerIdsForSeason: () => new Set(["1", "2"]),
                getCareer: (endDateExclusive: string, playerIds?: Set<string>) => {
                    const requested = Array.from(playerIds ?? []).sort()
                    careerRequests.push(requested)

                    return new Map(requested.map(playerId => [
                        playerId,
                        buildImport(playerId, endDateExclusive === "2026-07-21" && playerId === "2" ? 150 : playerId === "1" ? 100 : 110, 100)
                    ]))
                },
                getLastAppearances: (_endDateExclusive: string, _appearanceCount: number, playerIds?: Set<string>) => {
                    const requested = Array.from(playerIds ?? []).sort()
                    lastAppearanceRequests.push(requested)

                    return new Map(requested.map(playerId => [
                        playerId,
                        buildImport(playerId, playerId === "1" ? 100 : 110, 100)
                    ]))
                },
                getForDateRange: (startDate: string, endDateExclusive: string, playerIds?: Set<string>) => {
                    const isInitialWindow =
                        startDate === "2026-06-20" && endDateExclusive === "2026-07-05" ||
                        startDate === "2026-07-05" && endDateExclusive === "2026-07-13" ||
                        startDate === "2026-07-13" && endDateExclusive === "2026-07-20"

                    if (isInitialWindow) {
                        return new Map(Array.from(playerIds ?? []).map(playerId => [
                            playerId,
                            buildImport(playerId, playerId === "1" ? 100 : 110, 100)
                        ]))
                    }

                    return new Map([
                        ["2", buildImport("2", 150, 1)]
                    ])
                }
            }

            const service = new PlayerRatingService(repository as unknown as PlayerRatingInputRepository)
            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings
            ratingService.buildPlayerRatings = (_pitchEnvironment: PitchEnvironmentTarget, playerInput: any) => buildRatings(playerInput.value)

            try {
                const first = await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1", "2"]))
                const second = await service.buildPlayerRatingsForDate(2026, "2026-07-21", pitchEnvironment, new Set(["1", "2"]))

                assert.deepEqual(careerRequests, [["1", "2"]])
                assert.deepEqual(lastAppearanceRequests, [["1", "2"], ["2"]])
                assert.equal(second.get("1")?.hittingRatings.speed, first.get("1")?.hittingRatings.speed)
                assert.notEqual(second.get("2")?.hittingRatings.speed, first.get("2")?.hittingRatings.speed)
            } finally {
                ratingService.buildPlayerRatings = originalBuildPlayerRatings
            }
        })

        it("rebuilds all selected players when the pitch environment changes", async function () {
            const careerRequests: string[][] = []

            const repository = {
                getPlayerIdsForSeason: () => new Set(["1", "2"]),
                getCareer: (_endDateExclusive: string, playerIds?: Set<string>) => {
                    const requested = Array.from(playerIds ?? []).sort()
                    careerRequests.push(requested)

                    return new Map(requested.map(playerId => [
                        playerId,
                        buildImport(playerId, 100, 100)
                    ]))
                },
                getLastAppearances: (_endDateExclusive: string, _appearanceCount: number, playerIds?: Set<string>) => new Map(
                    Array.from(playerIds ?? []).map(playerId => [playerId, buildImport(playerId, 100, 100)])
                ),
                getForDateRange: (_startDate: string, _endDateExclusive: string, playerIds?: Set<string>) => new Map(
                    Array.from(playerIds ?? []).map(playerId => [playerId, buildImport(playerId, 100, 100)])
                )
            }

            const service = new PlayerRatingService(repository as unknown as PlayerRatingInputRepository)
            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings
            ratingService.buildPlayerRatings = (target: PitchEnvironmentTarget, playerInput: any) => buildRatings(playerInput.value + Number(target.avgRating))

            const changedPitchEnvironment = {
                ...structuredClone(pitchEnvironment),
                avgRating: Number(pitchEnvironment.avgRating) + 1
            }

            try {
                await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1", "2"]))
                await service.buildPlayerRatingsForDate(2026, "2026-07-20", changedPitchEnvironment, new Set(["1", "2"]))

                assert.deepEqual(careerRequests, [["1", "2"]])
            } finally {
                ratingService.buildPlayerRatings = originalBuildPlayerRatings
            }
        })

        it("passes the provided pitch environment into every rebuilt rating set", async function () {
            const receivedTargets: PitchEnvironmentTarget[] = []

            const repository = {
                getPlayerIdsForSeason: () => new Set(["1"]),
                getCareer: () => new Map([["1", buildImport("1", 100, 100)]]),
                getLastAppearances: () => new Map([["1", buildImport("1", 110, 100)]]),
                getForDateRange: () => new Map([["1", buildImport("1", 120, 100)]])
            }

            const service = new PlayerRatingService(repository as unknown as PlayerRatingInputRepository)
            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings

            ratingService.buildPlayerRatings = (receivedTarget: PitchEnvironmentTarget, playerInput: any) => {
                receivedTargets.push(receivedTarget)
                return buildRatings(playerInput.value)
            }

            try {
                await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1"]))

                assert.equal(receivedTargets.length, 5)

                for (const receivedTarget of receivedTargets) {
                    assert.equal(receivedTarget, pitchEnvironment)
                }
            } finally {
                ratingService.buildPlayerRatings = originalBuildPlayerRatings
            }
        })

        it("omits a filtered player without a career input", async function () {
            let lastAppearancesCalled = false
            let dateRangeCalls = 0

            const repository = {
                getPlayerIdsForSeason: () => new Set(["1"]),
                getCareer: () => new Map<string, PlayerRatingInput>(),
                getLastAppearances: () => {
                    lastAppearancesCalled = true
                    return new Map<string, PlayerRatingInput>()
                },
                getForDateRange: () => {
                    dateRangeCalls++
                    return new Map<string, PlayerRatingInput>()
                }
            }

            const service = new PlayerRatingService(repository as unknown as PlayerRatingInputRepository)
            const ratings = await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1"]))

            assert.equal(ratings.has("1"), false)
            assert.equal(lastAppearancesCalled, true)
            assert.equal(dateRangeCalls, 3)
        })

        it("clears a season state and rebuilds it on the next request", async function () {
            let careerCalls = 0

            const repository = {
                getPlayerIdsForSeason: () => new Set(["1"]),
                getCareer: () => {
                    careerCalls++
                    return new Map([["1", buildImport("1", 100, 100)]])
                },
                getLastAppearances: () => new Map([["1", buildImport("1", 100, 100)]]),
                getForDateRange: () => new Map([["1", buildImport("1", 100, 100)]])
            }

            const service = new PlayerRatingService(repository as unknown as PlayerRatingInputRepository)
            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings
            ratingService.buildPlayerRatings = (_pitchEnvironment: PitchEnvironmentTarget, playerInput: any) => buildRatings(playerInput.value)

            try {
                await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1"]))
                service.clearCache(2026)
                await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1"]))

                assert.equal(careerCalls, 2)
            } finally {
                ratingService.buildPlayerRatings = originalBuildPlayerRatings
            }
        })

        it("resets the season state when a request moves backward", async function () {
            const careerDates: string[] = []

            const repository = {
                getPlayerIdsForSeason: () => new Set(["1"]),
                getCareer: (endDateExclusive: string) => {
                    careerDates.push(endDateExclusive)
                    return new Map([["1", buildImport("1", 100, 100)]])
                },
                getLastAppearances: () => new Map([["1", buildImport("1", 100, 100)]]),
                getForDateRange: () => new Map([["1", buildImport("1", 100, 100)]])
            }

            const service = new PlayerRatingService(repository as unknown as PlayerRatingInputRepository)
            const ratingService = PlayerRatingService as any
            const originalBuildPlayerRatings = ratingService.buildPlayerRatings
            ratingService.buildPlayerRatings = (_pitchEnvironment: PitchEnvironmentTarget, playerInput: any) => buildRatings(playerInput.value)

            try {
                await service.buildPlayerRatingsForDate(2026, "2026-07-21", pitchEnvironment, new Set(["1"]))
                await service.buildPlayerRatingsForDate(2026, "2026-07-20", pitchEnvironment, new Set(["1"]))

                assert.deepEqual(careerDates, ["2026-07-21", "2026-07-20"])
            } finally {
                ratingService.buildPlayerRatings = originalBuildPlayerRatings
            }
        })
    })
}

if (toRun.includes(DiagnosticTest.PLAYER_RATING_DIAGNOSTICS)) {
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

        it("should compare season-generated real player ratings against real life", function () {
            const diagnostics = diagnosticPlayers.map(player => RatingTestHarness.getRealPlayerDiagnostic(player.name))
            const hitterDiagnostics = diagnostics.filter(diagnostic => diagnostic.hitter)
            const pitcherDiagnostics = diagnostics.filter(diagnostic => diagnostic.pitcher)

            assert.equal(diagnostics.length, diagnosticPlayers.length)
            assert.equal(hitterDiagnostics.length, 5)
            assert.equal(pitcherDiagnostics.length, 5)

            RatingTestHarness.printTable("[REAL PLAYER HITTER RATINGS]", hitterDiagnostics.map(diagnostic => ({
                player: diagnostic.name,
                playerId: diagnostic.player.playerId,
                ...RatingTestHarness.formatHitterRatingsForTable(diagnostic.ratings)
            })))

            RatingTestHarness.printTable("[REAL PLAYER PITCHER RATINGS]", pitcherDiagnostics.map(diagnostic => ({
                player: diagnostic.name,
                playerId: diagnostic.player.playerId,
                ...RatingTestHarness.formatPitcherRatingsForTable(diagnostic.ratings)
            })))

            RatingTestHarness.printTable("[REAL PLAYER HITTER SIM VS REAL]", hitterDiagnostics.flatMap(diagnostic => [
                {
                    player: diagnostic.name,
                    row: "SIM",
                    ...RatingTestHarness.formatActualForTable(diagnostic.hitter.actual)
                },
                {
                    player: diagnostic.name,
                    row: "REAL",
                    ...RatingTestHarness.formatActualForTable(diagnostic.hitter.target)
                },
                {
                    player: diagnostic.name,
                    row: "DIFF",
                    ...RatingTestHarness.formatDiffForTable(diagnostic.hitter.actual, diagnostic.hitter.target)
                }
            ]))

            RatingTestHarness.printTable("[REAL PLAYER PITCHER SIM VS REAL]", pitcherDiagnostics.flatMap(diagnostic => [
                {
                    player: diagnostic.name,
                    row: "SIM",
                    ...RatingTestHarness.formatActualForTable(diagnostic.pitcher.actual)
                },
                {
                    player: diagnostic.name,
                    row: "REAL",
                    ...RatingTestHarness.formatActualForTable(diagnostic.pitcher.target)
                },
                {
                    player: diagnostic.name,
                    row: "DIFF",
                    ...RatingTestHarness.formatDiffForTable(diagnostic.pitcher.actual, diagnostic.pitcher.target)
                }
            ]))
        })
    })
}

if (toRun.includes(DiagnosticTest.AARON_JUDGE)) {
    describe("Aaron Judge Probability Breakdown", function () {

        it("should show where Aaron Judge loses batting average", function () {
            const breakdown = RatingTestHarness.getAaronJudgeProbabilityRows()

            RatingTestHarness.printTable("[AARON JUDGE RATINGS]", breakdown.ratings)
            RatingTestHarness.printTable("[AARON JUDGE RATING CHANGES]", breakdown.changes)
            RatingTestHarness.printTable("[AARON JUDGE FAIR-CONTACT POWER CHART]", breakdown.powerChart)
            RatingTestHarness.printTable("[AARON JUDGE SIM VS REAL]", breakdown.results)

            const judgeRight = breakdown.powerChart.find(row => row.player === "Aaron Judge vs RHP")
            const averageRight = breakdown.powerChart.find(row => row.player === "Average hitter vs RHP")
            const sim = breakdown.results.find(row => row.row === "SIM")
            const real = breakdown.results.find(row => row.row === "REAL")

            assert.ok(judgeRight)
            assert.ok(averageRight)
            assert.ok(sim)
            assert.ok(real)
            assert.ok(judgeRight.chartBabip > averageRight.chartBabip)
            assert.ok(Number(sim.avg) < Number(real.avg))
            assert.ok(Number(sim.babip) < Number(real.babip))
        })
    })
}



