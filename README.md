# Baseball Sim Engine

A deterministic baseball simulation engine written in TypeScript.

This library simulates complete baseball games pitch-by-pitch using a ratings-driven model calibrated against real statistical environments. The engine is designed for reproducible simulations, online games, replay systems, and analytical workflows.

Features include:

- Pitch-by-pitch game simulation
- Deterministic outcomes with seeded RNG support
- Tunable league environments and statistical targets
- Ratings-driven player behavior
- Full runner movement and fielding logic
- Node.js and browser support

The engine runs in both Node.js and browser environments.

---

## Why This Project Exists

This engine was originally built as the core simulation system for [Ethereum Baseball League (EBL)](https://github.com/American-Space-Software/ethbaseball).

EBL started from a simple frustration: most sports simulations are closed systems. The logic that determines outcomes is hidden, difficult to inspect, and tied to a specific application or release cycle. Player history, results, and even the rules themselves often live inside a single product that can change or disappear over time.

This project takes a different approach.

The simulation engine is separated from the game and released as a standalone, open system. Every pitch, decision, and outcome is driven by a model that can be inspected, tested, and reproduced.

The goal is not just to simulate games, but to provide a foundation that can be:

- Studied and understood  
- Reproduced exactly  
- Extended for new use cases  
- Integrated into different applications  

While this engine powers EBL, it is not limited to it. The same system can be used for:

- Custom leagues  
- Analytical tools  
- Replay systems  
- Alternative baseball environments  

At its core, this project treats baseball simulation as infrastructure — something that should be transparent, deterministic, and able to evolve over time without being locked inside a single application.


---


## Pitch Environment

The engine is driven by a `PitchEnvironmentTarget`.

A pitch environment defines the statistical shape of the baseball universe the game operates inside. It acts as the league-average baseline that player ratings interact with during simulation.

This environment controls things like:

- Overall offensive levels
- Strikeout and walk tendencies
- Contact rates
- Power distribution
- Batted ball behavior
- Runner aggression
- Fielding outcomes
- Pitch-by-pitch tendencies

The environment can represent:

- A real-life season
- A dead-ball era league
- A high-offense league
- A custom stadium profile
- A fictional baseball world

Player ratings do not bypass the environment. Instead, ratings shift outcomes relative to the baseline established by the active pitch environment.

This allows the same player set to behave differently across leagues, seasons, stadiums, or custom simulation universes without rewriting player data.

---


## Importing Real Baseball Data

The default pitch environment is built from real season data. The included 2025 environment is the default baseline used by the engine.

The import pipeline downloads game data, accumulates player-level hitting, pitching, fielding, running, pitch, and batted-ball information, then combines those player records into a league-wide `PitchEnvironmentTarget`.

That process captures data such as:

- Pitch velocity
- Horizontal and vertical pitch movement
- Pitch type usage
- Zone and chase behavior by count
- Swing and contact rates
- Exit velocity
- Launch angle
- Batted-ball distance
- Batted-ball coordinates
- Spray angle
- Outcome rates by exit velocity and launch angle
- Runner advancement and stolen base behavior
- Fielding opportunities and defensive events

The player importer uses this accumulated season data to create ratings and player objects. The pitch environment builder uses the same source data to define the league-average world those players exist inside.

This means the simulation is not only tuned from final box score stats. It can also use pitch-level and batted-ball-level detail when shaping the default environment.

The 2025 `PitchEnvironmentTarget` represents the current default baseball universe for the package, but the same pipeline can be used to build a different environment from another season or custom data source.

---


## Defining Players and Starting a Game

To run a game, you provide the engine with two teams, their players, their lineups, and a starting pitcher for each side.

Players are plain data objects. They define identity, handedness, position, hitting ratings, pitching ratings, fielding ability, speed, and other baseball traits used by the simulation.

```ts
const player = {
  _id: "player-1",
  firstName: "Example",
  lastName: "Hitter",
  age: 27,

  hits: Handedness.R,
  throws: Handedness.R,
  primaryPosition: Position.SHORTSTOP,

  hittingRatings: {
    // contact, power, discipline, speed, defense, arm, etc.
  },

  pitchRatings: {
    // pitcher ratings and pitch mix
  }
}
```

A lineup defines the batting order and defensive positions. The engine expects a complete nine-player lineup and a valid starting pitcher.

```ts
const game = simService.startGame({
  game,
  away,
  home,

  awayPlayers,
  homePlayers,

  awayLineup,
  homeLineup,

  awayStartingPitcher,
  homeStartingPitcher,

  pitchEnvironmentTarget,
  date
})
```

Once the game has started, you control the simulation loop by repeatedly calling `simPitch`.

```ts
while (!game.isComplete) {
  simService.simPitch(game, rng)
}

simService.finishGame(game)
```

The engine does not create teams, generate players, manage rosters, or schedule games for you. It expects those inputs to be supplied by your application.


## Simulation Loop

The engine resolves baseball games one pitch at a time.

Every plate appearance, runner event, and inning transition flows through pitch resolution rather than direct at-bat simulation.

```ts
while (!game.isComplete) {
  simService.simPitch(game, rng)
}
```

A pitch may:

- Update the count
- Produce contact
- Trigger runner movement
- Generate steals, wild pitches, or passed balls
- End the plate appearance
- End the inning

Because game state advances pitch-by-pitch, runner behavior and defensive events can occur naturally during live play instead of being attached afterward as post-processing.

This design keeps the simulation state consistent and makes individual pitches fully reproducible during debugging and replay.

---
## Core Systems

The simulation is composed of several interconnected systems that resolve game state in sequence.

---


## Pitch-Level Detail

Each simulated pitch carries more information than a simple result.

A pitch records its type, intended zone, actual zone, pitch quality, swing result, and whether contact was made. Pitch quality includes velocity, horizontal break, and vertical break, while the engine also tracks separate power, movement, location, and overall quality scores.

When a ball is put in play, the pitch can also store contact quality data, including:

- Exit velocity
- Launch angle
- Estimated distance
- Field coordinates
- Overall contact quality

These details allow the engine to model outcomes from the physical shape of the pitch and contact, not only from a final result table.

This makes individual pitches useful for:

- Live game presentation
- Pitch-by-pitch replay
- Debugging simulation outcomes
- Measuring player performance
- Validating batted-ball distributions
- Building richer statistical reports

The result is still deterministic, but each pitch contains enough detail to explain how the play developed.


---

### Swing System

After a pitch is generated, the batter decides whether to swing.

Swing decisions are influenced by:

- Zone vs chase behavior
- Count adjustments
- Pitch quality
- Batter discipline ratings
- Pitch velocity and movement
- Handedness matchups

The swing system evaluates both whether the batter offers at the pitch and how well the batter is able to make contact if a swing occurs.

Possible outcomes include:

- Take
- Swing and miss
- Foul ball
- Weak contact
- Hard contact
- Ball in play

Two-strike counts, chase situations, and pitch quality can all affect swing aggression and contact quality differently.

Because the engine operates pitch-by-pitch, swing behavior can be analyzed at the individual pitch level rather than only through aggregate batting outcomes.

---

### Contact & Outcome System

When contact occurs, the engine determines:

- Contact type
- Contact quality
- Batted-ball trajectory
- Final play outcome

Results are influenced by:

- Batter ratings
- Pitch quality
- Defensive quality
- Environment targets
- Outcome distributions

Possible outcomes include:

- Outs
- Singles
- Doubles
- Triples
- Home runs

---

### Runner System

Runner movement is simulated independently alongside pitch and contact resolution.

This system handles:

- Base advancement
- Double plays and force plays
- Throws and tag attempts
- Stolen bases
- Wild pitches and passed balls
- Secondary runner movement after contact

Runner events are part of the active simulation state and can directly affect inning flow, scoring, and defensive outcomes.

---

## Outcome Modeling

The engine uses layered probability models rather than fixed outcome tables.

Pitch quality, swing decisions, contact quality, launch characteristics, defensive context, and league environment targets all contribute to the final result of a play.

At a high level, the simulation combines:

- Pitch-level probability models
- Swing and contact distributions
- Batted-ball outcome distributions
- Runner and defensive resolution systems
- League environment calibration

---

## Determinism

The engine is deterministic when provided with a consistent random number generator.

Given the same RNG sequence:

- Every pitch is identical
- Every swing decision is identical
- Every contact result is identical
- Every runner event is identical
- Every throw and advancement result is identical
- The final game result is identical

This includes:

- Stolen base attempts
- Throw results
- Defensive plays
- Wild pitches and passed balls
- Ball-in-play resolution

There is no hidden randomness outside the RNG you provide.

### Determinism + Tuning

Determinism applies *after tuning*.

That means you can:

- Change the environment
- Re-run the exact same seed
- Compare output before and after changes

This is useful for:

- Debugging
- Regression testing
- Replay systems
- Verifying tuning adjustments
- Comparing engine versions safely

---

## Testing & Validation

The engine is designed to be tested both functionally and statistically.

Unit tests verify individual systems such as:

- Pitch resolution
- Swing behavior
- Contact generation
- Runner advancement
- Throw outcomes
- Double plays
- Steal logic
- Deterministic replay behavior

In addition to functional tests, the engine is validated through large-scale statistical simulation.

A common workflow is:

1. Simulate a large sample of games
2. Aggregate league-wide output
3. Compare results to a target environment
4. Adjust tuning values
5. Re-run validation

This makes it possible to verify metrics such as:

- In-zone percentage
- Swing and chase rates
- Contact rates
- Pitches per plate appearance
- Strikeout and walk rates
- AVG / OBP / SLG / OPS
- BABIP
- Team runs per game
- Stolen base frequency and success
- Batted-ball outcome distributions

Because the engine is deterministic, simulations can be reproduced exactly using the same RNG seed. This makes debugging, regression testing, and tuning validation significantly easier.

---

## What This Engine Is Good For

This engine is designed for:

- Full game simulation
- Replay systems
- Online baseball games
- Persistent league worlds
- Analytical simulation workflows
- Experimental baseball environments
- Reproducible testing

Because the engine is deterministic and data-driven, it works well both for interactive applications and batch simulation.

---

## Scope

This engine does **not** include:

- Persistence
- Player generation
- UI rendering
- Schedule generation
- Team economy systems
- Contracts or roster management
- Database models
- Network transport

It is strictly a baseball simulation engine.

---

## Design Goals

The project is built around a few core ideas:

- Pitch-by-pitch resolution
- Deterministic outcomes
- Transparent game state
- Tunable statistical environments
- Reproducible debugging
- Separation from any single game client

---

## License

MIT
