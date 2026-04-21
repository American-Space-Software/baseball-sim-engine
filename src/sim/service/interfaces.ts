import { BaseResult, Contact, DefenseCreditType, Handedness, HomeAway, OfficialPlayResult, OfficialRunnerResult, PitchCall, PitchType, PitchZone, PlayResult, Position, ShallowDeep, ThrowResult } from "./enums.js"

interface StartGameCommand {
    game:Game, 
    home:Team, 
    homeTeamOptions:any,
    homePlayers:Player[], 
    homeLineup:Lineup
    homeStartingPitcher:RotationPitcher, 
    away:Team, 
    awayTeamOptions:any,   
    awayLineup:Lineup 
    awayPlayers:Player[], 
    awayStartingPitcher:RotationPitcher,
    pitchEnvironmentTarget?:PitchEnvironmentTarget
    date:Date
}

interface SimPitchCommand {

    game:Game
    play:Play

    offense:TeamInfo
    defense:TeamInfo

    hitter:GamePlayer
    pitcher:GamePlayer

    hitterChange:HitterChange
    pitcherChange:PitcherChange

    catcher:GamePlayer

    halfInningRunnerEvents:RunnerEvent[]
    halfInning:HalfInning
    
    pitchEnvironmentTarget:PitchEnvironmentTarget

    matchupHandedness:MatchupHandedness

    rng:any

}

interface RunnerThrowCommand {
    gameRNG: () => number
    runnerResult:RunnerResult
    allEvents:RunnerEvent[]
    runnerEvents:RunnerEvent[]
    runnerEvent:RunnerEvent
    hitterEvent:RunnerEvent
    defensiveCredits:DefensiveCredit[]
    start:BaseResult
    end:BaseResult
    eventType: PlayResult|OfficialRunnerResult
    eventTypeOut: PlayResult|OfficialRunnerResult
    pitchEnvironmentTarget:PitchEnvironmentTarget
    pitcher:GamePlayer
    defense:TeamInfo
    offense:TeamInfo
    throwFrom:GamePlayer
    chanceRunnerSafe:number
    isForce:boolean
    isFieldersChoice:boolean
    pitchIndex:number
}

interface Game {
    _id: string

    away: TeamInfo
    home: TeamInfo

    count: Count
    score: Score
    halfInnings?: HalfInning[]

    playIndex: number

    pitchEnvironmentTarget:PitchEnvironmentTarget


    currentInning: number
    summary?: any

    isStarted: boolean
    isTopInning: boolean
    isComplete: boolean
    isFinished: boolean

    winningPitcherId?: string
    losingPitcherId?: string

    winningTeamId?: string
    winningTeam?: Team

    losingTeamId?: string
    losingTeam?: Team

    teams?: Team[]

    currentSimDate?: Date
    startDate?: Date
    gameDate?: Date

    lastUpdated?: Date
    dateCreated?: Date
}

interface Player {

    _id: string

    tokenId?: number
    transactionHash?: string

    firstName: string
    lastName: string

    readonly fullName: string
    readonly displayName: string

    primaryPosition: Position
    zodiacSign: string

    throws: Handedness
    hits: Handedness

    isRetired: boolean

    stamina: number
    overallRating: number

    pitchRatings: PitchRatings
    hittingRatings: HittingRatings

    potentialOverallRating: number
    potentialPitchRatings: PitchRatings
    potentialHittingRatings: HittingRatings

    totalExperience?: string

    age: number

    lastGamePitched?: Date
    lastGamePlayed?: Date
    lastTeamChange?: Date

    lastUpdated?: Date
    dateCreated?: Date
}

interface Team {

    _id: string

    name?: string
    abbrev?: string

    colors: Colors
    // longTermRating: Rating
    // seasonRating: Rating

    lineups?: Lineup[]    


}

interface TeamInfo {

    _id?:string

    name:string
    abbrev:string
    homeAway:HomeAway
    
    color1?:string
    color2?:string

    players?:GamePlayer[]

    lineupIds?:string[]

    currentHitterIndex?:number
    currentPitcherId?:string

    //Runners
    runner1BId?:string
    runner2BId?:string
    runner3BId?:string

}

interface GamePlayerBio {

    _id:string
    fullName: string
    // ratingBefore:Rating

    age:number

    throws:Handedness
    hits:Handedness

    hitResult:HitterStatLine
    pitchResult:PitcherStatLine

}



interface HitterStatLine {

    teamWins:number
    teamLosses:number

    games: number
    pa: number
    atBats: number
    runs: number
    hits: number
    singles: number
    doubles: number
    triples: number
    homeRuns: number
    hbp:number 

    gidp:number
    po:number
    assists:number
    outfieldAssists:number

    e:number
    passedBalls:number

    csDefense:number
    doublePlays:number

    hbpPercent?:number
    singlePercent?:number
    doublePercent?:number
    triplePercent?:number
    homeRunPercent?:number
    bbPercent?:number
    soPercent?:number

    strikePercent?:number
    calledStrikesPercent?:number
    swingingStrikesPercent?:number    
    ballPercent?:number
    swingPercent?:number
    foulPercent?:number
    foulContactPercent?:number
    swingAtBallsPercent?:number
    swingAtStrikesPercent?:number
    inZonePercent?:number
    inZoneContactPercent?:number
    outZoneContactPercent?:number
    inPlayPercent?:number
    babip?:number

