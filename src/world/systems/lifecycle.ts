/**
 * Player lifecycle — the "living, generational world" system.
 *
 * Faithful to Hitwicket's age model, expanded into a full career arc:
 *
 *   AGE  | phase        | what happens
 *   16-21| prospect     | trains fastest, big upside, low experience
 *   22-25| rising       | still improving quickly, gaining experience
 *   26-29| PEAK         | best years; minimal natural change
 *   30-33| decline      | skills slowly erode, fitness drops faster
 *   34-37| veteran      | steeper decline, may retire
 *   38+  | retirement   | retires (or earlier if skills collapse)
 *
 * Ageing cadence mirrors Hitwicket's "birthday every 70 days": each player has
 * a birthday roughly every 10 game-weeks (staggered per player so the league
 * doesn't all age at once). On a birthday: age +1, salary recompute, and the
 * career-arc skill change for that year is applied.
 *
 * When players retire, fresh young players are generated into a FREE-AGENT
 * pool so clubs can refill — the world's talent population stays healthy.
 */
import { RNG, combineSeeds } from "../../engine/rng.js";
import { computeSalary, generatePlayer } from "../../data/generate.js";
import { skillIndex } from "../../engine/ability.js";
import { emptyCareer } from "../../engine/types.js";
import type { Player, PlayerSkills, PlayerRole } from "../../engine/types.js";
import type { GameWorld, Club } from "../state.js";
import { pushLog } from "../state.js";

const clamp = (v: number, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, v));

/** Weeks between birthdays (~70 days, like Hitwicket). */
export const WEEKS_PER_BIRTHDAY = 10;

/** A stable per-player birthday phase so ages stagger across the league. */
function birthdayPhase(p: Player): number {
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
  return h % WEEKS_PER_BIRTHDAY;
}

/**
 * The per-year skill delta from the career arc (before training).
 * Returns the average skill-point change to apply this birthday.
 */
function careerArcDelta(age: number, potential: number, currentAvg: number, rng: RNG): number {
  if (age <= 21) {
    // Prospect: natural growth toward potential.
    const room = Math.max(0, potential - currentAvg);
    return Math.min(room, rng.float(2.5, 5.0));
  }
  if (age <= 25) {
    // Rising: still improving, smaller.
    const room = Math.max(0, potential - currentAvg);
    return Math.min(room, rng.float(1.0, 3.0));
  }
  if (age <= 29) {
    // Peak: tiny fluctuation either way.
    return rng.float(-0.6, 0.8);
  }
  if (age <= 33) {
    // Decline begins.
    return -rng.float(1.5, 3.0);
  }
  if (age <= 37) {
    // Veteran: steeper decline.
    return -rng.float(3.0, 5.5);
  }
  // Old: heavy decline.
  return -rng.float(5.0, 8.0);
}

/** Decide if a player retires this birthday. */
function shouldRetire(p: Player, rng: RNG): boolean {
  const si = skillIndex(p.skills);
  // Hard cap: almost nobody plays past 40.
  if (p.age >= 40) return true;
  // Veterans whose skills have collapsed hang up the boots.
  if (p.age >= 34 && si < 9000) return true;
  // Probabilistic retirement rising with age (35→ small, 39→ high).
  if (p.age >= 35) {
    const prob = (p.age - 34) * 0.18; // 35:0.18 ... 39:0.9
    return rng.chance(prob);
  }
  return false;
}

function avgSkill(s: PlayerSkills): number {
  return (s.batVsSeam + s.batVsSpin + s.bowlMain + s.bowlVariation + s.fielding + s.wicketkeeping) / 6;
}

/** Apply one birthday's worth of ageing to a player. Returns "retire" if done. */
function applyBirthday(p: Player, rng: RNG): "retire" | "aged" {
  p.age += 1;

  if (shouldRetire(p, rng)) return "retire";

  const delta = careerArcDelta(p.age, p.potential, avgSkill(p.skills), rng);

  // Apply the delta across skills. Growth favours the player's main skills;
  // decline hits everyone. Keep within the potential ceiling on the way up.
  for (const sk of Object.keys(p.skills) as (keyof PlayerSkills)[]) {
    if (delta > 0) {
      const cap = sk === "wicketkeeping" && p.role !== "wicketkeeper" ? 60 : p.potential;
      p.skills[sk] = clamp(Math.min(cap, p.skills[sk] + delta + rng.float(-0.6, 0.6)));
    } else {
      p.skills[sk] = clamp(p.skills[sk] + delta + rng.float(-0.6, 0.6));
    }
  }

  // Experience keeps rising with age; potential drifts down once past peak so
  // older players can't suddenly bloom.
  p.experience = clamp(p.experience + rng.float(1.5, 3));
  if (p.age > 29) p.potential = clamp(p.potential - rng.float(0.5, 1.5));

  p.salary = computeSalary(p.skills);
  return "aged";
}

