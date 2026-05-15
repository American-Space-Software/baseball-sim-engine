import { HittingRatings, PitchEnvironmentTarget, PitchRatings, PlayerFromStatsCommand, PlayerImportBaseline, PlayerImportRaw } from "../../sim/service/interfaces.js";
declare class PlayerRatingService {
    static createPlayerFromStatsCommand(pitchEnvironment: PitchEnvironmentTarget, leagueImportBaseline: PlayerImportBaseline, playerImportBaseline: PlayerImportBaseline, playerImportRaw: PlayerImportRaw): PlayerFromStatsCommand;
    static buildHittingRatings(command: PlayerFromStatsCommand): HittingRatings;
    static buildPitchRatings(command: PlayerFromStatsCommand): PitchRatings;
    static createPlayerFromStats(command: PlayerFromStatsCommand): {
        hittingRatings: HittingRatings;
        pitchRatings: PitchRatings;
    };
    static clampRating(value: number, min?: number, max?: number): number;
    static getHigherIsBetterDelta(playerRate: number, baselineRate: number, scale: number): number;
    static getLowerIsBetterDelta(playerRate: number, baselineRate: number, scale: number): number;
}
export { PlayerRatingService };
