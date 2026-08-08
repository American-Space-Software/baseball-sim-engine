import { PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerFieldingStats, PlayerHittingSplitStats, PlayerHittingStats, PlayerImportRaw, PlayerPitchingSplitStats, PlayerPitchingStats, PlayerRunningStats, PlayerSplitsStats } from "../sim/service/interfaces.js";
import { PitchEnvironmentService } from "./service/pitch-environment-service.js";
import { PlayerImportService } from "./service/player-import-service.js";
import { StatAccumulatorService } from "./service/stat-accumulator-service.js";
import { DownloadService } from "./service/download-service.js";
declare const playerImportService: PlayerImportService;
declare const downloadService: DownloadService;
interface ExportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget;
    players: Map<string, PlayerImportRaw>;
}
declare function exportPitchEnvironmentTarget(season: number, baseDataDir: string, options?: any, seasonPlayers?: Map<string, PlayerImportRaw>): Promise<PitchEnvironmentTarget>;
export { downloadService, exportPitchEnvironmentTarget, playerImportService, PlayerImportService, StatAccumulatorService, PitchEnvironmentService };
export type { PlayerHittingStats, PlayerPitchingStats, PlayerFieldingStats, PlayerRunningStats, PlayerSplitsStats, PlayerHittingSplitStats, PlayerPitchingSplitStats, PlayerImportRaw, PitchEnvironmentTuning, ExportPitchEnvironmentTargetResult };