    groundBallPercent?:number
    flyBallPercent?:number
    ldPercent?:number
    popupPercent?:number

    rbi: number
    sb: number
    sbAttempts:number
    cs: number
    bb: number
    so: number
    avg?: number
    obp?: number
    slg?: number
    ops?: number
    wpa?:number

    avgPitchQuality: number
    avgPitchPowerQuality: number
    avgPitchLocationQuality: number
    avgPitchMovementQuality: number

    runsPerGame?:number  
    sbPerGame?:number  
    sbAttemptsPerGame?:number
    pitchesPerPA?:number
}

interface PitcherStatLine {
    games: number
    wins: number
    losses: number
    winPercent?:number
    era?: number
    starts: number
    outs: number
    cg: number
    sho: number
    saves: number
    ip?: string
    atBats: number
    battersFaced: number
    hits: number
    runs: number
    er: number
    homeRuns: number
    bb: number
    so: number
    hbp: number
    wpa:number 
    wildPitches:number

    singlePercent?:number
    doublePercent?:number
    triplePercent?:number
    homeRunPercent?:number

    hbpPercent?:number
    bbPercent?:number
    soPercent?:number
    strikePercent?:number
    calledStrikesPercent?:number
    swingingStrikesPercent?:number
    ballPercent?:number
    swingPercent?:number
    inPlayPercent?:number
    foulPercent?:number
    foulContactPercent?:number
    wildPitchPercent?:number
    swingAtBallsPercent?:number
    swingAtStrikesPercent?:number
    inZonePercent?:number
    inZoneContactPercent?:number
    outZoneContactPercent?:number
    babip?:number

    groundBallPercent?:number
    flyBallPercent?:number
    ldPercent?:number
    popupPercent?:number

    avgPitchQuality: number
    avgPitchPowerQuality: number
    avgPitchLocationQuality: number
    avgPitchMovementQuality: number

    runsPerGame?:number
    pitchesPerGame?:number
    pitchesPerPA?:number

}

interface Colors {
    color1:string
    color2:string
}

interface SimPitchResult {
    continueAtBat:boolean
    pitch:Pitch
}

interface PitchLog {
    pitches: Pitch[]
    count: PitchCount
}

interface Pitch {
    intentZone:PitchZone,
    actualZone:PitchZone,
    result: PitchCall,
    count?: Count,
    type: PitchType,
    quality: PitchQuality
    contactQuality?:ContactQuality
    overallContactQuality?: number
    overallQuality: number
    powQ: number,
    movQ: number,
    locQ: number,
    swing: boolean
    inZone:boolean
    isWP:boolean
    isPB:boolean
    con:boolean
    guess:boolean
}

interface PitchCount {
    balls: number
    strikes: number
    fouls: number
    pitches: number
}

interface ShallowDeepChance {
    shallow: number
    normal: number
    deep: number
}

interface FielderChance {
    first: number
    second: number
    third: number
    catcher: number
    shortstop: number
    leftField: number
    centerField: number
    rightField: number
    pitcher: number
}



interface ContactProfile {
    groundball:number
    flyBall:number
    lineDrive:number
}

interface PitchRatings {

    power?:number

    contactProfile?:ContactProfile

    vsR?:PitchingHandednessRatings
    vsL?:PitchingHandednessRatings

    pitches?:PitchType[]
}

interface PitchingHandednessRatings {

    control?:number
    movement?:number 

}

interface HittingRatings {

    defense?:number
    arm?:number

    speed?:number
    steals?:number

    contactProfile?:ContactProfile

    vsR?:HittingHandednessRatings
    vsL?:HittingHandednessRatings

}

interface HittingHandednessRatings {

    plateDiscipline?:number
    contact?:number 

    gapPower?:number
    homerunPower?:number

}

interface GamePlayer {
    _id:string
    fullName: string
    firstName:string
    lastName:string
    displayName: string

    age:number

    teamId?:string

    overallRating: {
        before:number
    }

    color1:string
    color2:string

    throws:Handedness
    hits:Handedness

    pitchRatings:PitchRatings
    hittingRatings:HittingRatings

    currentPosition?:Position
    lineupIndex?:number

    hitResult:HitResultCount
    pitchResult:PitchResultCount

    hitterChange: {
        vsL: HitterChange
        vsR: HitterChange
    }

    pitcherChange: {
        vsL: PitcherChange
        vsR: PitcherChange
    }

    isPitcherOfRecord?:boolean
}

interface MatchupHandedness {
    throws: Handedness,
    hits: Handedness,
    vsSameHand: boolean
}

interface HitResultCount {

    games:number
    uniqueGames:number

    teamWins:number
    teamLosses:number
    
    pa:number
    atBats:number 
    hits:number 

    singles:number 
    doubles:number 
    triples:number 
    homeRuns:number

    runs:number 
    rbi:number 
    bb:number 
    sb:number
    sbAttempts:number
    cs:number
    hbp:number 
    so:number 
    lob:number 
    sacBunts:number 
    sacFlys:number

    groundOuts:number 
    flyOuts:number
    lineOuts:number
    outs:number
    
    groundBalls:number
    lineDrives:number
    flyBalls:number

