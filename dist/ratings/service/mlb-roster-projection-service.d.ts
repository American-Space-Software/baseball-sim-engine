import type { MlbRosterEntry, MlbTeam } from "./mlb-roster-service.js";
declare class MlbRosterProjectionService {
    project(gameDate: string, team: MlbTeam, roster: MlbRosterEntry[], gamePk?: number): RosterProjection;
    private getPreviousRoster;
    private getRecentAppearances;
    private getConfirmedPlayerIds;
    private getRecentStartingPitcherIds;
    private countPosition;
    private countHitters;
    private mapPosition;
}
interface RosterProjection {
    players: MlbRosterEntry[];
    projected: boolean;
}
export { MlbRosterProjectionService };
export type { RosterProjection };
