import { Handedness } from "../../sim/service/enums.js";
import type { Game, GamePlayer, MatchupHandedness, Pitch, Play } from "../../sim/service/interfaces.js";
import { PlayByPlayService } from "./play-by-play-service.js";
import type { PlayByPlayEntry, PlayDescription } from "./play-by-play-service.js";
declare class GameWebService {
    private readonly playByPlayService;
    constructor(playByPlayService: PlayByPlayService);
    getGameViewModel(game: Game): GameViewModel;
    getLineScore(game: Game): GameLineScoreViewModel;
    getCurrentDescriptions(game: Game): PlayDescription[];
    getPlayByPlay(game: Game): PlayByPlayEntry[];
    getAtBatState(game: Game): AtBatState | undefined;
    getCurrentPlay(game: Game): Play | undefined;
    getLastPlay(game: Game): Play | undefined;
    getPlays(game: Game): Play[];
    getGamePlayers(game: Game): Record<string, GamePlayer>;
    getOffense(game: Game): GameTeam;
    getDefense(game: Game): GameTeam;
    getHitter(game: Game, currentPlay?: Play): GamePlayer | undefined;
    getPitcher(game: Game): GamePlayer | undefined;
    getMatchupHandedness(hitter: GamePlayer, pitcher: GamePlayer): MatchupHandedness;
    private getPlayer;
    private getDefender;
    private isFirstPlayOfHalfInning;
}
declare class GameViewService {
    private readonly playByPlayService;
    constructor(playByPlayService: PlayByPlayService);
    getEffectiveHittingRatings(hitter: GamePlayer, pitcherHandedness: Handedness): import("../../sim/service/interfaces.js").HittingHandednessRatings;
    getEffectivePitchRatings(pitcher: GamePlayer, hitterHandedness: Handedness): {
        power: number;
        control: number;
        movement: number;
    };
    getPitcherRatingsText(pitcher: GamePlayer, hitterHandedness: Handedness): string;
    getHitterRatingsText(hitter: GamePlayer, pitcherHandedness: Handedness): string;
    getPitcherGameStats(pitcher: GamePlayer): string;
    getPitcherGameStatsShort(pitcher: GamePlayer): string;
    getHitterGameStats(hitter: GamePlayer): string;
    getHitterGameStatsShort(hitter: GamePlayer): string;
    getPitchHeader(pitch: Pitch): string;
    getInPlayHeader(pitch: Pitch): string;
    getPitchResultDescription(pitch: Pitch): string;
    getNumberWithOrdinal(value: number): string;
    getBalls(total: number, filled: number): string;
    getMessagesFromPlayDescriptions(descriptions: PlayDescription[]): any[];
}
declare enum AtBatState {
    STARTED = "STARTED",
    ONGOING = "ONGOING",
    ENDED = "ENDED"
}
type GameTeam = Game["away"];
interface GameTeamLineScoreViewModel {
    name: string;
    innings: Array<number | undefined>;
    runs: number;
    hits: number;
    errors: number;
}
interface GameLineScoreViewModel {
    currentInning: number;
    isTopInning: boolean;
    isComplete: boolean;
    away: GameTeamLineScoreViewModel;
    home: GameTeamLineScoreViewModel;
}
interface GameBoxscoreViewModel {
    side: "AWAY" | "HOME";
    team: GameTeam;
    isComplete: boolean;
    isTopInning: boolean;
}
interface GameViewModel {
    game: Game;
    linescore: GameLineScoreViewModel;
    awayBoxscore: GameBoxscoreViewModel;
    homeBoxscore: GameBoxscoreViewModel;
    atBatBoxscore: GameBoxscoreViewModel;
    isTopInning: boolean;
    currentInning: number;
    balls: number;
    strikes: number;
    outs: number;
    score: Game["score"];
    runner1B?: GamePlayer;
    runner2B?: GamePlayer;
    runner3B?: GamePlayer;
    hitter?: GamePlayer;
    pitcher?: GamePlayer;
    awayPlayer?: GamePlayer;
    homePlayer?: GamePlayer;
    matchupHandedness?: MatchupHandedness;
    defense?: GameTeam;
    catcher?: GamePlayer;
    firstBase?: GamePlayer;
    secondBase?: GamePlayer;
    thirdBase?: GamePlayer;
    shortstop?: GamePlayer;
    leftField?: GamePlayer;
    centerField?: GamePlayer;
    rightField?: GamePlayer;
    winningPitcher?: GamePlayer;
    losingPitcher?: GamePlayer;
    showHitter: boolean;
    showPitcher: boolean;
}
export { AtBatState, GameViewService, GameWebService };
export type { GameBoxscoreViewModel, GameLineScoreViewModel, GameTeamLineScoreViewModel, GameViewModel };
