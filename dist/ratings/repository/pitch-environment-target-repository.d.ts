import type { PitchEnvironmentTarget } from "../../sim/service/interfaces.js";
declare class PitchEnvironmentTargetRepository {
    private readonly dataDir;
    constructor(dataDir: string);
    read(gameDate: string): Promise<PitchEnvironmentTarget | undefined>;
    write(gameDate: string, target: PitchEnvironmentTarget): Promise<void>;
    private getFilePath;
    private isMissingFile;
}
export { PitchEnvironmentTargetRepository };
