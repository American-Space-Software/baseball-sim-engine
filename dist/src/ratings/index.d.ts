import { DownloadService } from "../importer/service/download-service.js";
import { PlayerRatingService } from "./service/player-rating-service.js";
import { PlayerStatService } from "./service/player-stat-service.js";
declare const playerStatService: PlayerStatService;
declare const downloadService: DownloadService;
declare const playerRatingService: PlayerRatingService;
declare function exportPlayerRatings(season: number, baseDataDir?: string): Promise<any[]>;
export { downloadService, exportPlayerRatings, playerRatingService, playerStatService, PlayerRatingService, PlayerStatService };
