import { ContactProfile, ContactTypeRollInput, FielderChanceRollInput, HitterChange, PitchEnvironmentTarget, PitcherChange, PowerRollInput, RollChart, ShallowDeepRollInput } from "./interfaces.js";
declare class RollChartService {
    constructor();
    getMatchupPowerRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange): RollChart;
    getMatchupContactRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterContactProfile: ContactProfile, pitcherContactProfile: ContactProfile): RollChart;
    getFielderChanceRollChart(input: FielderChanceRollInput): RollChart;
    getShallowDeepRollChart(input: ShallowDeepRollInput): RollChart;
    private getRollChart;
}
declare class PowerModel {
    static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange): PowerRollInput;
    private static getHitterInput;
    private static getPitcherInput;
    private static normalize;
}
declare class ContactTypeModel {
    static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterContactProfile: ContactProfile, pitcherContactProfile: ContactProfile): ContactTypeRollInput;
    private static normalize;
}
export { RollChartService, PowerModel, ContactTypeModel };
