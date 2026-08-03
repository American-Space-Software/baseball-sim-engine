# baseball-sim-engine API

Complete TypeScript API reference for `baseball-sim-engine` version `2.0.0`.

The package exposes two entry points:

- `baseball-sim-engine` — simulation runtime, services, enums, and public game types.
- `baseball-sim-engine/importer` — MLB data preparation, pitch-environment generation, and player-rating generation.

---

## Installation

```bash
npm install baseball-sim-engine
```

`baseball-database` is installed as a package dependency and is used by the importer to synchronize and query MLB data.

Applications that also want to query the database directly can install it explicitly:

```bash
npm install baseball-database
```

---

## Entry Points

### Simulation Runtime

```ts
import {
    simService
} from "baseball-sim-engine"
```

### Importer

```ts
import {
    exportAll
} from "baseball-sim-engine/importer"
```

---

# Simulation Runtime

## Default Service

### `simService`

```ts
import {
    simService
} from "baseball-sim-engine"
```

A ready-to-use `SimService` instance configured with the package's default pitch environment.

The standard game lifecycle is:

```ts
simService.initGame(game)
simService.startGame(command)

while (!game.isComplete) {
    simService.simPitch(game, rng)
}

simService.finishGame(game)
```

---

## Exported Classes

```ts
import {
    SimService,
    StatService,
    RollChartService,
    PitchEnvironmentService,
    PlayerRatingService,
    GameInfo,
    AtBatInfo,
    Rolls,
    PlayerChange
} from "baseball-sim-engine"
```

| Export | Purpose |
|---|---|
| `SimService` | Initializes, starts, advances, and finishes games. |
| `StatService` | Works with game and player statistical results. |
| `RollChartService` | Creates and resolves probability roll charts used by the simulation model. |
| `PitchEnvironmentService` | Builds and evaluates pitch environments. |
| `PlayerRatingService` | Converts accumulated player statistics into engine-compatible ratings. |
| `GameInfo` | Provides game-state and matchup information used by consumers that need direct access to game context. |
| `AtBatInfo` | Represents at-bat context exported by the runtime. |
| `Rolls` | Exposes the runtime roll-resolution API. |
| `PlayerChange` | Represents calculated player rating changes used by the simulation. |

The package also exports `InningEndingEvent`, an error type used to signal the end of a half-inning during pitch resolution.

```ts
import {
    InningEndingEvent
} from "baseball-sim-engine"
```

---

## Exported Enums

```ts
import {
    PlayResult,
    Contact,
    ShallowDeep,
    PitchZone,
    PitchCall,
    PitchType,
    BaseResult,
    Handedness,
    Position,
    OfficialPlayResult,
    OfficialRunnerResult,
    ThrowResult,
    HomeAway,
    PitchingRoleType,
    DefenseOutResult,
    DefenseHitResult
} from "baseball-sim-engine"
```

| Enum | Represents |
|---|---|
| `PlayResult` | Simulation play outcomes. |
| `Contact` | Batted-ball contact types. |
| `ShallowDeep` | Batted-ball or defensive depth. |
| `PitchZone` | Named pitch-location zones. |
| `PitchCall` | Pitch results and calls. |
| `PitchType` | Supported pitch types. |
| `BaseResult` | Base locations used by runner events. |
| `Handedness` | Batter and pitcher handedness. |
| `Position` | Defensive positions. |
| `OfficialPlayResult` | Official scoring results for plays. |
| `OfficialRunnerResult` | Official scoring results for runner movements. |
| `ThrowResult` | Defensive throw outcomes. |
| `HomeAway` | Home or away team designation. |
| `PitchingRoleType` | Bullpen roles such as closer, setup, middle, long, and mop-up. |
| `DefenseOutResult` | Defensive resolution results for balls initially modeled as outs. |
| `DefenseHitResult` | Defensive resolution results for balls initially modeled as hits. |

Use the exported enum members rather than string literals when constructing game inputs.

---

## Starting a Game

```ts
import seedrandom from "seedrandom"

import {
    simService
} from "baseball-sim-engine"

import type {
    Game,
    StartGameCommand
} from "baseball-sim-engine"

const game: Game = {
    _id: "example-game"
} as Game

simService.initGame(game)

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
    stadiumEnvironment,
    useDH: true,
    date: new Date("2026-07-23T12:00:00.000Z")
}

simService.startGame(command)

const rng: seedrandom.PRNG = seedrandom(
    "example-seed"
)

while (!game.isComplete) {
    simService.simPitch(
        game,
        rng
    )
}

simService.finishGame(game)
```

