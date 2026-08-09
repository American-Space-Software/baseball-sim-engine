# baseball-sim-engine API

Complete TypeScript API reference for `baseball-sim-engine`.

The package exposes three entry points:

-   `baseball-sim-engine` --- simulation runtime, services, enums, and
    public game types.
-   `baseball-sim-engine/importer` --- MLB data preparation, player
    imports, and pitch-environment generation.
-   `baseball-sim-engine/ratings` --- rating-history synchronization,
    rating-input materialization, and player-rating generation.

------------------------------------------------------------------------

## Installation

``` bash
npm install baseball-sim-engine
```

`baseball-database` is installed as a package dependency and is used by
the importer to synchronize and query MLB data.

Applications that also want to query the database directly can install
it explicitly:

``` bash
npm install baseball-database
```

------------------------------------------------------------------------

## Entry Points

### Simulation Runtime

``` ts
import {
    simService
} from "baseball-sim-engine"
```

### Importer

The importer is available from:

``` ts
import {
    exportPitchEnvironmentTarget,
    playerImportService
} from "baseball-sim-engine/importer"
```

The importer uses `baseball-database` as its MLB data source and is
responsible for building player imports and pitch environments.

------------------------------------------------------------------------

## `exportPitchEnvironmentTarget`

``` ts
import {
    exportPitchEnvironmentTarget
} from "baseball-sim-engine/importer"

const result = await exportPitchEnvironmentTarget(
    2025,
    "./data"
)

console.log(result.pitchEnvironment)
```

Builds and writes the pitch environment for a season.

The output is written to:

``` text
data/2025/_pitch_environment_target.json
```

The returned result contains the generated pitch environment together
with the player imports used to build it.

### `ExportPitchEnvironmentTargetResult`

``` ts
interface ExportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget
    players: Map<string, PlayerImportRaw>
}
```

------------------------------------------------------------------------

## `playerImportService`

``` ts
import {
    playerImportService
} from "baseball-sim-engine/importer"
```

The default player-import service builds MLB-derived player inputs used
by pitch-environment generation.

The importer reads normalized historical data from `baseball-database`;
raw stored MLB game feeds remain canonical there.

------------------------------------------------------------------------

# Ratings

The ratings API is available from:

``` ts
import {
    downloadService,
    exportPlayerRatings,
    playerRatingService
} from "baseball-sim-engine/ratings"
```

The ratings entry point owns rating-history synchronization, derived
rating-input materialization, and player-rating generation.

------------------------------------------------------------------------

## `exportPlayerRatings`

``` ts
import {
    exportPlayerRatings
} from "baseball-sim-engine/ratings"

const playerRatings = await exportPlayerRatings(
    2025,
    "./data"
)
```

Generates and writes player ratings for a season.

The season pitch environment must already exist at:

``` text
data/2025/_pitch_environment_target.json
```

Ratings are written to:

``` text
data/2025/_player_ratings.json
```

Before ratings are generated, the required rating history is
synchronized through the requested season.

For a completed historical season, ratings are generated through January
1 of the following year. For the current season, ratings are generated
through the current date.

------------------------------------------------------------------------

## `playerRatingService`

``` ts
import {
    playerRatingService
} from "baseball-sim-engine/ratings"
```

The default rating service builds engine-compatible player ratings from
materialized historical and recent player inputs.

Rating history is split between per-appearance player rating inputs and
season-level player rating inputs for efficient loading of older
history.

Per-appearance inputs contain one row per player appearance per game.
Season inputs are derived aggregations. Both can be rebuilt from the
canonical games stored in `baseball-database`.

------------------------------------------------------------------------

## `downloadService`

``` ts
import {
    downloadService
} from "baseball-sim-engine/ratings"
```

The shared download service synchronizes MLB game data and the derived
rating inputs required by the rating system.

### `syncSeason`

``` ts
await downloadService.syncSeason(2025)
```

Synchronizes a season and creates the derived rating inputs for
synchronized games.

### `syncRatingHistory`

``` ts
await downloadService.syncRatingHistory(2025)
```

Synchronizes the rating history required through the supplied season.

Completed historical seasons can be skipped when their rating data is
already complete. The current season remains eligible for
synchronization.

------------------------------------------------------------------------

## Repository Commands

Build the project first:

``` bash
npm run build
```

Download the current season:

``` bash
npm run download
```

Download a specific season:

``` bash
npm run download -- 2025
```

Download all required rating history:

``` bash
npm run download:all
```

Generate a pitch environment:

``` bash
npm run generate:env -- 2025
```

Generate player ratings:

``` bash
npm run generate:ratings -- 2025
```

These are repository scripts rather than a published `bin` executable.

------------------------------------------------------------------------

## `baseball-database`

The importer and ratings systems use `baseball-database` for canonical
MLB game data.

The database supplies:

