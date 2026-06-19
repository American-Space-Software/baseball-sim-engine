import { Position, PitchingRoleType } from "./enums.js";
import { Game, GamePlayer, TeamInfo } from "./interfaces.js";
declare class SubstitutionService {
    changePitcher(game: Game, team: TeamInfo, newPitcherId: string, playIndex: number): void;
    changeHitter(game: Game, team: TeamInfo, outPlayerId: string, inPlayerId: string, playIndex: number): void;
    changeFielder(game: Game, team: TeamInfo, outPlayerId: string, inPlayerId: string, position: Position, playIndex: number): void;
    changeRunner(game: Game, team: TeamInfo, outPlayerId: string, inPlayerId: string, playIndex: number): void;
    private replaceLineupPlayer;
    getAvailablePitchers(game: Game, team: TeamInfo): GamePlayer[];
    getNextPitcher(game: Game, team: TeamInfo): GamePlayer;
    getNextHitter(game: Game, offense: TeamInfo, defense: TeamInfo): GamePlayer | undefined;
    getPitcherPitchesRemaining(pitcher: GamePlayer): number;
    getPitchingRoleForLead(game: Game, lead: number): PitchingRoleType;
    changePitcherIfNeeded(game: Game, defense: TeamInfo, playIndex: number): boolean;
    getFatigueScale(pitcher: GamePlayer): number;
    private validateIncomingPlayer;
    private getUsedPlayerIds;
    private shouldConsiderHitterChange;
}
export { SubstitutionService };
