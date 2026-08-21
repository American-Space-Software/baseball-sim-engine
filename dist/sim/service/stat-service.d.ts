import { HitResultCount, HitterStatLine, PitcherStatLine, PitchResultCount } from "./interfaces.js";
declare class StatService {
    constructor();
    formatRatio(num: any): any;
    getIP(outs: any): string;
    getERA(earnedRuns: number, outs: number): number;
    getOBP(hits: number, bb: number, hbp: number, pa: number): number;
    getSLG(singles: number, doubles: number, triples: number, homeRuns: number, atBats: number): number;
    getOPS(obp: number, slg: number): number;
    getAVG(hits: number, atBats: number): number;
    getWinPercent(wins: number, losses: number): number;
    displayPercent(num: number): string;
    hitResultToHitterStatLine(hitResult: HitResultCount): HitterStatLine;
    mergeHitResultsToStatLine(total: HitResultCount, currentGame: HitResultCount): HitterStatLine;
    mergePitchResultsToStatLine(total: PitchResultCount, currentGame: PitchResultCount): PitcherStatLine;
    pitchResultToPitcherStatLine(pitchResult: PitchResultCount): PitcherStatLine;
}
export { StatService };
