import { Position } from "../../sim/service/enums.js";
import { PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerImportRaw } from "../../sim/service/interfaces.js";
import { SimService } from "../../sim/service/sim-service.js";
import { StatService } from "../../sim/service/stat-service.js";
import { BaselineGameService } from "./baseline-game-service.js";
import type { StatExport } from "baseball-database";
interface PitchEnvironmentStats {
    hitterTotals: any;
    pitcherTotals: any;
    runningTotals: any;
    fieldingTotals: any;
    splitHittingTotals: any;
    splitPitchingTotals: any;
    inZoneByCountSeed: {
        balls: number;
        strikes: number;
        inZone: number;
        total: number;
    }[];
    behaviorByCountSeed: {
        balls: number;
        strikes: number;
        zonePitches: number;
        chasePitches: number;
        zoneSwings: number;
        chaseSwings: number;
        zoneContact: number;
        chaseContact: number;
        zoneMisses: number;
        chaseMisses: number;
        zoneFouls: number;
        chaseFouls: number;
        zoneBallsInPlay: number;
        chaseBallsInPlay: number;
    }[];
    inZoneByCountMap: Map<string, {
        balls: number;
        strikes: number;
        inZone: number;
        total: number;
    }>;
    behaviorByCountMap: Map<string, {
        balls: number;
        strikes: number;
        zonePitches: number;
        chasePitches: number;
        zoneSwings: number;
        chaseSwings: number;
        zoneContact: number;
        chaseContact: number;
        zoneMisses: number;
        chaseMisses: number;
        zoneFouls: number;
        chaseFouls: number;
        zoneBallsInPlay: number;
        chaseBallsInPlay: number;
    }>;
    outcomeByEvLaMap: Map<string, {
        evBin: number;
        laBin: number;
        count: number;
        out: number;
        single: number;
        double: number;
        triple: number;
        hr: number;
    }>;
    xyByTrajectoryMap: Map<string, {
        trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup";
        xBin: number;
        yBin: number;
        count: number;
    }>;
    positionSeeds: Record<Position, number>;
    hittingPhysicsTotals: any;
    pitchingPhysicsTotals: any;
}
declare class PitchEnvironmentService {
    private simService;
    private statService;
    private baselineGameService;
    constructor(simService: SimService, statService: StatService, baselineGameService: BaselineGameService);
    static getPitchEnvironmentTargetForSeason(season: number, players: Map<string, PlayerImportRaw>, homeFieldAdvantage: number): PitchEnvironmentTarget;
    static getPitchEnvironmentStatsForPlayers(players: Map<string, PlayerImportRaw>): PitchEnvironmentStats;
    static getPitchEnvironmentStatsForStatExport(season: number, statExport: StatExport): PitchEnvironmentStats;
    static createPitchEnvironmentStats(): PitchEnvironmentStats;
    private static accumulatePitchEnvironmentStatsForPlayer;
    static addPitchEnvironmentStats(target: PitchEnvironmentStats, source: PitchEnvironmentStats): void;
    static subtractPitchEnvironmentStats(target: PitchEnvironmentStats, source: PitchEnvironmentStats): void;
    static clonePitchEnvironmentStats(stats: PitchEnvironmentStats): PitchEnvironmentStats;
    private static applyPitchEnvironmentStats;
    private static applyNumericObject;
    private static applyBucketMap;
    static getPitchEnvironmentTargetForStats(season: number, stats: PitchEnvironmentStats, homeFieldAdvantage: number): PitchEnvironmentTarget;
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
export type { PitchEnvironmentStats };
