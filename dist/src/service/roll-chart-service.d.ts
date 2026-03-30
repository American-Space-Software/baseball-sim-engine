import { ContactProfile, ContactTypeRollInput, FielderChanceRollInput, HitterChange, LeagueAverage, PitcherChange, PowerRollInput, RollChart, ShallowDeepRollInput } from "./interfaces.js";
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
    buildHitterPowerRollInput(leagueAverage: LeagueAverage, hitterChange: HitterChange): PowerRollInput;
    buildPitcherPowerRollInput(leagueAverage: LeagueAverage, pitcherChange: PitcherChange): PowerRollInput;
    updatePowerRollInput(input: PowerRollInput, field: string, value: number): void;
    updateContactTypeInput(input: ContactTypeRollInput, field: string, value: number): void;
    getMatchupPowerRollChart(leagueAverage: LeagueAverage, hitterChange: HitterChange, pitcherChange: PitcherChange, applyPlayerChanges: boolean): RollChart;
    getMatchupContactRollChart(leagueAverage: LeagueAverage, hitterContactProfile: ContactProfile, pitcherContactProfile: ContactProfile, applyPlayerChanges: boolean): RollChart;
    private _getAverage;
}
export { RollChartService };
