/**
 * Balance harness: simulate many matches and report aggregate stats so we can
 * tune the engine toward realistic T20 cricket (avg first-innings ~150-175,
 * sane wicket counts, boundary %, win distribution).
 */
import { simulateMatch, combineSeeds } from "../engine/index.js";
import type { MatchConfig, PitchType, Pitch } from "../engine/index.js";
import { selectOrders, derivePersonality } from "../ai/manager.js";
import { generateLeague } from "../data/generate.js";

const PITCHES: PitchType[] = ["sporting", "crumbling", "green", "flat"];

export interface BalanceReport {
  matches: number;
  avgInn1: number;
  avgInn2: number;
  avgWicketsInn1: number;
  avgWicketsInn2: number;
  minScore: number;
  maxScore: number;
  chaseWinPct: number;
  tiePct: number;
  scoreHistogram: Record<string, number>;
}

export function runBalance(matches: number, seed = 12345): BalanceReport {
  const teams = generateLeague(seed, 12);
  let sumInn1 = 0;
  let sumInn2 = 0;
  let wInn1 = 0;
  let wInn2 = 0;
  let min = Infinity;
  let max = -Infinity;
  let chaseWins = 0;
  let ties = 0;
  const hist: Record<string, number> = {};

  for (let i = 0; i < matches; i++) {
    const a = teams[i % teams.length]!;
    const b = teams[(i * 7 + 3) % teams.length]!;
    if (a.id === b.id) continue;

    const matchSeed = combineSeeds(seed, i, 99);
    const pitch: Pitch = { type: PITCHES[i % PITCHES.length]! };
    const cfg: MatchConfig = {
      oversPerInnings: 20,
      maxOversPerBowler: 4,
      pitch,
      seed: matchSeed,
    };

    const res = simulateMatch(
      {
        teamId: a.id,
        teamName: a.name,
        players: a.squad,
        orders: selectOrders(a.squad, {
          personality: derivePersonality(a.id),
          matchSeed: combineSeeds(matchSeed, 1),
        }),
      },
      {
        teamId: b.id,
        teamName: b.name,
        players: b.squad,
        orders: selectOrders(b.squad, {
          personality: derivePersonality(b.id),
          matchSeed: combineSeeds(matchSeed, 2),
        }),
      },
      cfg,
    );

    const [inn1, inn2] = res.innings;
    sumInn1 += inn1.runs;
    sumInn2 += inn2.runs;
    wInn1 += inn1.wickets;
    wInn2 += inn2.wickets;
    min = Math.min(min, inn1.runs, inn2.runs);
    max = Math.max(max, inn1.runs, inn2.runs);
    if (res.winnerTeamId === b.id) chaseWins++;
    if (res.winnerTeamId === null) ties++;

    const bucket = `${Math.floor(inn1.runs / 20) * 20}-${Math.floor(inn1.runs / 20) * 20 + 19}`;
    hist[bucket] = (hist[bucket] ?? 0) + 1;
  }

  return {
    matches,
    avgInn1: +(sumInn1 / matches).toFixed(1),
    avgInn2: +(sumInn2 / matches).toFixed(1),
    avgWicketsInn1: +(wInn1 / matches).toFixed(2),
    avgWicketsInn2: +(wInn2 / matches).toFixed(2),
    minScore: min,
    maxScore: max,
    chaseWinPct: +((chaseWins / matches) * 100).toFixed(1),
    tiePct: +((ties / matches) * 100).toFixed(1),
    scoreHistogram: hist,
  };
}
