import { Game, StartGameCommand } from "../../sim/service/interfaces.js";
import { SimService } from "../../sim/service/sim-service.js";
interface SimOptions {
    gameId?: string;
    seedPrefix?: string;
    retainGames?: boolean;
}
interface SimPlayerSummary {
    playerId: string;
    name: string;
    teamId: string;
    teamName: string;
    hittingGames: number;
    pitchingGames: number;
    homeRunGames: number;
    hitting: Record<string, number>;
    pitching: Record<string, number>;
    hittingRatings: any;
    pitchRatings: any;
}
interface SimPartialSummary {
    simulations: number;
    awayWins: number;
    homeWins: number;
    totalAwayScore: number;
    totalHomeScore: number;
    totalInnings: number;
    players: SimPlayerSummary[];
}
interface SimSummary {
    gameId: string;
    simulations: number;
    awayTeamId: string;
    homeTeamId: string;
    awayWins: number;
    homeWins: number;
    awayWinPercent: number;
    homeWinPercent: number;
    averageAwayScore: number;
    averageHomeScore: number;
    averageInnings: number;
    players: SimPlayerSummary[];
}
interface SimPartialResult {
    summary: SimPartialSummary;
    games?: Game[];
}
interface SimResult {
    summary: SimSummary;
    games?: Game[];
}
declare class GameSimulationService {
    private readonly simService;
    constructor(simService: SimService);
    createGame(command: StartGameCommand): Game;
    simulate(command: StartGameCommand, seed: string): Game;
    simulateMany(command: StartGameCommand, simulations: number, options?: SimOptions): SimResult;
    simulateIndexes(command: StartGameCommand, simulationIndexes: number[], options?: SimOptions): SimPartialResult;
    createPartialSummary(): SimPartialSummary;
    accumulateGame(summary: SimPartialSummary, game: Game): void;
    mergePartialSummaries(command: StartGameCommand, gameId: string, simulations: number, partialSummaries: SimPartialSummary[]): SimSummary;
    private accumulateTeamPlayers;
    private getOrCreatePlayerSummary;
    private mergePlayerSummary;
    private mergeNumericResults;
}
export { GameSimulationService };
export type { SimOptions, SimPartialResult, SimPartialSummary, SimPlayerSummary, SimResult, SimSummary };
