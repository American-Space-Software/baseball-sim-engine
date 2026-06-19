import { SimService } from "../../sim/index.js";
import { Position } from "../../sim/service/enums.js";
import { Game, HitResultCount, Lineup, PitchEnvironmentTarget, PitchResultCount, Player } from "../../sim/service/interfaces.js";
declare class BaselineGameService {
    private simService;
    constructor(simService: SimService);
    buildStartedBaselineGame(pitchEnvironment: PitchEnvironmentTarget, gameId?: string): Game;
    buildStartedBaselineGameWithPlayer(pitchEnvironment: PitchEnvironmentTarget, player: Player, gameId?: string): Game;
    private replaceBaselineLineupPlayer;
    private replaceBaselineStartingPitcher;
    buildBaselinePlayer(id: string, position: Position): Player;
    buildBaselinePlayers(): Player[];
    buildBaselineLineup(players: Player[]): Lineup;
    mergeHitResults(total: HitResultCount, current: HitResultCount): HitResultCount;
    mergePitchResults(total: PitchResultCount, current: PitchResultCount): PitchResultCount;
    private getBaselineStamina;
}
export { BaselineGameService };
