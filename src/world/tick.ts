/**
 * The weekly tick — the heartbeat of the living world. One tick = one game week:
 *   1) play this week's league fixtures (AI orders for all clubs)
 *   2) finances (income/costs based on results)
 *   3) player development (training, form, fitness, aging)
 *   4) scouting (youth offers)
 *   5) auctions (resolve, list, bid)
 *   6) advance week & persist
 *
 * Humans plug in by replacing a club's managerType and supplying their own
 * orders/decisions; everything else is identical.
 */
import { RNG, combineSeeds } from "../engine/rng.js";
import { simulateMatch } from "../engine/matchSim.js";
import type { MatchConfig, MatchResult, Pitch, TeamMatchInput } from "../engine/types.js";
import { selectOrders, derivePersonality } from "../ai/manager.js";
import type { GameWorld, Club } from "./state.js";
import { pushLog } from "./state.js";
import { buildSchedule, type Fixture } from "../league/season.js";
import { runDevelopment } from "./systems/development.js";
import { runFinance } from "./systems/finance.js";
import { runScouting } from "./systems/scouting.js";
import { runAuctions } from "./systems/auction.js";
import { runLifecycle, refillThinSquads } from "./systems/lifecycle.js";
import { accumulateMatchStats } from "./systems/careerStats.js";
import { isSeasonBoundary, runSeasonEnd } from "./systems/seasonEnd.js";
import type { Player } from "../engine/types.js";

/** Cache schedules per league per season so fixtures are stable across ticks. */
const scheduleCache = new Map<string, Fixture[]>();

function clubToMatchInput(world: GameWorld, club: Club, matchSeed: number): TeamMatchInput {
  const players = club.squadPlayerIds
    .map((id) => world.players[id])
    .filter((p): p is Player => !!p);

  // Human-set lineup takes precedence — but validate it still matches the squad
  // (a sold/released player can't play). Fall back to AI if invalid.
  let orders = club.savedOrders;
  if (orders) {
    const owned = new Set(club.squadPlayerIds);
    const valid =
      orders.battingOrder.length === 11 &&
      orders.battingOrder.every((id) => owned.has(id)) &&
      owned.has(orders.keeperId) &&
      owned.has(orders.captainId) &&
      orders.bowlingOrder.length >= 5 &&
      orders.bowlingOrder.every((id) => owned.has(id));
    if (!valid) orders = null;
  }

  if (!orders) {
    orders = selectOrders(players, {
      personality: club.managerType === "ai" ? club.personality : derivePersonality(club.id),
      matchSeed,
    });
  }
  return { teamId: club.id, teamName: club.name, players, orders };
}

export interface TickReport {
  week: number;
  matchesPlayed: number;
  results: MatchResult[];
}

export function tick(world: GameWorld): TickReport {
  const results: MatchResult[] = [];
  const winsThisWeek = new Map<string, { w: number; p: number }>();

  for (const league of Object.values(world.leagues)) {
    const cacheKey = `${league.id}:${Math.floor(world.week / Math.max(1, (league.clubIds.length - 1) * 2))}`;
    let schedule = scheduleCache.get(cacheKey);
    if (!schedule) {
      const teams = league.clubIds.map((id) => ({
        id,
        name: world.clubs[id]?.name ?? id,
        isAI: true,
        squad: [],
      }));
      schedule = buildSchedule(teams, combineSeeds(world.seed, world.week));
      scheduleCache.set(cacheKey, schedule);
    }

    const roundsTotal = (league.clubIds.length - 1) * 2;
    const roundThisWeek = world.week % roundsTotal;
    const fixtures = schedule.filter((f) => f.round === roundThisWeek);

    for (const fx of fixtures) {
      const home = world.clubs[fx.homeId];
      const away = world.clubs[fx.awayId];
      if (!home || !away) continue;

      const matchSeed = combineSeeds(world.seed, world.week, fx.homeId.length, fx.awayId.length);
      const pitch: Pitch = { type: home.pitchType };
      const cfg: MatchConfig = { oversPerInnings: 20, maxOversPerBowler: 4, pitch, seed: matchSeed };

      let result: MatchResult;
      try {
        result = simulateMatch(
          clubToMatchInput(world, home, combineSeeds(matchSeed, 1)),
          clubToMatchInput(world, away, combineSeeds(matchSeed, 2)),
          cfg,
        );
      } catch (err) {
        // One bad match must never crash the whole world tick.
        console.error(`Match sim failed (${home.name} vs ${away.name}):`, (err as Error).message);
        continue;
      }
      results.push(result);
      accumulateMatchStats(world, result);

      // Update season standings for both clubs.
      const [inn1, inn2] = result.innings;
      home.seasonRunsFor += inn1.runs;
      home.seasonBallsFor += inn1.balls;
      home.seasonRunsAgainst += inn2.runs;
      home.seasonBallsAgainst += inn2.balls;
      away.seasonRunsFor += inn2.runs;
      away.seasonBallsFor += inn2.balls;
      away.seasonRunsAgainst += inn1.runs;
      away.seasonBallsAgainst += inn1.balls;

      if (result.winnerTeamId === home.id) {
        home.seasonWon++; home.seasonPoints += 2; away.seasonLost++;
      } else if (result.winnerTeamId === away.id) {
        away.seasonWon++; away.seasonPoints += 2; home.seasonLost++;
      } else {
        home.seasonTied++; away.seasonTied++;
        home.seasonPoints++; away.seasonPoints++;
      }

      for (const id of [home.id, away.id]) {
        if (!winsThisWeek.has(id)) winsThisWeek.set(id, { w: 0, p: 0 });
      }
      winsThisWeek.get(home.id)!.p++;
      winsThisWeek.get(away.id)!.p++;
      if (result.winnerTeamId) {
        winsThisWeek.get(result.winnerTeamId)!.w++;
        const winner = world.clubs[result.winnerTeamId]!;
        winner.reputationPoints += 5;
        winner.fanClub += 120;
        pushLog(world, "match", `${winner.name} won ${result.margin}. MOM: ${result.manOfTheMatch.name}.`, winner.id);
      }
    }
  }

  // Recent-form ratio for finance/attendance.
  const formByClub = new Map<string, number>();
  for (const [id, rec] of winsThisWeek) {
    formByClub.set(id, rec.p > 0 ? rec.w / rec.p : 0.5);
  }

  // Run the world systems in order.
  runFinance(world, formByClub);
  runDevelopment(world);
  runLifecycle(world);    // aging, retirement, youth replenishment
  runScouting(world);
  runAuctions(world);
  refillThinSquads(world); // safety net: no club drops below a viable squad

  world.week++;

  // Season boundary: prizes, promotion/relegation, reset records.
  if (isSeasonBoundary(world)) {
    runSeasonEnd(world);
  }

  return { week: world.week - 1, matchesPlayed: results.length, results };
}

/** Run many ticks in a row (headless season/era simulation). */
export function runWeeks(world: GameWorld, weeks: number): TickReport[] {
  const reports: TickReport[] = [];
  for (let i = 0; i < weeks; i++) reports.push(tick(world));
  return reports;
}
