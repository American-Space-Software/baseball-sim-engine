import { PitchingRoleType, Position } from "../../sim/service/enums.js";
import type { Player } from "../../sim/service/interfaces.js";
import type { TeamBundle } from "../../ratings/service/game-lineup-service.js";
declare class TeamComponentService {
    getStartingPitcher(teamBundle: TeamBundle): Player;
    getDisplayHitters(teamBundle: TeamBundle): Player[];
    getDisplayAvailableHitters(teamBundle: TeamBundle): Player[];
    getDisplayAvailablePitchers(teamBundle: TeamBundle): Array<Player & {
        role?: PitchingRoleType;
        priority?: number;
    }>;
    setStartingPitcher(teamBundle: TeamBundle, playerId: string): void;
    moveHitter(teamBundle: TeamBundle, selectedPlayerId: string, targetPlayerId: string): void;
    moveHitterToLineup(teamBundle: TeamBundle, playerId: string, lineupIndex: number): void;
    moveBullpenPitcher(teamBundle: TeamBundle, selectedPlayerId: string, targetPlayerId: string): void;
    setBullpenRole(teamBundle: TeamBundle, playerId: string, role: PitchingRoleType, priority?: number): void;
    setBullpenPriority(teamBundle: TeamBundle, playerId: string, priority: number): void;
    getBullpenRoleDisplay(role?: PitchingRoleType): string;
    playerCanPlay(player: Player, position: Position): boolean;
    private getPlayer;
    private getRequiredPlayer;
    private swapLineupOrder;
    private replaceLineupPlayer;
    private isPitcher;
    private getPositionFitScore;
    private getNextPriority;
}
export { TeamComponentService };