-   Schedules
-   Raw game feeds
-   Player appearances
-   Plate appearances
-   Pitches
-   Runner movements
-   Fielding credits
-   Defensive events

The engine builds derived player imports, pitch environments, rating
inputs, season rating inputs, and player ratings from that data.

------------------------------------------------------------------------

# Public Type Declarations

The following types are re-exported from `baseball-sim-engine`.

``` ts
interface StartGameCommand {
    game:Game, 

    home:Team, 
    homeTeamOptions:any,
    homePlayers:Player[], 
    homeLineup:Lineup
    homeStartingPitcher:RotationPitcher, 
    homeAvailablePitchers: PitchingRole[],

    away:Team, 
    awayTeamOptions:any,   
    awayLineup:Lineup 
    awayPlayers:Player[], 
    awayStartingPitcher:RotationPitcher,
    awayAvailablePitchers: PitchingRole[],

    pitchEnvironmentTarget?:PitchEnvironmentTarget
    stadiumEnvironment?: StadiumEnvironment

    useDH:boolean
    date:Date
}

interface PitchingRole {
    playerId: string
    role: PitchingRoleType
    priority: number
}

interface ThrowRoll {
    roll:number
    result:ThrowResult
}

interface DefensiveCredit { 
    _id:string
    type:DefenseCreditType
}

interface PitchEnvironmentTarget {
    
    season: number
    avgRating:number

    homeFieldAdvantage: number

    pitch: {
        inZonePercent: number
        strikePercent: number
        ballPercent: number
        swingPercent: number
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

        evLaModel: Record<BattedBallTrajectory, BattedBallEvLaModel>
        outcomeModel: Record<BattedBallTrajectory, BattedBallOutcomeModel>
        sprayModel: Record<BattedBallTrajectory, BattedBallSprayModel>
        depthModel: Record<BattedBallTrajectory, BattedBallDepthModel>
        
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
            runsAllowed:number
            earnedRunsAllowed:number

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

interface StadiumEnvironment {
    team: string
    venue: string
    yearRange: string
    singles: number
    doubles: number
    triples: number
    hr: number
    walks: number
    strikeouts: number
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
    stadiumEnvironment?: StadiumEnvironment

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

    substitutions: GameSubstitution[]

    useDH:boolean

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
    maxPitchCount:number
    overallRating: number

    pitchRatings: PitchRatings
    hittingRatings: HittingRatings

    age: number

    lastGamePitched?: Date
    lastGamePlayed?: Date
    lastTeamChange?: Date

    lastUpdated?: Date
    dateCreated?: Date
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
    availablePitchers?: PitchingRole[]

    currentHitterIndex?:number
    currentPitcherId?:string

    //Runners
    runner1BId?:string
    runner2BId?:string
    runner3BId?:string


}

interface Team {

    _id: string

    name?: string
    abbrev?: string

    colors: Colors

    lineups?: Lineup[]    


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

interface UpcomingMatchup {
    hitter: GamePlayer
    pitcher: GamePlayer
}

interface Lineup {
    order?:LineupPlayer[]
    valid?:boolean
}

interface LineupPlayer {
    _id?:string
    position?:Position
}

interface RotationPitcher {
    _id?:string
}

interface HalfInning {
    num: number
    top: boolean
    linescore: LinescoreTeam
    plays: Play[]
}

interface RunnerResult {
    first: string
    second: string
    third: string
    scored: string[]
    out: string[]
}

interface Score {
    away:number
    home:number
}

interface Pitch {
    intentZone:PitchZone,
    actualZone:PitchZone,
    plateX: number,
    plateZ: number,
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

interface Count {
    balls: number
    strikes: number
    outs: number
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

interface MatchupHandedness {
    throws: Handedness,
    hits: Handedness,
    vsSameHand: boolean
}

interface GamePlayer {
    
    _id:string
    fullName: string
    firstName:string
    lastName:string
    displayName: string

    stamina:number
    maxPitchCount:number

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
    positions:Position[]
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

interface PowerRollInput {
    out:number
    singles: number
    doubles: number
    triples: number
    hr: number
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

    runsAllowed: number
    earnedRunsAllowed: number

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

        runsAllowed: number
        earnedRunsAllowed: number

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

interface PitchEnvironmentTuning {

    _id:string

    tuning?: {

        contactQuality: {
            evScale: number
            laScale: number
            distanceScale: number
            outOutcomeScale:number
            doubleOutcomeScale: number
            tripleOutcomeScale: number
            homeRunOutcomeScale: number
        }

        swing: {
            pitchQualityZoneSwingEffect: number
            pitchQualityChaseSwingEffect: number
            disciplineZoneSwingEffect: number
            disciplineChaseSwingEffect: number
            walkRateScale:number
        }

        contact: {
            pitchQualityContactEffect: number
            contactSkillEffect: number
        }

        running: {
            stealAttemptAggressionScale:number
            advancementAggressionScale:number 
        },

        meta: {
            fullPitchQualityBonus: number
            fullTeamDefenseBonus: number
            fullFielderDefenseBonus: number
        }

    }

}

interface RatingTuning {
    _id: string

    hitting: {
        contactScale: number
        plateDisciplineScale: number
        gapPowerScale: number
        homerunPowerScale: number
        splitScale: number
    }

    pitching: {
        powerScale: number
        controlScale: number
        movementScale: number
        splitScale: number
    }

    running: {
        speedScale: number
        stealsScale: number
    }

    fielding: {
        defenseScale: number
        armScale: number
    }
}
```

