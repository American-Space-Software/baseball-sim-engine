import { PitchEnvironmentTarget, PitchEnvironmentTuning, PlayerImportRaw } from "../sim/service/interfaces.js";
interface TuningWorkerSuccess {
    ok: true;
    candidate: PitchEnvironmentTuning;
    result: {
        actual: any;
        target: any;
        diff: any;
        score: number;
    };
}
interface ImportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget;
    players: Map<string, PlayerImportRaw>;
}
declare const evaluateCandidateLocal: (pitchEnvironment: PitchEnvironmentTarget, candidate: PitchEnvironmentTuning, gamesPerIteration: number, rngSeed: string, baseDataDir: string) => {
    actual: any;
    target: any;
    diff: any;
    score: number;
};
declare const evaluateCandidatesWithWorkers: (pitchEnvironment: PitchEnvironmentTarget, candidates: PitchEnvironmentTuning[], gamesPerIteration: number, workers: number, rngSeedBase: string) => Promise<TuningWorkerSuccess[]>;
declare function importPitchEnvironmentTarget(season: number, baseDataDir: string, options?: any): Promise<PitchEnvironmentTarget>;
export { importPitchEnvironmentTarget, evaluateCandidateLocal, evaluateCandidatesWithWorkers, ImportPitchEnvironmentTargetResult };
