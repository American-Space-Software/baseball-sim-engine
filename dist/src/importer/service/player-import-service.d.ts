import type { PlayerImportRaw } from "../../sim/service/interfaces.js";
import { StatAccumulatorService } from "./stat-accumulator-service.js";
declare class PlayerImportService {
    private readonly baseDataDir;
    private readonly statAccumulatorService;
    private readonly importCache;
    private readonly appearanceIndexes;
    private readonly gameFeeds;
    constructor(baseDataDir: string, statAccumulatorService: StatAccumulatorService);
    buildSeasonPlayerImports(season: number, filterPlayerIds?: Set<string>, forceFullReimport?: boolean): Promise<Map<string, PlayerImportRaw>>;
    buildSeasonPlayerImportRaw(season: number, playerId: string, forceFullReimport?: boolean): Promise<PlayerImportRaw | undefined>;
    buildCorePlayerImports(season: number, gameDate: string, filterPlayerIds?: Set<string>, forceFullReimport?: boolean): Promise<Map<string, PlayerImportRaw>>;
    buildDateRangePlayerImports(season: number, startDate: string, endDateExclusive: string, filterPlayerIds?: Set<string>, forceFullReimport?: boolean): Promise<Map<string, PlayerImportRaw>>;
    getAppearanceCountsBeforeDate(season: number, gameDate: string, filterPlayerIds?: Set<string>): Promise<Map<string, number>>;
    buildFromGameFeeds(season: number, gameFeeds: PlayerImportGameFeed[]): Map<string, PlayerImportRaw>;
    clearCache(season?: number): void;
    private buildFromSelectedGames;
    private getAppearanceIndex;
    private buildAppearanceIndex;
    private getSeasonScheduleGames;
    private getGameFeed;
    private resolvePlayerIds;
    private addSelectedGamePlayer;
    private accumulateGame;
    private finalizePlayers;
    private finalizePlayer;
    private getParticipatingPlayerIds;
    private isCompletedScheduleGame;
    private isGameComplete;
    private normalizePlayerIds;
    private samePlayerIds;
    private getCacheKey;
    private getGameKey;
    private getResultsFilePath;
    private readResultsFile;
    private writeResultsFile;
    private resultsFileToPlayerMap;
    private clonePlayerImportMap;
    private validateIsoDate;
    private isCurrentSeason;
    private getTomorrowUtcDate;
    private fileExists;
}
interface PlayerImportGameFeed {
    sourceSeason: number;
    gamePk: number;
    data: any;
    playerIds: string[];
}
interface PlayerGameReference {
    sourceSeason: number;
    gamePk: number;
    gameDate: string;
}
interface PlayerAppearanceIndex {
    season: number;
    appearancesByPlayerId: Map<string, PlayerGameReference[]>;
}
export { PlayerImportService };
export type { PlayerImportGameFeed, PlayerGameReference, PlayerAppearanceIndex };
