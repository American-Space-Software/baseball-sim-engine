import { PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerImportRaw } from "../../sim/service/interfaces.js";
import { SimService } from "../../sim/service/sim-service.js";
import { StatService } from "../../sim/service/stat-service.js";
import { BaselineGameService } from "./baseline-game-service.js";
declare class PitchEnvironmentService {
    private simService;
    private statService;
    private baselineGameService;
    constructor(simService: SimService, statService: StatService, baselineGameService: BaselineGameService);
    static getPitchEnvironmentTargetForSeason(season: number, players: Map<string, PlayerImportRaw>): PitchEnvironmentTarget;
    private static finalizeBattedBallModels;
    private static finalizeBattedBallEvLaModel;
    private static finalizeBattedBallOutcomeModel;
    private static finalizeBattedBallSprayModel;
    private static finalizeBattedBallDepthModel;
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
    private static finalizeTrajectoryPhysics;
    evaluatePitchEnvironment(pitchEnvironment: PitchEnvironmentTarget, rng: Function, games?: number): {
        actual: any;
        target: any;
        diff: any;
        score: number;
    };
    seedPitchEnvironmentTuning(pitchEnvironment: PitchEnvironmentTarget): PitchEnvironmentTuning;
    printPitchEnvironmentIterationDiagnostics(stage: string, iteration: number, maxIterations: number, gamesPerIteration: number, candidate: PitchEnvironmentTuning, result: {
        actual: any;
        target: any;
        diff: any;
        score: number;
    }): void;
}
export { PitchEnvironmentService };
