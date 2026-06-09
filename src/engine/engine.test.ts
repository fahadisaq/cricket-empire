/**
 * Lightweight test runner (no deps). Validates determinism, fairness, and that
 * the engine produces sane cricket. Run with: npm test
 */
import { RNG, combineSeeds } from "./rng.js";
import { simulateMatch } from "./matchSim.js";
import { skillIndex } from "./ability.js";
import type { MatchConfig, Pitch } from "./types.js";
import { generateLeague } from "../data/generate.js";
import { selectOrders, derivePersonality } from "../ai/manager.js";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function makeMatch(seed: number) {
  const teams = generateLeague(seed, 4);
  const a = teams[0]!;
  const b = teams[1]!;
  const matchSeed = combineSeeds(seed, 42);
  const pitch: Pitch = { type: "sporting" };
  const cfg: MatchConfig = {
    oversPerInnings: 20,
    maxOversPerBowler: 4,
    pitch,
    seed: matchSeed,
  };
  return simulateMatch(
    {
      teamId: a.id,
      teamName: a.name,
      players: a.squad,
      orders: selectOrders(a.squad, { personality: derivePersonality(a.id), matchSeed: combineSeeds(matchSeed, 1) }),
    },
    {
      teamId: b.id,
      teamName: b.name,
      players: b.squad,
      orders: selectOrders(b.squad, { personality: derivePersonality(b.id), matchSeed: combineSeeds(matchSeed, 2) }),
    },
    cfg,
  );
}

console.log("\nRunning engine tests...\n");

// 1) RNG determinism
{
  const r1 = new RNG(123);
  const r2 = new RNG(123);
  let same = true;
  for (let i = 0; i < 1000; i++) if (r1.next() !== r2.next()) same = false;
  assert(same, "RNG is deterministic for the same seed");

  const r3 = new RNG(124);
  const r4 = new RNG(125);
  assert(r3.next() !== r4.next(), "Different seeds diverge");
}

// 2) RNG distribution roughly uniform
{
  const r = new RNG(7);
  let sum = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) sum += r.next();
  const mean = sum / N;
  assert(Math.abs(mean - 0.5) < 0.01, `RNG mean ~0.5 (got ${mean.toFixed(4)})`);
}

// 3) Match determinism
{
  const m1 = makeMatch(999);
  const m2 = makeMatch(999);
  assert(
    m1.innings[0].runs === m2.innings[0].runs &&
      m1.innings[1].runs === m2.innings[1].runs,
    "Same seed -> identical match scores",
  );
  assert(
    m1.events.length === m2.events.length,
    "Same seed -> identical ball count",
  );
}

// 4) Scores within sane bounds, wickets <= 10, balls <= 120
{
  for (let s = 0; s < 30; s++) {
    const m = makeMatch(1000 + s);
    for (const inn of m.innings) {
      assert(inn.runs >= 30 && inn.runs <= 320, `innings score sane (${inn.runs})`);
      assert(inn.wickets >= 0 && inn.wickets <= 10, `wickets in range (${inn.wickets})`);
      assert(inn.balls <= 120, `balls <= 120 (${inn.balls})`);
    }
  }
}

// 5) Bowler over-cap respected (max 4 overs = 24 balls)
{
  const m = makeMatch(555);
  for (const inn of m.innings) {
    for (const bw of inn.bowling) {
      assert(bw.ballsBowled <= 24, `bowler <= 24 balls (${bw.name}: ${bw.ballsBowled})`);
    }
  }
}

// 6) Batting scorecard runs sum to innings total
{
  const m = makeMatch(321);
  for (const inn of m.innings) {
    const batRuns = inn.batting.reduce((s, b) => s + b.runs, 0);
    assert(batRuns === inn.runs, `batting runs sum to total (${batRuns} vs ${inn.runs})`);
  }
}

// 7) Stronger squad wins more often than not over many games
{
  const teams = generateLeague(42, 2);
  // Force a clear quality gap by comparing skill indices.
  const sA = teams[0]!.squad.reduce((s, p) => s + skillIndex(p.skills), 0);
  const sB = teams[1]!.squad.reduce((s, p) => s + skillIndex(p.skills), 0);
  const strong = sA >= sB ? teams[0]! : teams[1]!;
  const weak = sA >= sB ? teams[1]! : teams[0]!;

  let strongWins = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const matchSeed = combineSeeds(7, i);
    const cfg: MatchConfig = {
      oversPerInnings: 20,
      maxOversPerBowler: 4,
      pitch: { type: "sporting" },
      seed: matchSeed,
    };
    const res = simulateMatch(
      {
        teamId: strong.id, teamName: strong.name, players: strong.squad,
        orders: selectOrders(strong.squad, { personality: "balanced", matchSeed: combineSeeds(matchSeed, 1) }),
      },
      {
        teamId: weak.id, teamName: weak.name, players: weak.squad,
        orders: selectOrders(weak.squad, { personality: "balanced", matchSeed: combineSeeds(matchSeed, 2) }),
      },
      cfg,
    );
    if (res.winnerTeamId === strong.id) strongWins++;
  }
  assert(strongWins > N * 0.55, `stronger squad wins majority (${strongWins}/${N})`);
}

console.log(`\n${passed} passed, ${failed} failed.\n`);
process.exit(failed > 0 ? 1 : 0);
