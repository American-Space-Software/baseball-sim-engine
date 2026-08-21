import { PitcherAppearanceRepository } from "../repository/pitcher-appearance-repository.js";
import type { PitcherAppearance } from "../repository/pitcher-appearance-repository.js";
declare class PitcherAppearanceService {
    private readonly pitcherAppearanceRepository;
    constructor(pitcherAppearanceRepository: PitcherAppearanceRepository);
    getForDate(gameDate: string): Promise<PitcherAppearance[]>;
    private buildForDate;
    private getPitcherAppearances;
    private getPitcherEntryInning;
    private getPitchingOuts;
    private getScheduledGameDate;
    private isCompletedGame;
    private getNumber;
}
export { PitcherAppearanceService };
