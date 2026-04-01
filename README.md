# Baseball Simulation Engine

## Why This Project Exists

EBL started from a simple frustration: baseball games and franchise saves reset too often, and too much player history depends on a single company or a single release cycle.

This project takes a different approach.

The simulation engine is open source so it can be studied, preserved, modified, and extended over time. The web app is built for shared league play instead of only single-player franchise mode. Ethereum is used as open infrastructure for optional Diamond withdrawals and deposits, so value is not forced to remain inside one server.

EBL is the first public baseball game built on top of that philosophy.

---

## Simulation Loop

The engine simulates games one pitch at a time.

Each call to `simPitch` advances the game by exactly one pitch.

```ts
while (!game.isComplete) {
  simService.simPitch(game, rng)
}
```

A single pitch may:

- Update the count (ball / strike / foul)
- Trigger a ball in play
- Generate runner events (steals, wild pitch, passed ball)
- End the at-bat
- End the inning

The engine does **not** simulate at-bats directly.

Everything flows through pitch resolution.

---

## Core Systems

The simulation is composed of several independent systems that execute in order.

---

### Pitch System

Each pitch generates:

- Pitch type
- Pitch quality (power, location, movement)
- Zone result (in-zone / out-of-zone)
- Pitch outcome (ball, strike, in-play, anomaly)

Pitch behavior is driven by:

- Count state
- League environment targets
- Pitcher ratings (optional via tuning)

---

### Swing System

Given a pitch, the batter decides whether to swing.

This is based on:

- Zone vs chase logic
- Count adjustments (2-strike, 3-ball)
- Pitch quality
- Plate discipline tuning

Outcomes:

- No swing
- Swing and miss
- Foul ball
- Ball in play

---

### Contact & Outcome System

If contact is made:

1. Contact type is determined (ground ball, fly ball, line drive)
2. A 1–1000 roll determines base outcome
3. The result is modified by:
   - Pitch quality
   - Team defense
   - Fielder defense
   - Contact type adjustments

Final outcomes:

- Out
- Single
- Double
- Triple
- Home run

---

### Runner System

Runner movement is handled separately from hit resolution.

This includes:

- Base advancement
- Tag plays and throws
- Force plays and double plays
- Stolen base attempts during pitches
- Wild pitches and passed balls
- Error-driven advancement

Runner events can:

- End innings early
- Override expected outcomes
- Create additional plays after contact

This system operates continuously alongside pitch resolution.

---

## Tuning System

The engine is not hardcoded to a specific baseball environment.

Instead, behavior is controlled through a `PitchEnvironmentTarget`.

This includes:

- Pitch behavior (zone %, strike %, pitches per PA)
- Swing behavior (zone swing %, chase %, contact rates)
- Batted ball distribution
- Outcome distribution (AVG, OBP, SLG, etc.)
- Stolen base rates
- Defensive distributions
- Fine-grained tuning parameters

### Why This Matters

The simulation is built to match real-world data.

You can:

- Recreate real MLB-style environments
- Create custom offensive or defensive eras
- Tune individual systems without rewriting engine logic
- Validate output against target distributions

The engine is **data-driven, not hardcoded**.

---

## Roll Charts

The engine uses **1–1000 roll charts** as the core probability model.

At league average, the base outcome distribution can be tuned to represent a desired offensive environment.

Example baseline shape:

- Out
- Single
- Double
- Triple
- Home run

Player and environment effects push results up or down inside that roll space rather than bypassing the system.

This keeps the simulation transparent and easier to reason about during testing.

---

## League Environment Targets

A `PitchEnvironmentTarget` defines the statistical environment the engine is trying to produce.

This includes:

- Pitch-level targets
- Swing-level targets
- Batted-ball targets
- Team offensive targets
- Outcome targets
- Steal tendencies
- Fielder distribution
- Tuning constants

In practice, this means the engine can target a specific season model and then be validated against that target through aggregate simulation.

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

## Testing & Calibration

The engine is designed to be validated statistically, not only functionally.

A common workflow is:

1. Simulate a large sample of games
2. Aggregate the output
3. Compare actual results to the target environment
4. Adjust tuning values
5. Re-run until the output is acceptably close

This allows you to verify things like:

- In-zone percentage
- Swing rate
- Contact rates
- Pitches per plate appearance
- AVG / OBP / SLG / OPS
- Team runs per game
- Steal frequency and success

This calibration loop is a core part of working on the engine.

---

## Runner Events and Game State

Runner movement is not treated as a cosmetic layer on top of batting results.

It is part of the actual simulation state.

That means runner logic can affect:

- Outs
- Inning transitions
- Double plays
- Scoring
- Left on base
- Fielding credits
- Stolen base stats
- Caught stealing stats

In some cases, runner events can end the inning before further movement is processed.

This is intentional and part of keeping game state internally consistent.

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

## Quick Start

```ts
import { simService } from "baseball-sim-engine"
import seedrandom from "seedrandom"

const rng = seedrandom("game-123")

simService.startGame(command)

while (!game.isComplete) {
  simService.simPitch(game, rng)
}

simService.finishGame(game)
```

---

## Notes

- Simulation is pitch-by-pitch
- You control the simulation loop
- The engine expects you to provide the RNG
- League behavior comes from environment targets and tuning values
- Unit tests and calibration are an important part of development

---

## License

MIT