------------------------------------------------------------------------

# Supporting Public Shapes

These declarations support fields contained inside the exported types
above.

``` ts
interface GameSubstitution {
    
    inning: number
    top: boolean
    teamId: string

    outPlayerId: string
    inPlayerId: string

    lineupIndex?: number

    fromPosition?: Position
    toPosition?: Position

    isPitchingChange: boolean
    playIndex: number

    requiresPitcherChange?: boolean
    resolvedPitcherChange?: boolean
}

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

type BattedBallTrajectory = "groundBall" | "flyBall" | "lineDrive" | "popup"

interface BattedBallEvLaModel {
    count: number
    evMean: number
    evStdDev: number
    laMean: number
    laStdDev: number
    evLaCorrelation: number
}

interface BattedBallOutcomeFormula {
    intercept: number
    ev: number
    la: number
    ev2: number
    la2: number
    evLa: number
}

interface BattedBallOutcomeModel {
    out: BattedBallOutcomeFormula
    single: BattedBallOutcomeFormula
    double: BattedBallOutcomeFormula
    triple: BattedBallOutcomeFormula
    hr: BattedBallOutcomeFormula
}

interface BattedBallSprayModel {
    pullMean: number
    centerMean: number
    oppoMean: number
    pullShare: number
    centerShare: number
    oppoShare: number
    stdDev: number
}

interface BattedBallDepthModel {
    mean: number
    stdDev: number
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
```

------------------------------------------------------------------------

# Complete Example

``` ts
import seedrandom from "seedrandom"

import {
    Handedness,
    PitchingRoleType,
    Position,
    simService
} from "baseball-sim-engine"

import type {
    Game,
    Lineup,
    PitchEnvironmentTarget,
    PitchingRole,
    Player,
    RotationPitcher,
    StartGameCommand,
    Team
} from "baseball-sim-engine"

const away: Team = {
    _id: "away",
    name: "Away Team",
    abbrev: "AWY",
    colors: {
        color1: "#111111",
        color2: "#eeeeee"
    }
}

const home: Team = {
    _id: "home",
    name: "Home Team",
    abbrev: "HME",
    colors: {
        color1: "#222222",
        color2: "#dddddd"
    }
}

const awayPlayers: Player[] = buildAwayPlayers()
const homePlayers: Player[] = buildHomePlayers()

const awayLineup: Lineup = buildAwayLineup()
const homeLineup: Lineup = buildHomeLineup()

const awayStartingPitcher: RotationPitcher = {
    _id: "away-starter"
}

const homeStartingPitcher: RotationPitcher = {
    _id: "home-starter"
}

const awayAvailablePitchers: PitchingRole[] = [
    {
        playerId: "away-closer",
        role: PitchingRoleType.CLOSER,
        priority: 1
    }
]

const homeAvailablePitchers: PitchingRole[] = [
    {
        playerId: "home-closer",
        role: PitchingRoleType.CLOSER,
        priority: 1
    }
]

const pitchEnvironmentTarget: PitchEnvironmentTarget =
    loadPitchEnvironmentTarget()

const game: Game = {
    _id: "example-game"
} as Game

simService.initGame(
    game
)

const command: StartGameCommand = {
    game,

    away,
    awayTeamOptions: {},
    awayPlayers,
    awayLineup,
    awayStartingPitcher,
    awayAvailablePitchers,

    home,
    homeTeamOptions: {},
    homePlayers,
    homeLineup,
    homeStartingPitcher,
    homeAvailablePitchers,

    pitchEnvironmentTarget,
    useDH: true,
    date: new Date("2026-07-23T12:00:00.000Z")
}

simService.startGame(
    command
)

const rng: seedrandom.PRNG = seedrandom(
    "example-game-seed"
)

while (!game.isComplete) {
    simService.simPitch(
        game,
        rng
    )
}

simService.finishGame(
    game
)

console.log(
    game.score
)
```

The helper functions in this example represent application-specific
loading and construction of players, lineups, and environment data.

------------------------------------------------------------------------

## TypeScript Declarations

The installed package includes declarations for the simulation,
importer, and ratings entry points.

The generated TypeScript declarations are the authoritative source for
the exact API in the installed package version.
