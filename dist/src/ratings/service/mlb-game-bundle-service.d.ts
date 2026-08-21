import type { PitchEnvironmentTarget } from "../../sim/service/interfaces.js";
import { GameLineupService } from "./game-lineup-service.js";
import type { TeamBundle } from "./game-lineup-service.js";
import { MlbRosterService } from "./mlb-roster-service.js";
import { PitchEnvironmentTargetService } from "./pitch-environment-target-service.js";
import { PlayerRatingService } from "./player-rating-service.js";
declare class MlbGameBundleService {
    private readonly mlbRosterService;
    private readonly gameLineupService;
    private readonly playerRatingService;
    private readonly pitchEnvironmentTargetService;
    constructor(mlbRosterService: MlbRosterService, gameLineupService: GameLineupService, playerRatingService: PlayerRatingService, pitchEnvironmentTargetService: PitchEnvironmentTargetService);
    build(gameDate: string): Promise<MlbDailyBundle>;
    private getGameRoster;
    private getRosterKey;
    private getTeam;
    private validateGameDate;
}
interface MlbGameBundle {
    gamePk: number;
    away: TeamBundle;
    home: TeamBundle;
}
interface MlbDailyBundle {
    date: string;
    pitchEnvironmentTarget: PitchEnvironmentTarget;
    games: MlbGameBundle[];
}
export { MlbGameBundleService };
export type { MlbDailyBundle, MlbGameBundle };
