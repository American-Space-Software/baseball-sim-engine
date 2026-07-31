import { ContactProfile, ContactTypeRollInput, FielderChanceRollInput, HitterChange, PitchCount, PitchEnvironmentTarget, PitcherChange, PowerRollInput, RollChart, ShallowDeepRollInput, SwingTakeRollInput, ContactMissRollInput, FairFoulRollInput, DefenseOutRollInput, DefenseHitRollInput, ContactQuality } from "./interfaces.js";
import { Contact } from "./enums.js";
declare class RollChartService {
    constructor();
    getMatchupSwingTakeRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, inZone: boolean, pitchQuality: number, pitchCount: PitchCount): RollChart;
    getMatchupContactMissRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange, inZone: boolean, pitchQuality: number, pitchCount: PitchCount): RollChart;
    getMatchupFairFoulRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange, pitchQuality: number, guessPitch: boolean, pitchCount: PitchCount): RollChart;
    getDefenseOutRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, defenseChange: number, contact: Contact, hitQuality: ContactQuality): RollChart;
    getDefenseHitRollChart(defenseChange: number, contact: Contact, hitQuality: ContactQuality): RollChart;
    getMatchupPowerRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange): RollChart;
    getMatchupContactRollChart(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterContactProfile: ContactProfile, pitcherContactProfile: ContactProfile): RollChart;
    getFielderChanceRollChart(input: FielderChanceRollInput): RollChart;
    getShallowDeepRollChart(input: ShallowDeepRollInput): RollChart;
    private getRollChart;
}
declare class SwingTakeModel {
    static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, inZone: boolean, pitchQuality: number, pitchCount: PitchCount): SwingTakeRollInput;
    private static getSwingDecisionChange;
    private static getZoneSwingRate;
    private static getChaseSwingRate;
    private static getAdjustedSwingRate;
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
declare class ContactMissModel {
    static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange, inZone: boolean, pitchQuality: number, pitchCount: PitchCount): ContactMissRollInput;
    private static getHitterContactRate;
    private static getPitcherPowerContactAdjustment;
    private static getPitcherPowerContactPointsPerFullPowerChange;
    private static getRateStdDev;
    private static getRateRange;
    private static getFullRatingChange;
}
declare class FairFoulModel {
    static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, pitcherChange: PitcherChange, pitchQuality: number, guessPitch: boolean, pitchCount: PitchCount): FairFoulRollInput;
    private static getPitchQualityFoulAdjustment;
    private static getPitcherPowerFoulAdjustment;
    private static getHitterContactFoulAdjustment;
    private static getContactPointsPerFullContactChange;
    private static getPitcherPowerContactPointsPerFullPowerChange;
    private static getRateStdDev;
    private static getRateRange;
    private static getFullRatingChange;
}
declare class DefenseHitModel {
    static getInput(defenseChange: number, contact: Contact, hitQuality: ContactQuality): DefenseHitRollInput;
    private static getBattedBallCatchProbability;
}
declare class DefenseOutModel {
    static getInput(pitchEnvironmentTarget: PitchEnvironmentTarget, hitterChange: HitterChange, defenseChange: number, contact: Contact, hitQuality: ContactQuality): DefenseOutRollInput;
    private static getBattedBallCatchProbability;
    private static getFullRatingChange;
}
export { DefenseHitModel, DefenseOutModel, RollChartService, PowerModel, ContactTypeModel, SwingTakeModel, ContactMissModel, FairFoulModel };
