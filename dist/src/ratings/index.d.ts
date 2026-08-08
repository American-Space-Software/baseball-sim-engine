import { DownloadService } from "../importer/service/download-service.js";
import { PlayerRatingService } from "./service/player-rating-service.js";
declare const downloadService: DownloadService;
declare const playerRatingService: PlayerRatingService;
declare function exportPlayerRatings(season: number, baseDataDir?: string): Promise<any[]>;
export { downloadService, exportPlayerRatings, playerRatingService, PlayerRatingService };
