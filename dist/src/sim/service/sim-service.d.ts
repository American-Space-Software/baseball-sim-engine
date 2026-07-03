import { HomeAway, Position, Handedness, SwingResult, PlayResult, Contact, ShallowDeep, OfficialPlayResult, PitchZone } from "./enums.js";
import { StartGameCommand, GamePlayer, MatchupHandedness, HalfInning, UpcomingMatchup, HitterChange, PitcherChange, Game, HittingRatings, Lineup, PitchCount, PitchRatings, Play, Player, RotationPitcher, Team, TeamInfo, ThrowRoll, PitchEnvironmentTarget, ContactQuality, PitchingRole } from "./interfaces.js";
import { RollChartService } from "./roll-chart-service.js";
import { RunnerService } from "./runner-service.js";
import { SubstitutionService } from "./substitution-service.js";
declare class SimService {
    private rollChartService;
    private gameRolls;
    private runnerService;
    private gameInfo;
    private substitutionService;
    private defaultPitchEnvironmentTarget;
    constructor(rollChartService: RollChartService, gameRolls: SimRolls, runnerService: RunnerService, gameInfo: GameInfo, substitutionService: SubstitutionService, defaultPitchEnvironmentTarget: PitchEnvironmentTarget);
    initGame(game: Game): void;
    startGame(command: StartGameCommand): Game;
    finishGame(game: Game): void;
    simPitch(game: Game, rng: any): void;
    private createPlay;
    private createSimPitchCommand;
    private simPitchRolls;
    private getPitchQualityBoundedChange;
    private getPlateLocation;
    private getZoneFromPlateLocation;
    private getPitchAnomalyResult;
    private finishPlay;
    private getTunedMatchupPowerResult;
    private getMatchupContactForPlayResult;
    private getExpectedBasesForPlayResult;
    private validateNextHitterIsNotOnBase;
    private applyDefenseToPlayResult;
    private getBattedBallCatchProbability;
    private getFielderWeights;
    private weightedPickPosition;
    private getShallowDeepFromY;
    private pickFielderFromLocation;
    private getOfficialPlayResult;
    getUpcomingMatchup(game: Game): UpcomingMatchup;
    private isHitterSafeAtFirstOnNonFcGrounder;
}
declare class Matchup {
    static getMatchupHandedness(hitter: GamePlayer, pitcher: GamePlayer): MatchupHandedness;
}
declare class SimRolls {
    private rollChartService;
    constructor(rollChartService: RollChartService);
    getIntentZone(rng: () => number): PitchZone;
    getHitQuality(gameRNG: () => number, pitchEnvironmentTarget: PitchEnvironmentTarget, pitchQualityChange: number, guessPitch: boolean, contact: Contact, playResult?: PlayResult, hitterChange?: HitterChange): ContactQuality;
    getSwingResult(gameRNG: () => number, hitterChange: HitterChange, pitcherChange: PitcherChange, pitchEnvironmentTarget: PitchEnvironmentTarget, inZone: boolean, pitchQuality: number, guessPitch: boolean, pitchCount: PitchCount): SwingResult;
    isInZone(gameRNG: () => number, locationQuality: number, inZoneRate: number): boolean;
    getFielder(gameRNG: () => number, pitchEnvironmentTarget: PitchEnvironmentTarget, hitterHandedness: Handedness): Position;
    getShallowDeep(gameRNG: any, pitchEnvironmentTarget: PitchEnvironmentTarget): ShallowDeep;
    getThrowResult(gameRNG: () => number, overallSafeChance: number): ThrowRoll;
    getStealResult(gameRNG: () => number): number;
    private getPlateOutcomeChange;
    private getChaseSwingPointsPerFullDisciplineChange;
    private getContactPointsPerFullContactChange;
    private getRateStdDev;
    private getPitcherPowerContactPointsPerFullPowerChange;
    getFullRatingChange(): number;
    private getRateRange;
}
declare class GamePlayers {
    constructor();
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
    static validateGameLineup(players: Player[], lineup: Lineup, startingPitcher: RotationPitcher): void;
    buildTeamInfo(pitchEnvironmentTarget: PitchEnvironmentTarget, team: Team, lineup: Lineup, availablePitchers: PitchingRole[], players: Player[], startingPitcher: RotationPitcher, color1: string, color2: string, homeAway: HomeAway, startingId: number, teamOptions?: any): TeamInfo;
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
    static getQualityOfContactChange(hitterChange: HitterChange): number;
    static getClampedChange(avgRating: number, rating: number): number;
    static applyChanges(base: number, changes: number[]): number;
    static applyChange(value: number, change: number): number;
    static applyNegativeChange(value: number, change: number): number;
}
export { SimService, PlayerChange, Rolls, AtBatInfo, SimRolls, Matchup, GameInfo, GamePlayers };