    gidp:number
    po:number
    assists:number
    outfieldAssists:number
    e:number
    passedBalls:number

    csDefense:number
    doublePlays:number

    pitches:number
    balls:number
    strikes:number
    fouls:number

    swings:number
    swingAtBalls:number
    swingAtStrikes:number
    inZoneContact:number
    outZoneContact:number

    inZone:number

    calledStrikes:number
    swingingStrikes:number

    ballsInPlay:number

    totalPitchQuality: number
    totalPitchPowerQuality: number
    totalPitchLocationQuality: number
    totalPitchMovementQuality: number

    wpa:number

}

interface PitchResultCount {

    games:number
    uniqueGames:number

    teamWins:number
    teamLosses:number

    starts:number
    wins:number
    losses:number
    saves:number
    bs:number

    outs:number
    er:number
    so:number
    hits:number
    bb:number
    sho:number
    cg:number
    hbp:number

    singles:number
    doubles:number
    triples:number

    battersFaced:number
    atBats:number

    runs:number
    homeRuns:number

    groundOuts:number
    flyOuts:number

    lineOuts:number
    groundBalls:number
    lineDrives:number
    flyBalls:number

    pitches:number
    balls:number
    strikes:number
    fouls:number
    wildPitches:number

    swings:number
    swingAtBalls:number
    swingAtStrikes:number
    inZoneContact:number
    outZoneContact:number

    calledStrikes:number
    swingingStrikes:number

    ballsInPlay:number

    inZone:number
    ip:string

    sacFlys:number

    totalPitchQuality: number
    totalPitchPowerQuality: number
    totalPitchLocationQuality: number
    totalPitchMovementQuality: number

    wpa:number

}

interface PitcherChange {

    powerChange: number
    controlChange: number
    movementChange: number

    // pitchesChange:PitchChange[]

}

interface HitterChange {

    plateDisiplineChange: number
    contactChange: number

    gapPowerChange: number
    hrPowerChange: number

    speedChange: number
    stealsChange:number

    defenseChange:number
    armChange:number

}

interface DefensiveCredit { 
    _id:string
    type:DefenseCreditType
}

interface ThrowRoll {
    roll:number
    result:ThrowResult
}

interface RunnerEvent {

    pitchIndex:number

    pitcher: {
        _id: string
    }

    runner?: {
        _id: string
    }

    eventType?: PlayResult|OfficialRunnerResult

    movement?: {
        start?: BaseResult
        end?: BaseResult
        outBase?: BaseResult
        isOut?:boolean
        outNumber?:number
    }


    isUnearned?:boolean
    isScoringEvent?:boolean
    isForce?:boolean
    isFC?:boolean
    isWP?:boolean
    isPB?:boolean
    isError?:boolean

    isSBAttempt?:boolean
    isSB?:boolean
    isCS?:boolean

    throw?: {

        result: ThrowResult

        from?: {
            _id?: string,
            position?:Position
        },

        to?: {
            _id?:string,
            position:Position
        }
    }
}

interface RunnerResult {
    first: string
    second: string
    third: string
    scored: string[]
    out: string[]
}

interface Count {
    balls: number
    strikes: number
    outs: number
}

interface Score {
    away:number
    home:number
}

interface UpcomingMatchup {
    hitter: GamePlayer
    pitcher: GamePlayer
}

interface LastPlay {
    hitter:GamePlayerBio
    pitcher:GamePlayerBio
    play: Play
    inning: number
    top: boolean
    first:GamePlayerBio
    second:GamePlayerBio
    third:GamePlayerBio
}

interface Play {
    index: number
    pitchLog: PitchLog
    result?: PlayResult
    officialPlayResult?: OfficialPlayResult|OfficialRunnerResult

    runner: {
        events: RunnerEvent[]
        result: {
            start: RunnerResult
            end: RunnerResult
        }
    }

    credits:DefensiveCredit[]
    contact?: Contact
    shallowDeep?: ShallowDeep
    fielder?: Position
    fielderId?:string

    matchupHandedness:MatchupHandedness

    hitterId: string
    pitcherId: string
    catcherId:string

    count: {
        start: Count
        end?: Count
    }
    score: {
        start: Score
        end?: Score
    }
    inningNum: number
    inningTop: boolean
}

interface HalfInning {
    num: number
    top: boolean
    linescore: LinescoreTeam
    plays: Play[]
}

interface LinescoreTeam {
    runs: number
    hits: number
    errors: number
    leftOnBase: number
}

interface Lineup {
    order?:LineupPlayer[]
    rotation?:RotationPitcher[]
    valid?:boolean
}

interface LineupPlayer {
    _id?:string
    position?:Position
}

interface RotationPitcher {
    _id?:string
    stamina?:number
}


interface RollChart {
    entries?: Map<number,string>
}

interface ContactTypeRollInput {
    groundball: number
    flyBall:number    
    lineDrive:number
}

interface FielderChanceRollInput {
    first:number
    second:number
    third:number
    catcher:number
    shortstop:number
    leftField:number
    centerField:number
    rightField:number
    pitcher:number
}

interface ShallowDeepRollInput {
    shallow:number
    normal: number
    deep: number
}

interface HitterHandednessRollInput {
    left:number
    right: number
    switch: number
}

