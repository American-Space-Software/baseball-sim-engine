import { Game, PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerImportRaw } from "../../sim/service/interfaces.js";
import { SimService } from "../../sim/service/sim-service.js";
import { StatService } from "../../sim/service/stat-service.js";
import { DownloaderService } from "./downloader-service.js";
declare class PitchEnvironmentService {
    private simService;
    private statService;
    private downloaderService;
    constructor(simService: SimService, statService: StatService, downloaderService: DownloaderService);
    static getPitchEnvironmentTargetForSeason(season: number, players: Map<string, PlayerImportRaw>): PitchEnvironmentTarget;
    private static createInZoneByCountSeed;
    private static createBehaviorByCountSeed;
    private static accumulatePitchEnvironmentTotalsForPlayer;
    private static accumulatePitchEnvironmentCountBuckets;
    private static accumulatePitchEnvironmentBattedBallBuckets;
    private static accumulatePitchEnvironmentPhysics;
    private static accumulatePitchEnvironmentPositionSeeds;
    private static accumulateInZoneByCountBuckets;
    private static accumulateBehaviorByCountBuckets;
    private static finalizePitchEnvironmentPhysicsTotals;
    buildStartedBaselineGame(pitchEnvironment: PitchEnvironmentTarget, gameId?: string): Game;
    evaluatePitchEnvironment(pitchEnvironment: PitchEnvironmentTarget, rng: Function, games?: number): {
        actual: any;
        target: any;
        diff: any;
        score: number;
    };
    seedPitchEnvironmentTuning(pitchEnvironment: PitchEnvironmentTarget): PitchEnvironmentTuning;
    isPitchEnvironmentCloseEnough(diff: any): boolean;
    private static finalizeOutcomeByEvLa;
    printPitchEnvironmentIterationDiagnostics(stage: string, iteration: number, maxIterations: number, gamesPerIteration: number, candidate: PitchEnvironmentTuning, result: {
        actual: any;
        target: any;
        diff: any;
        score: number;
    }): void;
    private mergeHitResults;
    private mergePitchResults;
    private buildBaselinePlayer;
    private buildBaselinePlayers;
    private buildBaselineLineup;
}
export { PitchEnvironmentService };
