import seedrandom from "seedrandom"

import {
    v4 as uuid
} from "uuid"

import {
    Game,
    StartGameCommand
} from "../../sim/service/interfaces.js"

import {
    SimService
} from "../../sim/service/sim-service.js"


interface SimOptions {
    gameId?: string
    seedPrefix?: string
    retainGames?: boolean
}


interface SimPlayerSummary {
    playerId: string
    name: string
    teamId: string
    teamName: string
    hittingGames: number
    pitchingGames: number
    homeRunGames: number
    hitting: Record<string, number>
    pitching: Record<string, number>
    hittingRatings: any
    pitchRatings: any
}


interface SimPartialSummary {
    simulations: number
    awayWins: number
    homeWins: number
    totalAwayScore: number
    totalHomeScore: number
    totalInnings: number
    players: SimPlayerSummary[]
}


interface SimSummary {
    gameId: string
    simulations: number
    awayTeamId: string
    homeTeamId: string
    awayWins: number
    homeWins: number
    awayWinPercent: number
    homeWinPercent: number
    averageAwayScore: number
    averageHomeScore: number
    averageInnings: number
    players: SimPlayerSummary[]
}


interface SimPartialResult {
    summary: SimPartialSummary
    games?: Game[]
}


interface SimResult {
    summary: SimSummary
    games?: Game[]
}


class GameSimulationService {

    public constructor(
        private readonly simService: SimService
    ) {}

    public createGame(command: StartGameCommand): Game {
        const game = {
            _id: uuid()
        } as Game

        this.simService.initGame(game)

        const simulationCommand = structuredClone(command)

        simulationCommand.game = game
        simulationCommand.date = new Date(command.date)

        this.simService.startGame(simulationCommand)

        return game
    }

    public simulate(command: StartGameCommand, seed: string): Game {
        const game = this.createGame(command)
        const rng = seedrandom(seed)

        let steps = 0

        while (!game.isComplete && steps < 10000) {
            this.simService.simPitch(game, rng)
            steps++
        }

        if (!game.isComplete) {
            throw new Error(`Game ${game._id} did not complete after ${steps} steps.`)
        }

        this.simService.finishGame(game)

        return game
    }

    public simulateMany(command: StartGameCommand, simulations: number, options: SimOptions = {}): SimResult {
        if (!Number.isInteger(simulations) || simulations <= 0) {
            throw new Error("Simulation count must be a positive integer.")
        }

        const gameId = options.gameId ?? String(command.game._id)
        const seedPrefix = options.seedPrefix ?? `game-${gameId}`
        const simulationIndexes = Array.from({ length: simulations }, (_, index) => index)

        const partialResult = this.simulateIndexes(command, simulationIndexes, {
            gameId,
            seedPrefix,
            retainGames: options.retainGames
        })

        return {
            summary: this.mergePartialSummaries(command, gameId, simulations, [partialResult.summary]),
            games: partialResult.games
        }
    }

    public simulateIndexes(command: StartGameCommand, simulationIndexes: number[], options: SimOptions = {}): SimPartialResult {
        const gameId = options.gameId ?? String(command.game._id)
        const seedPrefix = options.seedPrefix ?? `game-${gameId}`
        const summary = this.createPartialSummary()
        const games: Game[] | undefined = options.retainGames ? [] : undefined

        for (const simulationIndex of simulationIndexes) {
            if (!Number.isInteger(simulationIndex) || simulationIndex < 0) {
                throw new Error(`Invalid simulation index: ${simulationIndex}.`)
            }

            const game = this.simulate(command, `${seedPrefix}-${simulationIndex}`)

            this.accumulateGame(summary, game)

            if (games) {
                games.push(game)
            }
        }

        return {
            summary,
            games
        }
    }

    public createPartialSummary(): SimPartialSummary {
        return {
            simulations: 0,
            awayWins: 0,
            homeWins: 0,
            totalAwayScore: 0,
            totalHomeScore: 0,
            totalInnings: 0,
            players: []
        }
    }

    public accumulateGame(summary: SimPartialSummary, game: Game): void {
        summary.simulations++
        summary.totalAwayScore += game.score.away
        summary.totalHomeScore += game.score.home
        summary.totalInnings += game.currentInning

        if (game.score.away > game.score.home) {
            summary.awayWins++
        } else {
            summary.homeWins++
        }

        const playerSummaries = new Map(
            summary.players.map(player => [
                player.playerId,
                player
            ])
        )

        this.accumulateTeamPlayers(playerSummaries, game.away)
        this.accumulateTeamPlayers(playerSummaries, game.home)

        summary.players = Array.from(playerSummaries.values())
    }

