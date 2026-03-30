import { BaseResult, Contact, DefenseCreditType, Handedness, HomeAway, OfficialPlayResult, OfficialRunnerResult, PitchCall, PitchType, PitchZone, PlayResult, Position, ShallowDeep, ThrowResult } from "./enums.js";
interface StartGameCommand {
    game: Game;
    home: Team;
    homeTeamOptions: any;
    homePlayers: Player[];
    homeLineup: Lineup;
    homeStartingPitcher: RotationPitcher;
    away: Team;
    awayTeamOptions: any;
    awayLineup: Lineup;
    awayPlayers: Player[];
    awayStartingPitcher: RotationPitcher;
    leagueAverages: LeagueAverage;
    date: Date;
}
interface SimPitchCommand {
    game: Game;
    play: Play;
    offense: TeamInfo;
    defense: TeamInfo;
    hitter: GamePlayer;
    pitcher: GamePlayer;
    hitterChange: HitterChange;
    pitcherChange: PitcherChange;
    catcher: GamePlayer;
    halfInningRunnerEvents: RunnerEvent[];
    halfInning: HalfInning;
    leagueAverages: LeagueAverage;
    matchupHandedness: MatchupHandedness;
    rng: any;
}
interface RunnerThrowCommand {
    gameRNG: any;
    runnerResult: RunnerResult;
    allEvents: RunnerEvent[];
    runnerEvents: RunnerEvent[];
    runnerEvent: RunnerEvent;
    hitterEvent: RunnerEvent;
    defensiveCredits: DefensiveCredit[];
    start: BaseResult;
    end: BaseResult;
    eventType: PlayResult | OfficialRunnerResult;
    eventTypeOut: PlayResult | OfficialRunnerResult;
    leagueAverage: LeagueAverage;
    pitcher: GamePlayer;
    defense: TeamInfo;
    offense: TeamInfo;
    throwFrom: GamePlayer;
    chanceRunnerSafe: number;
    isForce: boolean;
    isFieldersChoice: boolean;
    pitchIndex: number;
}
interface Game {
    _id: string;
    away: TeamInfo;
    home: TeamInfo;
    count: Count;
    score: Score;
    halfInnings?: HalfInning[];
    playIndex: number;
    leagueAverages?: LeagueAverage;
    currentInning: number;
    summary?: any;
    isStarted: boolean;
    isTopInning: boolean;
    isComplete: boolean;
    isFinished: boolean;
    winningPitcherId?: string;
    losingPitcherId?: string;
    winningTeamId?: string;
    winningTeam?: Team;
    losingTeamId?: string;
    losingTeam?: Team;
    teams?: Team[];
    currentSimDate?: Date;
    startDate?: Date;
    gameDate?: Date;
    lastUpdated?: Date;
    dateCreated?: Date;
}
interface Player {
    _id: string;
    tokenId?: number;
    transactionHash?: string;
    firstName: string;
    lastName: string;
    readonly fullName: string;
    readonly displayName: string;
    primaryPosition: Position;
    zodiacSign: string;
    throws: Handedness;
    hits: Handedness;
    isRetired: boolean;
    stamina: number;
    overallRating: number;
    pitchRatings: PitchRatings;
    hittingRatings: HittingRatings;
    potentialOverallRating: number;
    potentialPitchRatings: PitchRatings;
    potentialHittingRatings: HittingRatings;
    totalExperience?: string;
    age: number;
    lastGamePitched?: Date;
    lastGamePlayed?: Date;
    lastTeamChange?: Date;
    lastUpdated?: Date;
    dateCreated?: Date;
}
interface Team {
    _id: string;
    name?: string;
    abbrev?: string;
    colors: Colors;
    lineups?: Lineup[];
}
interface TeamInfo {
    _id?: string;
    name: string;
    abbrev: string;
    homeAway: HomeAway;
    color1?: string;
    color2?: string;
    players?: GamePlayer[];
    lineupIds?: string[];
    currentHitterIndex?: number;
    currentPitcherId?: string;
    runner1BId?: string;
    runner2BId?: string;
    runner3BId?: string;
}
interface GamePlayerBio {
    _id: string;
    fullName: string;
    age: number;
    throws: Handedness;
    hits: Handedness;
    hitResult: HitterStatLine;
    pitchResult: PitcherStatLine;
}
interface HitterStatLine {
    teamWins: number;
    teamLosses: number;
    games: number;
    pa: number;
    atBats: number;
    runs: number;
    hits: number;
    singles: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    hbp: number;
    gidp: number;
    po: number;
    assists: number;
    outfieldAssists: number;
    e: number;
    passedBalls: number;
    csDefense: number;
    doublePlays: number;
    hbpPercent?: number;
    singlePercent?: number;
    doublePercent?: number;
    triplePercent?: number;
    homeRunPercent?: number;
    bbPercent?: number;
    soPercent?: number;
    strikePercent?: number;
    ballPercent?: number;
    swingPercent?: number;
    foulPercent?: number;
    swingAtBallsPercent?: number;
    swingAtStrikesPercent?: number;
    inZonePercent?: number;
    inZoneContactPercent?: number;
    outZoneContactPercent?: number;
    inPlayPercent?: number;
    babip?: number;
    groundBallPercent?: number;
    flyBallPercent?: number;
    ldPercent?: number;
    popupPercent?: number;
    rbi: number;
    sb: number;
    sbAttempts: number;
    cs: number;
    bb: number;
    so: number;
    avg?: number;
    obp?: number;
    slg?: number;
    ops?: number;
    wpa?: number;
    avgPitchQuality: number;
    avgPitchPowerQuality: number;
    avgPitchLocationQuality: number;
    avgPitchMovementQuality: number;
    runsPerGame?: number;
    sbPerGame?: number;
    sbAttemptsPerGame?: number;
    pitchesPerPA?: number;
}
interface PitcherStatLine {
    games: number;
    wins: number;
    losses: number;
    winPercent?: number;
    era?: number;
    starts: number;
    outs: number;
    cg: number;
    sho: number;
    saves: number;
    ip?: string;
    atBats: number;
    battersFaced: number;
    hits: number;
    runs: number;
    er: number;
    homeRuns: number;
    bb: number;
    so: number;
    hbp: number;
    wpa: number;
    wildPitches: number;
    singlePercent?: number;
    doublePercent?: number;
    triplePercent?: number;
    homeRunPercent?: number;
    hbpPercent?: number;
    bbPercent?: number;
    soPercent?: number;
    strikePercent?: number;
    ballPercent?: number;
    swingPercent?: number;
    inPlayPercent?: number;
    foulPercent?: number;
    wildPitchPercent?: number;
    swingAtBallsPercent?: number;
    swingAtStrikesPercent?: number;
    inZonePercent?: number;
    inZoneContactPercent?: number;
    outZoneContactPercent?: number;
    babip?: number;
    groundBallPercent?: number;
    flyBallPercent?: number;
    ldPercent?: number;
    popupPercent?: number;
    avgPitchQuality: number;
    avgPitchPowerQuality: number;
    avgPitchLocationQuality: number;
    avgPitchMovementQuality: number;
    runsPerGame?: number;
    pitchesPerGame?: number;
    pitchesPerPA?: number;
}
interface Colors {
    color1: string;
    color2: string;
}
interface SimPitchResult {
    continueAtBat: boolean;
    pitch: Pitch;
}
interface PitchLog {
    pitches: Pitch[];
    count: PitchCount;
}
interface Pitch {
    intentZone: PitchZone;
    actualZone: PitchZone;
    result: PitchCall;
    count?: Count;
    type: PitchType;
    quality: number;
    powQ: number;
    locQ: number;
    movQ: number;
    swing: boolean;
    inZone: boolean;
    isWP: boolean;
    isPB: boolean;
    con: boolean;
    guess: boolean;
}
interface PitchCount {
    balls: number;
    strikes: number;
    fouls: number;
    pitches: number;
}
interface ShallowDeepChance {
    shallow: number;
    normal: number;
    deep: number;
}
interface FielderChance {
    first: number;
    second: number;
    third: number;
    catcher: number;
    shortstop: number;
    leftField: number;
    centerField: number;
    rightField: number;
    pitcher: number;
}
interface LeagueAverage {
    hittingRatings: HittingRatings;
    pitchRatings: PitchRatings;
    powerRollInput: PowerRollInput;
    contactTypeRollInput: ContactTypeRollInput;
    foulRate: number;
    inZoneRate: number;
    ballSwingRate: number;
    strikeSwingRate: number;
    zoneSwingContactRate: number;
    chaseSwingContactRate: number;
    pitchQuality: number;
    fielderChanceR: FielderChance;
    fielderChanceL: FielderChance;
    shallowDeepChance: ShallowDeepChance;
}
interface ContactProfile {
    groundball: number;
    flyBall: number;
    lineDrive: number;
}
interface PitchRatings {
    power?: number;
    contactProfile?: ContactProfile;
    vsR?: PitchingHandednessRatings;
    vsL?: PitchingHandednessRatings;
    pitches?: PitchType[];
}
interface PitchingHandednessRatings {
    control?: number;
    movement?: number;
}
interface HittingRatings {
    defense?: number;
    arm?: number;
    speed?: number;
    steals?: number;
    contactProfile?: ContactProfile;
    vsR?: HittingHandednessRatings;
    vsL?: HittingHandednessRatings;
}
interface HittingHandednessRatings {
    plateDiscipline?: number;
    contact?: number;
    gapPower?: number;
    homerunPower?: number;
}
interface GamePlayer {
    _id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    displayName: string;
    age: number;
    teamId?: string;
    overallRating: {
        before: number;
    };
    color1: string;
    color2: string;
    throws: Handedness;
    hits: Handedness;
    pitchRatings: PitchRatings;
    hittingRatings: HittingRatings;
    currentPosition?: Position;
    lineupIndex?: number;
    hitResult: HitResultCount;
    pitchResult: PitchResultCount;
    hitterChange: {
        vsL: HitterChange;
        vsR: HitterChange;
    };
    pitcherChange: {
        vsL: PitcherChange;
        vsR: PitcherChange;
    };
    isPitcherOfRecord?: boolean;
}
interface MatchupHandedness {
    throws: Handedness;
    hits: Handedness;
    vsSameHand: boolean;
}
interface HitResultCount {
    games: number;
    uniqueGames: number;
    teamWins: number;
    teamLosses: number;
    pa: number;
    atBats: number;
    hits: number;
    singles: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    runs: number;
    rbi: number;
    bb: number;
    sb: number;
    sbAttempts: number;
    cs: number;
    hbp: number;
    so: number;
    lob: number;
    sacBunts: number;
    sacFlys: number;
    groundOuts: number;
    flyOuts: number;
    lineOuts: number;
    outs: number;
    groundBalls: number;
    lineDrives: number;
    flyBalls: number;
    gidp: number;
    po: number;
    assists: number;
    outfieldAssists: number;
    e: number;
    passedBalls: number;
    csDefense: number;
    doublePlays: number;
    pitches: number;
    balls: number;
    strikes: number;
    fouls: number;
    swings: number;
    swingAtBalls: number;
    swingAtStrikes: number;
    inZoneContact: number;
    outZoneContact: number;
    inZone: number;
    ballsInPlay: number;
    totalPitchQuality: number;
    totalPitchPowerQuality: number;
    totalPitchLocationQuality: number;
    totalPitchMovementQuality: number;
    wpa: number;
}
interface PitchResultCount {
    games: number;
    uniqueGames: number;
    teamWins: number;
    teamLosses: number;
    starts: number;
    wins: number;
    losses: number;
    saves: number;
    bs: number;
    outs: number;
    er: number;
    so: number;
    hits: number;
    bb: number;
    sho: number;
    cg: number;
    hbp: number;
    singles: number;
    doubles: number;
    triples: number;
    battersFaced: number;
    atBats: number;
    runs: number;
    homeRuns: number;
    groundOuts: number;
    flyOuts: number;
    lineOuts: number;
    groundBalls: number;
    lineDrives: number;
    flyBalls: number;
    pitches: number;
    balls: number;
    strikes: number;
    fouls: number;
    wildPitches: number;
    swings: number;
    swingAtBalls: number;
    swingAtStrikes: number;
    inZoneContact: number;
    outZoneContact: number;
    ballsInPlay: number;
    inZone: number;
    ip: string;
    sacFlys: number;
    totalPitchQuality: number;
    totalPitchPowerQuality: number;
    totalPitchLocationQuality: number;
    totalPitchMovementQuality: number;
    wpa: number;
}
interface PitcherChange {
    powerChange: number;
    controlChange: number;
    movementChange: number;
}
interface HitterChange {
    plateDisiplineChange: number;
    contactChange: number;
    gapPowerChange: number;
    hrPowerChange: number;
    speedChange: number;
    stealsChange: number;
    defenseChange: number;
    armChange: number;
}
interface DefensiveCredit {
    _id: string;
    type: DefenseCreditType;
}
interface ThrowRoll {
    roll: number;
    result: ThrowResult;
}
interface RunnerEvent {
    pitchIndex: number;
    pitcher: {
        _id: string;
    };
    runner?: {
        _id: string;
    };
    eventType?: PlayResult | OfficialRunnerResult;
    movement?: {
        start?: BaseResult;
        end?: BaseResult;
        outBase?: BaseResult;
        isOut?: boolean;
        outNumber?: number;
    };
    isUnearned?: boolean;
    isScoringEvent?: boolean;
    isForce?: boolean;
    isFC?: boolean;
    isWP?: boolean;
    isPB?: boolean;
    isError?: boolean;
    isSBAttempt?: boolean;
    isSB?: boolean;
    isCS?: boolean;
    throw?: {
        result: ThrowResult;
        from?: {
            _id?: string;
            position?: Position;
        };
        to?: {
            _id?: string;
            position: Position;
        };
    };
}
interface RunnerResult {
    first: string;
    second: string;
    third: string;
    scored: string[];
    out: string[];
}
interface Count {
    balls: number;
    strikes: number;
    outs: number;
}
interface Score {
    away: number;
    home: number;
}
interface UpcomingMatchup {
    hitter: GamePlayer;
    pitcher: GamePlayer;
}
interface LastPlay {
    hitter: GamePlayerBio;
    pitcher: GamePlayerBio;
    play: Play;
    inning: number;
    top: boolean;
    first: GamePlayerBio;
    second: GamePlayerBio;
    third: GamePlayerBio;
}
interface Play {
    index: number;
    pitchLog: PitchLog;
    result?: PlayResult;
    officialPlayResult?: OfficialPlayResult | OfficialRunnerResult;
    runner: {
        events: RunnerEvent[];
        result: {
            start: RunnerResult;
            end: RunnerResult;
        };
    };
    credits: DefensiveCredit[];
    contact?: Contact;
    shallowDeep?: ShallowDeep;
    fielder?: Position;
    fielderId?: string;
    matchupHandedness: MatchupHandedness;
    hitterId: string;
    pitcherId: string;
    catcherId: string;
    count: {
        start: Count;
        end?: Count;
    };
    score: {
        start: Score;
        end?: Score;
    };
    inningNum: number;
    inningTop: boolean;
}
interface HalfInning {
    num: number;
    top: boolean;
    linescore: LinescoreTeam;
    plays: Play[];
}
interface LinescoreTeam {
    runs: number;
    hits: number;
    errors: number;
    leftOnBase: number;
}
interface Lineup {
    order?: LineupPlayer[];
    rotation?: RotationPitcher[];
    valid?: boolean;
}
interface LineupPlayer {
    _id?: string;
    position?: Position;
}
interface RotationPitcher {
    _id?: string;
    stamina?: number;
}
interface RollChart {
    entries?: Map<number, string>;
}
interface ContactTypeRollInput {
    groundball: number;
    flyBall: number;
    lineDrive: number;
}
interface FielderChanceRollInput {
    first: number;
    second: number;
    third: number;
    catcher: number;
    shortstop: number;
    leftField: number;
    centerField: number;
    rightField: number;
    pitcher: number;
}
interface ShallowDeepRollInput {
    shallow: number;
    normal: number;
    deep: number;
}
interface HitterHandednessRollInput {
    left: number;
    right: number;
    switch: number;
}
interface PitcherHandednessRollInput {
    left: number;
    right: number;
}
interface PowerRollInput {
    out: number;
    singles: number;
    doubles: number;
    triples: number;
    hr: number;
}
declare class InningEndingEvent extends Error {
}
interface HitResult {
    games?: number;
    uniqueGames?: number;
    playerId: string;
    age: number;
    teamWins: number;
    teamLosses: number;
    pa: number;
    atBats: number;
    hits: number;
    singles: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    runs: number;
    rbi: number;
    bb: number;
    sbAttempts: number;
    sb: number;
    cs: number;
    hbp: number;
    so: number;
    lob: number;
    sacBunts: number;
    sacFlys: number;
    groundOuts: number;
    flyOuts: number;
    lineOuts: number;
    outs: number;
    groundBalls: number;
    lineDrives: number;
    flyBalls: number;
    gidp: number;
    po: number;
    assists: number;
    outfieldAssists: number;
    csDefense: number;
    doublePlays: number;
    e: number;
    passedBalls: number;
    wpa: number;
    pitches: number;
    balls: number;
    strikes: number;
    fouls: number;
    inZone: number;
    swings: number;
    swingAtBalls: number;
    swingAtStrikes: number;
    ballsInPlay: number;
    inZoneContact: number;
    outZoneContact: number;
    totalPitchQuality: number;
    totalPitchPowerQuality: number;
    totalPitchLocationQuality: number;
    totalPitchMovementQuality: number;
    overallRatingBefore: number;
    overallRatingAfter: number;
    careerStats: {
        before: HitterStatLine;
        after: HitterStatLine;
    };
    startDate?: Date;
    lastUpdated?: Date;
    dateCreated?: Date;
}
interface PitchResult {
    games?: number;
    uniqueGames?: number;
    playerId: string;
    age: number;
    teamWins: number;
    teamLosses: number;
    starts: number;
    wins: number;
    losses: number;
    saves: number;
    bs: number;
    outs: number;
    er: number;
    so: number;
    hits: number;
    bb: number;
    sho: number;
    cg: number;
    hbp: number;
    singles: number;
    doubles: number;
    triples: number;
    battersFaced: number;
    atBats: number;
    runs: number;
    homeRuns: number;
    groundOuts: number;
    flyOuts: number;
    lineOuts: number;
    groundBalls: number;
    lineDrives: number;
    flyBalls: number;
    sacFlys: number;
    wpa: number;
    wildPitches: number;
    pitches: number;
    strikes: number;
    balls: number;
    fouls: number;
    inZone: number;
    swings: number;
    swingAtBalls: number;
    swingAtStrikes: number;
    ballsInPlay: number;
    inZoneContact: number;
    outZoneContact: number;
    totalPitchQuality: number;
    totalPitchPowerQuality: number;
    totalPitchLocationQuality: number;
    totalPitchMovementQuality: number;
    overallRatingBefore: number;
    overallRatingAfter: number;
    careerStats: {
        before: PitcherStatLine;
        after: PitcherStatLine;
    };
    startDate?: Date;
    lastUpdated?: Date;
    dateCreated?: Date;
}
export { DefensiveCredit, Player, ThrowRoll, Game, StartGameCommand, HitResult, PitchResult, RollChart, ContactTypeRollInput, FielderChanceRollInput, ShallowDeepRollInput, HitterHandednessRollInput, PitcherHandednessRollInput, PowerRollInput, ShallowDeepChance, TeamInfo, FielderChance, LastPlay, UpcomingMatchup, InningEndingEvent, LeagueAverage, Lineup, LineupPlayer, RotationPitcher, HalfInning, RunnerResult, Score, Pitch, RunnerEvent, Play, Count, PitcherChange, HitterChange, PitchResultCount, HitResultCount, MatchupHandedness, GamePlayer, GamePlayerBio, HitterStatLine, PitcherStatLine, SimPitchResult, SimPitchCommand, PitchLog, RunnerThrowCommand, Team, Colors, ContactProfile, PitchRatings, PitchingHandednessRatings, HittingRatings, HittingHandednessRatings };
