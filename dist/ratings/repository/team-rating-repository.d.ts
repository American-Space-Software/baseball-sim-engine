declare class TeamRatingRepository {
    private readonly baseDataDir;
    constructor(baseDataDir: string);
    get(date: string): Promise<TeamRatingSnapshot | undefined>;
    getLatestBefore(date: string): Promise<TeamRatingSnapshot | undefined>;
    put(snapshot: TeamRatingSnapshot): Promise<void>;
    private getFilePath;
    private getSeason;
    private validateSnapshot;
    private validateDate;
}
interface TeamRating {
    rating: number;
    rd: number;
    vol: number;
}
interface TeamRatingSnapshot {
    date: string;
    teams: Record<string, TeamRating>;
}
export { TeamRatingRepository };
export type { TeamRating, TeamRatingSnapshot };
