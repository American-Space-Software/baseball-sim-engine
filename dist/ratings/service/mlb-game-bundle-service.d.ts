import type { PitchEnvironmentTarget, StadiumEnvironment } from "../../sim/service/interfaces.js";
import { BaseballSavantService } from "./baseball-savant-service.js";
import { GameLineupService } from "./game-lineup-service.js";
import type { TeamBundle } from "./game-lineup-service.js";
import { MlbRosterService } from "./mlb-roster-service.js";
import { PitchEnvironmentTargetService } from "./pitch-environment-target-service.js";
import { PlayerRatingService } from "./player-rating-service.js";
import { PlayerStatService } from "./player-stat-service.js";
import { TeamRatingService } from "./team-rating-service.js";
import type { TeamRating } from "../repository/team-rating-repository.js";
declare class MlbGameBundleService {
    private readonly mlbRosterService;
    private readonly gameLineupService;
    private readonly playerRatingService;
    private readonly pitchEnvironmentTargetService;
    private readonly playerStatService;
    private readonly baseballSavantService;
    private readonly teamRatingService;
    constructor(mlbRosterService: MlbRosterService, gameLineupService: GameLineupService, playerRatingService: PlayerRatingService, pitchEnvironmentTargetService: PitchEnvironmentTargetService, playerStatService: PlayerStatService, baseballSavantService: BaseballSavantService, teamRatingService: TeamRatingService);
    build(gameDate: string): Promise<MlbDailyBundle>;
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
interface MlbGameBundle {
    gamePk: number;
    away: MlbTeamBundle;
    home: MlbTeamBundle;
    homeFieldAdvantage: number;
}
interface MlbDailyBundle {
    date: string;
    pitchEnvironmentTarget: PitchEnvironmentTarget;
    stadiumEnvironments: StadiumEnvironment[];
    games: MlbGameBundle[];
}
export { MlbGameBundleService };
export type { MlbDailyBundle, MlbGameBundle, MlbHittingStats, MlbPitchingStats, MlbPlayerStats, MlbTeamBundle };