The same inputs and RNG sequence produce the same game.

---

## Teams

```ts
import type {
    Team
} from "baseball-sim-engine"

const away: Team = {
    _id: "away-team",
    name: "Away Team",
    abbrev: "AWY",
    colors: {
        color1: "#111111",
        color2: "#eeeeee"
    }
}

const home: Team = {
    _id: "home-team",
    name: "Home Team",
    abbrev: "HME",
    colors: {
        color1: "#222222",
        color2: "#dddddd"
    }
}
```

---

## Players

```ts
import {
    Handedness,
    Position
} from "baseball-sim-engine"

import type {
    Player
} from "baseball-sim-engine"

const player: Player = {
    _id: "player-1",
    firstName: "Example",
    lastName: "Player",
    fullName: "Example Player",
    displayName: "Example Player",
    primaryPosition: Position.SHORTSTOP,
    zodiacSign: "",
    throws: Handedness.R,
    hits: Handedness.R,
    isRetired: false,
    stamina: 0,
    maxPitchCount: 0,
    overallRating: 100,
    pitchRatings: {},
    hittingRatings: {},
    age: 27
}
```

Player ratings are interpreted relative to the active `PitchEnvironmentTarget`.

---

## Lineups

```ts
import {
    Position
} from "baseball-sim-engine"

import type {
    Lineup
} from "baseball-sim-engine"

const lineup: Lineup = {
    order: [
        { _id: "player-1", position: Position.CENTER_FIELD },
        { _id: "player-2", position: Position.SHORTSTOP },
        { _id: "player-3", position: Position.FIRST_BASE },
        { _id: "player-4", position: Position.RIGHT_FIELD },
        { _id: "player-5", position: Position.LEFT_FIELD },
        { _id: "player-6", position: Position.THIRD_BASE },
        { _id: "player-7", position: Position.SECOND_BASE },
        { _id: "player-8", position: Position.CATCHER },
        { _id: "player-9", position: Position.DESIGNATED_HITTER }
    ],
    valid: true
}
```

---

## Starting Pitchers

```ts
import type {
    RotationPitcher
} from "baseball-sim-engine"

const startingPitcher: RotationPitcher = {
    _id: "pitcher-1"
}
```

---

## Bullpen Roles

```ts
import {
    PitchingRoleType
} from "baseball-sim-engine"

import type {
    PitchingRole
} from "baseball-sim-engine"

const availablePitchers: PitchingRole[] = [
    {
        playerId: "pitcher-2",
        role: PitchingRoleType.CLOSER,
        priority: 1
    },
    {
        playerId: "pitcher-3",
        role: PitchingRoleType.SETUP,
        priority: 1
    },
    {
        playerId: "pitcher-4",
        role: PitchingRoleType.MIDDLE,
        priority: 1
    },
    {
        playerId: "pitcher-5",
        role: PitchingRoleType.LONG,
        priority: 1
    },
    {
        playerId: "pitcher-6",
        role: PitchingRoleType.MOP_UP,
        priority: 1
    }
]
```

Priority orders pitchers within the same role.

---

## Pitch Environment

```ts
import type {
    PitchEnvironmentTarget
} from "baseball-sim-engine"
```

`PitchEnvironmentTarget` defines the league-wide simulation baseline, including:

- Pitch distribution
- Swing and contact behavior
- Batted-ball behavior
- Running behavior
- Defensive distribution
- Outcome targets
- Team-level targets
- Imported statistical references
- Home-field advantage
- Optional tuning parameters

The environment is supplied through `StartGameCommand`.

---

## Stadium Environment

```ts
import type {
    StadiumEnvironment
} from "baseball-sim-engine"

const stadiumEnvironment: StadiumEnvironment = {
    team: "COL",
    venue: "Coors Field",
    yearRange: "2024-2026",
    singles: 1.09,
    doubles: 1.09,
    triples: 1.68,
    hr: 1.13,
    walks: 0.98,
    strikeouts: 0.89
}
```

Each numeric field is a multiplier. `1.00` is neutral.

---

## Roll Charts

```ts
import {
    RollChartService
} from "baseball-sim-engine"

import type {
    RollChart,
    ContactTypeRollInput,
    FielderChanceRollInput,
    ShallowDeepRollInput,
    PowerRollInput
} from "baseball-sim-engine"
```

The public roll-chart inputs describe weighted outcomes for:

- Power results
- Contact types
- Fielder selection
- Defensive depth

---

# Importer

The importer is available from:

