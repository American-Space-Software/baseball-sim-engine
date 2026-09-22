import { PlayerRatingsRepository } from "../repository/player-ratings-repository.js";
import { MlbRosterService } from "./mlb-roster-service.js";
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
    private readonly mlbRosterService;
    constructor(playerRatingsRepository: PlayerRatingsRepository, mlbRosterService: MlbRosterService);
    build(gameDate: string): Promise<MlbPlayerPool>;
}
export { MlbPlayerPoolService };
export type { MlbPlayerPool, MlbPlayerPoolPlayer };