interface PitcherHandednessRollInput {
    left:number
    right: number
}

interface PowerRollInput {
    out:number
    singles: number
    doubles: number
    triples: number
    hr: number
}

class InningEndingEvent extends Error {}


interface PitchCountBehaviorTarget {
    balls: number
    strikes: number

    zoneSwingPercent: number
    chaseSwingPercent: number

    zoneContactPercent: number
    chaseContactPercent: number

    foulContactPercent: number
    inPlayPercentOfContact: number
    inPlayPercentOfFairContact: number
}

interface PitchPhysics {
    velocity: {
        count: number
        total: number
        totalSquared: number
        avg: number
    }
    horizontalBreak: {
        count: number
        total: number
        totalSquared: number
        avg: number
    }
    verticalBreak: {
        count: number
        total: number
        totalSquared: number
        avg: number
    }
    byPitchType: Partial<Record<PitchType, {
        count: number
        totalVelocity: number
        totalVelocitySquared: number
        avgVelocity: number
        totalHorizontalBreak: number
        totalHorizontalBreakSquared: number
        avgHorizontalBreak: number
        totalVerticalBreak: number
        totalVerticalBreakSquared: number
        avgVerticalBreak: number
    }>>
}

interface BattedBallPhysics {
    exitVelocity: {
        count: number
        total: number
        totalSquared: number
        avg: number
    }
    launchAngle: {
        count: number
        total: number
        totalSquared: number
        avg: number
    }
    distance: {
        count: number
        total: number
        totalSquared: number
        avg: number
    }
    byTrajectory: {
        groundBall: {
            count: number
            totalExitVelocity: number
            totalExitVelocitySquared: number
            avgExitVelocity: number
            totalLaunchAngle: number
            totalLaunchAngleSquared: number
            avgLaunchAngle: number
            totalDistance: number
            totalDistanceSquared: number
            avgDistance: number
        }
        flyBall: {
            count: number
            totalExitVelocity: number
            totalExitVelocitySquared: number
            avgExitVelocity: number
            totalLaunchAngle: number
            totalLaunchAngleSquared: number
            avgLaunchAngle: number
            totalDistance: number
            totalDistanceSquared: number
            avgDistance: number
        }
        lineDrive: {
            count: number
            totalExitVelocity: number
            totalExitVelocitySquared: number
            avgExitVelocity: number
            totalLaunchAngle: number
            totalLaunchAngleSquared: number
            avgLaunchAngle: number
            totalDistance: number
            totalDistanceSquared: number
            avgDistance: number
        }
        popup: {
            count: number
            totalExitVelocity: number
            totalExitVelocitySquared: number
            avgExitVelocity: number
            totalLaunchAngle: number
            totalLaunchAngleSquared: number
            avgLaunchAngle: number
            totalDistance: number
            totalDistanceSquared: number
            avgDistance: number
        }
    }
}

interface BattedBallOutcomeByEvLaBucket {
    evBin: number
    laBin: number
    count: number
    out: number
    single: number
    double: number
    triple: number
    hr: number
}


interface BattedBallXyByTrajectoryBucket {
    trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup"
    xBin: number
    yBin: number
    count: number
}

interface BattedBallXyByTrajectoryEvLaBucket {
    trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup"
    evBin: number
    laBin: number
    xBin: number
    yBin: number
    count: number
}

interface BattedBallSprayByTrajectoryBucket {
    trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup"
    sprayBin: number
    count: number
}

interface BattedBallSprayByTrajectoryEvLaBucket {
    trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup"
    evBin: number
    laBin: number
    sprayBin: number
    count: number
}

interface RunningAdvancementTarget {
    runnerOnFirstToThirdOnSingle: number
    runnerOnFirstToHomeOnDouble: number
    runnerOnSecondToHomeOnSingle: number
    runnerOnSecondToHomeOnDouble: number
    runnerOnThirdToHomeOnFlyBallShallow: number
    runnerOnThirdToHomeOnFlyBallNormal: number
    runnerOnThirdToHomeOnFlyBallDeep: number
    runnerOnSecondToThirdOnGroundBall: number
    runnerOnThirdToHomeOnGroundBall: number
}

interface PitchEnvironmentTarget {
    
    season: number
    avgRating:number

    pitch: {
        inZonePercent: number
        strikePercent: number
        ballPercent: number
        swingPercent: number
        foulContactPercent: number
        pitchesPerPA: number
        inZoneByCount: InZoneByCount[]
    }

    swing: {
        swingAtStrikesPercent: number
        swingAtBallsPercent: number
        inZoneContactPercent: number
        outZoneContactPercent: number

        zoneSwingBase: number
        chaseSwingBase: number

        zoneContactBase: number
        chaseContactBase: number

        behaviorByCount: PitchCountBehaviorTarget[]
    }

    battedBall: {
        inPlayPercent: number
        contactRollInput: ContactTypeRollInput
        powerRollInput: PowerRollInput
        outcomeByEvLa: BattedBallOutcomeByEvLaBucket[]
        xy: {
            byTrajectory: BattedBallXyByTrajectoryBucket[]
            byTrajectoryEvLa: BattedBallXyByTrajectoryEvLaBucket[]
        }
        spray: {
            byTrajectory: BattedBallSprayByTrajectoryBucket[]
            byTrajectoryEvLa: BattedBallSprayByTrajectoryEvLaBucket[]
        }
    }


