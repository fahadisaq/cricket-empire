/**
 * Human onboarding — the "new manager joins" flow, modelled on Hitwicket.
 *
 * When a player signs up they are handed a freshly generated STARTER CLUB:
 *  - an "average team with a few standouts" (per the original)
 *  - one promising young "First Scout" player
 *  - placed in the LOWEST division
 *  - a starting balance, small stadium, and fan base
 *
 * A human club and an AI club share the exact same shape; only `managerType`
 * and `ownerUserId` differ, so everything downstream (tick, finance, training,
 * auctions) treats them identically.
 */
import { RNG, combineSeeds } from "../engine/rng.js";
import { generatePlayer, generateSquad } from "../data/generate.js";
import { derivePersonality } from "../ai/manager.js";
import { skillIndex } from "../engine/ability.js";
import { TEAM_PREFIXES, TEAM_NOUNS } from "../data/names.js";
import type { GameWorld, Club, League } from "./state.js";
import { pushLog } from "./state.js";
import type { Player, PlayerRole } from "../engine/types.js";
import type { ClubCrest } from "./state.js";
import { SCOUT_COUNTRIES, autoCrest } from "./createWorld.js";

let onbCounter = 0;
function oid(prefix: string): string {
  return `${prefix}_h${(onbCounter++).toString(36)}_${Date.now().toString(36)}`;
}

export interface StarterClubResult {
  club: Club;
  firstScoutPlayerId: string;
}

/** Build the balanced 16-man starter squad: mostly average, a few standouts. */
function buildStarterSquad(world: GameWorld, rng: RNG): { ids: string[]; firstScout: string } {
  const ids: string[] = [];

  const plan: { role: PlayerRole; quality: number }[] = [
    // A couple of standouts.
    { role: "batsman", quality: 0.72 },
    { role: "bowler", quality: 0.7 },
    // Solid core.
    { role: "batsman", quality: 0.5 },
    { role: "batsman", quality: 0.48 },
    { role: "allrounder", quality: 0.52 },
    { role: "allrounder", quality: 0.46 },
    { role: "bowler", quality: 0.5 },
    { role: "bowler", quality: 0.47 },
    { role: "wicketkeeper", quality: 0.5 },
    // Average filler.
    { role: "batsman", quality: 0.38 },
    { role: "bowler", quality: 0.4 },
    { role: "allrounder", quality: 0.36 },
    { role: "batsman", quality: 0.34 },
    { role: "bowler", quality: 0.37 },
    { role: "wicketkeeper", quality: 0.33 },
  ];

  for (const slot of plan) {
    const p = generatePlayer(rng, slot.role, slot.quality, [19, 31]);
    p.id = oid("pl");
    world.players[p.id] = p;
    ids.push(p.id);
  }

  // The "First Scout": a promising young all-rounder to build around.
  const scout = generatePlayer(rng, "allrounder", 0.6, [16, 18]);
  scout.id = oid("pl");
  scout.potential = Math.max(scout.potential, 78); // high ceiling
  world.players[scout.id] = scout;
  ids.push(scout.id);

  return { ids, firstScout: scout.id };
}

/** Pick the lowest-division league with room; if all full, create a new one. */
function findEntryLeague(world: GameWorld, clubsPerLeague = 10): League {
  const leagues = Object.values(world.leagues);
  if (leagues.length === 0) {
    // No leagues at all — make a top-division league.
    const lg: League = { id: oid("lg"), name: "I.1", divisionTier: 1, clubIds: [] };
    world.leagues[lg.id] = lg;
    return lg;
  }
  const bottomTier = Math.max(...leagues.map((l) => l.divisionTier));
  const bottomLeagues = leagues.filter((l) => l.divisionTier === bottomTier);

  // Prefer a bottom-division league with an open slot.
  const withRoom = bottomLeagues
    .filter((l) => l.clubIds.length < clubsPerLeague)
    .sort((a, b) => a.clubIds.length - b.clubIds.length)[0];
  if (withRoom) return withRoom;

  // All bottom leagues full → create a NEW league in the bottom division and
  // populate it with AI clubs, so every human lands in a full, real league.
  const newLeague: League = {
    id: oid("lg"),
    name: `${roman(bottomTier)}.${bottomLeagues.length + 1}`,
    divisionTier: bottomTier,
    clubIds: [],
  };
  world.leagues[newLeague.id] = newLeague;
  fillLeagueWithAI(world, newLeague, clubsPerLeague - 1); // leave 1 slot for the human
  return newLeague;
}

