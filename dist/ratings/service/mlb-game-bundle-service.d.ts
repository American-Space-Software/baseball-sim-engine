import type { PitchEnvironmentTarget, StadiumEnvironment } from "../../sim/service/interfaces.js";
import { BaseballSavantService } from "./baseball-savant-service.js";
import { GameLineupService } from "./game-lineup-service.js";
import type { TeamBundle } from "./game-lineup-service.js";
import { MlbRosterService } from "./mlb-roster-service.js";
import { PlayerRatingService } from "./player-rating-service.js";
import { PlayerStatService } from "./player-stat-service.js";
import { TeamRatingService } from "./team-rating-service.js";
import type { TeamRating } from "../repository/team-rating-repository.js";
declare class MlbGameBundleService {
    private readonly mlbRosterService;
    private readonly gameLineupService;
    private readonly playerRatingService;
    private readonly playerStatService;
    private readonly baseballSavantService;
    private readonly teamRatingService;
    private readonly baseDataDir;
    constructor(mlbRosterService: MlbRosterService, gameLineupService: GameLineupService, playerRatingService: PlayerRatingService, playerStatService: PlayerStatService, baseballSavantService: BaseballSavantService, teamRatingService: TeamRatingService, baseDataDir?: string);
    build(gameDate: string): Promise<MlbDailyBundle>;
    private getPitchEnvironmentTarget;
    private getGameRoster;
    private addPlayerStats;
    private addTeamRating;
    private getHomeFieldAdvantage;
    private buildPlayerStats;
    private getWhip;
    private getRosterKey;
    private getTeam;
    private validateGameDate;
}
interface MlbHittingStats {
    avg: number;
    obp: number;
    slg: number;
    ops: number;
}
interface MlbPitchingStats {
    era: number;
    whip: number;
    soPercent: number;
    bbPercent: number;
}
interface MlbPlayerStats {
    playerId: string;
    hitting: MlbHittingStats;
    pitching: MlbPitchingStats;
}
interface MlbTeamBundle extends TeamBundle {
    playerStats: MlbPlayerStats[];
    teamRating?: TeamRating;
}
interface MlbGameScore {
    away: number;
    home: number;
}
interface MlbGameStatus {
    abstractGameState: string;
    detailedState: string;
    currentInning?: number;
    inningState?: string;
}
interface MlbGameBundle {
    gamePk: number;
    date: string;
    gameDate: string;
    away: MlbTeamBundle;
    home: MlbTeamBundle;
    score?: MlbGameScore;
    status: MlbGameStatus;
    homeFieldAdvantage: number;
}
interface MlbDailyBundle {
    date: string;
    pitchEnvironmentTarget: PitchEnvironmentTarget;
    stadiumEnvironments: StadiumEnvironment[];
    games: MlbGameBundle[];
}
export { MlbGameBundleService };
export type { MlbDailyBundle, MlbGameBundle, MlbGameScore, MlbGameStatus, MlbHittingStats, MlbPitchingStats, MlbPlayerStats, MlbTeamBundle };
