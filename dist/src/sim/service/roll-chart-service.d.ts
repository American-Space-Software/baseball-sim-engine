import { ContactProfile, ContactTypeRollInput, FielderChanceRollInput, HitterChange, PitchEnvironmentTarget, PitcherChange, PowerRollInput, RollChart, ShallowDeepRollInput } from "./interfaces.js";
declare class RollChartService {
    constructor();
    getPowerRollChart(input: PowerRollInput): RollChart;
    getContactTypeRollChart(input: ContactTypeRollInput): RollChart;
    getFielderChanceRollChart(input: FielderChanceRollInput): RollChart;
    getShallowDeepRollChart(input: ShallowDeepRollInput): RollChart;
    sortRollChart(rollChart: RollChart): void;
    diffRollChart(average: RollChart, override: RollChart): RollChart;
    applyChartDiffs(hitterDiff: RollChart, pitcherDiff: RollChart, average: RollChart): RollChart;
    buildHitterPowerRollInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange): PowerRollInput;
    buildPitcherPowerRollInput(pitchEnvironmentTarget: PitchEnvironmentTarget, pitcherChange: PitcherChange): PowerRollInput;
    private normalizePowerRollInput;
    getMatchupPowerRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange): RollChart;
    private buildMatchupPowerRollInput;
    getMatchupContactRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterContactProfile: ContactProfile, pitcherContactProfile: ContactProfile): RollChart;
    getFirstRollIndex(chart: RollChart, result: string): number;
    private _getAverage;
}
export { RollChartService };
