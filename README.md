# ⚾ baseball-sim-engine

[![npm version](https://img.shields.io/npm/v/baseball-sim-engine.svg)](https://www.npmjs.com/package/baseball-sim-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

A deterministic, pitch-by-pitch baseball simulation engine written in TypeScript.

`baseball-sim-engine` simulates complete baseball games from structured team, player, lineup, pitching, and environment data.

It also includes MLB data-preparation tools for generating player ratings, player statistics, pitch environments, stadium environments, rosters, lineups, bullpen availability, team ratings, and complete daily MLB game bundles.

A separate presentation package provides reusable game view models, play-by-play, box scores, playback control, messages, team presentation helpers, and Framework7 game components.

The simulation runtime and presentation layer work in browser environments. MLB data preparation and rating generation are intended for Node.js.

---

## Features

### Simulation

- Pitch-by-pitch game simulation
- Deterministic outcomes with caller-supplied RNG
- Ratings-driven hitters, pitchers, runners, and fielders
- Configurable league-wide pitch environments
- Configurable home-field advantage
- Game-specific stadium environments
- Designated hitter support
- Starting pitcher and bullpen role support
- Pitch-level velocity, movement, location, and quality
- Batted-ball exit velocity, launch angle, distance, and coordinates
- Runner advancement, steals, wild pitches, passed balls, and double plays
- Fielding, throwing, force-play, tag-play, and defensive resolution

### Presentation

- Game view models
- Play-by-play descriptions
- Box-score presentation models
- Game-state messages
- Manual and automatic pitch playback
- Team presentation helpers
- Reusable Framework7 game components

### MLB Data and Ratings

- Historical MLB game data through `baseball-database`
- Player rating generation from historical and recent MLB performance
- Career, season, and current player statistics
- MLB roster synchronization
- Projected and confirmed lineup construction
- Starting pitcher selection
- Bullpen role and workload handling
- Stadium environment generation from park factors
- Team ratings
- Complete daily MLB game bundles for historical and current dates

### Package

- Node.js and browser simulation support
- Browser presentation layer
- TypeScript declarations
- ES modules
- Separate simulation, presentation, importer, and ratings entry points

---

## Installation

```bash
npm install baseball-sim-engine
```

The package includes four primary entry points:

```text
baseball-sim-engine
baseball-sim-engine/presentation
baseball-sim-engine/importer
baseball-sim-engine/ratings
```

`baseball-database` is installed automatically as a dependency.

Applications that want to query the MLB database directly can also install it explicitly:

```bash
npm install baseball-database
```

---

## Package Entry Points

### Simulation Runtime

```ts
import {
    simService
} from "baseball-sim-engine"
```

The main package contains the deterministic simulation runtime, public simulation types and enums, roll-chart services, stat services, and the default `simService`.

### Presentation

```ts
import {
    GamePlaybackService,
    gameWebService,
    playByPlayService,
    boxscoreService,
    teamComponentService
} from "baseball-sim-engine/presentation"
```

The presentation package sits on top of the simulation runtime and provides reusable browser-facing services and components.

It includes:

- Play-by-play generation
- Game view models
- Box-score view models
- Game messages
- Manual and automatic playback
- Team presentation helpers
- Framework7 game components

The package exports configured service instances where possible, along with the underlying service classes and presentation types.

`GamePlaybackService` is constructed with the application's `SimService`:

```ts
import {
    simService
} from "baseball-sim-engine"

import {
    GamePlaybackService
} from "baseball-sim-engine/presentation"

const gamePlaybackService = new GamePlaybackService(
    simService
)
```

Framework7 components are also exported:

```ts
import {
    LineScoreComponent,
    GameLogComponent,
    GameStateComponent,
    BoxscoreComponent,
    GameInProgressComponent
} from "baseball-sim-engine/presentation"
```

Applications can use the services and view models with their own UI, use the supplied Framework7 components, or combine both approaches.

### Importer

```ts
import {
    exportPitchEnvironmentTarget
} from "baseball-sim-engine/importer"
```

The importer is responsible for MLB synchronization, player-import generation, pitch-environment generation, and environment tuning.

### Ratings and MLB Bundles

```ts
import {
    exportPlayerRatings,
    mlbGameBundleService,
    playerRatingService,
    playerStatService
} from "baseball-sim-engine/ratings"
```

The ratings entry point provides:

- Player rating generation
- Player statistical aggregation
- Rating-history synchronization
- Materialized rating inputs
- MLB roster and lineup construction
- Stadium environments
- Team ratings
- Daily MLB game bundles

---

## Quick Start

A game is initialized, started with a `StartGameCommand`, advanced one pitch at a time, and finalized after completion.

```ts
import seedrandom from "seedrandom"

import {
    simService
} from "baseball-sim-engine"

import type {
    Game,
    StartGameCommand
} from "baseball-sim-engine"

const game = {
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

    date: new Date("2026-09-21T12:00:00.000Z")
}

simService.startGame(command)

const rng = seedrandom(
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

## Presentation Quick Start

`GamePlaybackService` wraps the pitch-by-pitch simulation loop for applications that want manual or timed game playback.

```ts
import {
    simService
} from "baseball-sim-engine"

import {
    GamePlaybackService
} from "baseball-sim-engine/presentation"

const playback = new GamePlaybackService(
    simService
)

const game = playback.start(
    command,
    {
        automatic: false,
        seed: "example-seed"
    }
)

playback.advance()
```

The presentation package also exports configured services:

```ts
import {
    playByPlayService,
    gameWebService,
    gameViewService,
    gameMessageService,
    boxscoreService,
    teamComponentService
} from "baseball-sim-engine/presentation"
```

These services derive presentation data from simulation state without changing the underlying baseball simulation.

---

## Building an MLB Game Slate

The ratings package can construct a complete MLB slate for a specific date.

```ts
import {
    mlbGameBundleService
} from "baseball-sim-engine/ratings"

const bundle = await mlbGameBundleService.build(
    "2026-09-21"
)
```

The resulting daily bundle contains the information required to construct and simulate the scheduled games for that date.

That includes:

- Date
- League pitch environment
- Stadium environments
- Scheduled games
- Away and home teams
- Player ratings
- Player statistics
- Lineups
- Starting pitchers
- Available bullpen pitchers
- Team ratings
- Game status and available score information

The service supports both historical and current MLB dates as long as the required underlying MLB data and generated season data are available.

---

## MLB Lineup Construction

MLB game bundles build lineups from the best available source.

The lineup system can use:

1. Confirmed lineups
2. Projected lineups
3. Previous comparable lineups
4. Active roster fallback

Previous lineups can be selected using the opposing starting pitcher's handedness.

The resulting team bundle includes:

```text
team
players
lineup
startingPitcher
availablePitchers
playerStats
teamRating
```

This gives consuming applications one materialized team input instead of requiring them to independently assemble ratings, roster data, statistics, and pitching availability.

---

## Starting Pitchers and Bullpens

Starting pitchers are supplied separately from the batting lineup.

```ts
import type {
    RotationPitcher
} from "baseball-sim-engine"

const startingPitcher: RotationPitcher = {
    _id: "pitcher-1"
}
```

Available pitchers are represented as bullpen assignments.

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

Supported bullpen roles include:

- `CLOSER`
- `SETUP`
- `MIDDLE`
- `LONG`
- `MOP_UP`

Priority orders pitchers within the same role.

The MLB bundle pipeline can derive pitcher availability and bullpen assignments from recent workload and roster information.

---

## Architecture

The project separates the simulation runtime, presentation layer, and MLB data preparation.

```text
                         baseball-database
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
      Player stat inputs   Rating inputs      MLB schedules
              │                 │                 │
              ▼                 ▼                 ▼
       PlayerStatService  PlayerRatingService  Rosters
              │                 │                 │
              └────────────┬────┴────────────┬────┘
                           │                 │
                           ▼                 ▼
                 Stadium environments   Team ratings
                           │                 │
                           └────────┬────────┘
                                    ▼
                           MlbGameBundleService
                                    │
                                    ▼
                              MlbDailyBundle
                                    │
                                    ▼
                               SimService
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
             Deterministic games      Presentation services
                                               │
                                               ▼
                             View models / playback / components
```

### Simulation Runtime

The runtime owns:

- Game state
- Pitch generation
- Swing decisions
- Contact
- Batted-ball resolution
- Fielding
- Runner advancement
- Pitching changes
- Scoring
- Game completion

### Presentation

The presentation layer owns browser-facing representations and playback behavior.

It includes:

- Play-by-play descriptions
- Game view models
- Box-score view models
- Game-state messages
- Game playback control
- Team presentation helpers
- Framework7 game components

The presentation layer reads simulation state but does not own the baseball simulation model itself.

### Importer

The importer reads MLB data from `baseball-database` and builds reusable derived data including:

- Player statistical inputs
- Player rating inputs
- Season rating inputs
- Player imports
- Pitch environments
- Home-field advantage baselines

### Ratings

The ratings layer builds:

- Player ratings
- Player statistics
- Rosters
- Lineups
- Pitching availability
- Stadium environments
- Team ratings
- Complete MLB daily bundles

### Database Layer

`baseball-database` remains the canonical MLB game-data layer.

It stores and exposes normalized data for:

- Games
- Schedules
- Player appearances
- Plate appearances
- Pitches
- Runner movements
- Fielding credits
- Defensive events

Derived simulation and rating data can be rebuilt from the underlying stored games.

---

## Core Simulation Concepts

The runtime separates four concerns:

1. **Game state** — mutable baseball game state.
2. **Baseball inputs** — teams, players, lineups, starters, and available pitchers.
3. **Simulation environment** — league-wide and game-specific conditions.
4. **Randomness** — supplied by the caller so simulations can be reproduced exactly.

The simulation runtime does not require persistence, schedules, a database, or a user interface.

Applications provide game inputs and control the simulation loop.

---

## Game Lifecycle

Every game follows the same lifecycle:

```ts
simService.initGame(game)

simService.startGame(command)

while (!game.isComplete) {
    simService.simPitch(
        game,
        rng
    )
}

simService.finishGame(game)
```

### `initGame`

Initializes mutable game state.

### `startGame`

Loads:

- Away and home teams
- Players
- Lineups
- Starting pitchers
- Available pitchers
- Pitch environment
- Stadium environment
- Designated hitter setting
- Game date

### `simPitch`

Advances the game by exactly one pitch.

### `finishGame`

Finalizes the completed game and its statistics.

---

## Teams and Players

Teams and players are plain data objects supplied to the simulation runtime.

A player includes identity, handedness, positions, hitting ratings, pitching ratings, stamina, and pitch-count limits.

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

    age: 27,

    hits: Handedness.R,
    throws: Handedness.R,

    primaryPosition: Position.SHORTSTOP,
    secondaryPositions: [],

    positions: [
        Position.SHORTSTOP
    ],

    hittingRatings: {
        // Contact, discipline, gap power, home-run power,
        // speed, steals, defense, arm, and contact profile.
    },

    pitchRatings: {
        // Power, control, movement, handedness splits,
        // pitch mix, pitch quality, and contact profile.
    },

    stamina: 0,
    maxPitchCount: 0
} as Player
```

Ratings are interpreted relative to the active `PitchEnvironmentTarget`.

A rating does not define a fixed outcome rate by itself. It shifts player behavior around the environment baseline.

---

## Ratings

The standard rating scale is centered around `100`.

A rating of `100` represents league-average ability within the active environment.

### Hitting Ratings

Hitting ratings include:

- Contact
- Plate discipline
- Gap power
- Home-run power
- Handedness splits
- Speed
- Steals
- Defense
- Arm
- Contact profile

### Pitching Ratings

Pitching ratings include:

- Power
- Control
- Movement
- Handedness splits
- Pitch repertoire
- Pitch quality
- Contact profile

Ratings work together with the pitch environment.

The same ratings can produce different statistical results in different eras or leagues because the environment baseline changes.

---

## Player Rating History

Player ratings can use multiple recent-history windows rather than treating all historical performance equally.

The rating pipeline supports:

- Long-term player history
- Recent performance
- Handedness splits
- Pitch usage
- Swing and contact behavior
- Batted-ball characteristics
- Fielding
- Running

Materialized rating inputs allow recent samples to be loaded without repeatedly rebuilding an entire player's history from raw game data.

Season-level rating inputs allow older history to be loaded efficiently.

---

## Player Statistics

The ratings package also exposes `PlayerStatService`.

It can build statistical views for players from the normalized MLB data stored by `baseball-database`.

Player statistics include areas such as:

### Hitting

- Games
- Plate appearances
- At-bats
- Hits
- Singles
- Doubles
- Triples
- Home runs
- Runs
- RBI
- Walks
- Strikeouts
- Stolen bases
- Caught stealing
- Rate statistics

### Pitching

- Games
- Starts
- Wins
- Losses
- Innings
- Hits
- Runs
- Earned runs
- Home runs
- Walks
- Strikeouts
- Hit batters
- Batters faced
- Rate statistics

### Fielding

- Putouts
- Assists
- Outfield assists
- Errors
- Passed balls
- Caught stealing
- Double plays

The same underlying materialized player-stat data can be queried for career, season, recent, and date-specific use cases.

---

## Lineups

A lineup contains nine unique players in batting order with an assigned defensive position for each spot.

```ts
import {
    Position
} from "baseball-sim-engine"

import type {
    Lineup
} from "baseball-sim-engine"

const lineup: Lineup = {
    order: [
        {
            _id: "player-1",
            position: Position.CENTER_FIELD
        },
        {
            _id: "player-2",
            position: Position.SHORTSTOP
        },
        {
            _id: "player-3",
            position: Position.FIRST_BASE
        },
        {
            _id: "player-4",
            position: Position.RIGHT_FIELD
        },
        {
            _id: "player-5",
            position: Position.LEFT_FIELD
        },
        {
            _id: "player-6",
            position: Position.THIRD_BASE
        },
        {
            _id: "player-7",
            position: Position.SECOND_BASE
        },
        {
            _id: "player-8",
            position: Position.CATCHER
        },
        {
            _id: "player-9",
            position: Position.DESIGNATED_HITTER
        }
    ],

    valid: true
}
```

When `useDH` is `false`, the starting pitcher may occupy a batting-order position instead.

---

## Designated Hitter Support

The engine supports games with or without a designated hitter.

```ts
const command: StartGameCommand = {
    // ...

    useDH: true
}
```

Lineup validation supports:

- DH lineups
- Non-DH lineups
- Pitchers batting
- Two-way players
- Pitcher substitutions
- Removed-pitcher re-entry restrictions
- Two-way player DH continuity

---

## Pitch Environment

The league-wide simulation baseline is defined by a `PitchEnvironmentTarget`.

A pitch environment describes the statistical shape of the baseball universe in which the game is played.

It can represent:

- A real MLB season
- A historical era
- A low-offense league
- A high-offense league
- A fictional baseball world
- A custom test environment

It can influence:

- Strikeout rates
- Walk rates
- Zone rates
- Chase rates
- Swing rates
- Contact rates
- Batted-ball distributions
- Home-run rates
- Extra-base-hit rates
- Hit rates
- Runner aggression
- Stolen-base behavior
- Defensive outcomes
- Pitch-level tendencies
- Home-field advantage

```ts
const command: StartGameCommand = {
    // ...

    pitchEnvironmentTarget
}
```

The supplied environment is used as the baseline for the game without requiring the caller to mutate its season-level data.

---

## Home-Field Advantage

`PitchEnvironmentTarget` includes a configurable `homeFieldAdvantage`.

```ts
const pitchEnvironmentTarget: PitchEnvironmentTarget = {
    // ...

    homeFieldAdvantage: 0.0425
} as PitchEnvironmentTarget
```

The engine applies home-field advantage through game simulation rather than forcing a final result.

- `0` creates a neutral environment.
- Positive values favor the home team.
- Negative values favor the away team.

Because the value belongs to the environment, it can be tuned and validated by season.

---

## Stadium Environment

A `StadiumEnvironment` is an optional game-specific layer applied on top of the league-wide pitch environment.

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

```ts
const command: StartGameCommand = {
    // ...

    pitchEnvironmentTarget,
    stadiumEnvironment
}
```

Stadium factors are multipliers:

- `1.00` is neutral.
- Values above `1.00` increase the event.
- Values below `1.00` reduce the event.

When no stadium environment is supplied, the game uses the league pitch environment by itself.

The MLB bundle pipeline can load stadium environments for the scheduled teams automatically.

---

## Simulation Loop

The engine advances exactly one pitch per call.

```ts
while (!game.isComplete) {
    simService.simPitch(
        game,
        rng
    )
}
```

A pitch can:

- Change the ball-strike count
- Produce a called strike or ball
- Produce a swinging strike
- Produce a foul
- Put the ball in play
- Trigger a steal attempt
- Trigger a wild pitch or passed ball
- Advance or retire runners
- End a plate appearance
- End an inning
- Complete the game

The host application controls when and how quickly pitches are simulated.

---

## Pitch-Level Detail

Pitch data can include:

- Pitch type
- Intended zone
- Actual zone
- Velocity
- Horizontal break
- Vertical break
- Power quality
- Movement quality
- Location quality
- Overall pitch quality
- Swing decision
- Contact result

When contact occurs, pitch data can also retain:

- Exit velocity
- Launch angle
- Estimated distance
- Field coordinates
- Spray direction
- Contact quality

This supports:

- Live presentation
- Replay
- Debugging
- Statistical validation
- Analytical output
- Pitch-by-pitch visualization

---

## Swing and Contact

Swing behavior can be influenced by:

- Pitch location
- Zone tendencies
- Chase tendencies
- Count
- Batter discipline
- Batter contact
- Pitch power
- Pitch movement
- Pitch location quality
- Batter and pitcher handedness

Possible pitch outcomes include:

- Take
- Called strike
- Swing and miss
- Foul
- Ball in play

When contact occurs, the engine resolves the batted-ball shape before the final play result.

---

## Batted-Ball Modeling

The contact system models:

- Ground balls
- Line drives
- Fly balls
- Popups
- Exit velocity
- Launch angle
- Carry distance
- Spray direction
- Field coordinates

The engine separates:

1. Contact generation
2. Ball trajectory
3. Defensive resolution
4. Runner advancement
5. Final scoring outcome

This allows a play to develop from pitch and contact quality instead of selecting a final box-score result in one step.

---

## Fielding

Fielding resolution uses ball location, trajectory, defender position, and player ratings.

The engine can determine:

- The fielder responsible for the play
- Catch and fielding outcomes
- Infield and outfield depth
- Throw difficulty
- Force plays
- Tag plays
- Double-play opportunities
- Runner advancement pressure

Defense and arm ratings affect fielding and throwing outcomes.

---

## Runner System

The runner system handles:

- Advancement on hits
- Advancement on outs
- Force plays
- Tag attempts
- Double plays
- Stolen-base attempts
- Wild pitches
- Passed balls
- Secondary advancement
- Scoring

Speed, steal ratings, fielding, arm strength, ball location, and game context can affect runner decisions and outcomes.

---

## Pitching Changes

Pitching changes use the supplied starter, bullpen roles, priorities, availability, stamina, and pitch-count limits.

The engine supports:

- Starting pitcher removal
- Bullpen selection by role and priority
- Pitch-count limits
- Unavailable pitchers
- Position-player pitching fallback
- No re-entry for removed pitchers
- Two-way player DH continuity

The host application can construct its own bullpen assignments or use the MLB bundle pipeline to build them from roster and workload data.

---

## Determinism

The engine contains no hidden random source outside the RNG supplied by the caller.

Given identical:

- Game inputs
- Team and player data
- Lineups
- Pitchers
- Environments
- Date
- RNG sequence

the engine produces identical:

- Pitches
- Swing decisions
- Contact results
- Runner events
- Fielding outcomes
- Substitutions
- Scores
- Final game state

```ts
const rng = seedrandom(
    "stable-seed"
)

simService.simPitch(
    game,
    rng
)
```

This makes the engine suitable for:

- Replays
- Regression tests
- Version comparisons
- Statistical tuning
- Debugging
- Large simulation workloads

---

## MLB Data

Historical MLB schedules and game feeds are synchronized through [`baseball-database`](https://www.npmjs.com/package/baseball-database).

The engine uses that data to build:

- Player statistical inputs
- Player imports
- Pitch environments
- Player ratings
- Rosters
- Lineups
- Pitching workloads
- Team ratings
- MLB game bundles

Derived data can be rebuilt from the underlying stored games.

Applications that already have their own players, ratings, teams, environments, and lineups can use the simulation runtime without using any of the MLB data-preparation systems.

---

## Using `baseball-database`

```ts
import {
    downloadSeason,
    queries
} from "baseball-database"

await downloadSeason(
    2025
)

const schedule = queries.getSchedule(
    2025
)

const game = queries.getGame(
    778557
)
```

`baseball-database` uses the official MLB Stats API through the separately maintained [`mlb-stats-api`](https://www.npmjs.com/package/mlb-stats-api) package.

`baseball-database` is not an official MLB library, and neither is `mlb-stats-api`.

The simulation engine treats stored MLB game data as input for statistical accumulation and rating generation.

It does not modify the raw game feeds stored by `baseball-database`.

---

## Generating a Pitch Environment

```ts
import {
    exportPitchEnvironmentTarget
} from "baseball-sim-engine/importer"

const result = await exportPitchEnvironmentTarget(
    2025,
    "./data"
)
```

The importer:

1. Synchronizes required MLB data.
2. Builds season player imports.
3. Calculates the season baseline.
4. Calculates home-field advantage.
5. Tunes the pitch environment.
6. Writes the generated pitch environment.

---

## Generating Player Ratings

Player-rating generation is exposed from the ratings entry point.

```ts
import {
    exportPlayerRatings
} from "baseball-sim-engine/ratings"

const playerRatings = await exportPlayerRatings(
    2025,
    "./data"
)
```

A pitch environment must already exist for the requested season.

The ratings pipeline verifies and synchronizes the required rating history before generating ratings.

For completed historical seasons, ratings can be generated through the end of that season.

For the current season, ratings can be generated through the current date.

---

## Rating History

The ratings system maintains two levels of derived rating inputs.

### Player Rating Inputs

Player rating inputs contain per-game player appearance data.

They allow recent rating windows to be loaded directly from individual appearances.

### Player Rating Season Inputs

Season-level inputs contain aggregated historical data.

They allow older player history to be loaded efficiently without repeatedly aggregating every individual game.

Both are derived from the canonical MLB game data and can be rebuilt.

---

## Repository Commands

Build the project:

```bash
npm run build
```

Download the current MLB season:

```bash
npm run download
```

Download a specific season:

```bash
npm run download -- 2025
```

Download all required rating history:

```bash
npm run download:all
```

Generate a pitch environment for the current season:

```bash
npm run generate:env
```

Generate a pitch environment for a specific season:

```bash
npm run generate:env -- 2025
```

Generate player ratings for the current season:

```bash
npm run generate:ratings
```

Generate player ratings for a specific season:

```bash
npm run generate:ratings -- 2025
```

The repository scripts execute the compiled importer and ratings entry points.

---

## Testing and Statistical Validation

The engine is tested both functionally and statistically.

Functional tests cover systems including:

- Starting and finishing games
- Lineup validation
- DH and non-DH games
- Two-way players
- Pitch resolution
- Swing decisions
- Contact
- Runner advancement
- Stolen bases
- Wild pitches and passed balls
- Fielding
- Double plays
- Bullpen selection
- Pitch-count behavior
- Pitcher substitutions
- Deterministic replay
- Game playback and presentation behavior

Large simulation samples can be compared against target environments for metrics including:

- Runs per game
- AVG
- OBP
- SLG
- OPS
- BABIP
- Walk rate
- Strikeout rate
- Home-run rate
- Extra-base-hit rates
- Stolen-base attempts
- Stolen-base success
- Swing rates
- Chase rates
- Contact rates
- Pitches per plate appearance
- Batted-ball distributions

Because the engine is deterministic, tuning changes can be evaluated against identical seeds.

---

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/American-Space-Software/baseball-sim-engine.git
cd baseball-sim-engine
npm install
```

Run the test suite:

```bash
npm test
```

Build the package:

```bash
npm run build
```

Build continuously:

```bash
npm run build:watch
```

The JavaScript build produces separate runtime, presentation, importer, and ratings bundles.

```text
dist/
├── index.js
├── presentation.js
├── importer.js
└── ratings.js
```

TypeScript declaration files are generated for the package's public API.

The published package includes:

- `dist`
- `README.md`
- `API.md`
- `LICENSE`

---

## Node.js and Browser Support

The simulation runtime and presentation package are designed to run in browser environments.

The simulation runtime does not require:

- Persistence
- A database
- A web server
- Authentication
- A specific application framework

Host applications decide how to:

- Store game state
- Render games
- Schedule games
- Load players
- Build rosters
- Select lineups
- Select pitchers
- Persist results

The presentation package can be used with application-owned UI through its services and view models, or through its exported Framework7 components.

The importer and ratings entry points are intended for Node.js because they perform filesystem operations, database work, MLB synchronization, caching, and data generation.

---

## Scope

### Simulation Runtime

The runtime includes:

- Baseball game state
- Pitch-by-pitch simulation
- Player and team simulation inputs
- Lineups
- Pitching roles
- Substitution logic
- League environments
- Stadium environments

The runtime does not include:

- Application persistence
- UI rendering
- Network transport
- Authentication
- Schedule generation
- Team management
- Player contracts
- Economy systems

### Presentation

The presentation package includes:

- Game view models
- Play-by-play descriptions
- Box-score view models
- Game messages
- Game playback control
- Team presentation helpers
- Framework7 game components

It does not own persistence or application routing.

### MLB Data Preparation

The importer and ratings packages additionally include:

- MLB synchronization
- Player statistical accumulation
- Player import generation
- Player rating generation
- Pitch-environment generation
- Pitch-environment tuning
- MLB roster synchronization
- Lineup construction
- Pitching workload handling
- Stadium environment loading
- Team ratings
- Daily MLB game bundles

These systems prepare real MLB data for use by the simulation runtime. They are not required for applications that supply their own baseball inputs.

---

## Design Goals

The project is built around:

- Deterministic simulation
- Pitch-by-pitch resolution
- Transparent game state
- Ratings-driven behavior
- Tunable statistical environments
- Game-specific environment layers
- Reproducible debugging
- Statistical validation
- Separation from any single application
- Reusable presentation services
- Reusable MLB data infrastructure
- One canonical historical data source
- Rebuildable derived data

---

## API

The complete TypeScript API reference is available in [API.md](API.md).

It documents:

- Main package exports
- Presentation exports
- Importer exports
- Ratings exports
- Simulation services
- Presentation services and components
- Game and player interfaces
- Team and lineup interfaces
- Pitch environment interfaces
- MLB game bundle interfaces
- Player statistics
- Ratings interfaces
- Enums
- Usage examples

---

## Data Integrity

`baseball-database` remains the canonical source for synchronized MLB game data.

The engine builds derived data including:

- Statistical accumulations
- Player imports
- Pitch environments
- Player rating inputs
- Season rating inputs
- Player ratings
- Team ratings
- Game bundles

Derived data can be rebuilt from the underlying stored games.

---

## Data Source

Historical MLB schedules and game feeds are stored and queried through [`baseball-database`](https://www.npmjs.com/package/baseball-database).

`baseball-database` downloads data from the official MLB Stats API using the separately maintained [`mlb-stats-api`](https://www.npmjs.com/package/mlb-stats-api) package.

Neither `baseball-database` nor `mlb-stats-api` is an official MLB library.

MLB data is used as input for statistical accumulation, environment generation, rating generation, testing, bundle generation, and simulation.

---

## License

MIT