    public mergePartialSummaries(command: StartGameCommand, gameId: string, simulations: number, partialSummaries: SimPartialSummary[]): SimSummary {
        const merged = this.createPartialSummary()
        const playerSummaries = new Map<string, SimPlayerSummary>()

        for (const partialSummary of partialSummaries) {
            merged.simulations += partialSummary.simulations
            merged.awayWins += partialSummary.awayWins
            merged.homeWins += partialSummary.homeWins
            merged.totalAwayScore += partialSummary.totalAwayScore
            merged.totalHomeScore += partialSummary.totalHomeScore
            merged.totalInnings += partialSummary.totalInnings

            for (const player of partialSummary.players) {
                const existing = playerSummaries.get(player.playerId)

                if (!existing) {
                    playerSummaries.set(player.playerId, structuredClone(player))
                    continue
                }

                this.mergePlayerSummary(existing, player)
            }
        }

        if (merged.simulations !== simulations) {
            throw new Error(`Expected ${simulations} simulations for game ${gameId}, but received ${merged.simulations}.`)
        }

        return {
            gameId,
            simulations,
            awayTeamId: String(command.away._id),
            homeTeamId: String(command.home._id),
            awayWins: merged.awayWins,
            homeWins: merged.homeWins,
            awayWinPercent: merged.awayWins / simulations,
            homeWinPercent: merged.homeWins / simulations,
            averageAwayScore: merged.totalAwayScore / simulations,
            averageHomeScore: merged.totalHomeScore / simulations,
            averageInnings: merged.totalInnings / simulations,
            players: Array.from(playerSummaries.values())
        }
    }

    private accumulateTeamPlayers(playerSummaries: Map<string, SimPlayerSummary>, team: any): void {
        for (const player of team.players ?? []) {
            const summary = this.getOrCreatePlayerSummary(playerSummaries, player, team)
            const plateAppearances = Number(player.hitResult?.pa ?? 0)
            const homeRuns = Number(player.hitResult?.homeRuns ?? player.hitResult?.hr ?? 0)
            const pitchesThrown = Number(player.pitchResult?.pitches ?? 0)
            const battersFaced = Number(player.pitchResult?.battersFaced ?? 0)

            if (plateAppearances > 0) {
                summary.hittingGames++
            }

            if (Number.isFinite(homeRuns) && homeRuns > 0) {
                summary.homeRunGames++
            }

            if (pitchesThrown > 0 || battersFaced > 0) {
                summary.pitchingGames++
            }

            this.mergeNumericResults(summary.hitting, player.hitResult)
            this.mergeNumericResults(summary.pitching, player.pitchResult)
        }
    }

    private getOrCreatePlayerSummary(playerSummaries: Map<string, SimPlayerSummary>, player: any, team: any): SimPlayerSummary {
        const playerId = String(player._id)
        const existing = playerSummaries.get(playerId)

        if (existing) {
            return existing
        }

        const fallbackName = `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim()
        const name = player.displayName ?? player.fullName ?? fallbackName

        const created: SimPlayerSummary = {
            playerId,
            name: String(name || playerId),
            teamId: String(team._id),
            teamName: String(team.name ?? team.abbrev ?? team._id),
            hittingGames: 0,
            pitchingGames: 0,
            homeRunGames: 0,
            hitting: {},
            pitching: {},
            hittingRatings: structuredClone(player.hittingRatings ?? {}),
            pitchRatings: structuredClone(player.pitchRatings ?? {})
        }

        playerSummaries.set(playerId, created)

        return created
    }

    private mergePlayerSummary(target: SimPlayerSummary, source: SimPlayerSummary): void {
        target.hittingGames += source.hittingGames
        target.pitchingGames += source.pitchingGames
        target.homeRunGames += source.homeRunGames

        this.mergeNumericResults(target.hitting, source.hitting)
        this.mergeNumericResults(target.pitching, source.pitching)

        if (!target.hittingRatings || Object.keys(target.hittingRatings).length === 0) {
            target.hittingRatings = structuredClone(source.hittingRatings ?? {})
        }

        if (!target.pitchRatings || Object.keys(target.pitchRatings).length === 0) {
            target.pitchRatings = structuredClone(source.pitchRatings ?? {})
        }
    }

    private mergeNumericResults(target: Record<string, number>, source: unknown): void {
        if (!source || typeof source !== "object") {
            return
        }

        for (const [key, value] of Object.entries(source)) {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                continue
            }

            target[key] = (target[key] ?? 0) + value
        }
    }

}


export {
    GameSimulationService
}


export type {
    SimOptions,
    SimPartialResult,
    SimPartialSummary,
    SimPlayerSummary,
    SimResult,
    SimSummary
}