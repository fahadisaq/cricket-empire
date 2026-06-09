/**
 * Player development system: weekly training, form fluctuation, fitness loss,
 * aging, and skill decay. This is what makes the world feel alive — every
 * player (AI or human) evolves week to week, and it's all persisted.
 *
 * Mirrors the original game's rules:
 *  - younger players train faster; higher skill trains slower
 *  - only players who "played" get trained (we approximate: XI gets trained)
 *  - skills decay after ~30; fitness loss accelerates with age
 *  - form mean-reverts randomly each week
 */
import { RNG, combineSeeds } from "../../engine/rng.js";
import { computeSalary } from "../../data/generate.js";
import type { Player, PlayerSkills } from "../../engine/types.js";
import type { GameWorld, Club, TrainingFocus } from "../state.js";
import { pushLog } from "../state.js";
import { selectOrders, derivePersonality } from "../../ai/manager.js";

const clamp = (v: number, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, v));

/** How fast a player trains given age & current level (0..1 multiplier). */
function trainingRate(player: Player, currentLevel: number, facility: number): number {
  // Age curve: peaks young, falls off after mid-20s.
  const ageFactor = player.age <= 21 ? 1.0 : Math.max(0.15, 1.2 - (player.age - 21) * 0.07);
  // Diminishing returns at high skill.
  const levelFactor = Math.max(0.1, 1 - currentLevel / 110);
  // Potential ceiling.
  const headroom = Math.max(0, player.potential - currentLevel) / 100;
  const facilityFactor = 0.6 + facility * 0.12;
  return ageFactor * levelFactor * headroom * facilityFactor;
}

const FOCUS_SKILLS: Record<TrainingFocus, (keyof PlayerSkills)[]> = {
  fitness: [],
  fielding: ["fielding"],
  keeping: ["wicketkeeping"],
  batting: ["batVsSeam", "batVsSpin"],
  battingSeam: ["batVsSeam"],
  battingSpin: ["batVsSpin"],
  bowlingSeam: ["bowlMain", "bowlVariation"],
  bowlingSpin: ["bowlMain", "bowlVariation"],
  bowlingVariation: ["bowlVariation"],
};

/** Apply one week of training to a club's trained players. Returns the XI set. */
function trainClub(world: GameWorld, club: Club, rng: RNG): Set<string> {
  // Determine who "played" this week -> the selected XI.
  const squad = club.squadPlayerIds
    .map((id) => world.players[id])
    .filter((p): p is Player => !!p);
  if (squad.length === 0) return new Set();

  const orders = selectOrders(squad, {
    personality: club.managerType === "ai" ? club.personality : derivePersonality(club.id),
    matchSeed: combineSeeds(world.seed, world.week, club.id.length),
  });
  const xi = new Set(orders.battingOrder);

  const focus = club.trainingFocus;
  const skills = FOCUS_SKILLS[focus];
  const BASE_GAIN = 2.4;

  let popMessages = 0;

  for (const id of club.squadPlayerIds) {
    const p = world.players[id];
    if (!p) continue;

    if (focus === "fitness") {
      if (xi.has(id)) {
        const rate = trainingRate(p, p.fitness, club.trainingFacilityLevel);
        p.fitness = clamp(p.fitness + BASE_GAIN * rate * 1.4);
      }
      continue;
    }

    // Bowling foci only train the relevant bowler type.
    if (focus === "bowlingSeam" && p.bowlerType !== "seam") continue;
    if (focus === "bowlingSpin" && p.bowlerType !== "spin") continue;

    if (xi.has(id)) {
      for (const sk of skills) {
        const before = Math.floor(p.skills[sk] / 10);
        const rate = trainingRate(p, p.skills[sk], club.trainingFacilityLevel);
        p.skills[sk] = clamp(p.skills[sk] + BASE_GAIN * rate);
        const after = Math.floor(p.skills[sk] / 10);
        if (after > before) popMessages++;
      }
      // Recompute salary on skill change.
      p.salary = computeSalary(p.skills);
    }
  }

  if (popMessages > 0) {
    club.reputationPoints += popMessages * 4; // training pops earn reputation
    pushLog(world, "training", `${club.name}: ${popMessages} skill pop(s) from ${focus} training.`, club.id);
  }

  return xi;
}

/** Weekly form drift (mean-reverting) + fitness toward age-based equilibrium.
 *  NOTE: aging/skill-decay/retirement now live in systems/lifecycle.ts. */
function ageAndFormPlayer(p: Player, played: boolean, rng: RNG): void {
  // Form: pulls toward 50, with random weekly shock.
  const pull = (50 - p.form) * 0.25;
  p.form = clamp(p.form + pull + rng.normal(0, 9));

  // Fitness model: each week has rest days, so players recover toward an
  // age-based equilibrium. Playing a match applies mild fatigue. Net effect
  // for a young regular is ~stable-high; older players settle lower.
  const equilibrium = p.age <= 26 ? 82 : Math.max(45, 82 - (p.age - 26) * 3);
  p.fitness = clamp(p.fitness + (equilibrium - p.fitness) * 0.35);
  if (played) {
    const fatigue = p.age <= 28 ? 1.5 : 1.5 + (p.age - 28) * 0.5;
    p.fitness = clamp(p.fitness - fatigue - rng.float(0, 0.6));
  }
}

export function runDevelopment(world: GameWorld): void {
  const rng = new RNG(combineSeeds(world.seed, world.week, 101));

  // 1) Training per club. Collect each club's XI (who "played"/rested).
  const playedThisWeek = new Set<string>();
  for (const club of Object.values(world.clubs)) {
    const xi = trainClub(world, club, rng);
    for (const id of xi) playedThisWeek.add(id);
  }

  // 2) Form/fitness for every player (aging handled by the lifecycle system).
  for (const p of Object.values(world.players)) {
    ageAndFormPlayer(p, playedThisWeek.has(p.id), rng);
  }
}
