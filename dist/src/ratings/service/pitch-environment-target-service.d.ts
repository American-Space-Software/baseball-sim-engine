import type { PitchEnvironmentTarget } from "../../sim/service/interfaces.js";
import { DownloadService } from "../../importer/service/download-service.js";
import { PitchEnvironmentTargetRepository } from "../repository/pitch-environment-target-repository.js";
interface PitchEnvironmentTargetOptions {
    forceRebuild?: boolean;
}
declare class PitchEnvironmentTargetService {
    private readonly pitchEnvironmentTargetRepository;
    private readonly downloadService;
    private readonly homeFieldAdvantageCache;
    private state?;
    constructor(pitchEnvironmentTargetRepository: PitchEnvironmentTargetRepository, downloadService: DownloadService);
    getForDate(gameDate: string, options?: PitchEnvironmentTargetOptions): Promise<PitchEnvironmentTarget>;
    clearImportCache(season?: number): void;
    private getPitchEnvironmentStats;
    private getPitchEnvironmentStatsForDateRange;
    private getHomeFieldAdvantage;
    private getHomeFieldAdvantageSeason;
    private isCompleteGame;
    private validateTarget;
    private validateGameDate;
    private addDays;
}
export { PitchEnvironmentTargetService };
export type { PitchEnvironmentTargetOptions };
