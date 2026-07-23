# Baseball Sim Engine

A deterministic, pitch-by-pitch baseball simulation engine written in TypeScript.

`baseball-sim-engine` simulates complete baseball games from structured team, player, lineup, pitching, and environment data. It is designed for reproducible game simulation, replay systems, statistical validation, custom leagues, and analytical workflows.

## Features

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
- Real-data import utilities for building environments and player ratings
- Node.js and browser support

---

## Installation

```bash
npm install baseball-sim-engine
```

The package exposes the simulation engine from the main entry point and data-import utilities from the importer entry point.

```ts
import { simService } from "baseball-sim-engine"
import { DownloaderService } from "baseball-sim-engine/importer"
```

---

## Core Concepts

The engine separates four concerns:

1. **Game state** — the mutable state of a baseball game.
2. **Baseball inputs** — teams, players, lineups, starters, and available pitchers.
3. **Simulation environment** — league-wide and game-specific conditions.
4. **Randomness** — supplied by the caller so simulations can be reproduced exactly.

The engine does not generate teams, schedule games, persist results, or manage rosters. Applications provide those inputs and control the simulation loop.

---

## Starting a Game

A game is initialized, started with a `StartGameCommand`, advanced one pitch at a time, and finalized after completion.

```ts
import seedrandom from "seedrandom"

import { simService } from "baseball-sim-engine"

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
    date: new Date("2026-07-23T12:00:00.000Z")
}

simService.startGame(command)

const rng = seedrandom("example-seed")

while (!game.isComplete) {
    simService.simPitch(game, rng)
}

simService.finishGame(game)
```

The same inputs and RNG sequence produce the same game.

---

## Teams and Players

Teams and players are plain data objects supplied by the host application.

A player includes identity, handedness, positions, hitting ratings, pitching ratings, stamina, and pitch-count limits.

```ts
const player = {
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
    positions: [Position.SHORTSTOP],

    hittingRatings: {
        // Contact, plate discipline, gap power, home-run power,
        // speed, steals, defense, arm, and contact profile.
    },

    pitchRatings: {
        // Power, control, movement, handedness splits,
        // pitch mix, pitch quality, and contact profile.
    },

    stamina: 0,
    maxPitchCount: 0
}
```

Ratings are interpreted relative to the active `PitchEnvironmentTarget`. A rating does not define a fixed outcome rate by itself; it shifts player behavior around the environment baseline.

---

## Lineups

A lineup contains nine unique players in batting order with an assigned defensive position for each spot.

