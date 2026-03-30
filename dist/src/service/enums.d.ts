declare enum PlayResult {
    ERROR = "ERROR",
    STRIKEOUT = "STRIKEOUT",
    OUT = "OUT",
    HIT_BY_PITCH = "HIT_BY_PITCH",
    BB = "BB",
    SINGLE = "SINGLE",
    DOUBLE = "DOUBLE",
    TRIPLE = "TRIPLE",
    HR = "HR"
}
declare enum Contact {
    GROUNDBALL = "GROUNDBALL",
    LINE_DRIVE = "LINE_DRIVE",
    FLY_BALL = "FLY_BALL"
}
declare enum ShallowDeep {
    SHALLOW = "SHALLOW",
    NORMAL = "NORMAL",
    DEEP = "DEEP"
}
declare enum PitchZone {
    LOW_AWAY = "LOW_AWAY",
    LOW_MIDDLE = "LOW_MIDDLE",
    LOW_INSIDE = "LOW_INSIDE",
    MID_AWAY = "MID_AWAY",
    MID_MIDDLE = "MID_MIDDLE",
    MID_INSIDE = "MID_INSIDE",
    HIGH_AWAY = "HIGH_AWAY",
    HIGH_MIDDLE = "HIGH_MIDDLE",
    HIGH_INSIDE = "HIGH_INSIDE"
}
declare enum PitchCall {
    BALL = "BALL",
    STRIKE = "STRIKE",
    FOUL = "FOUL",
    IN_PLAY = "IN_PLAY",
    HBP = "HIT_BY_PITCH"
}
declare enum PitchType {
    FF = "FF",
    CU = "CU",
    CH = "CH",
    FC = "FC",
    FO = "FO",
    KN = "KN",
    KC = "KC",
    SC = "SC",
    SI = "SI",
    SL = "SL",
    SV = "SV",
    FS = "FS",
    ST = "ST"
}
declare enum BaseResult {
    FIRST = "1B",
    SECOND = "2B",
    THIRD = "3B",
    HOME = "home"
}
declare enum Handedness {
    L = "L",
    R = "R",
    S = "S"
}
declare enum Position {
    CATCHER = "C",
    PITCHER = "P",
    FIRST_BASE = "1B",
    SECOND_BASE = "2B",
    THIRD_BASE = "3B",
    SHORTSTOP = "SS",
    LEFT_FIELD = "LF",
    CENTER_FIELD = "CF",
    RIGHT_FIELD = "RF"
}
declare enum OfficialPlayResult {
    INTENT_WALK = "Intent Walk",
    HIT_BY_PITCH = "Hit By Pitch",
    SAC_FLY = "Sac Fly",
    SAC_FLY_DP = "Sac Fly DP",
    WALK = "Walk",
    CATCHER_INTERFERENCE = "Catcher Interference",
    RUNNER_OUT = "Runner Out",
    EJECTION = "Ejection",
    SINGLE = "Single",
    DOUBLE = "Double",
    TRIPLE = "Triple",
    HOME_RUN = "Home Run",
    STRIKEOUT = "Strikeout",
    STRIKEOUT_DP = "Strikeout - DP",
    SAC_BUNT = "Sac Bunt",
    SAC_BUNT_DP = "Sacrifice Bunt DP",
    BATTER_INTERFERENCE = "Batter Interference",
    BUNT_GROUNDOUT = "Bunt Groundout",
    BUNT_LINEOUT = "Bunt Lineout",
    BUNT_POPOUT = "Bunt Pop Out",
    FAN_INTERFERENCE = "Fan Interference",
    FIELDERS_CHOICE = "Fielders Choice",
    FLYOUT = "Flyout",
    POP_OUT = "Pop Out",
    FOURCEOUT = "Forceout",
    GROUNDOUT = "Groundout",
    GROUNDED_INTO_DP = "Grounded Into DP",
    TRIPLE_PLAY = "Triple Play",
    REACHED_ON_ERROR = "Reached on Error"
}
declare enum OfficialRunnerResult {
    TAGGED_OUT = "Tagged out",
    FORCE_OUT = "Force out",
    HOME_TO_FIRST = "Advanced from home to 1B",
    HOME_TO_SECOND = "Advanced from home to 2B",
    HOME_TO_THIRD = "Advanced from home to 3B",
    HOME_TO_SCORE = "Advanced from home to come around and score",
    FIRST_TO_SECOND = "Advanced from 1B to 2B",
    FIRST_TO_THIRD = "Advanced from 1B to 3B",
    FIRST_TO_HOME = "Advanced from 1B to home",
    SECOND_TO_THIRD = "Advanced from 2B to 3B",
    SECOND_TO_HOME = "Advanced from 2B to home",
    THIRD_TO_HOME = "Advanced from 3B to home",
    TAGGED_FIRST_TO_SECOND = "Tagged up and moved from 1B to 2B",
    TAGGED_SECOND_TO_THIRD = "Tagged up and moved from 2B to 3B",
    TAGGED_THIRD_TO_HOME = "Tagged up and scored from 3B.",
    STOLEN_BASE_2B = "Stolen Base 2B",
    STOLEN_BASE_3B = "Stolen Base 3B",
    STOLEN_BASE_HOME = "Stolen Base Home",
    CAUGHT_STEALING_2B = "Caught Stealing 2B",
    CAUGHT_STEALING_3B = "Caught Stealing 3B",
    CAUGHT_STEALING_HOME = "Caught Stealing Home"
}
declare enum DefenseCreditType {
    ASSIST = "ASSIST",
    ERROR = "ERROR",
    PUTOUT = "PUTOUT",
    CAUGHT_STEALING = "CAUGHT_STEALING",
    PASSED_BALL = "PASSED_BALL"
}
declare enum ThrowResult {
    SAFE = "safe",
    OUT = "out",
    NO_THROW = "no throw"
}
declare enum SwingResult {
    FAIR = "FAIR",
    FOUL = "FOUL",
    STRIKE = "STRIKE",
    NO_SWING = "NO_SWING"
}
declare enum HomeAway {
    HOME = "Home",
    AWAY = "Away"
}
export { ThrowResult, HomeAway, Contact, SwingResult, DefenseCreditType, PlayResult, OfficialRunnerResult, OfficialPlayResult, PitchType, ShallowDeep, PitchCall, PitchZone, Position, Handedness, BaseResult };
