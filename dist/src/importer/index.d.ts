import { PitchEnvironmentTarget, PlayerImportRaw, RatingTuning } from "../sim/service/interfaces.js";
interface ExportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget;
    players: Map<string, PlayerImportRaw>;
}
interface ExportAllResult {
    season: number;
    pitchEnvironmentTarget: PitchEnvironmentTarget;
    ratingTuning: RatingTuning;
    playerRatings: any[];
}
declare function exportPitchEnvironmentTarget(season: number, baseDataDir: string, options?: any): Promise<PitchEnvironmentTarget>;
declare function exportRatingTuning(season: number, baseDataDir: string, options?: any): Promise<RatingTuning>;
declare function exportPlayerRatings(season: number, baseDataDir: string, ratingTuning?: RatingTuning): Promise<any[]>;
declare function exportAll(season: number, baseDataDir: string, options?: any): Promise<ExportAllResult>;
export { exportPitchEnvironmentTarget, exportRatingTuning, exportPlayerRatings, exportAll, ExportPitchEnvironmentTargetResult, ExportAllResult };