```ts
import {
    exportAll,
    exportPitchEnvironmentTarget,
    exportPlayerRatings
} from "baseball-sim-engine/importer"
```

The importer uses `baseball-database` as its MLB data source.

---

## `exportAll`

```ts
function exportAll(
    season: number,
    baseDataDir: string,
    options?: any
): Promise<ExportAllResult>
```

Builds the complete generated season output:

- Pitch environment
- Environment tuning
- Player ratings

```ts
import {
    exportAll
} from "baseball-sim-engine/importer"

import type {
    ExportAllResult
} from "baseball-sim-engine/importer"

const result: ExportAllResult = await exportAll(
    2025,
    "./data"
)
```

### `ExportAllResult`

```ts
interface ExportAllResult {
    season: number
    pitchEnvironmentTarget: PitchEnvironmentTarget
    playerRatings: any[]
}
```

Generated files include:

```text
data/
└── 2025/
    ├── _pitch_environment_target.json
    └── _player_ratings.json
```

---

## `exportPitchEnvironmentTarget`

```ts
function exportPitchEnvironmentTarget(
    season: number,
    baseDataDir: string,
    options?: any,
    seasonPlayers?: Map<string, PlayerImportRaw>
): Promise<PitchEnvironmentTarget>
```

Builds and writes the pitch environment for a season.

```ts
import {
    exportPitchEnvironmentTarget
} from "baseball-sim-engine/importer"

import type {
    PitchEnvironmentTarget
} from "baseball-sim-engine"

const pitchEnvironmentTarget: PitchEnvironmentTarget =
    await exportPitchEnvironmentTarget(
        2025,
        "./data"
    )
```

The output is written to:

```text
data/2025/_pitch_environment_target.json
```

### `ExportPitchEnvironmentTargetResult`

```ts
interface ExportPitchEnvironmentTargetResult {
    pitchEnvironment: PitchEnvironmentTarget
    players: Map<string, PlayerImportRaw>
}
```

This result type is exported for consumers that need to represent an environment together with its player-import map.

---

## `exportPlayerRatings`

```ts
function exportPlayerRatings(
    season: number,
    baseDataDir: string,
    seasonPlayers?: Map<string, PlayerImportRaw>
): Promise<any[]>
```

Generates and writes player ratings using the season's pitch environment.

```ts
import {
    exportPlayerRatings
} from "baseball-sim-engine/importer"

const playerRatings: any[] = await exportPlayerRatings(
    2025,
    "./data"
)
```

The pitch environment must already exist at:

```text
data/2025/_pitch_environment_target.json
```

Ratings are written to:

```text
data/2025/_player_ratings.json
```

---

## Exported Importer Services

```ts
import {
    PlayerImportService,
    PlayerRatingService,
    StatAccumulatorService,
    playerImportService,
    playerRatingService
} from "baseball-sim-engine/importer"
```

| Export | Purpose |
|---|---|
| `PlayerImportService` | Builds player-import data from accumulated MLB statistics. |
| `PlayerRatingService` | Converts player-import data into engine-compatible player ratings. |
| `StatAccumulatorService` | Accumulates normalized MLB statistics used by the importer. |
| `playerImportService` | Default `PlayerImportService` instance using the configured data directory. |
| `playerRatingService` | Default importer `PlayerRatingService` instance using the configured data directory. |

The default data directory is read from `DATA_DIR` and otherwise defaults to `data`.

---

## Importer Commands

The repository provides development scripts for the importer.

```bash
npm run tune:target -- 2025
npm run generate:ratings -- 2025
npm run generate:all -- 2025
```

These scripts are repository commands. The published package does not expose an npm executable through a `bin` entry.

---

## `baseball-database`

The importer uses:

```ts
import {
    downloadSeason,
    queries
} from "baseball-database"
```

The database supplies:

- Schedules
- Raw game feeds
- Player appearances
- Plate appearances
- Pitches
- Runner movements
- Fielding credits
- Defensive events

The importer reads that data to build derived simulation inputs. Raw stored game feeds remain canonical in `baseball-database`.

---

# Public Type Declarations

The following types are re-exported from `baseball-sim-engine`.

```ts
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

---

# Supporting Public Shapes

These declarations support fields contained inside the exported types above.

```ts
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

---

# Complete Example

```ts
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

The helper functions in this example represent application-specific loading and construction of players, lineups, and environment data.

---

## TypeScript Declarations

The installed package includes declarations for both entry points:

```text
dist/
├── index.d.ts
└── importer.d.ts
```

These declarations are the authoritative source for the exact API in the installed package version.