    running: {
        steal: StolenBaseByCount[]
        extraBaseTakenRate: number 
        advancement: RunningAdvancementTarget
    }
    

    fielderChance: {
        vsR: FielderChance
        vsL: FielderChance
        shallowDeep: ShallowDeepChance
    }

    outcome: {
        avg: number
        obp: number
        slg: number
        ops: number
        babip: number
        homeRunPercent: number
        doublePercent: number
        triplePercent: number
        bbPercent: number
        soPercent: number
        hbpPercent?: number
    }

    team: {
        runsPerGame: number
        hitsPerGame: number
        homeRunsPerGame: number
        bbPerGame: number
        soPerGame: number
        sbPerGame: number
        sbAttemptsPerGame: number
    }

    importReference: {
        hitter: {
            games: number
            pa: number
            ab: number

            hits: number
            doubles: number
            triples: number
            homeRuns: number
            bb: number
            so: number
            hbp: number

            groundBalls: number
            flyBalls: number
            lineDrives: number
            popups: number

            pitchesSeen: number
            ballsSeen: number
            strikesSeen: number

            swings: number
            swingAtBalls: number
            swingAtStrikes: number

            calledStrikes: number
            swingingStrikes: number

            inZonePitches: number
            inZoneContact: number
            outZoneContact: number

            fouls: number
            ballsInPlay: number

            physics: BattedBallPhysics
        }

        pitcher: {
            games: number
            starts: number

            battersFaced: number
            outs: number

            hitsAllowed: number
            doublesAllowed: number
            triplesAllowed: number
            homeRunsAllowed: number
            bbAllowed: number
            so: number
            hbpAllowed: number

            groundBallsAllowed: number
            flyBallsAllowed: number
            lineDrivesAllowed: number
            popupsAllowed: number

            pitchesThrown: number
            ballsThrown: number
            strikesThrown: number

            swingsInduced: number
            swingAtBallsAllowed: number
            swingAtStrikesAllowed: number

            inZoneContactAllowed: number
            outZoneContactAllowed: number

            foulsAllowed: number
            ballsInPlayAllowed: number

            physics: PitchPhysics
        }

        fielding: {
            errors: number
            assists: number
            putouts: number
            chances: number
            doublePlays: number
            doublePlayOpportunities: number

            outfieldAssists: number
            catcherCaughtStealing: number
            catcherStolenBasesAllowed: number
            passedBalls: number

            throwsAttempted: number
            successfulThrowOuts: number
        }

        running: {

            sb: number
            cs: number
            sbAttempts: number
            timesOnFirst: number
            extraBaseTaken: number
            extraBaseOpportunities: number
        }

        splits: {
            hitting: {
                vsL: PlayerHittingSplitStats
                vsR: PlayerHittingSplitStats
            }
            pitching: {
                vsL: PlayerPitchingSplitStats
                vsR: PlayerPitchingSplitStats
            }
        }
    }

    pitchEnvironmentTuning?: PitchEnvironmentTuning
}

interface PitchEnvironmentTuning {

    _id:string

    tuning?: {


        contactQuality: {
            evScale: number
            laScale: number
            distanceScale: number
            fullPitchQualityBonus: number
        }

        swing: {
            pitchQualityZoneSwingEffect: number
            pitchQualityChaseSwingEffect: number
            disciplineZoneSwingEffect: number
            disciplineChaseSwingEffect: number
        }

        contact: {
            pitchQualityContactEffect: number
            contactSkillEffect: number
        }

        running: {
            stealAttemptAggressionScale:number
        },

        defense: {
            fullTeamDefenseBonus: number
            fullFielderDefenseBonus: number
        }

    }

    ratingTuning?: {
        hitting: {
            overallPlateDisciplineScale: number
            splitPlateDisciplineScale: number

            overallContactScale: number
            splitContactScale: number
            contactSkillScale: number
            contactDecisionScale: number
            contactEvScale: number

            overallGapPowerScale: number
            splitGapPowerScale: number

            overallHrPowerScale: number
            splitHrPowerScale: number
            hrEvScale: number
        }

        pitching: {
            minFastball: number
            maxFastball: number
            veloScale: number
            kScale: number
            baselinePowerScale: number

            overallControlScale: number
            splitControlScale: number
            strikeoutControlHelpScale: number

            overallMovementScale: number
            splitMovementScale: number
            arsenalMovementScale: number
            contactSuppressionScale: number
            missBatScale: number
        }
    }

}

interface InZoneByCount {
    balls:number
    strikes:number
    inZone:number
}

interface StolenBaseByCount {
    balls:number
    strikes:number
    
    attempt2BChance:number
    attempt2BSuccess:number    
    
    attempt3BChance:number
    attempt3BSuccess:number
    
}

interface PlayerFromStatsCommand {
    
    season: number

    playerId: string
    firstName: string
    lastName: string

    age?: number

    primaryPosition: Position
    secondaryPositions?: Position[]

    throws: Handedness
    hits: Handedness

    primaryRole: "hitter" | "pitcher" | "twoWay"

    hitter: PlayerHittingStats
    pitcher: PlayerPitchingStats

