/**
 * AI manager brain. Produces the exact same MatchOrders a human would submit,
 * so the match engine cannot distinguish AI from human teams. Fast and
 * heuristic (no LLM) so hundreds of clubs can be processed each tick.
 *
 * Personalities bias tactical choices, making the league feel alive.
 */
import { RNG, hashString } from "../engine/rng.js";
import { skillIndex } from "../engine/ability.js";
import type { Player, MatchOrders } from "../engine/types.js";

export type Personality = "aggressive" | "balanced" | "economical" | "youth";

export interface AIManagerProfile {
  teamId: string;
  personality: Personality;
}

/** Assign a stable personality from the team id. */
export function derivePersonality(teamId: string): Personality {
  const personalities: Personality[] = [
    "aggressive",
    "balanced",
    "economical",
    "youth",
  ];
  return personalities[hashString(teamId) % personalities.length]!;
}

function battingValue(p: Player): number {
  return (p.skills.batVsSeam + p.skills.batVsSpin) / 2 +
    p.form * 0.15 +
    p.experience * 0.1;
}

function bowlingValue(p: Player): number {
  return (
    p.skills.bowlMain * 0.4 +
    p.skills.bowlVariation * 0.6 +
    p.form * 0.15 +
    p.fitness * 0.1
  );
}

/**
 * Select the best XI and tactical orders from a squad.
 * Greedy but cricket-aware: ensures a keeper, enough bowling, sensible order.
 */
export function selectOrders(
  squad: Player[],
  opts: { personality: Personality; matchSeed: number; opponentStrength?: number },
): MatchOrders {
  const rng = new RNG(opts.matchSeed);

  // 1) Pick a keeper (best wicketkeeping).
  const keepers = [...squad].sort(
    (a, b) => b.skills.wicketkeeping - a.skills.wicketkeeping,
  );
  const keeper = keepers[0]!;

  // 2) Rank remaining by an all-round value to fill the XI.
  const rest = squad.filter((p) => p.id !== keeper.id);

  // Ensure at least 5 credible bowling options.
  const bowlers = [...rest]
    .sort((a, b) => bowlingValue(b) - bowlingValue(a))
    .slice(0, 6);
  const bowlerIds = new Set(bowlers.map((b) => b.id));

  // Top batters (may overlap with allrounders already chosen as bowlers).
  const batters = [...rest].sort((a, b) => battingValue(b) - battingValue(a));

  // Build XI: keeper + top bowlers + best remaining batters up to 11.
  const xi: Player[] = [keeper, ...bowlers];
  for (const b of batters) {
    if (xi.length >= 11) break;
    if (!xi.find((p) => p.id === b.id)) xi.push(b);
  }
  while (xi.length < 11 && xi.length < squad.length) {
    const extra = squad.find((p) => !xi.find((x) => x.id === p.id));
    if (!extra) break;
    xi.push(extra);
  }

  // 3) Batting order: best batters up top, alternate hands where possible.
  const ordered = orderBatting(xi, rng);

  // 4) Bowling order: best bowlers, seamers tend to open.
  const bowlingOrder = [...xi]
    .filter((p) => bowlerIds.has(p.id) || bowlingValue(p) > 35)
    .sort((a, b) => {
      // Seamers slightly preferred to open (new-ball boost).
      const seamBias = (p: Player) => (p.bowlerType === "seam" ? 3 : 0);
      return bowlingValue(b) + seamBias(b) - (bowlingValue(a) + seamBias(a));
    })
    .map((p) => p.id);

  // 5) Captain: most experienced in the XI.
  const captain = [...xi].sort((a, b) => b.experience - a.experience)[0]!;

  // 6) Powerplay start based on personality.
  let powerplayStartOver: number;
  switch (opts.personality) {
    case "aggressive":
      powerplayStartOver = 0;
      break;
    case "economical":
      powerplayStartOver = rng.int(8, 12);
      break;
    case "youth":
      powerplayStartOver = rng.int(0, 4);
      break;
    default:
      powerplayStartOver = rng.int(0, 6);
  }

  return {
    battingOrder: ordered.map((p) => p.id),
    bowlingOrder,
    keeperId: keeper.id,
    captainId: captain.id,
    powerplayStartOver,
  };
}

/** Order batters by value, nudging toward left/right alternation in the middle. */
function orderBatting(xi: Player[], rng: RNG): Player[] {
  const byValue = [...xi].sort((a, b) => battingValue(b) - battingValue(a));

  // Take top 7 as specialist batting slots, tail at the end.
  const topOrder = byValue.slice(0, 7);
  const tail = byValue.slice(7);

  // Light left/right alternation pass in the middle (slots 2..5).
  for (let i = 2; i < topOrder.length - 1; i++) {
    if (topOrder[i]!.battingHand === topOrder[i - 1]!.battingHand) {
      const swap = topOrder.findIndex(
        (p, j) => j > i && p.battingHand !== topOrder[i - 1]!.battingHand,
      );
      if (swap > -1) {
        [topOrder[i], topOrder[swap]] = [topOrder[swap]!, topOrder[i]!];
      }
    }
  }
  void rng;
  return [...topOrder, ...tail];
}

/** Quick squad strength estimate for matchmaking/valuation. */
export function squadStrength(squad: Player[]): number {
  const top11 = [...squad]
    .sort((a, b) => skillIndex(b.skills) - skillIndex(a.skills))
    .slice(0, 11);
  return Math.round(
    top11.reduce((s, p) => s + skillIndex(p.skills), 0) / top11.length,
  );
}
