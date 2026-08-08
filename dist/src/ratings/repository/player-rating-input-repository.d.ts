import type { Database } from "better-sqlite3";
import type { PlayerRatingInput } from "../../sim/service/interfaces.js";
declare class PlayerRatingInputRepository {
    private readonly database;
    private readonly createStatement;
    constructor(database: Database);
    create(gamePk: number): void;
    getByGame(gamePk: number): PlayerRatingInput[];
    getCareer(endDateExclusive: string, filterPlayerIds?: Set<string>): PlayerRatingInput[];
    getLastAppearances(endDateExclusive: string, appearanceCount: number, filterPlayerIds?: Set<string>): PlayerRatingInput[];
    getForDateRange(startDate: string, endDateExclusive: string, filterPlayerIds?: Set<string>): PlayerRatingInput[];
    getPlayerIdsForSeason(season: number): Set<string>;
    put(gamePk: number, input: PlayerRatingInput): void;
    deleteByGame(gamePk: number): void;
    private getAggregatedInputs;
    private aggregatePitchTypes;
    private aggregateNumericMaps;
    private mapRow;
    private getAverage;
}
export { PlayerRatingInputRepository };