    fielding: PlayerFieldingStats
    running: PlayerRunningStats

    splits: PlayerSplitsStats

    pitchEnvironmentTarget:PitchEnvironmentTarget
    playerImportBaseline: PlayerImportBaseline
    leagueImportBaseline: PlayerImportBaseline
}

interface PlayerHittingStats {
    games: number
    pa: number
    ab: number

    hits: number
    doubles: number
    triples: number
    homeRuns: number
    bb: number
    so: number
    hbp: number

    groundBalls: number
    flyBalls: number
    lineDrives: number
    popups: number

    pitchesSeen: number
    ballsSeen: number
    strikesSeen: number

    swings: number
    swingAtBalls: number
    swingAtStrikes: number

    calledStrikes: number
    swingingStrikes: number

    inZonePitches: number
    inZoneContact: number
    outZoneContact: number

    fouls: number
    ballsInPlay: number

    exitVelocity?: ExitVelocityStat
}

interface PlayerPitchingStats {
    games: number
    starts: number

    battersFaced: number
    outs: number

    hitsAllowed: number
    doublesAllowed: number
    triplesAllowed: number
    homeRunsAllowed: number
    bbAllowed: number
    so: number
    hbpAllowed: number

    groundBallsAllowed: number
    flyBallsAllowed: number
    lineDrivesAllowed: number
    popupsAllowed: number

    pitchesThrown: number
    ballsThrown: number
    strikesThrown: number

    swingsInduced: number
    swingAtBallsAllowed: number
    swingAtStrikesAllowed: number

    inZoneContactAllowed: number
    outZoneContactAllowed: number

    foulsAllowed: number
    ballsInPlayAllowed: number

    pitchTypes?: Partial<Record<PitchType, PitchTypeMovementStat>>
}

interface PlayerFieldingStats {
    gamesAtPosition?: Partial<Record<Position, number>>
    inningsAtPosition?: Partial<Record<Position, number>>

    errors?: number
    assists?: number
    putouts?: number
    doublePlays?: number

    outfieldAssists?: number
    catcherCaughtStealing?: number
    catcherStolenBasesAllowed?: number
    passedBalls?: number
}

interface PlayerRunningStats {
    sb?: number
    cs?: number
    sbAttempts?: number
}

interface PlayerSplitsStats {
    hitting: {
        vsL: PlayerHittingSplitStats
        vsR: PlayerHittingSplitStats
    }
    pitching: {
        vsL: PlayerPitchingSplitStats
        vsR: PlayerPitchingSplitStats
    }
}

interface PlayerHittingSplitStats {
    pa: number
    ab: number

    hits: number
    doubles: number
    triples: number
    homeRuns: number
    bb: number
    so: number
    hbp: number

    swings?: number
    swingAtBalls?: number
    swingAtStrikes?: number
    calledStrikes?: number
    swingingStrikes?: number
    inZoneContact?: number
    outZoneContact?: number

    exitVelocity: number
}

interface PlayerPitchingSplitStats {
    battersFaced: number
    outs: number

    hitsAllowed: number
    doublesAllowed: number
    triplesAllowed: number
    homeRunsAllowed: number
    bbAllowed: number
    so: number
    hbpAllowed: number

    swingsInduced?: number
    swingAtBallsAllowed?: number
    swingAtStrikesAllowed?: number
    inZoneContactAllowed?: number
    outZoneContactAllowed?: number
    foulsAllowed?: number
    ballsInPlayAllowed?: number
}

interface PlayerImportBaseline {
    hitting: {
        plateDisciplineBBPercent: number
        contactSOPercent: number
        gapPowerPercent: number
        homerunPowerPercent: number

        speedExtraBaseTakenPercent: number
        stealsAttemptPercent: number
        stealsSuccessPercent: number

        defenseErrorPercent: number
        defenseFieldingPlayPercent: number
        armThrowOutPercent: number
        defenseDoublePlayPercent: number

        catcherCaughtStealingPercent?: number
        catcherPassedBallPercent?: number
        outfieldAssistPercent?: number

        contactProfile: {
            groundball: number
            flyBall: number
            lineDrive: number
        }
    }
    pitching: {
        powerSOPercent: number
        controlBBPercent: number
        movementHRPercent: number
        contactProfile: {
            groundball: number
            flyBall: number
            lineDrive: number
        }
    }
}

interface ExitVelocityStat {
    count: number
    totalExitVelo: number
    avgExitVelo: number
}

interface LaunchAngleStat {
    count: number
    totalLaunchAngle: number
    avgLaunchAngle: number
}

interface DistanceStat {
    count: number
    totalDistance: number
    avgDistance: number
}

interface BattedBallCoordinateStat {
    count: number
    totalCoordX: number
    avgCoordX: number
    totalCoordY: number
    avgCoordY: number
}

interface BattedBallPhysicsStat {
    exitVelocity: ExitVelocityStat
    launchAngle: LaunchAngleStat
    distance: DistanceStat
    coordinates: BattedBallCoordinateStat
}

interface PitchTypeMovementStat {
    count: number
    totalMph: number
    avgMph: number
    totalHorizontalBreak: number
    avgHorizontalBreak: number
    totalVerticalBreak: number
    avgVerticalBreak: number
}

interface PlayerRunningStatsRaw {
    sb: number
    cs: number
    sbAttempts: number

