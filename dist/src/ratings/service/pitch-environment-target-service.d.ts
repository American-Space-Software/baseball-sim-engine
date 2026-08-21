import { PlayerImportService } from "../../importer/service/player-import-service.js";
import type { PitchEnvironmentTarget } from "../../sim/service/interfaces.js";
import { PitchEnvironmentTargetRepository } from "../repository/pitch-environment-target-repository.js";
declare class PitchEnvironmentTargetService {
    private readonly pitchEnvironmentTargetRepository;
    private readonly playerImportService;
    constructor(pitchEnvironmentTargetRepository: PitchEnvironmentTargetRepository, playerImportService: PlayerImportService);
    getForDate(gameDate: string, options?: PitchEnvironmentTargetOptions): Promise<PitchEnvironmentTarget>;
    clearImportCache(season?: number): void;
    private getSeason;
    private validateTarget;
}
interface PitchEnvironmentTargetOptions {
    forceRebuild?: boolean;
}
export { PitchEnvironmentTargetService };
export type { PitchEnvironmentTargetOptions };
