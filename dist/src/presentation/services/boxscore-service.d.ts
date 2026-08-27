import type { GamePlayer, GameSubstitution } from "../../sim/service/interfaces.js";
import type { GameBoxscoreViewModel } from "./game-web-service.js";
declare class BoxscoreService {
    getBoxscoreInfo(substitutions: GameSubstitution[], boxscoreViewModel: GameBoxscoreViewModel): BoxscoreInfoViewModel;
    getSubNumberByPlayerId(substitutions: GameSubstitution[]): Map<string, number>;
    getRowsFromSubstitutions(seedIds: string[], players: GamePlayer[], subNumberByPlayerId: Map<string, number>, includePlayer: (player: GamePlayer) => boolean): BoxscorePlayerRow[];
    getPlayer(players: GamePlayer[], playerId: string): GamePlayer | undefined;
    hasBattingLine(player: GamePlayer): boolean;
    hasPitchingLine(player: GamePlayer): boolean;
    getPitcherAppearanceIds(pitchingSubstitutions: GameSubstitution[]): string[];
    getBatterAppearanceIds(lineup: string[], substitutions: GameSubstitution[]): string[];
    private getTotalBases;
    private getStatSummary;
}
interface BoxscorePlayerRow {
    player: GamePlayer;
    subNumber?: number;
}
interface BoxscoreStatSummary {
    playerId: string;
    name: string;
    value: number;
}
interface BoxscoreInfoViewModel {
    lineup: string[];
    batters: BoxscorePlayerRow[];
    pitchers: BoxscorePlayerRow[];
    doubles: BoxscoreStatSummary[];
    triples: BoxscoreStatSummary[];
    homeRuns: BoxscoreStatSummary[];
    totalBases: BoxscoreStatSummary[];
    rbi: BoxscoreStatSummary[];
}
export { BoxscoreService };
export type { BoxscoreInfoViewModel, BoxscorePlayerRow, BoxscoreStatSummary };
