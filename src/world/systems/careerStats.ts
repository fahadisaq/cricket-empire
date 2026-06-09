/**
 * Career-stats accumulation. After every match, each participating player's
 * lifetime record is updated from the scorecard. This is what gives retired
 * players real, meaningful Hall-of-Fame numbers.
 */
import { emptyCareer } from "../../engine/types.js";
import type { GameWorld } from "../state.js";
import type { MatchResult } from "../../engine/types.js";

function ensureCareer(world: GameWorld, playerId: string, debutWeek: number): void {
  const p = world.players[playerId];
  if (!p) return;
  if (!p.career) {
    p.career = emptyCareer();
    p.debutWeek = debutWeek;
  }
}

/** Apply one match's scorecards to every involved player's career stats. */
export function accumulateMatchStats(world: GameWorld, result: MatchResult): void {
  const week = world.week;

  // Count a "match played" once per player who appears in either innings.
  const appeared = new Set<string>();

  for (const inn of result.innings) {
    // Batting.
    for (const b of inn.batting) {
      if (b.balls === 0 && !b.out) continue; // didn't actually bat
      ensureCareer(world, b.playerId, week);
      const p = world.players[b.playerId];
      if (!p?.career) continue;
      appeared.add(b.playerId);
      const c = p.career;
      c.inningsBatted++;
      c.runs += b.runs;
      c.ballsFaced += b.balls;
      c.fours += b.fours;
      c.sixes += b.sixes;
      if (!b.out) c.notOuts++;
      if (b.runs > c.highScore) c.highScore = b.runs;
      if (b.runs >= 100) c.hundreds++;
      else if (b.runs >= 50) c.fifties++;
    }

    // Bowling.
    for (const bw of inn.bowling) {
      ensureCareer(world, bw.playerId, week);
      const p = world.players[bw.playerId];
      if (!p?.career) continue;
      appeared.add(bw.playerId);
      const c = p.career;
      c.ballsBowled += bw.ballsBowled;
      c.oversBowled = +(c.ballsBowled / 6).toFixed(1);
      c.runsConceded += bw.runsConceded;
      c.wickets += bw.wickets;
      // Best bowling: most wickets, then fewest runs.
      if (
        bw.wickets > c.bestBowlingWickets ||
        (bw.wickets === c.bestBowlingWickets && bw.runsConceded < c.bestBowlingRuns)
      ) {
        c.bestBowlingWickets = bw.wickets;
        c.bestBowlingRuns = bw.runsConceded;
      }
    }
  }

  // Matches played.
  for (const id of appeared) {
    const c = world.players[id]?.career;
    if (c) c.matches++;
  }

  // Man of the Match.
  const mom = world.players[result.manOfTheMatch.playerId];
  if (mom) {
    ensureCareer(world, mom.id, week);
    if (mom.career) mom.career.manOfTheMatch++;
  }
}
