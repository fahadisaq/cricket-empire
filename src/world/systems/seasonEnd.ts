/**
 * Season-end processing: award league prize money, handle promotion/relegation
 * between divisions, then reset season records for the new campaign.
 *
 * Mirrors Hitwicket: league winner promoted, bottom 4 relegated. Divisions are
 * tiers; tier 1 is the top. Movement only happens where adjacent tiers exist.
 */
import type { GameWorld, Club } from "../state.js";
import { pushLog } from "../state.js";

const PRIZE_BY_TIER: Record<number, number> = {
  1: 2_000_000, 2: 1_500_000, 3: 1_200_000, 4: 1_000_000,
  5: 800_000, 6: 600_000, 7: 600_000,
};

function nrr(c: Club): number {
  const f = c.seasonBallsFor > 0 ? (c.seasonRunsFor / c.seasonBallsFor) * 6 : 0;
  const a = c.seasonBallsAgainst > 0 ? (c.seasonRunsAgainst / c.seasonBallsAgainst) * 6 : 0;
  return f - a;
}

/** Number of league rounds in a full double round-robin for a club's league. */
export function roundsPerSeason(world: GameWorld, club: Club): number {
  const league = club.leagueId ? world.leagues[club.leagueId] : null;
  const n = league ? league.clubIds.length : 10;
  return (n - 1) * 2;
}

/** True if the just-completed week was the last of a season. */
export function isSeasonBoundary(world: GameWorld): boolean {
  // Use the largest league as the season length reference.
  const sizes = Object.values(world.leagues).map((l) => l.clubIds.length);
  const n = sizes.length ? Math.max(...sizes) : 10;
  const rounds = (n - 1) * 2;
  return world.week > 0 && world.week % rounds === 0;
}

export function runSeasonEnd(world: GameWorld): void {
  const leagues = Object.values(world.leagues).sort(
    (a, b) => a.divisionTier - b.divisionTier,
  );
  if (leagues.length === 0) return;

  // Standings per league.
  const tableByLeague = new Map<string, Club[]>();
  for (const league of leagues) {
    const clubs = league.clubIds
      .map((id) => world.clubs[id])
      .filter((c): c is Club => !!c)
      .sort((a, b) => b.seasonPoints - a.seasonPoints || nrr(b) - nrr(a));
    tableByLeague.set(league.id, clubs);

    // Prize money to the winner.
    const champ = clubs[0];
    if (champ) {
      const prize = PRIZE_BY_TIER[champ.divisionTier] ?? 500_000;
      champ.balance += prize;
      champ.reputationPoints += 20;
      // Credit a title to every player in the champion's squad.
      for (const pid of champ.squadPlayerIds) {
        const p = world.players[pid];
        if (p?.career) p.career.titlesWon++;
      }
      pushLog(world, "promotion", `${champ.name} won ${league.name}! Prize ${prize.toLocaleString()}.`, champ.id);
    }
  }

  // Promotion/relegation between adjacent tiers.
  for (let i = 0; i < leagues.length; i++) {
    const league = leagues[i]!;
    const table = tableByLeague.get(league.id)!;
    const upperTier = league.divisionTier - 1;
    const lowerTier = league.divisionTier + 1;

    const upper = leagues.find((l) => l.divisionTier === upperTier);
    const lower = leagues.find((l) => l.divisionTier === lowerTier);

    // Promote winner if a higher division exists.
    if (upper && table[0]) {
      moveClub(world, table[0], league, upper);
      pushLog(world, "promotion", `${table[0].name} promoted to ${upper.name}.`, table[0].id);
    }
    // Relegate bottom 4 if a lower division exists.
    if (lower) {
      for (const c of table.slice(-4)) {
        moveClub(world, c, league, lower);
        pushLog(world, "relegation", `${c.name} relegated to ${lower.name}.`, c.id);
      }
    }
  }

  // Reset season records for everyone.
  for (const c of Object.values(world.clubs)) {
    c.seasonWon = 0;
    c.seasonLost = 0;
    c.seasonTied = 0;
    c.seasonPoints = 0;
    c.seasonRunsFor = 0;
    c.seasonBallsFor = 0;
    c.seasonRunsAgainst = 0;
    c.seasonBallsAgainst = 0;
  }

  pushLog(world, "info", `Season complete. New campaign begins (week ${world.week}).`);
}

function moveClub(
  world: GameWorld,
  club: Club,
  from: { id: string; clubIds: string[] },
  to: { id: string; divisionTier: number; clubIds: string[] },
): void {
  from.clubIds = from.clubIds.filter((id) => id !== club.id);
  if (!to.clubIds.includes(club.id)) to.clubIds.push(club.id);
  club.leagueId = to.id;
  club.divisionTier = to.divisionTier;
}
