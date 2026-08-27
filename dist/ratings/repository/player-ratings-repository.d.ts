interface PlayerRatingsRow {
    playerId: string;
    firstName: string;
    lastName: string;
    primaryPosition: any;
    age: number;
    throws: any;
    hits: any;
    overallRating: number;
    hittingRatings: any;
    pitchRatings: any;
}
declare class PlayerRatingsRepository {
    private readonly dataDir;
    constructor(dataDir: string);
    read(gameDate: string): Promise<PlayerRatingsRow[]>;
    write(gameDate: string, ratings: PlayerRatingsRow[]): Promise<void>;
    private getFilePath;
    private isMissingFile;
}
export { PlayerRatingsRepository };
export type { PlayerRatingsRow };
