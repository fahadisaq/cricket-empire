/**
 * The per-ball outcome model. Given a batter, bowler, and match context, it
 * produces a probability distribution over {0,1,2,3,4,6,W} and samples it.
 *
 * Design: a logistic curve maps the ability gap (batter - bowler) into a
 * batting-dominance factor in (0,1). Aggression and chase-pressure then reshape
 * the boundary/wicket weights. Fielding & keeper quality decide whether a
 * wicket chance is actually taken.
 */
import { ENGINE_CONFIG as C } from "./config.js";
import type { RNG } from "./rng.js";
import type { BallOutcome } from "./types.js";

export interface BallContext {
  battingAbility: number;
  bowlingAbility: number;
  over: number; // 0-based
  fieldingRating: number; // bowling team
  keeperAbility: number;
  /** Aggression state. */
  inPowerplay: boolean;
  isDeathOvers: boolean;
  /** Chase pressure: required run rate per ball minus par (>0 = behind). */
  rrrPressure: number | null; // null in first innings / no target
  cruising: boolean; // chasing & needs < 1 run/ball
  /** Did the strike change on the previous ball (bowler line penalty)? */
  bowlerLinePenalty: boolean;
}

export interface BallResolution {
  outcome: BallOutcome;
  runs: number;
  wicket: boolean;
  wicketType?: "bowled" | "caught" | "caughtBehind" | "lbw" | "stumped";
}

/** Logistic squash. */
function logistic(x: number, spread: number): number {
  return 1 / (1 + Math.exp(-x / spread));
}

export function resolveBall(ctx: BallContext, rng: RNG): BallResolution {
  let effectiveBowling = ctx.bowlingAbility;
  if (ctx.bowlerLinePenalty) effectiveBowling -= C.strikeChangeBowlerPenalty;

  // Batting dominance in (0,1): 0.5 means evenly matched.
  const gap = ctx.battingAbility - effectiveBowling;
  const dominance = logistic(gap, C.abilitySpread);

  // ---- Wicket probability ----
  // Weaker batters (low dominance) get out more. Aggression raises risk.
  let wicketProb = C.baseWicketProb * (1 + (0.5 - dominance) * 1.6);

  let boundaryMult = 1;
  let wicketMult = 1;

  if (ctx.isDeathOvers) {
    boundaryMult *= C.aggression.deathBoundary;
    wicketMult *= C.aggression.deathWicket;
  } else if (ctx.inPowerplay) {
    boundaryMult *= C.aggression.powerplayBoundary;
    wicketMult *= C.aggression.powerplayWicket;
  }

  // Chase pressure reshapes appetite.
  if (ctx.rrrPressure !== null) {
    if (ctx.cruising) {
      boundaryMult *= C.chase.cruisePassiveBoundary;
    } else if (ctx.rrrPressure > 0) {
      boundaryMult *= 1 + ctx.rrrPressure * C.chase.boundaryPerRRR;
      wicketMult *= 1 + ctx.rrrPressure * C.chase.wicketPerRRR;
    }
  }

  wicketProb *= wicketMult;
  wicketProb = Math.min(0.5, Math.max(0.005, wicketProb));

  if (rng.chance(wicketProb)) {
    return resolveWicket(ctx, rng);
  }

  // ---- Scoring outcome (no wicket) ----
  // Base run weights for {0,1,2,3,4,6}. Dots & singles dominate (realistic T20);
  // higher dominance shifts mass toward boundaries.
  const w0 = 2.4 - dominance * 1.2; // dots more likely when dominated
  const w1 = 2.6;
  const w2 = 0.55;
  const w3 = 0.04;
  const w4 = (0.35 + dominance * 0.7) * boundaryMult;
  const w6 = (0.08 + dominance * 0.35) * boundaryMult;

  const idx = rng.weighted([w0, w1, w2, w3, w4, w6]);
  const runs = [0, 1, 2, 3, 4, 6][idx]! as 0 | 1 | 2 | 3 | 4 | 6;
  return { outcome: runs, runs, wicket: false };
}

function resolveWicket(ctx: BallContext, rng: RNG): BallResolution {
  // Decide dismissal type. Caught chances may be dropped based on fielding.
  const roll = rng.next();

  // Caught-behind first (depends on keeper quality).
  const cbProb =
    C.caughtBehindBaseProb * (0.6 + ctx.keeperAbility / 100);
  if (roll < cbProb) {
    // Keeper may drop it: conversion scales with keeper ability.
    const conv = 0.8 + (ctx.keeperAbility - 50) * 0.003;
    if (rng.chance(Math.min(0.98, Math.max(0.55, conv)))) {
      return {
        outcome: "W",
        runs: 0,
        wicket: true,
        wicketType: "caughtBehind",
      };
    }
    // Dropped: treat as a dot (let off).
    return { outcome: 0, runs: 0, wicket: false };
  }

  // Caught in the field: conversion depends on team fielding rating.
  if (roll < cbProb + 0.45) {
    const conv =
      C.fielding.catchBaseConversion +
      (ctx.fieldingRating - 50) * C.fielding.catchSwingPerPoint;
    if (rng.chance(Math.min(0.98, Math.max(0.5, conv)))) {
      return { outcome: "W", runs: 0, wicket: true, wicketType: "caught" };
    }
    // Dropped catch -> batter survives, sometimes runs.
    return rng.chance(0.4)
      ? { outcome: 1, runs: 1, wicket: false }
      : { outcome: 0, runs: 0, wicket: false };
  }

  // Bowled / LBW (unaffected by fielding).
  const type = rng.chance(0.6) ? "bowled" : "lbw";
  return { outcome: "W", runs: 0, wicket: true, wicketType: type };
}
