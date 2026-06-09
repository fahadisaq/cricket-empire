/**
 * Weekly youth scouting. Each club is offered one generated youth per week.
 * AI clubs auto-decide sign/reject based on squad need & finances. Humans get
 * a pending offer they can act on via the UI.
 */
import { RNG, combineSeeds } from "../../engine/rng.js";
import { generatePlayer } from "../../data/generate.js";
import { skillIndex } from "../../engine/ability.js";
import type { Player, PlayerRole } from "../../engine/types.js";
import type { GameWorld, Club } from "../state.js";
import { pushLog } from "../state.js";

const ROLES: PlayerRole[] = ["batsman", "bowler", "allrounder", "wicketkeeper"];
const SIGNING_FEE_BASE = 80_000;

let scoutCounter = 0;

/** Generate the youth offered to a club this week. */
function generateYouth(world: GameWorld, club: Club, rng: RNG): Player {
  const role = rng.pick(ROLES);
  // Youth quality is luck-based: mostly modest, rare gems.
  const luck = Math.pow(rng.next(), 2.2); // skewed toward low
  const quality = 0.2 + luck * 0.65;
  const youth = generatePlayer(rng, role, quality, [16, 19]);
  youth.id = `yth_${world.week}_${(scoutCounter++).toString(36)}`;
  return youth;
}

/** Weakest area of a squad, to inform AI signing decisions. */
function squadNeedsRole(world: GameWorld, club: Club): PlayerRole {
  const counts: Record<PlayerRole, number> = {
    batsman: 0, bowler: 0, allrounder: 0, wicketkeeper: 0,
  };
  for (const id of club.squadPlayerIds) {
    const p = world.players[id];
    if (p) counts[p.role]++;
  }
  // Fewest of -> most needed (keeper floor of 2).
  let need: PlayerRole = "batsman";
  let min = Infinity;
  for (const r of ROLES) {
    const target = r === "wicketkeeper" ? 2 : 4;
    const deficit = counts[r] - target;
    if (deficit < min) {
      min = deficit;
      need = r;
    }
  }
  return need;
}

export function runScouting(world: GameWorld): void {
  const rng = new RNG(combineSeeds(world.seed, world.week, 202));

  for (const club of Object.values(world.clubs)) {
    const youth = generateYouth(world, club, rng);
    world.players[youth.id] = youth;

    const fee = Math.round(SIGNING_FEE_BASE * (1 + (20 - youth.age) * 0.15));

    if (club.managerType === "human") {
      // Humans decide later; stash the offer.
      club.pendingScoutPlayerId = youth.id;
      club.reputationPoints += 2; // scouting earns reputation regardless
      continue;
    }

    // AI decision: sign if affordable, fills a need, and is decent/promising.
    const need = squadNeedsRole(world, club);
    const si = skillIndex(youth.skills);
    const promising = youth.potential > 60 || si > 12000;
    const affordable = club.balance > fee + 200_000;
    const wantRole = youth.role === need;

    if (affordable && (promising || wantRole) && club.squadPlayerIds.length < 22) {
      club.balance -= fee;
      club.squadPlayerIds.push(youth.id);
      club.reputationPoints += 3;
      pushLog(
        world,
        "scout",
        `${club.name} signed youth ${youth.name} (${youth.role}, age ${youth.age}, SI ${si}) for ${fee}.`,
        club.id,
      );
    } else {
      // Rejected: remove from world to avoid orphan players piling up.
      delete world.players[youth.id];
      club.reputationPoints += 2;
    }
  }
}
