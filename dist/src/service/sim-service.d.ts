import { Contact, Handedness, OfficialPlayResult, PlayResult, Position, ShallowDeep } from "./enums.js";
import { DefensiveCredit, Game, GamePlayer, HitterChange, HittingRatings, LeagueAverage, PitcherChange, PitchRatings, Player, RotationPitcher, RunnerEvent, RunnerResult, StartGameCommand, TeamInfo, ThrowRoll, UpcomingMatchup } from "./interfaces.js";
import { RollChartService } from "./roll-chart-service.js";
declare class SimService {
    private rollChartService;
    private gameInfo;
    private gamePlayers;
    private sim;
    private simRolls;
    private runnerActions;
    private matchup;
    constructor(rollChartService: RollChartService);
    initGame(game: Game): void;
    startGame(command: StartGameCommand): Game;
    finishGame(game: Game): void;
    buildLeagueAverages(laRating: number, overrideValues?: Partial<LeagueAverage>): LeagueAverage;
    simPitch(game: Game, rng: any): void;
    buildTeamInfoFromPlayers(leagueAverage: LeagueAverage, name: string, teamId: string, players: Player[], color1: string, color2: string, startingId: number): TeamInfo;
    getThrowResult(gameRNG: any, overallSafeChance: number): ThrowRoll;
    getRunnerEvents(gameRNG: any, runnerResult: RunnerResult, halfInningRunnerEvents: RunnerEvent[], defensiveCredits: DefensiveCredit[], leagueAverages: LeagueAverage, playResult: PlayResult, contact: Contact | undefined, shallowDeep: ShallowDeep | undefined, hitter: GamePlayer, fielderPlayer: GamePlayer | undefined, runner1B: GamePlayer | undefined, runner2B: GamePlayer | undefined, runner3B: GamePlayer | undefined, offense: TeamInfo, defense: TeamInfo, pitcher: GamePlayer, pitchIndex: number): RunnerEvent[];
    getChanceRunnerSafe(leagueAverages: LeagueAverage, armRating: number, runnerSpeed: number, defaultSuccess: number): any;
    getUpcomingMatchup(game: Game): UpcomingMatchup;
    initGamePlayers(leagueAverage: LeagueAverage, players: Player[], startingPitcher: RotationPitcher, teamId: string, color1: string, color2: string, startingId: number): GamePlayer[];
}
declare class AtBatInfo {
    static isAtBat(playResult: OfficialPlayResult): boolean;
    static isInAir(contact: Contact): contact is Contact.LINE_DRIVE | Contact.FLY_BALL;
    static isToInfielder(fielder: Position): boolean;
    static isToOF(fielder: Position): boolean;
    static isHit(playResult: PlayResult): boolean;
}
declare class Rolls {
    static getRoll(generator: () => number, min: number, max: number): number;
    static getRollUnrounded(generator: () => number, min: number, max: number): number;
    static weightedRandom(gameRNG: any, items: any, weights: any): any;
}
declare class PlayerChange {
    static getChange(a: number, b: number): number;
    static getPitcherChange(pitchRatings: PitchRatings, laPitchRatings: PitchRatings, hits: Handedness): PitcherChange;
    static getHitterChange(hittingRatings: HittingRatings, laHittingRatings: HittingRatings, throws: Handedness): HitterChange;
    static getClampedChange(avgRating: number, rating: number): number;
    static clamp(value: any, min: any, max: any): number;
    static applyChanges(base: number, changes: number[]): number;
    static applyChange(value: number, change: number): number;
    static applyNegativeChange(value: number, change: number): number;
}
export { SimService, PlayerChange, Rolls, AtBatInfo };
