/**
 * Ability calculations: turn raw skills + dynamic state + context into the
 * effective per-ball "ability" numbers the ball engine compares.
 *
 * The original game described these as "SomeComplexFunction" and hid them.
 * Here they are fully specified, continuous, and tunable via config.ts.
 */
import { ENGINE_CONFIG as C } from "./config.js";
import type { Player, BowlerType, Pitch, PlayerSkills } from "./types.js";

const NEUTRAL = 50;

/** Convert a 0..100 dynamic attribute into a multiplier centered on 1.0. */
function modifier(value: number, weight: number): number {
  return 1 + ((value - NEUTRAL) / NEUTRAL) * weight;
}

/** Display tier for a 0..100 value (mirrors original Hopeless..Superb ladder). */
export function skillTier(value: number): string {
  const tiers = [
    "Hopeless",
    "Poor",
    "Unreliable",
    "Decent",
    "Good",
    "Reliable",
    "Accomplished",
    "Remarkable",
    "Exemplary",
    "Superb",
  ];
  const idx = Math.min(tiers.length - 1, Math.max(0, Math.floor(value / 10)));
  return tiers[idx]!;
}

/**
 * Batting ability against a specific bowler type, for a single ball.
 * Combines the relevant batting skill with form, fitness, experience, and pitch.
 */
export function battingAbility(
  batter: Player,
  bowlerType: BowlerType,
  pitch: Pitch,
): number {
  const base =
    bowlerType === "seam" ? batter.skills.batVsSeam : batter.skills.batVsSpin;

  let ability =
    base *
    modifier(batter.form, C.formWeight) *
    modifier(batter.fitness, C.fitnessWeight) *
    modifier(batter.experience, C.experienceWeight);

  // Flat pitch rewards batsmen as a % of their own ability.
  if (pitch.type === "flat") ability += ability * C.pitchBatBoostPct;

  return ability;
}

/**
 * Bowling ability for a single ball, including new-ball phase and pitch.
 * Variation is weighted higher than main bowling skill.
 */
export function bowlingAbility(
  bowler: Player,
  over: number,
  pitch: Pitch,
): number {
  const skillCore =
    bowler.skills.bowlMain * C.bowlMainWeight +
    bowler.skills.bowlVariation * C.bowlVariationWeight;

  // Fitness matters more for seamers.
  const fitnessWeight =
    bowler.bowlerType === "seam"
      ? C.fitnessWeight + C.fitnessSeamBonus
      : C.fitnessWeight;

  let ability =
    skillCore *
    modifier(bowler.form, C.formWeight) *
    modifier(bowler.fitness, fitnessWeight) *
    modifier(bowler.experience, C.experienceWeight);

  // New-ball phase: seamers boosted, spinners slightly penalized.
  if (over < C.newBallPhaseOvers) {
    if (bowler.bowlerType === "seam") ability += C.seamNewBallBoost;
    else ability -= C.spinNewBallPenalty;
  }

  // Pitch help as a % of ability (rewards higher skill).
  if (pitch.type === "green" && bowler.bowlerType === "seam") {
    ability += ability * C.pitchSeamBoostPct;
  } else if (pitch.type === "crumbling" && bowler.bowlerType === "spin") {
    ability += ability * C.pitchSpinBoostPct;
  }

  return ability;
}

/**
 * Team fielding rating (0..~100). Captain experience and the 3 best fielders
 * carry extra weight (the original auto-placed your 3 best fielders at key spots).
 */
export function teamFieldingRating(
  xi: Player[],
  captainId: string,
): number {
  if (xi.length === 0) return NEUTRAL;

  const fieldingScores = xi
    .map((p) => p.skills.fielding * modifier(p.fitness, C.fitnessWeight))
    .sort((a, b) => b - a);

  const avg =
    fieldingScores.reduce((s, v) => s + v, 0) / fieldingScores.length;

  // Top 3 fielders weighted extra.
  const top3 =
    fieldingScores.slice(0, 3).reduce((s, v) => s + v, 0) /
    Math.min(3, fieldingScores.length);

  const captain = xi.find((p) => p.id === captainId);
  const captainBonus = captain
    ? ((captain.experience - NEUTRAL) / NEUTRAL) * 4
    : 0;

  return 0.55 * avg + 0.45 * top3 + captainBonus;
}

/** Keeper ability for caught-behind / byes resolution. */
export function keeperAbility(keeper: Player): number {
  return (
    keeper.skills.wicketkeeping *
    modifier(keeper.fitness, C.fitnessWeight) *
    modifier(keeper.experience, C.experienceWeight)
  );
}

/**
 * Skill Index (SI): single-number summary of a player's worth.
 * Weighted so bowling/batting contribute far more than fielding (per original).
 */
export function skillIndex(skills: PlayerSkills): number {
  const weights = {
    batVsSeam: 95,
    batVsSpin: 95,
    bowlMain: 110,
    bowlVariation: 120,
    fielding: 35,
    wicketkeeping: 60,
  };
  let si = 0;
  // Quadratic-ish growth so high "pops" add disproportionately more SI.
  for (const key of Object.keys(weights) as (keyof PlayerSkills)[]) {
    const v = skills[key];
    si += weights[key] * (v + (v * v) / 100);
  }
  return Math.round(si);
}
