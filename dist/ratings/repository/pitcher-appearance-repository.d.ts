declare class PitcherAppearanceRepository {
    private readonly dataDir;
    constructor(dataDir: string);
    read(gameDate: string): Promise<PitcherAppearance[] | undefined>;
    write(gameDate: string, appearances: PitcherAppearance[]): Promise<void>;
    private getFilePath;
    private isMissingFile;
}
interface PitcherAppearance {
    playerId: string;
    playerName: string;
    gameId: string;
    gameDate: string;
    teamId: string;
    pitches: number;
    outs: number;
    inningsPitched: number;
    battersFaced: number;
    gamesStarted: number;
    gamesFinished: number;
    saves: number;
    holds: number;
    blownSaves: number;
    entryInning?: number;
}
export { PitcherAppearanceRepository };
export type { PitcherAppearance };
