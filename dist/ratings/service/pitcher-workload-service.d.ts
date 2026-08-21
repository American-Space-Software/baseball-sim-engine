import { PitchingRoleType } from "../../sim/service/enums.js";
import type { PitcherAppearance } from "../repository/pitcher-appearance-repository.js";
import { PitcherAppearanceService } from "./pitcher-appearance-service.js";
declare class PitcherWorkloadService {
    private readonly pitcherAppearanceService;
    constructor(pitcherAppearanceService: PitcherAppearanceService);
    getPitcherWorkloads(gameDate: string, playerIds: string[]): Promise<Map<string, PitcherWorkload>>;
    getPitcherWorkload(gameDate: string, playerId: string): Promise<PitcherWorkload>;
    getBullpenRoles(gameDate: string, playerIds: string[], startingPitcherId?: string): Promise<SynthesizedPitchingRole[]>;
    private selectBullpenProfiles;
    private isRotationStarter;
    private getAppearances;
    private buildRoleProfile;
    private assignBullpenRoles;
    private takeBest;
    private sortRoles;
    private getRoleScore;
    private groupAppearancesByPlayerId;
    private buildWorkload;
    private getConsecutiveDaysPitched;
    private normalizePlayerIds;
    private sumPitches;
    private safeDivide;
    private daysBetween;
    private addDays;
}
interface PitcherWorkload {
    playerId: string;
    appearances: PitcherAppearance[];
    lastAppearanceDate?: string;
    lastAppearancePitchCount: number;
    daysSinceLastAppearance?: number;
    appearancesYesterday: number;
    appearancesLastThreeDays: number;
    appearancesLastFiveDays: number;
    consecutiveDaysPitched: number;
    pitchesYesterday: number;
    pitchesLastThreeDays: number;
    pitchesLastFiveDays: number;
}
interface PitcherRoleProfile {
    playerId: string;
    appearances: number;
    reliefAppearances: number;
    starts: number;
    saves: number;
    holds: number;
    blownSaves: number;
    gamesFinished: number;
    outs: number;
    pitches: number;
    averageOuts: number;
    averagePitches: number;
    averageEntryInning: number;
    lateInningAppearances: number;
    multiInningAppearances: number;
    closerScore: number;
    setupScore: number;
    longScore: number;
    mopUpScore: number;
}
interface SynthesizedPitchingRole {
    playerId: string;
    role: PitchingRoleType;
    priority: number;
    profile: PitcherRoleProfile;
    workload: PitcherWorkload;
}
export { PitcherWorkloadService };
export type { PitcherRoleProfile, PitcherWorkload, SynthesizedPitchingRole };