    sb2B: number
    cs2B: number
    sb2BAttempts: number

    sb3B: number
    cs3B: number
    sb3BAttempts: number

    timesOnFirst: number
    timesOnSecond: number
    timesOnThird: number

    firstToThird: number
    firstToThirdOpportunities: number

    firstToHome: number
    firstToHomeOpportunities: number

    secondToHomeOnSingle: number
    secondToHomeOnSingleOpportunities: number

    secondToHomeOnDouble: number
    secondToHomeOnDoubleOpportunities: number

    thirdToHomeOnFlyBallShallow: number
    thirdToHomeOnFlyBallShallowOpportunities: number

    thirdToHomeOnFlyBallNormal: number
    thirdToHomeOnFlyBallNormalOpportunities: number

    thirdToHomeOnFlyBallDeep: number
    thirdToHomeOnFlyBallDeepOpportunities: number

    secondToThirdOnGroundBall: number
    secondToThirdOnGroundBallOpportunities: number

    thirdToHomeOnGroundBall: number
    thirdToHomeOnGroundBallOpportunities: number

    extraBaseTaken: number
    extraBaseOpportunities: number

    pickedOff: number
    pickoffAttemptsFaced: number

    advancedOnGroundOut: number
    advancedOnFlyOut: number
    tagUps: number

    heldOnBase: number
}

interface PlayerFieldingPositionRaw {
    chances: number
    putouts: number
    assists: number
    errors: number
    doublePlays: number
    doublePlayOpportunities: number
    outsRecorded: number

    fieldedBalls: number
    groundBallsFielded: number
    flyBallsFielded: number
    lineDrivesFielded: number
    popupsFielded: number

    throwsAttempted: number
    successfulThrowOuts: number

    battedBallOpportunitiesByLocation: Partial<Record<string, number>>
}

interface PlayerPitchCountZoneRaw {
    balls: number
    strikes: number
    inZone: number
    total: number
}

interface PlayerPitchCountBehaviorRaw {
    balls: number
    strikes: number

    zonePitches: number
    chasePitches: number

    zoneSwings: number
    chaseSwings: number

    zoneContact: number
    chaseContact: number

    zoneMisses: number
    chaseMisses: number

    zoneFouls: number
    chaseFouls: number

    zoneBallsInPlay: number
    chaseBallsInPlay: number
}

interface BattedBallOutcomeBucketRaw {
    evBin: number
    laBin: number
    count: number
    out: number
    single: number
    double: number
    triple: number
    hr: number
}

interface BattedBallXyBucketRaw {
    xBin: number
    yBin: number
    count: number
}

interface BattedBallXyByTrajectoryBucketRaw extends BattedBallXyBucketRaw {
    trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup"
}

interface BattedBallXyByTrajectoryEvLaBucketRaw extends BattedBallXyBucketRaw {
    trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup"
    evBin: number
    laBin: number
}

interface BattedBallSprayByTrajectoryBucketRaw {
    trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup"
    sprayBin: number
    count: number
}

interface BattedBallSprayByTrajectoryEvLaBucketRaw {
    trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup"
    evBin: number
    laBin: number
    sprayBin: number
    count: number
}

interface PlayerImportRaw {
    playerId: string
    firstName: string
    lastName: string

    age?: number

    primaryPosition: Position
    secondaryPositions?: Position[]

    throws: Handedness
    bats: Handedness

    primaryRole: "hitter" | "pitcher" | "twoWay"

    hitting: {
        games: number
        pa: number
        ab: number

        hits: number
        doubles: number
        triples: number
        homeRuns: number
        bb: number
        so: number
        hbp: number

        groundBalls: number
        flyBalls: number
        lineDrives: number
        popups: number

        pitchesSeen: number
        ballsSeen: number
        strikesSeen: number

        swings: number
        swingAtBalls: number
        swingAtStrikes: number

        calledStrikes: number
        swingingStrikes: number

        inZonePitches: number
        inZoneContact: number
        outZoneContact: number

        fouls: number
        ballsInPlay: number

        inZoneByCount: PlayerPitchCountZoneRaw[]
        behaviorByCount: PlayerPitchCountBehaviorRaw[]

        exitVelocity: ExitVelocityStat
        launchAngle: LaunchAngleStat
        distance: DistanceStat
        coordinates: BattedBallCoordinateStat

        physicsByTrajectory: {
            groundBall: BattedBallPhysicsStat
            flyBall: BattedBallPhysicsStat
            lineDrive: BattedBallPhysicsStat
            popup: BattedBallPhysicsStat
        }

        battedBallLocation: Partial<Record<string, number>>
        battedBallHardness: {
            soft: number
            medium: number
            hard: number
        }

        outcomeByEvLa: BattedBallOutcomeBucketRaw[]
        xyByTrajectory: BattedBallXyByTrajectoryBucketRaw[]
        xyByTrajectoryEvLa: BattedBallXyByTrajectoryEvLaBucketRaw[]
        sprayByTrajectory: BattedBallSprayByTrajectoryBucketRaw[]
        sprayByTrajectoryEvLa: BattedBallSprayByTrajectoryEvLaBucketRaw[]
    }

