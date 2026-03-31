import { HitResult, HitResultCount, HitterStatLine, PitcherStatLine, PitchResult, PitchResultCount } from "./interfaces.js";
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
    hitResultToHitterStatLine(hitResult: HitResult | HitResultCount): HitterStatLine;
    mergeHitResultsToStatLine(total: HitResult, currentGame: HitResultCount): HitterStatLine;
    mergePitchResultsToStatLine(total: PitchResult, currentGame: PitchResultCount): PitcherStatLine;
    pitchResultToPitcherStatLine(pitchResult: PitchResult | PitchResultCount): PitcherStatLine;
}
export { StatService };
