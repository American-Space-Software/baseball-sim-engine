# ⚾ baseball-sim-engine

[![npm
version](https://img.shields.io/npm/v/baseball-sim-engine.svg)](https://www.npmjs.com/package/baseball-sim-engine)
[![License:
MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

A deterministic, pitch-by-pitch baseball simulation engine written in
TypeScript.

`baseball-sim-engine` simulates complete baseball games from structured
team, player, lineup, pitching, and environment data. It is designed for
reproducible game simulation, replay systems, statistical validation,
custom leagues, prediction systems, and analytical workflows.

The simulation runtime works in both Node.js and browser environments.

------------------------------------------------------------------------

## Features

-   Pitch-by-pitch game simulation
-   Deterministic outcomes with caller-supplied RNG
-   Ratings-driven hitters, pitchers, runners, and fielders
-   Configurable league-wide pitch environments
-   Configurable home-field advantage
-   Game-specific stadium environments
-   Designated hitter support
-   Starting pitcher and bullpen role support
-   Pitch-level velocity, movement, location, and quality
-   Batted-ball exit velocity, launch angle, distance, and coordinates
-   Runner advancement, steals, wild pitches, passed balls, and double
    plays
-   Fielding, throwing, force-play, tag-play, and defensive resolution
-   Real MLB data import utilities for building environments and player
    ratings
-   Historical MLB data supplied through
    [`baseball-database`](https://www.npmjs.com/package/baseball-database)
-   Node.js and browser support
-   TypeScript declarations included
-   ES module support

------------------------------------------------------------------------

## Installation

Install the simulation engine:

``` bash
npm install baseball-sim-engine
```

The package includes separate simulation, importer, and ratings entry
points.

The importer uses `baseball-database` to synchronize and query MLB
schedules, game feeds, player appearances, plate appearances, pitches,
runner movements, fielding credits, and defensive events.

`baseball-database` is installed automatically as a dependency of
`baseball-sim-engine`.

Applications that want to query the database directly can also install
it explicitly:

``` bash
npm install baseball-database
```

------------------------------------------------------------------------

## Package Entry Points

### Simulation Runtime

``` ts
import {
    simService
} from "baseball-sim-engine"
```

The main package contains the deterministic simulation runtime, its
public types and enums, roll-chart services, stat services, and the
default `simService`.

### Importer

``` ts
import {
    exportPitchEnvironmentTarget,
    playerImportService
} from "baseball-sim-engine/importer"
```

The importer is responsible for player imports and pitch-environment
generation and tuning.

### Ratings

``` ts
import {
    exportPlayerRatings,
    playerRatingService
} from "baseball-sim-engine/ratings"
```

The ratings entry point is responsible for rating-history
synchronization, materialized rating inputs, and player-rating
generation.

------------------------------------------------------------------------

## Quick Start

A game is initialized, started with a `StartGameCommand`, advanced one
pitch at a time, and finalized after completion.

``` ts
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

------------------------------------------------------------------------

## Architecture

The project separates simulation, environment generation, ratings, and
historical MLB persistence.

``` text
                         baseball-database
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
           PlayerImportService        Rating input tables
                  │                           │
                  ▼                           ▼
       PitchEnvironmentService       PlayerRatingService
                  │                           │
                  └─────────────┬─────────────┘
                                ▼
                           SimService
                                │
                                ▼
                 Deterministic pitch-by-pitch games
```

### Simulation Runtime

The runtime owns game state, pitch generation, swing and contact
decisions, batted-ball resolution, fielding, runner advancement,
pitching changes, scoring, and game completion.

### Importer

The importer reads MLB data from `baseball-database`, accumulates player
statistics, builds player imports, calculates home-field advantage, and
builds and tunes pitch environments.

### Ratings

The ratings system builds per-game player rating inputs and season-level
rating inputs, loads historical and recent player samples, and generates
hitting, pitching, fielding, and running ratings.

### Database Layer

`baseball-database` remains the canonical MLB game-data layer. It stores
raw game feeds and normalized analytics for games, schedules,
appearances, plate appearances, pitches, runner movements, fielding
credits, and defensive events.

The engine adds rebuildable derived rating-input tables to the same
database rather than maintaining a duplicate MLB game database.

------------------------------------------------------------------------

## Core Concepts

The engine separates four concerns:

1.  **Game state** --- the mutable state of a baseball game.
2.  **Baseball inputs** --- teams, players, lineups, starters, and
    available pitchers.
3.  **Simulation environment** --- league-wide and game-specific
    conditions.
4.  **Randomness** --- supplied by the caller so simulations can be
    reproduced exactly.

The engine does not generate schedules, persist game results, manage
contracts, or provide a user interface.

Applications provide the game inputs and control the simulation loop.

------------------------------------------------------------------------

## Starting a Game

Every game follows the same lifecycle:

``` ts
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

Initializes the mutable game state.

### `startGame`

Loads:

-   Away and home teams
-   Players
-   Lineups
-   Starting pitchers
-   Available pitchers
-   Pitch environment
-   Stadium environment
-   Designated hitter setting
-   Game date

### `simPitch`

Advances the game by exactly one pitch.

### `finishGame`

Finalizes the completed game and its statistics.

------------------------------------------------------------------------

## Teams and Players

Teams and players are plain data objects supplied by the host
application.

A player includes identity, handedness, positions, hitting ratings,
pitching ratings, stamina, and pitch-count limits.

``` ts
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

A rating does not define a fixed outcome rate by itself. It shifts
player behavior around the environment baseline.

------------------------------------------------------------------------

## Ratings

The standard rating scale is centered around `100`.

A rating of `100` represents league-average ability within the active
environment.

Ratings can describe:

### Hitting

-   Contact
-   Plate discipline
-   Gap power
-   Home-run power
-   Handedness splits
-   Speed
-   Steals
-   Defense
-   Arm
-   Contact profile

### Pitching

-   Power
-   Control
-   Movement
-   Handedness splits
-   Pitch repertoire
-   Pitch quality
-   Contact profile

Ratings work together with the pitch environment. The same player
ratings can behave differently in different eras or leagues because the
baseline environment changes.

------------------------------------------------------------------------

## Lineups

A lineup contains nine unique players in batting order with an assigned
defensive position for each spot.

``` ts
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

When `useDH` is `false`, the starting pitcher may occupy a batting-order
position instead.

------------------------------------------------------------------------

## Designated Hitter Support

The engine supports games with or without a designated hitter.

``` ts
const command: StartGameCommand = {
    // ...
    useDH: true
}
```

Rules enforced by lineup validation include:

-   A DH lineup must include a valid designated hitter.
-   A non-DH lineup may include the pitcher as a hitter.
-   A two-way player may start as both the designated hitter and
    starting pitcher.
-   Removing a two-way player from the mound does not automatically
    remove that player from the DH role.
-   Pitcher substitutions do not allow removed pitchers to re-enter.

------------------------------------------------------------------------

## Starting Pitchers and Bullpens

The starting pitcher is supplied separately from the batting lineup.

``` ts
import type {
    RotationPitcher
} from "baseball-sim-engine"

const startingPitcher: RotationPitcher = {
    _id: "pitcher-1"
}
```

Available pitchers are supplied as bullpen assignments.

``` ts
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

-   `CLOSER`
-   `SETUP`
-   `MIDDLE`
-   `LONG`
-   `MOP_UP`

Priority orders pitchers within the same role.

Pitcher availability is controlled by the player data supplied to the
engine, including:

-   `stamina`
-   `maxPitchCount`

The host application can use workload data, injuries, roster status, or
any other external system to determine those values.

------------------------------------------------------------------------

## Pitch Environment

The league-wide simulation baseline is defined by a
`PitchEnvironmentTarget`.

A pitch environment describes the statistical shape of the baseball
universe in which the game is played.

The environment can represent:

-   A real MLB season
-   A historical era
-   A low-offense league
-   A high-offense league
-   A fictional baseball world
-   A custom test environment

It can influence:

-   Strikeout and walk rates
-   Zone rates
-   Chase rates
-   Swing rates
-   Contact rates
-   Batted-ball distributions
-   Home-run rates
-   Extra-base-hit rates
-   Hit rates
-   Runner aggression
-   Stolen-base behavior
-   Defensive outcomes
-   Pitch-level tendencies
-   Home-field advantage

``` ts
const command: StartGameCommand = {
    // ...
    pitchEnvironmentTarget
}
```

The engine clones and uses the supplied environment for the game.

Applications can reuse a season baseline without mutating the original
object.

------------------------------------------------------------------------

## Default Pitch Environment

The package includes a default pitch environment used by the exported
`simService`.

Applications can also provide a custom `PitchEnvironmentTarget` for
every game.

``` ts
import type {
    PitchEnvironmentTarget
} from "baseball-sim-engine"

const pitchEnvironmentTarget: PitchEnvironmentTarget = {
    // Custom environment
} as PitchEnvironmentTarget
```

Custom environments can be built manually or generated from MLB data
through the importer.

------------------------------------------------------------------------

## Home-Field Advantage

`PitchEnvironmentTarget` includes a configurable `homeFieldAdvantage`.

``` ts
const pitchEnvironmentTarget: PitchEnvironmentTarget = {
    // ...
    homeFieldAdvantage: 0.0425
} as PitchEnvironmentTarget
```

The engine applies the advantage through the game simulation rather than
forcing a final result.

-   `0` creates a neutral environment.
-   Positive values favor the home team.
-   Negative values favor the away team.

Because the value is part of the environment, it can be tuned, tested,
and varied by season or simulation context.

The importer can calculate a season's home-field advantage from
completed games stored in `baseball-database`.

------------------------------------------------------------------------

## Stadium Environment

A `StadiumEnvironment` is an optional game-specific layer applied on top
of the league-wide `PitchEnvironmentTarget`.

``` ts
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

``` ts
const command: StartGameCommand = {
    // ...
    pitchEnvironmentTarget,
    stadiumEnvironment
}
```

Stadium factors are multipliers:

-   `1.00` is neutral.
-   Values above `1.00` increase the event.
-   Values below `1.00` reduce the event.

The stadium environment modifies the game environment for both teams
without mutating the season baseline.

When omitted, the game uses only the supplied `PitchEnvironmentTarget`.

------------------------------------------------------------------------

## Simulation Loop

The engine advances exactly one pitch per call.

``` ts
while (!game.isComplete) {
    simService.simPitch(
        game,
        rng
    )
}
```

A pitch can:

-   Change the ball-strike count
-   Produce a called strike or ball
-   Produce a swinging strike
-   Produce a foul ball
-   Put the ball in play
-   Trigger a steal attempt
-   Trigger a wild pitch or passed ball
-   Advance or retire runners
-   End a plate appearance
-   End an inning
-   Complete the game

The host application controls when and how quickly pitches are
simulated.

------------------------------------------------------------------------

## Pitch-Level Detail

Each pitch can contain more than a final result.

Pitch data may include:

-   Pitch type
-   Intended zone
-   Actual zone
-   Velocity
-   Horizontal break
-   Vertical break
-   Power quality
-   Movement quality
-   Location quality
-   Overall pitch quality
-   Swing decision
-   Contact result

When contact occurs, the pitch can also retain:

-   Exit velocity
-   Launch angle
-   Estimated distance
-   Field coordinates
-   Spray direction
-   Contact quality

This detail supports:

-   Live presentation
-   Replay
-   Debugging
-   Statistical validation
-   Analytical output
-   Pitch-by-pitch visualization

------------------------------------------------------------------------

## Swing and Contact

After pitch generation, the batter decides whether to swing.

Swing behavior can be influenced by:

-   Pitch location
-   Zone tendencies
-   Chase tendencies
-   Count
-   Batter discipline
-   Batter contact
-   Pitch power
-   Pitch movement
-   Pitch location quality
-   Batter and pitcher handedness

Possible pitch outcomes include:

-   Take
-   Called strike
-   Swing and miss
-   Foul
-   Ball in play

When contact occurs, the engine resolves the batted-ball shape before
the final play result.

------------------------------------------------------------------------

## Batted-Ball Modeling

The contact system can model:

-   Ground balls
-   Line drives
-   Fly balls
-   Popups
-   Exit velocity
-   Launch angle
-   Carry distance
-   Spray direction
-   Field coordinates

The engine separates:

1.  Contact generation
2.  Ball trajectory
3.  Defensive resolution
4.  Runner advancement
5.  Final scoring outcome

This allows a play to develop from pitch and contact quality instead of
selecting a final box-score result in one step.

------------------------------------------------------------------------

## Fielding

Fielding resolution uses ball location, trajectory, defender position,
and player ratings.

The engine can determine:

-   The fielder responsible for the play
-   Catch and fielding outcomes
-   Infield and outfield depth
-   Throw difficulty
-   Force plays
-   Tag plays
-   Double-play opportunities
-   Runner advancement pressure

Defense and arm ratings affect fielding and throwing outcomes.

------------------------------------------------------------------------

## Runner System

Runner behavior is simulated as part of active game state.

The runner system handles:

-   Advancement on hits
-   Advancement on outs
-   Force plays
-   Tag attempts
-   Double plays
-   Stolen-base attempts
-   Wild pitches
-   Passed balls
-   Secondary advancement
-   Scoring

Speed, steal ratings, fielding, arm strength, ball location, and game
context can all affect runner decisions and outcomes.

------------------------------------------------------------------------

## Pitching Changes

Pitching changes use the supplied starter, bullpen roles, priorities,
availability, stamina, and pitch-count limits.

The engine supports:

-   Starting pitcher removal
-   Bullpen selection by role and priority
-   Pitch-count limits
-   Unavailable pitchers
-   Position-player pitching fallback
-   No re-entry for removed pitchers
-   Two-way player DH continuity

The host application is responsible for constructing the
available-pitcher list and setting each player's current availability.

------------------------------------------------------------------------

## Determinism

The engine contains no hidden random source outside the RNG supplied by
the caller.

Given identical:

-   Game inputs
-   Team and player data
-   Lineups
-   Pitchers
-   Environments
-   Date
-   RNG sequence

the engine produces identical:

-   Pitches
-   Swing decisions
-   Contact results
-   Runner events
-   Fielding outcomes
-   Substitutions
-   Scores
-   Final game state

``` ts
const rng: seedrandom.PRNG = seedrandom(
    "stable-seed"
)

simService.simPitch(
    game,
    rng
)
```

This makes the engine suitable for:

-   Replays
-   Regression tests
-   Version comparisons
-   Statistical tuning
-   Debugging
-   Distributed simulation

------------------------------------------------------------------------

## MLB Data and Rating Inputs

Historical MLB schedules and game feeds are synchronized through
[`baseball-database`](https://www.npmjs.com/package/baseball-database).

The importer uses that data to build player imports and pitch
environments. The ratings system materializes one player-rating input
per player appearance per game and also builds season-level rating
inputs for efficient historical loading.

The derived rating inputs contain the statistics required by the rating
models across hitting, pitching, fielding, running, handedness splits,
pitch usage, swing and contact behavior, and batted-ball
characteristics.

These tables are derived data and can be rebuilt from the underlying
stored games.

Applications that already have player ratings and environment data do
not need to use the MLB data-preparation tools.

------------------------------------------------------------------------

## Using `baseball-database`

The importer depends on `baseball-database` for MLB data storage and
queries.

``` ts
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

`baseball-database` uses the official MLB Stats API through the
separately maintained
[`mlb-stats-api`](https://www.npmjs.com/package/mlb-stats-api) package.

`baseball-database` is not an official MLB library, and neither is
`mlb-stats-api`.

The simulation engine treats stored MLB game data as input for
statistical accumulation and rating generation. It does not modify the
raw game feeds stored by `baseball-database`.

------------------------------------------------------------------------

## Generating a Pitch Environment

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

The importer:

1.  Synchronizes required MLB data through `baseball-database`.
2.  Builds season player imports.
3.  Calculates the season baseline.
4.  Calculates home-field advantage.
5.  Tunes the pitch environment.
6.  Writes `_pitch_environment_target.json`.

------------------------------------------------------------------------

## Generating Player Ratings

Player-rating generation is exposed from the ratings entry point. A
pitch environment must already exist for the requested season.

``` ts
import {
    exportPlayerRatings
} from "baseball-sim-engine/ratings"

const playerRatings = await exportPlayerRatings(
    2025,
    "./data"
)
```

The ratings system reads:

``` text
data/2025/_pitch_environment_target.json
```

and writes:

``` text
data/2025/_player_ratings.json
```

Before generating ratings, it verifies and synchronizes the required
rating history through the requested season.

For a completed historical season, ratings are generated through January
1 of the following year. For the current season, ratings are generated
through the current date.

------------------------------------------------------------------------

## Rating History

The ratings system maintains two levels of derived inputs.

**Player rating inputs** contain one row per player appearance per game.
They are created as games are synchronized and can also be rebuilt from
stored games.

**Player rating season inputs** contain season-level aggregations used
to load older player history efficiently. Recent samples can still be
read from individual appearance rows without repeatedly aggregating the
entire historical table.

------------------------------------------------------------------------

## Repository Commands

Build the project before running the generated command entry points:

``` bash
npm run build
```

Download the current MLB season:

``` bash
npm run download
```

Download a specific season:

``` bash
npm run download -- 2025
```

Download all required rating history through the current season:

``` bash
npm run download:all
```

Generate a pitch environment for the current season:

``` bash
npm run generate:env
```

Generate a pitch environment for a specific season:

``` bash
npm run generate:env -- 2025
```

Generate player ratings for the current season:

``` bash
npm run generate:ratings
```

Generate player ratings for a specific season:

``` bash
npm run generate:ratings -- 2025
```

The repository scripts execute the compiled `dist/importer.js` and
`dist/ratings.js` entry points.

------------------------------------------------------------------------

## Testing and Statistical Validation

The engine is tested functionally and statistically.

Functional tests cover systems such as:

-   Starting and finishing games
-   Lineup validation
-   DH and non-DH games
-   Two-way players
-   Pitch resolution
-   Swing decisions
-   Contact
-   Runner advancement
-   Stolen bases
-   Wild pitches and passed balls
-   Fielding
-   Double plays
-   Bullpen selection
-   Pitch-count behavior
-   Pitcher substitutions
-   Deterministic replay

Large simulation samples can also be compared against target
environments for metrics including:

-   Runs per game
-   AVG
-   OBP
-   SLG
-   OPS
-   BABIP
-   Walk rate
-   Strikeout rate
-   Home-run rate
-   Extra-base-hit rates
-   Stolen-base attempts
-   Stolen-base success
-   Swing rates
-   Chase rates
-   Contact rates
-   Pitches per plate appearance
-   Batted-ball distributions

Because the engine is deterministic, tuning changes can be evaluated
against identical seeds.

------------------------------------------------------------------------

## Development

Clone the repository and install dependencies:

``` bash
git clone https://github.com/American-Space-Software/baseball-sim-engine.git
cd baseball-sim-engine
npm install
```

Run the test suite:

``` bash
npm test
```

Build the package:

``` bash
npm run build
```

Build continuously:

``` bash
npm run build:watch
```

The JavaScript build produces separate runtime, importer, and ratings
bundles:

``` text
dist/
├── index.js
├── importer.js
└── ratings.js
```

TypeScript declaration files are generated for the package's public API.

The published package includes:

-   `dist`
-   `README.md`
-   `LICENSE`

------------------------------------------------------------------------

## Node.js and Browser Support

The simulation runtime is designed to run in both Node.js and browser
environments.

The runtime does not require:

-   Persistence
-   A database
-   A web server
-   Authentication
-   A specific application framework

Host applications decide how to:

-   Store game state
-   Render games
-   Schedule games
-   Load players
-   Build rosters
-   Select lineups
-   Select pitchers
-   Persist results

The importer and ratings entry points are intended for Node.js because
they perform filesystem operations, database work, data synchronization,
and worker-thread processing.

------------------------------------------------------------------------

## Scope

This package includes:

-   Baseball game state
-   Pitch-by-pitch simulation
-   Player and team simulation inputs
-   Lineups
-   Pitching roles
-   Substitution logic
-   League environments
-   Stadium environments
-   Real-data import utilities
-   Player import generation
-   Player rating generation
-   Pitch-environment generation
-   Pitch-environment tuning

This package does **not** include:

-   Application persistence
-   UI rendering
-   Network transport
-   Authentication
-   Schedule generation
-   Team management
-   Roster management
-   Player contracts
-   Economy systems

The runtime is strictly a baseball simulation engine.

The importer and ratings entry points are supporting data-preparation
systems built around `baseball-database`.

------------------------------------------------------------------------

## Design Goals

The project is built around:

-   Deterministic simulation
-   Pitch-by-pitch resolution
-   Transparent game state
-   Ratings-driven behavior
-   Tunable statistical environments
-   Game-specific environment layers
-   Reproducible debugging
-   Statistical validation
-   Separation from any single application
-   Reusable MLB data infrastructure
-   One canonical historical data source

------------------------------------------------------------------------

## API

The complete TypeScript API reference is available in [API.md](API.md).

It includes:

-   Main package exports
-   Importer exports
-   Ratings exports
-   Simulation services
-   Game and player interfaces
-   Team and lineup interfaces
-   Pitch environment interfaces
-   Ratings interfaces
-   Enums
-   Complete usage examples

------------------------------------------------------------------------

## Data Integrity

The importer reads MLB game data from `baseball-database`.

Raw MLB game feeds remain canonical inside `baseball-database`. The
engine builds derived statistical accumulations, player imports, pitch
environments, per-appearance rating inputs, season rating inputs, and
player ratings from that data.

Derived rating data can be rebuilt from the underlying stored games.

------------------------------------------------------------------------

## Data Source

Historical MLB schedules and game feeds are stored and queried through
[`baseball-database`](https://www.npmjs.com/package/baseball-database).

`baseball-database` downloads data from the official MLB Stats API using
the separately maintained
[`mlb-stats-api`](https://www.npmjs.com/package/mlb-stats-api) package.

Neither `baseball-database` nor `mlb-stats-api` is an official MLB
library.

MLB data is used only as input for statistical accumulation, environment
generation, rating generation, testing, and simulation.

------------------------------------------------------------------------

## License

MIT
