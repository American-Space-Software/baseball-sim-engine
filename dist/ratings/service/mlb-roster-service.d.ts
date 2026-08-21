import { Position } from "../../sim/service/enums.js";
declare class MlbRosterService {
    getTeams(season: number): Promise<MlbTeam[]>;
    syncRosters(gameDate: string): Promise<void>;
    getRoster(gameDate: string, team: MlbTeam): Promise<MlbRosterEntry[]>;
    private validateGameDate;
    private mapPosition;
}
interface MlbTeam {
    id: number;
    name: string;
    abbrev: string;
}
interface MlbRosterEntry {
    playerId: string;
    fullName: string;
    position: Position;
}
export { MlbRosterService };
export type { MlbTeam, MlbRosterEntry };