/** Generate AI clubs (with full squads) to populate a league up to `count`. */
function fillLeagueWithAI(world: GameWorld, league: League, count: number): void {
  const rng = new RNG(combineSeeds(world.seed, world.week, league.id.length, onbCounter + 7));
  for (let i = 0; i < count; i++) {
    // Bottom-division quality — modest sides for newcomers to compete with.
    const quality = 0.3 + rng.float(0, 0.3);
    const squad = generateSquad(rng, quality);
    const squadIds: string[] = [];
    for (const p of squad) {
      const np: Player = { ...p, id: oid("pl") };
      world.players[np.id] = np;
      squadIds.push(np.id);
    }
    const clubId = oid("cl");
    const idx = Object.keys(world.clubs).length;
    const club: Club = {
      id: clubId,
      name: `${TEAM_PREFIXES[idx % TEAM_PREFIXES.length]} ${TEAM_NOUNS[(idx * 3) % TEAM_NOUNS.length]}`,
      managerType: "ai",
      ownerUserId: null,
      personality: derivePersonality(clubId),
      squadPlayerIds: squadIds,
      crest: autoCrest(clubId),
      balance: 2_000_000,
      stadiumSeats: 8000,
      pitchType: "sporting",
      fanClub: rng.int(3000, 8000),
      divisionTier: league.divisionTier,
      leagueId: league.id,
      reputationPoints: 0,
      seasonWon: 0, seasonLost: 0, seasonTied: 0, seasonPoints: 0,
      seasonRunsFor: 0, seasonBallsFor: 0, seasonRunsAgainst: 0, seasonBallsAgainst: 0,
      trainingFocus: rng.pick(["batting", "bowlingSeam", "bowlingSpin", "fitness"] as const),
      trainingFacilityLevel: 1,
      scoutCountry: rng.pick(SCOUT_COUNTRIES),
      pendingScoutPlayerId: null,
      savedOrders: null,
    };
    world.clubs[clubId] = club;
    league.clubIds.push(clubId);
  }
}

function roman(n: number): string {
  const map: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };
  return map[n] ?? String(n);
}

export interface CreateHumanClubOptions {
  userId: string;
  clubName?: string;
  crest?: ClubCrest;
}

/**
 * Create and register a human-owned starter club in the world.
 * Returns the club (also added to world.clubs and the entry league).
 */
export function createHumanClub(
  world: GameWorld,
  opts: CreateHumanClubOptions,
): StarterClubResult {
  const rng = new RNG(combineSeeds(world.seed, world.week, opts.userId.length, onbCounter + 1));

  const { ids, firstScout } = buildStarterSquad(world, rng);
  const clubId = oid("cl");

  const idx = Object.keys(world.clubs).length;
  const defaultName =
    `${TEAM_PREFIXES[idx % TEAM_PREFIXES.length]} ${TEAM_NOUNS[(idx + 5) % TEAM_NOUNS.length]}`;

  const entryLeague = findEntryLeague(world);

  const club: Club = {
    id: clubId,
    name: opts.clubName?.trim() || defaultName,
    managerType: "human",
    ownerUserId: opts.userId,
    personality: derivePersonality(clubId),
    squadPlayerIds: ids,
    crest: opts.crest ?? autoCrest(clubId),
    balance: 3_000_000, // starting kitty
    stadiumSeats: 6000,
    pitchType: "sporting",
    fanClub: 2500,
    divisionTier: entryLeague.divisionTier,
    leagueId: entryLeague.id,
    reputationPoints: 0,
    seasonWon: 0,
    seasonLost: 0,
    seasonTied: 0,
    seasonPoints: 0,
    seasonRunsFor: 0,
    seasonBallsFor: 0,
    seasonRunsAgainst: 0,
    seasonBallsAgainst: 0,
    trainingFocus: "batting",
    trainingFacilityLevel: 1,
    scoutCountry: rng.pick(SCOUT_COUNTRIES),
    pendingScoutPlayerId: null,
    savedOrders: null,
  };

  world.clubs[clubId] = club;
  entryLeague.clubIds.push(clubId);

  pushLog(world, "info", `New manager joined: ${club.name} enters Division ${club.divisionTier}.`, clubId);

  const si = skillIndex(world.players[firstScout]!.skills);
  void si;
  return { club, firstScoutPlayerId: firstScout };
}

/** Find the club owned by a given user (if any). */
export function findClubByUser(world: GameWorld, userId: string): Club | null {
  return Object.values(world.clubs).find((c) => c.ownerUserId === userId) ?? null;
}
