import type { StatExport } from "baseball-database";
import type { PlayerImportRaw } from "../../sim/service/interfaces.js";
import { StatAccumulatorService } from "./stat-accumulator-service.js";
declare class PlayerImportService {
    private readonly baseDataDir;
    private readonly statAccumulatorService;
    private readonly importCache;
    private readonly states;
    constructor(baseDataDir: string, statAccumulatorService: StatAccumulatorService);
    buildSeasonPlayerImports(season: number, filterPlayerIds?: Set<string>, forceFullReimport?: boolean): Promise<Map<string, PlayerImportRaw>>;
    buildSeasonPlayerImportRaw(season: number, playerId: string, forceFullReimport?: boolean): Promise<PlayerImportRaw | undefined>;
    buildCorePlayerImports(season: number, gameDate: string, filterPlayerIds?: Set<string>, forceFullReimport?: boolean): Promise<Map<string, PlayerImportRaw>>;
    buildDateRangePlayerImports(season: number, startDate: string, endDateExclusive: string, filterPlayerIds?: Set<string>, forceFullReimport?: boolean): Promise<Map<string, PlayerImportRaw>>;
    getAppearanceCountsBeforeDate(season: number, gameDate: string, filterPlayerIds?: Set<string>): Promise<Map<string, number>>;
    clearCache(season?: number): void;
    private getOrCreateState;
    private advanceState;
    private addAppearancesToState;
    private getStatExport;
    private getPlayerIdsFromExports;
    private splitStatExportByDate;
    private filterStatExportByDate;
    private removeUnneededDates;
    private getRequiredStartDate;
    private buildCoreSelections;
    private filterPlayerImports;
    private buildDateRangeSelections;
    private buildFromState;
    private buildFromExports;
    private getSelectedGameCount;
    private loadDatedStatExports;
    private resolvePlayerIds;
    private getPlayerAppearances;
    private finalizePlayers;
    private finalizePlayer;
    private normalizePlayerIds;
    private samePlayerIds;
    private getCacheKey;
    private getResultsFilePath;
    private readResultsFile;
    private writeResultsFile;
    private resultsFileToPlayerMap;
    private clonePlayerImportMap;
    private validateIsoDate;
    private addDays;
    private isCurrentSeason;
    private getTomorrowUtcDate;
    private fileExists;
    private formatDuration;
}
interface DatedStatExport {
    date: string;
    statExport: StatExport;
}
interface PlayerImportState {
    season: number;
    currentDate: string;
    statExports: DatedStatExport[];
    players: Map<string, PlayerImportRaw>;
    appearancesByPlayer: Record<string, PlayerAppearanceReference[]>;
}
interface PlayerImportSelection {
    playerId: string;
    gamePks: number[];
}
interface PlayerAppearanceReference {
    gamePk: number;
    date: string;
}
export { PlayerImportService };
export type { DatedStatExport, PlayerImportSelection, PlayerImportState };
