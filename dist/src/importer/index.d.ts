import { PitchEnvironmentTarget, PlayerImportRaw, RatingTuning } from "../sim/service/interfaces.js";
interface ImportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget;
    players: Map<string, PlayerImportRaw>;
}
declare function importPitchEnvironmentTarget(season: number, baseDataDir: string, options?: any): Promise<PitchEnvironmentTarget>;
declare function importRatingTuning(season: number, baseDataDir: string, options?: any): Promise<RatingTuning>;
declare function importPlayerRatings(season: number, baseDataDir: string, ratingTuning?: RatingTuning): Promise<any[]>;
export { importPitchEnvironmentTarget, importRatingTuning, importPlayerRatings, ImportPitchEnvironmentTargetResult };
