import type { PitchEnvironmentTarget, PitchEnvironmentTuning } from "../sim/service/interfaces.js";
type PitchEnvironmentWorkerInput = {
    pitchEnvironment: PitchEnvironmentTarget;
    candidate: PitchEnvironmentTuning;
    gamesPerIteration: number;
    rngSeed: string;
};
type TuningWorkerSuccess = {
    ok: true;
    candidate: PitchEnvironmentTuning;
    result: {
        actual: any;
        target: any;
        diff: any;
        score: number;
    };
};
type TuningWorkerFailure = {
    ok: false;
    error: string;
    stack?: string;
};
type TuningWorkerResponse = TuningWorkerSuccess | TuningWorkerFailure;
export type { PitchEnvironmentWorkerInput, TuningWorkerFailure, TuningWorkerResponse, TuningWorkerSuccess };
