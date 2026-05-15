import { HomeAway, Position, Handedness, SwingResult, PlayResult, Contact, ShallowDeep, OfficialPlayResult, BaseResult, OfficialRunnerResult, PitchZone } from "./enums.js";
import { StartGameCommand, GamePlayer, MatchupHandedness, RunnerResult, DefensiveCredit, HalfInning, RunnerEvent, HitterChange, PitcherChange, SimPitchCommand, SimPitchResult, Game, HittingRatings, Lineup, PitchCount, PitchRatings, Play, Player, RotationPitcher, RunnerThrowCommand, Team, TeamInfo, ThrowRoll, PitchEnvironmentTarget, ContactQuality, PitchQuality } from "./interfaces.js";
import { RollChartService } from "./roll-chart-service.js";
declare class SimService {
    private rollChartService;
    private gameRolls;
    private runnerActions;
    private gameInfo;
    private defaultPitchEnvironmentTarget;
    constructor(rollChartService: RollChartService, gameRolls: SimRolls, runnerActions: RunnerActions, gameInfo: GameInfo, defaultPitchEnvironmentTarget: PitchEnvironmentTarget);
    initGame(game: Game): void;
    startGame(command: StartGameCommand): Game;
    finishGame(game: Game): void;
    simPitch(game: Game, rng: any): void;
    private createPlay;
    private createSimPitchCommand;
    private simPitchRolls;
    private getPitchAnomalyResult;
    private finishPlay;
    private validateNextHitterIsNotOnBase;
    private getOutcomeModelForContactQuality;
    private applyDefenseToOutcomeModel;
    private getPlayResultFromOutcomeModel;
    private getFielderWeights;
    private weightedPickPosition;
    private getShallowDeepFromY;
    private pickFielderFromLocation;
    private getOfficialPlayResult;
    private getUpcomingMatchup;
}
declare class Matchup {
    static getMatchupHandedness(hitter: GamePlayer, pitcher: GamePlayer): MatchupHandedness;
}
declare class RunnerActions {
    private rollChartService;
    private gameRolls;
    constructor(rollChartService: RollChartService, gameRolls: SimRolls);
    static clearRunners(team: TeamInfo): void;
    static getTotalOuts(runnerEvents: RunnerEvent[]): number;
    static validateInningOver(allEvents: RunnerEvent[]): boolean;
    static getThrowCount(runnerEvents: RunnerEvent[]): number;
    static filterNonEvents(runnerEvents: RunnerEvent[], hitter: GamePlayer): RunnerEvent[];
    initRunnerEvents(pitcher: GamePlayer, hitter: GamePlayer, runner1B: GamePlayer, runner2B: GamePlayer, runner3B: GamePlayer, pitchIndex: number): RunnerEvent[];
    isRunUnearned(inningRunnerEvents: RunnerEvent[], runnerEvent: RunnerEvent): boolean;
    runnerIsOut(runnerResult: RunnerResult, allEvents: RunnerEvent[], defensiveCredits: DefensiveCredit[], fielderPlayer: GamePlayer, runnerEvent: RunnerEvent, outNumber: number, outBase: BaseResult): void;
    runnerToBase(runnerResult: RunnerResult, runnerEvent: RunnerEvent, start: BaseResult, end: BaseResult, eventType: PlayResult | OfficialRunnerResult, isForce: boolean): void;
    runnerOutAtBase(runnerEvent: RunnerEvent, end: BaseResult, isForce: boolean, isFieldersChoice: boolean, defense: TeamInfo, throwFrom: GamePlayer, outs: number): void;
    runnersTagWithThrow(gameRNG: () => number, runnerResult: RunnerResult, pitchEnvironmentTarget: PitchEnvironmentTarget, allEvents: RunnerEvent[], runnerEvents: RunnerEvent[], defensiveCredits: DefensiveCredit[], defense: TeamInfo, offense: TeamInfo, pitcher: GamePlayer, fielderPlayer: GamePlayer, runner1bRA: RunnerEvent, runner2bRA: RunnerEvent, runner3bRA: RunnerEvent, chanceRunnerSafe: number, pitchIndex: number): void;
    runnerToBaseWithThrow(command: RunnerThrowCommand): void;
    advanceRunnersOneBase(runnerResult: RunnerResult, events: RunnerEvent[], isForce: boolean): void;
    advanceOtherRunnersOneBase(runnerResult: RunnerResult, events: RunnerEvent[], runner: RunnerEvent, isForce: boolean): void;
    getPositionCoveringBase(throwFromPosition: Position, throwToBase: BaseResult): Position.CATCHER | Position.FIRST_BASE | Position.SECOND_BASE | Position.THIRD_BASE | Position.SHORTSTOP;
    stealBases(runner1B: GamePlayer, runner2B: GamePlayer, runner3B: GamePlayer, gameRNG: () => number, runnerResult: RunnerResult, allEvents: RunnerEvent[], runnerEvents: RunnerEvent[], defensiveCredits: DefensiveCredit[], pitchEnvironmentTarget: PitchEnvironmentTarget, catcher: GamePlayer, defense: TeamInfo, offense: TeamInfo, pitcher: GamePlayer, pitchIndex: number, pitchCount: PitchCount): void;
    private getStealSettingsForState;
    getStolenBaseSafe(pitchEnvironmentTarget: PitchEnvironmentTarget, armRating: number, runnerSpeed: number, runnerSteals: number, defaultSuccess: number): any;
    getChanceRunnerSafe(pitchEnvironmentTarget: PitchEnvironmentTarget, armRating: number, runnerSpeed: number, defaultSuccess: number): any;
    getRunnerEvents(gameRNG: () => number, runnerResult: RunnerResult, halfInningRunnerEvents: RunnerEvent[], defensiveCredits: DefensiveCredit[], pitchEnvironmentTarget: PitchEnvironmentTarget, playResult: PlayResult, contact: Contact | undefined, shallowDeep: ShallowDeep | undefined, hitter: GamePlayer, fielderPlayer: GamePlayer | undefined, runner1B: GamePlayer | undefined, runner2B: GamePlayer | undefined, runner3B: GamePlayer | undefined, offense: TeamInfo, defense: TeamInfo, pitcher: GamePlayer, pitchIndex: number): RunnerEvent[];
    generateRunnerEventsFromPitch(command: SimPitchCommand, pitchIndex: number, result: SimPitchResult): void;
    validateRunners(firstId: string, secondId: string, thirdId: string): void;
    validateRunnerResult(runnerResult: RunnerResult): void;
    applyMinMaxToNumber(num: any, min: any, max: any): any;
}
declare class SimRolls {
    private rollChartService;
    constructor(rollChartService: RollChartService);
    getIntentZone(rng: () => number): PitchZone;
    getHitQuality(gameRNG: () => number, pitchEnvironmentTarget: PitchEnvironmentTarget, pitchQualityChange: number, guessPitch: boolean, contact: Contact): ContactQuality;
    getSwingResult(gameRNG: () => number, hitterChange: HitterChange, pitchEnvironmentTarget: PitchEnvironmentTarget, inZone: boolean, pitchQuality: number, guessPitch: boolean, pitchCount: PitchCount): SwingResult;
    isInZone(gameRNG: () => number, locationQuality: number, inZoneRate: number): boolean;
    getFielder(gameRNG: () => number, pitchEnvironmentTarget: PitchEnvironmentTarget, hitterHandedness: Handedness): Position;
    getShallowDeep(gameRNG: any, pitchEnvironmentTarget: PitchEnvironmentTarget): ShallowDeep;
    getThrowResult(gameRNG: () => number, overallSafeChance: number): ThrowRoll;
    getStealResult(gameRNG: () => number): number;
    getPitchQuality(gameRNG: () => number, pitcherChange: PitcherChange, pitchEnvironmentTarget: PitchEnvironmentTarget): PitchQuality;
}
declare class GamePlayers {
    private rollChartService;
    constructor(rollChartService: RollChartService);
    initGamePlayers(pitchEnvironmentTarget: PitchEnvironmentTarget, players: Player[], startingPitcher: RotationPitcher, teamId: string, color1: string, color2: string, startingId: number): GamePlayer[];
    getGamePlayer(game: Game, playerId: string): GamePlayer;
}
declare class GameInfo {
    private gamePlayers;
    constructor(gamePlayers: GamePlayers);
    static initHalfInning(num: number, top: boolean): HalfInning;
    static getOffense(game: Game): TeamInfo;
    static getDefense(game: Game): TeamInfo;
    static isGameOver(game: Game): boolean;
    static getTeamDefense(teamInfo: TeamInfo): number;
    static getPlays(game: Game): Play[];
    static validateGameLineup(lineup: Lineup, startingPitcher: RotationPitcher): void;
    buildTeamInfoFromTeam(pitchEnvironmentTarget: PitchEnvironmentTarget, team: Team, lineup: Lineup, players: Player[], startingPitcher: RotationPitcher, color1: string, color2: string, homeAway: HomeAway, startingId: number, teamOptions?: any): TeamInfo;
    buildTeamInfoFromPlayers(pitchEnvironmentTarget: PitchEnvironmentTarget, name: string, teamId: string, players: Player[], color1: string, color2: string, startingId: number, teamOptions?: any): TeamInfo;
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
    static weightedRandom(gameRNG: () => number, items: any, weights: any): any;
}
declare class PlayerChange {
    static getChange(a: number, b: number): number;
    static getPitcherChange(pitchRatings: PitchRatings, laRating: number, hits: Handedness): PitcherChange;
    static getHitterChange(hittingRatings: HittingRatings, laRating: number, throws: Handedness): HitterChange;
    static getClampedChange(avgRating: number, rating: number): number;
    static clamp(value: any, min: any, max: any): number;
    static applyChanges(base: number, changes: number[]): number;
    static applyChange(value: number, change: number): number;
    static applyNegativeChange(value: number, change: number): number;
}
export { SimService, PlayerChange, Rolls, AtBatInfo, SimRolls, Matchup, RunnerActions, GameInfo, GamePlayers };