let freeAgentCounter = 0;

/** Generate a fresh young free agent into the world (talent replenishment). */
function spawnYoungFreeAgent(world: GameWorld, rng: RNG): Player {
  const roles: PlayerRole[] = ["batsman", "bowler", "allrounder", "wicketkeeper"];
  const role = rng.pick(roles);
  // Most are modest; occasional gem (skewed low).
  const quality = 0.25 + Math.pow(rng.next(), 2) * 0.6;
  const youth = generatePlayer(rng, role, quality, [16, 19]);
  youth.id = `fa_${world.week}_${(freeAgentCounter++).toString(36)}`;
  world.players[youth.id] = youth;
  return youth;
}

/**
 * Run the lifecycle each week:
 *  1) apply birthdays (age, career-arc skill change, salary)
 *  2) retire eligible players (remove from squad + world, log it)
 *  3) replenish the talent pool with fresh youth free agents
 */
export function runLifecycle(world: GameWorld): void {
  const rng = new RNG(combineSeeds(world.seed, world.week, 404));

  // Map player -> owning club for removal on retirement.
  const clubOf = new Map<string, Club>();
  for (const club of Object.values(world.clubs)) {
    for (const pid of club.squadPlayerIds) clubOf.set(pid, club);
  }

  let retirements = 0;

  for (const p of Object.values(world.players)) {
    if (birthdayPhase(p) !== world.week % WEEKS_PER_BIRTHDAY) continue;

    const result = applyBirthday(p, rng);
    if (result === "retire") {
      retirements++;
      const club = clubOf.get(p.id);
      const clubName = club?.name ?? "free agency";
      // Archive to the Hall of Fame with their final career record.
      world.hallOfFame.push({
        id: p.id,
        name: p.name,
        role: p.role,
        bowlerType: p.bowlerType,
        battingHand: p.battingHand,
        retiredAge: p.age,
        retiredWeek: world.week,
        debutWeek: p.debutWeek ?? world.week,
        lastClubId: club?.id ?? null,
        lastClubName: clubName,
        peakSkillIndex: skillIndex(p.skills),
        career: p.career ?? emptyCareer(),
      });
      if (club) {
        club.squadPlayerIds = club.squadPlayerIds.filter((id) => id !== p.id);
        if (club.savedOrders) {
          const used =
            club.savedOrders.battingOrder.includes(p.id) ||
            club.savedOrders.bowlingOrder.includes(p.id);
          if (used) club.savedOrders = null;
        }
      }
      const c = p.career;
      const legacy = c
        ? ` (${c.matches} matches, ${c.runs} runs, ${c.wickets} wkts)`
        : "";
      pushLog(
        world,
        "info",
        `🎖️ ${p.name} (age ${p.age}) has retired from ${clubName}${legacy}.`,
        club?.id,
      );
      delete world.players[p.id];
    }
  }

  // Replenish young talent so the world's population stays healthy.
  // Roughly match retirements + a steady trickle of new prospects.
  const newProspects = retirements + rng.int(2, 5);
  for (let i = 0; i < newProspects; i++) spawnYoungFreeAgent(world, rng);

  if (retirements > 0) {
    pushLog(world, "info", `${retirements} player(s) retired this week; ${newProspects} young prospects emerged.`);
  }
}

/** Clubs below a healthy squad size auto-recruit cheap free agents (AI + safety net). */
export function refillThinSquads(world: GameWorld): void {
  const MIN_SQUAD = 14;
  const rng = new RNG(combineSeeds(world.seed, world.week, 505));

  // Free agents = players not on any squad.
  const onSquad = new Set<string>();
  for (const club of Object.values(world.clubs)) {
    for (const id of club.squadPlayerIds) onSquad.add(id);
  }
  let freeAgents = Object.values(world.players).filter((p) => !onSquad.has(p.id));

  for (const club of Object.values(world.clubs)) {
    while (club.squadPlayerIds.length < MIN_SQUAD && freeAgents.length > 0) {
      const idx = rng.int(0, Math.min(freeAgents.length - 1, 5));
      const fa = freeAgents.splice(idx, 1)[0]!;
      club.squadPlayerIds.push(fa.id);
      onSquad.add(fa.id);
      pushLog(world, "transfer", `${club.name} signed free agent ${fa.name} to bolster the squad.`, club.id);
    }
  }

  // Prune the free-agent pool so it can't grow unbounded. Keep the best ~300
  // (by skill index); older/weaker undrafted players drift out of the game.
  const POOL_CAP = 300;
  const stillFree = Object.values(world.players).filter((p) => !onSquad.has(p.id));
  if (stillFree.length > POOL_CAP) {
    stillFree.sort((a, b) => skillIndex(a.skills) - skillIndex(b.skills)); // worst first
    const drop = stillFree.length - POOL_CAP;
    for (let i = 0; i < drop; i++) delete world.players[stillFree[i]!.id];
  }
}
