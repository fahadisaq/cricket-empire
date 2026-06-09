# 🏏 Cricket Empire

A deep T20 cricket **management** sim — inspired by the original 2011 browser
Hitwicket, rebuilt with a powerful, fully-specified match engine and
self-managing **AI clubs** so the league is alive from day one.

You are a club manager, not a player. You build a squad, train it, scout youth,
bid at auction, set tactics — and a probability-driven engine simulates every
ball.

## What makes it better than the 2011 original

- **The engine is real, not a black box.** The original hid its math behind
  "SomeComplexFunction." Here every ability and per-ball probability is
  explicit, **seeded, deterministic, and unit-tested** — reproducible matches,
  replayable commentary, provable fairness.
- **AI teams behave exactly like humans.** The match engine cannot tell an AI
  club from a human one — same data model, same `MatchOrders`. This solves the
  cold-start problem: a full, competitive league exists before any real players
  join, and humans drop in seamlessly.
- **Tunable cricket model.** Phase-based aggression (powerplay/death), chase
  pressure (required run rate), seam/spin matchups, new-ball effects, pitch
  types, fielding & keeper quality, captaincy — all config-driven.

## Project layout

```
src/
├── engine/          The crown jewel — pure, dependency-free, seeded sim
│   ├── rng.ts         seeded RNG (mulberry32) + string hashing
│   ├── types.ts       player / team / pitch / match models
│   ├── config.ts      ALL tuning coefficients (balance here, not in logic)
│   ├── ability.ts     batting/bowling/fielding/keeper ability + Skill Index
│   ├── ballEngine.ts  per-delivery probability model
│   ├── matchSim.ts    full innings, chase logic, scorecards, MOM
│   ├── commentary.ts  deterministic ball-by-ball commentary
│   └── engine.test.ts test suite (determinism + fairness + sane cricket)
├── data/
│   ├── names.ts       fictional name pools (no real cricketers)
│   └── generate.ts    procedural players / squads / leagues (seeded)
├── ai/
│   └── manager.ts     AI brain: XI selection, order, tactics, personalities
├── league/
│   ├── season.ts      round-robin schedule, standings, NRR
│   └── balance.ts     mass-simulation harness for tuning
└── cli.ts             season | match | balance commands
```

## Run it

```bash
npm install
npm test               # engine determinism + fairness tests
npm run season         # simulate a full 10-team AI season + final table
npm run season 2026    # ...with a specific seed
npm run match          # one match with scorecard + commentary
npm run balance 600    # simulate 600 matches, print scoring distribution
npm run typecheck
```

## Current balance (≈ realistic T20)

- 1st innings average ~180 (≈5 wickets), range ~70–260
- Chasing side wins ~53% (matches real-world chase edge)
- Stronger squads win the majority but upsets happen

## Roadmap

1. ✅ Engine + AI + headless season (this milestone)
2. Persistence layer (Supabase) — players, teams, matches, auctions, finances
3. Weekly tick server — training, finances, scouting, auctions, AI turns
4. Web UI (React 19 + Vite + Zustand + Tailwind, matching `airline-empire`)
5. Divisions, promotion/relegation, alliances, social features
