import { PitchEnvironmentTarget, PlayerImportRaw } from "../sim/service/interfaces.js";
interface ImportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget;
    players: Map<string, PlayerImportRaw>;
}
declare function importPitchEnvironmentTarget(season: number, baseDataDir: string): Promise<ImportPitchEnvironmentTargetResult>;
export { importPitchEnvironmentTarget };
export type { ImportPitchEnvironmentTargetResult };
