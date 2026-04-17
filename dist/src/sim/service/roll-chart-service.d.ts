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
    incDec(index: number, by: number, array: number[]): number[];
    buildHitterPowerRollInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange): PowerRollInput;
    buildPitcherPowerRollInput(pitchEnvironmentTarget: PitchEnvironmentTarget, pitcherChange: PitcherChange): PowerRollInput;
    updatePowerRollInput(input: PowerRollInput, field: string, value: number): void;
    updateContactTypeInput(input: ContactTypeRollInput, field: string, value: number): void;
    getMatchupPowerRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange, applyPlayerChanges: boolean): RollChart;
    getMatchupContactRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterContactProfile: ContactProfile, pitcherContactProfile: ContactProfile, applyPlayerChanges: boolean): RollChart;
    getFirstRollIndex(chart: RollChart, result: string): number;
    private _getAverage;
}
export { RollChartService };
