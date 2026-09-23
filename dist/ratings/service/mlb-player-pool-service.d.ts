import { PlayerRatingsRepository } from "../repository/player-ratings-repository.js";
import { MlbRosterService } from "./mlb-roster-service.js";
import { PlayerRatingService } from "./player-rating-service.js";
import type { PlayerRatingsRow } from "../repository/player-ratings-repository.js";
import type { MlbTeam } from "./mlb-roster-service.js";
interface MlbPlayerPoolPlayer extends PlayerRatingsRow {
    team?: MlbTeam;
}
interface MlbPlayerPool {
    date: string;
    players: MlbPlayerPoolPlayer[];
}
declare class MlbPlayerPoolService {
    private readonly playerRatingsRepository;
    private readonly playerRatingService;
    private readonly mlbRosterService;
    private readonly baseDataDir;
    constructor(playerRatingsRepository: PlayerRatingsRepository, playerRatingService: PlayerRatingService, mlbRosterService: MlbRosterService, baseDataDir?: string);
    build(gameDate: string): Promise<MlbPlayerPool>;
    private getPitchEnvironmentTarget;
}
export { MlbPlayerPoolService };
export type { MlbPlayerPool, MlbPlayerPoolPlayer };
