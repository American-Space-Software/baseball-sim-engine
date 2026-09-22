import { Position } from "../../sim/service/enums.js";
declare class MlbRosterService {
    getTeams(season: number): Promise<MlbTeam[]>;
    syncRosters(gameDate: string): Promise<void>;
    getRoster(gameDate: string, team: MlbTeam): Promise<MlbRosterEntry[]>;
    getRosters(gameDate: string): Promise<MlbTeamRoster[]>;
    private validateGameDate;
    private mapPosition;
}
interface MlbTeamColors {
    color1: string;
    color2: string;
}
interface MlbTeam {
    id: number;
    name: string;
    abbrev: string;
    colors?: MlbTeamColors;
}
interface MlbRosterEntry {
    playerId: string;
    fullName: string;
    position: Position;
}
interface MlbTeamRoster {
    team: MlbTeam;
    players: MlbRosterEntry[];
}
export { MlbRosterService };
export type { MlbRosterEntry, MlbTeam, MlbTeamColors, MlbTeamRoster };
