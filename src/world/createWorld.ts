/**
 * Bootstrap a fresh game world from a seed: a full DIVISION PYRAMID of leagues,
 * AI clubs, and full squads — modelled on Hitwicket.
 *
 *   Division 1 = 1 league
 *   Division 2 = 4 leagues
 *   Division 3 = 16 leagues   (each league = 10 clubs)
 *   ...each division has 4x the leagues of the one above.
 *
 * Everything is persisted by id so humans can later claim/join.
 */
import { RNG } from "../engine/rng.js";
import { generateSquad } from "../data/generate.js";
import { derivePersonality } from "../ai/manager.js";
import { TEAM_PREFIXES, TEAM_NOUNS } from "../data/names.js";
import type { GameWorld, Club, League } from "./state.js";
import type { Player } from "../engine/types.js";
import type { ClubCrest } from "./state.js";

const SHAPES: ClubCrest["shape"][] = ["shield", "circle", "diamond", "banner"];
const EMBLEMS: ClubCrest["emblem"][] = ["bats", "ball", "stumps", "lion", "star", "crown"];

/** Deterministic crest from a seed string (for AI clubs). */
export function autoCrest(seed: string): ClubCrest {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue1 = h % 360;
  return {
    shape: SHAPES[h % SHAPES.length]!,
    emblem: EMBLEMS[(h >> 3) % EMBLEMS.length]!,
    primaryHue: hue1,
    secondaryHue: (hue1 + 140 + (h % 70)) % 360,
  };
}

const SCOUT_COUNTRIES = [
  "India", "Australia", "England", "South Africa", "Pakistan",
  "New Zealand", "West Indies", "Sri Lanka", "Bangladesh", "Zimbabwe",
];

let worldIdCounter = 0;
function wid(prefix: string): string {
  return `${prefix}_${(worldIdCounter++).toString(36)}`;
}

export interface CreateWorldOptions {
  seed: number;
  clubsPerLeague?: number; // default 10
  divisions?: number; // default 3 (1 + 4 + 16 = 21 leagues, 210 clubs)
}

/** Higher division tiers get worse base quality, so the pyramid feels real. */
function tierQuality(tier: number, totalTiers: number, rng: RNG): number {
  // tier 1 (top) ~0.75 avg, bottom tier ~0.4 avg.
  const top = 0.78;
  const bottom = 0.4;
  const t = (tier - 1) / Math.max(1, totalTiers - 1);
  const base = top - (top - bottom) * t;
  return Math.max(0.2, Math.min(0.92, base + rng.float(-0.1, 0.1)));
}

export function createWorld(opts: CreateWorldOptions): GameWorld {
  worldIdCounter = 0;
  const clubsPerLeague = opts.clubsPerLeague ?? 10;
  const divisions = opts.divisions ?? 3;
  const rng = new RNG(opts.seed);

  const world: GameWorld = {
    seed: opts.seed,
    week: 0,
    players: {},
    clubs: {},
    leagues: {},
    auctions: {},
    hallOfFame: [],
    log: [],
  };

  let clubIndex = 0;

  for (let tier = 1; tier <= divisions; tier++) {
    const leaguesInTier = Math.pow(4, tier - 1); // 1, 4, 16, ...

    for (let l = 0; l < leaguesInTier; l++) {
      const league: League = {
        id: wid("lg"),
        name: `${roman(tier)}.${l + 1}`,
        divisionTier: tier,
        clubIds: [],
      };

      for (let c = 0; c < clubsPerLeague; c++) {
        const quality = tierQuality(tier, divisions, rng);
        const squad = generateSquad(rng, quality);

        const squadIds: string[] = [];
        for (const p of squad) {
          const player: Player = { ...p, id: wid("pl") };
          world.players[player.id] = player;
          squadIds.push(player.id);
        }

        const clubId = wid("cl");
        const name = clubName(clubIndex, rng);
        clubIndex++;

        const club: Club = {
          id: clubId,
          name,
          managerType: "ai",
          ownerUserId: null,
          personality: derivePersonality(clubId),
          squadPlayerIds: squadIds,
          crest: autoCrest(clubId + name),
          balance: 2_000_000,
          stadiumSeats: 8000,
          pitchType: "sporting",
          fanClub: rng.int(3000, 9000),
          divisionTier: tier,
          leagueId: league.id,
          reputationPoints: 0,
          seasonWon: 0,
          seasonLost: 0,
          seasonTied: 0,
          seasonPoints: 0,
          seasonRunsFor: 0,
          seasonBallsFor: 0,
          seasonRunsAgainst: 0,
          seasonBallsAgainst: 0,
          trainingFocus: rng.pick([
            "batting", "bowlingSeam", "bowlingSpin", "fitness",
          ] as const),
          trainingFacilityLevel: 1,
          scoutCountry: rng.pick(SCOUT_COUNTRIES),
          pendingScoutPlayerId: null,
          savedOrders: null,
        };

        world.clubs[clubId] = club;
        league.clubIds.push(clubId);
      }

      world.leagues[league.id] = league;
    }
  }

  return world;
}

/** Build a unique-ish club name from prefix+noun pools with a numeric tail. */
function clubName(index: number, rng: RNG): string {
  const prefix = TEAM_PREFIXES[index % TEAM_PREFIXES.length]!;
  const noun = TEAM_NOUNS[Math.floor(index / TEAM_PREFIXES.length) % TEAM_NOUNS.length]!;
  // Add a city-ish tag occasionally to reduce duplicates across 210 clubs.
  const cities = ["", "", " United", " XI", " CC", " Stars", " Royals", " Lions"];
  const tag = cities[(index + rng.int(0, 0)) % cities.length] ?? "";
  return `${prefix} ${noun}${tag}`.trim();
}

function roman(n: number): string {
  const map: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };
  return map[n] ?? String(n);
}

export { SCOUT_COUNTRIES };