    pitching: {
        games: number
        starts: number

        battersFaced: number
        outs: number

        hitsAllowed: number
        doublesAllowed: number
        triplesAllowed: number
        homeRunsAllowed: number
        bbAllowed: number
        so: number
        hbpAllowed: number

        groundBallsAllowed: number
        flyBallsAllowed: number
        lineDrivesAllowed: number
        popupsAllowed: number

        pitchesThrown: number
        ballsThrown: number
        strikesThrown: number

        swingsInduced: number
        swingAtBallsAllowed: number
        swingAtStrikesAllowed: number

        inZoneContactAllowed: number
        outZoneContactAllowed: number

        foulsAllowed: number
        ballsInPlayAllowed: number

        inZoneByCount: PlayerPitchCountZoneRaw[]
        behaviorByCount: PlayerPitchCountBehaviorRaw[]

        pitchTypes: Partial<Record<PitchType, PitchTypeMovementStat>>

        exitVelocityAllowed: ExitVelocityStat
        launchAngleAllowed: LaunchAngleStat
        distanceAllowed: DistanceStat
        coordinatesAllowed: BattedBallCoordinateStat

        physicsAllowedByTrajectory: {
            groundBall: BattedBallPhysicsStat
            flyBall: BattedBallPhysicsStat
            lineDrive: BattedBallPhysicsStat
            popup: BattedBallPhysicsStat
        }

        battedBallLocationAllowed: Partial<Record<string, number>>
        battedBallHardnessAllowed: {
            soft: number
            medium: number
            hard: number
        }

        outcomeAllowedByEvLa: BattedBallOutcomeBucketRaw[]
        xyAllowedByTrajectory: BattedBallXyByTrajectoryBucketRaw[]
        xyAllowedByTrajectoryEvLa: BattedBallXyByTrajectoryEvLaBucketRaw[]
        sprayAllowedByTrajectory: BattedBallSprayByTrajectoryBucketRaw[]
        sprayAllowedByTrajectoryEvLa: BattedBallSprayByTrajectoryEvLaBucketRaw[]
    }

    fielding: {
        gamesAtPosition: Partial<Record<Position, number>>
        inningsAtPosition: Partial<Record<Position, number>>

        errors: number
        assists: number
        putouts: number
        doublePlays: number
        doublePlayOpportunities: number

        outfieldAssists: number
        catcherCaughtStealing: number
        catcherStolenBasesAllowed: number
        passedBalls: number

        fieldedBalls: number
        groundBallsFielded: number
        flyBallsFielded: number
        lineDrivesFielded: number
        popupsFielded: number

        throwsAttempted: number
        successfulThrowOuts: number

        battedBallOpportunitiesByLocation: Partial<Record<string, number>>

        chances: number
        positionStats: Partial<Record<Position, PlayerFieldingPositionRaw>>
    }

    running: PlayerRunningStatsRaw

    splits: {
        hitting: {
            vsL: PlayerHittingSplitStats
            vsR: PlayerHittingSplitStats
        }
        pitching: {
            vsL: PlayerPitchingSplitStats
            vsR: PlayerPitchingSplitStats
        }
    }
}

interface ContactQuality {
    launchAngle: number
    exitVelocity: number
    distance: number
    coordX: number
    coordY: number
}


interface PitchQuality {
    velocity: number
    horizontalBreak: number
    verticalBreak: number
}



export {
    PitchQuality, ContactQuality, StolenBaseByCount,  PitchCount, InZoneByCount,  PitchEnvironmentTarget, DefensiveCredit, Player, ThrowRoll, Game, StartGameCommand, RollChart, ContactTypeRollInput, FielderChanceRollInput, ShallowDeepRollInput, HitterHandednessRollInput, PitcherHandednessRollInput, PowerRollInput, ShallowDeepChance,
    TeamInfo, FielderChance, LastPlay, UpcomingMatchup, InningEndingEvent,  Lineup, LineupPlayer, RotationPitcher, HalfInning, RunnerResult, Score,
    Pitch, RunnerEvent, Play, Count, PitcherChange, HitterChange, PitchResultCount,HitResultCount, MatchupHandedness,
    GamePlayer, GamePlayerBio, HitterStatLine, PitcherStatLine, SimPitchResult, SimPitchCommand, PitchLog, RunnerThrowCommand, Team,
    Colors, ContactProfile, PitchRatings, PitchingHandednessRatings, HittingRatings, HittingHandednessRatings,     PlayerFromStatsCommand,
    PlayerHittingStats,
    PlayerPitchingStats,
    PlayerFieldingStats,
    PlayerRunningStats,
    PlayerSplitsStats,
    PlayerHittingSplitStats,
    PlayerPitchingSplitStats,
    PlayerImportBaseline,
    PlayerImportRaw,
    PitchTypeMovementStat,
    ExitVelocityStat,
    PlayerFieldingPositionRaw,
    PlayerRunningStatsRaw,
    PitchEnvironmentTuning,
    BattedBallCoordinateStat,
    BattedBallPhysicsStat,
    DistanceStat,
    LaunchAngleStat,
    PitchPhysics,
    BattedBallPhysics,
    BattedBallOutcomeBucketRaw,
    BattedBallXyBucketRaw,
    BattedBallXyByTrajectoryBucketRaw,
    BattedBallXyByTrajectoryEvLaBucketRaw
}