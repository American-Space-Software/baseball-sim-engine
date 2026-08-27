import type { PitchEnvironmentTarget } from "../../sim/service/interfaces.js";
import { GameLineupService } from "./game-lineup-service.js";
import type { TeamBundle } from "./game-lineup-service.js";
import { MlbRosterService } from "./mlb-roster-service.js";
import { PitchEnvironmentTargetService } from "./pitch-environment-target-service.js";
import { PlayerRatingService } from "./player-rating-service.js";
import { PlayerStatService } from "./player-stat-service.js";
declare class MlbGameBundleService {
    private readonly mlbRosterService;
    private readonly gameLineupService;
    private readonly playerRatingService;
    private readonly pitchEnvironmentTargetService;
    private readonly playerStatService;
    constructor(mlbRosterService: MlbRosterService, gameLineupService: GameLineupService, playerRatingService: PlayerRatingService, pitchEnvironmentTargetService: PitchEnvironmentTargetService, playerStatService: PlayerStatService);
    build(gameDate: string): Promise<MlbDailyBundle>;
    private getGameRoster;
    private addPlayerStats;
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
}
interface MlbGameBundle {
    gamePk: number;
    away: MlbTeamBundle;
    home: MlbTeamBundle;
}
interface MlbDailyBundle {
    date: string;
    pitchEnvironmentTarget: PitchEnvironmentTarget;
    games: MlbGameBundle[];
}
export { MlbGameBundleService };
export type { MlbDailyBundle, MlbGameBundle, MlbHittingStats, MlbPitchingStats, MlbPlayerStats, MlbTeamBundle };
