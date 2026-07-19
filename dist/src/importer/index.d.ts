import { PitchEnvironmentTarget, PlayerImportRaw } from "../sim/service/interfaces.js";
import { DownloaderService, PlayerImportGameFeed } from "./service/downloader-service.js";
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
declare function exportPlayerRatings(season: number, baseDataDir: string, seasonPlayers?: Map<string, PlayerImportRaw>): Promise<any[]>;
declare function exportAll(season: number, baseDataDir: string, options?: any): Promise<ExportAllResult>;
export { exportPitchEnvironmentTarget, exportPlayerRatings, exportAll, DownloaderService, PlayerImportGameFeed, ExportPitchEnvironmentTargetResult, ExportAllResult };
