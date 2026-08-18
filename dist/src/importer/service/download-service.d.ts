import { PlayerRatingInputRepository } from "../../ratings/repository/player-rating-input-repository.js";
import { PlayerRatingSeasonInputRepository } from "../../ratings/repository/player-rating-season-input-repository.js";
import { PlayerStatRepository } from "../../ratings/repository/player-stat-repository.js";
import { SchemaService } from "./schema-service.js";
declare class DownloadService {
    private readonly schemaService;
    private readonly playerRatingInputRepository;
    private readonly playerRatingSeasonInputRepository;
    private readonly playerStatRepository;
    private readonly firstRatingSeason;
    constructor(schemaService: SchemaService, playerRatingInputRepository: PlayerRatingInputRepository, playerRatingSeasonInputRepository: PlayerRatingSeasonInputRepository, playerStatRepository: PlayerStatRepository);
    syncSeason(season: number, force?: boolean): Promise<Set<number>>;
    syncRatingHistory(endSeason: number, force?: boolean): Promise<Map<number, Set<number>>>;
    rebuildRatingSeason(season: number): Promise<Set<number>>;
    rebuildRatingHistory(endSeason: number): Promise<Map<number, Set<number>>>;
    private rebuildPreparedSeason;
    private isRatingSeasonComplete;
    private isCompletedScheduleGame;
    private prepare;
    private validateSeason;
    private validateEndSeason;
}
export { DownloadService };
