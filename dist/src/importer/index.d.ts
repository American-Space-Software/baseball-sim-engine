import { PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerFieldingStats, PlayerFromStatsCommand, PlayerHittingSplitStats, PlayerHittingStats, PlayerImportRaw, PlayerPitchingSplitStats, PlayerPitchingStats, PlayerRunningStats, PlayerSplitsStats, RatingTuning } from "../sim/service/interfaces.js";
import { SimService } from "../sim/service/sim-service.js";
import { StatService } from "../sim/service/stat-service.js";
import { PitchEnvironmentService } from "./service/pitch-environment-service.js";
import { PlayerRatingService } from "./service/player-rating-service.js";
import { BaselineGameService } from "./service/baseline-game-service.js";
import { PlayerImportService } from "./service/player-import-service.js";
import { StatAccumulatorService } from "./service/stat-accumulator-service.js";
interface ImporterServices {
    pitchEnvironmentService: PitchEnvironmentService;
    playerImportService: PlayerImportService;
    playerRatingService: PlayerRatingService;
    simService: SimService;
    statService: StatService;
    baselineGameService: BaselineGameService;
}
declare const playerImportService: PlayerImportService;
declare const playerRatingService: PlayerRatingService;
interface ExportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget;
    players: Map<string, PlayerImportRaw>;
}
interface ExportAllResult {
    season: number;
    pitchEnvironmentTarget: PitchEnvironmentTarget;
    playerRatings: any[];
}
declare function exportPitchEnvironmentTarget(season: number, baseDataDir: string, options?: any, seasonPlayers?: Map<string, PlayerImportRaw>): Promise<PitchEnvironmentTarget>;
declare function exportPlayerRatings(season: number, baseDataDir: string, seasonPlayers?: Map<string, PlayerImportRaw>, services?: ImporterServices): Promise<any[]>;
declare function exportAll(season: number, baseDataDir: string, options?: any): Promise<ExportAllResult>;
export { exportPitchEnvironmentTarget, exportPlayerRatings, exportAll, playerImportService, playerRatingService };
export type { PlayerFromStatsCommand, PlayerHittingStats, PlayerPitchingStats, PlayerFieldingStats, PlayerRunningStats, PlayerSplitsStats, PlayerHittingSplitStats, PlayerPitchingSplitStats, PlayerImportRaw, PitchEnvironmentTuning, RatingTuning, PlayerImportService, PlayerRatingService, StatAccumulatorService, PitchEnvironmentService, ExportPitchEnvironmentTargetResult, ExportAllResult };
