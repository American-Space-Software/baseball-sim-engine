# Baseball Sim Engine

A deterministic baseball simulation engine written in TypeScript.

This library simulates complete baseball games pitch-by-pitch using a ratings-driven model grounded in league-average distributions. It is designed for both interactive applications and analytical workflows.

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


## Installation

```bash
npm install baseball-sim-engine
```

---

## Quick Start

```ts
import { simService } from "baseball-sim-engine"

// Initialize game
simService.startGame(command)

// Simulate until complete
while (!game.isComplete) {
  simService.simPitch(game, rng)
}

// Finalize
simService.finishGame(game)
```

---

## Core API

### Start Game

```ts
simService.startGame(command)
```

Initializes a game with teams, players, and league configuration.

---

### Simulate Pitch

```ts
simService.simPitch(game, rng)
```

Advances the simulation by one pitch.

---

### Finish Game

```ts
simService.finishGame(game)
```

Finalizes the game once complete.

---

## Simulation Model

The engine begins with a model of **league-average baseball**.

### League-Average Outcome Distribution (1–1000)

- 1–649 → OUT  
- 650–849 → SINGLE  
- 850–924 → DOUBLE  
- 925–932 → TRIPLE  
- 933–1000 → HOME RUN  

---

## Pitch-by-Pitch Model

Each pitch is resolved through:

1. Pitch intent  
2. Pitch execution (power, location, movement)  
3. Zone evaluation  
4. Swing decision  
5. Contact resolution  
6. Ball-in-play resolution  
7. Runner + fielding outcomes  

---

## Roll Charts

The engine uses **1–1000 roll charts** as the core probability model.

At league average:

- 649 slots = outs  
- 200 slots = singles  
- 75 slots = doubles  
- 8 slots = triples  
- 68 slots = home runs  

### Player Adjustments

Players modify this distribution:

- Hitters shift outcomes upward  
- Pitchers shift outcomes downward  

Examples:

- Contact hitters convert OUT → SINGLE  
- Power hitters convert SINGLE → HR  
- Pitchers convert HIT → OUT  

If both players modify the same range, the system stabilizes toward league average.

---

## Fielding and Ball Direction

Example distribution:

- CF: 18  
- LF: 17  
- RF: 13  
- SS: 14  
- etc.

Depth:

- Shallow: 20%  
- Normal: 60%  
- Deep: 20%  

---

## Pitch Environment (League Average)

- In-zone rate: 49.6%  
- Strike swing rate: 67.6%  
- Ball swing rate: 28.5%  
- Zone contact: 82.2%  
- Chase contact: 56%  
- Foul rate: 50%  

---

## Pitch Tracking Model

This system does NOT directly output Statcast data.

However:

- Pitch power → velocity (scaled, up to ~104 mph)  
- Contact quality → exit velocity  
- Zones → spatial mapping  

The structure is compatible with future mapping.

---

## Determinism

The engine is deterministic when provided with a consistent random number generator.

Given the same RNG sequence:

- Game results will be identical  
- Play-by-play output will match exactly  
- Every pitch, decision, and outcome can be reproduced  

This applies across the entire simulation, including:

- Pitch selection and execution  
- Swing decisions  
- Contact outcomes  
- Ball-in-play resolution  
- Runner and fielding events  

There is no hidden randomness outside of the RNG you provide.

### Why This Matters

Determinism enables:

- **Reproducible simulations**  
  The same game can be replayed exactly, down to every pitch.

- **Debugging and testing**  
  Bugs can be isolated and verified against a fixed sequence of events.

- **Simulation verification**  
  Changes to the engine can be validated by comparing outputs before and after.

- **Replay systems**  
  Games can be stored as RNG seeds and reconstructed later without saving full state.

- **Analytical workflows**  
  Identical inputs always produce identical outputs, making large-scale analysis reliable.

### RNG Requirements

The engine expects a function that returns a numeric value (typically `0–1`).

```ts
const rng = () => Math.random() 
import seedrandom from "seedrandom"

const rng = seedrandom("game-123")
```
As long as the RNG produces the same sequence, the simulation will produce the same results.


---

## Design Goals

- Realistic statistical outcomes  
- Deterministic simulation  
- Transparent game state  
- No hidden randomness  

---

## Notes

- Simulation is pitch-by-pitch (not at-bat)  
- You control the loop  
- No persistence included  
- Player generation is external  

---

## License

MIT