```ts
const lineup = {
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

Rules enforced by lineup validation include:

- A DH lineup must include a valid designated hitter.
- A non-DH lineup may include the pitcher as a hitter.
- A two-way player may start as both the designated hitter and starting pitcher.
- Removing a two-way player from the mound does not automatically remove that player from the DH role.
- Pitcher substitutions do not allow removed pitchers to re-enter.

---

## Starting Pitchers and Bullpens

The starting pitcher is supplied separately from the batting lineup.

```ts
const startingPitcher = {
    _id: "pitcher-1"
}
```

Available pitchers are supplied as bullpen assignments.

```ts
const availablePitchers = [
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

Pitcher availability is controlled by the player data supplied to the engine, including `stamina` and `maxPitchCount`.

---

## Pitch Environment

The league-wide simulation baseline is defined by a `PitchEnvironmentTarget`.

A pitch environment describes the statistical shape of the baseball universe in which the game is played. Player ratings modify behavior relative to this baseline.

The environment can represent:

- A real season
- A historical era
- A low-offense or high-offense league
- A fictional baseball world
- A custom testing environment

It can influence:

- Strikeout and walk rates
- Zone, chase, swing, and contact behavior
- Batted-ball distributions
- Home-run, extra-base-hit, and hit rates
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

The engine clones and uses the supplied environment for the game. Applications can reuse a season baseline without mutating the original object.

---

## Home-Field Advantage

`PitchEnvironmentTarget` includes a configurable `homeFieldAdvantage`.

```ts
const pitchEnvironmentTarget = {
    // ...
    homeFieldAdvantage: 0.0425
}
```

The engine applies the advantage through the game simulation rather than forcing a final result.

A value of `0` creates a neutral environment. Positive values favor the home team; negative values favor the away team.

Because the value is part of the environment, it can be tuned, tested, and varied by season or simulation context.

---

## Stadium Environment

A `StadiumEnvironment` is an optional game-specific layer applied on top of the league-wide `PitchEnvironmentTarget`.

```ts
const stadiumEnvironment = {
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

The stadium environment modifies the game environment for both teams without mutating the season baseline.

When omitted, the game uses only the supplied `PitchEnvironmentTarget`.

---

## Simulation Loop

The engine advances exactly one pitch per call.

```ts
while (!game.isComplete) {
    simService.simPitch(game, rng)
}
```

A pitch can:

- Change the ball-strike count
- Produce a called strike or ball
- Produce a swinging strike
- Produce a foul ball
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

Each pitch can contain more than a final result.

Pitch data may include:

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

When contact occurs, the pitch can also retain:

- Exit velocity
- Launch angle
- Estimated distance
- Field coordinates
- Spray direction
- Contact quality

This detail supports live presentation, replay, debugging, statistical validation, and analytical output.

---

## Swing and Contact

After pitch generation, the batter decides whether to swing.

Swing behavior can be influenced by:

- Pitch location
- Zone and chase tendencies
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

The contact system can model:

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

Defense and arm ratings affect the resolution of fielding and throwing events.

---

## Runner System

Runner behavior is simulated as part of active game state.

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

Speed, steal ratings, fielding, arm strength, ball location, and game context can all affect runner decisions and outcomes.

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

The host application is responsible for constructing the available-pitcher list and setting each player’s current availability.

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
const rng = seedrandom("stable-seed")
simService.simPitch(game, rng)
```

This makes the engine suitable for:

- Replays
- Regression tests
- Version comparisons
- Statistical tuning
- Debugging
- Distributed simulation

---

## Importing Real Baseball Data

The importer entry point contains utilities for downloading and accumulating real baseball data.

```ts
import {
    DownloaderService
} from "baseball-sim-engine/importer"
```

The import pipeline can accumulate:

- Hitting results
- Pitching results
- Fielding events
- Runner events
- Pitch velocity and movement
- Pitch type usage
- Zone, chase, swing, and contact behavior
- Exit velocity
- Launch angle
- Distance
- Batted-ball coordinates
- Spray angle
- Outcome rates by contact shape

Accumulated data can be used to build:

- Player ratings
- Player objects
- League-wide pitch environments
- Statistical validation datasets

The importer is separate from the simulation runtime. Applications that already have player ratings and environment data do not need to use it.

---

## Player Ratings

The importer can transform accumulated player statistics into engine-compatible player ratings.

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

Pitching ratings include:

- Power
- Control
- Movement
- Handedness splits
- Pitch repertoire
- Pitch quality
- Contact profile

Ratings are calibrated against a pitch environment, so the same raw statistical performance can map differently in different league environments.

---

## Testing and Statistical Validation

The engine is tested functionally and statistically.

Functional tests cover systems such as:

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

Large simulation samples can also be compared against target environments for metrics including:

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
- Stolen-base attempts and success
- Swing and chase rates
- Contact rates
- Pitches per plate appearance
- Batted-ball distributions

Because the engine is deterministic, tuning changes can be evaluated against identical seeds.

---

## Node.js and Browser Support

The engine is designed to run in both Node.js and browser environments.

The simulation runtime does not require persistence, a database, a web server, or a specific application framework.

Host applications decide how to:

- Store game state
- Render games
- Schedule games
- Load players
- Build rosters
- Select lineups
- Select pitchers
- Persist results

---

## Scope

This package includes:

- Baseball game state
- Pitch-by-pitch simulation
- Player and team simulation inputs
- Lineups
- Pitching roles
- Substitution logic
- League environments
- Stadium environments
- Real-data import utilities

This package does **not** include:

- Persistence
- Database models
- UI rendering
- Network transport
- Authentication
- Schedule generation
- Team management
- Roster management
- Player contracts
- Economy systems

It is strictly a baseball simulation engine and its supporting data-import utilities.

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

---

## Version 1.10.2

Version `1.10.2` includes the current pitch-by-pitch simulation model and its supporting environment, lineup, pitching, substitution, designated hitter, stadium, importer, and deterministic replay systems.

Consult the package exports and TypeScript declarations for the exact API available in the installed version.

---

## License

MIT