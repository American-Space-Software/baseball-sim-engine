import type { Database } from "better-sqlite3";
import type { PlayerRatingSeasonInput } from "../../sim/service/interfaces.js";
declare class PlayerRatingSeasonInputRepository {
    private readonly database;
    private readonly createStatement;
    constructor(database: Database);
    create(season: number): void;
    getBySeason(season: number, filterPlayerIds?: Set<string>): PlayerRatingSeasonInput[];
    getBeforeSeason(season: number, filterPlayerIds?: Set<string>): PlayerRatingSeasonInput[];
    deleteBySeason(season: number): void;
    private getPlayerFilter;
    private mapRow;
    private mapInputRow;
    private getAverage;
    private validateSeason;
}
export { PlayerRatingSeasonInputRepository };
