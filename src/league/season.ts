/**
 * League season orchestration: round-robin schedule, match simulation via the
 * engine, AI orders for every club, standings, and net run rate.
 *
 * Every club is driven by the AI manager here. When real humans join, you swap
 * their orders in for the AI's — nothing else changes.
 */
import { simulateMatch, combineSeeds } from "../engine/index.js";
import type { MatchConfig, MatchResult, PitchType, Pitch } from "../engine/index.js";
import { selectOrders, derivePersonality } from "../ai/manager.js";
import type { GeneratedTeam } from "../data/generate.js";
import { RNG } from "../engine/rng.js";

export interface TeamStanding {
  teamId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
  nrr: number;
}

export interface Fixture {
  homeId: string;
  awayId: string;
  round: number;
  pitch: PitchType;
}

export interface SeasonResult {
  standings: TeamStanding[];
  fixtures: Fixture[];
  results: MatchResult[];
  teams: Map<string, GeneratedTeam>;
}

const PITCHES: PitchType[] = ["sporting", "crumbling", "green", "flat"];

/** Circle-method double round-robin schedule. */
export function buildSchedule(teams: GeneratedTeam[], seed: number): Fixture[] {
  const rng = new RNG(combineSeeds(seed, 7));
  const ids = teams.map((t) => t.id);
  if (ids.length % 2 !== 0) ids.push("__BYE__");
  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixtures: Fixture[] = [];
  let arr = [...ids];

  for (let leg = 0; leg < 2; leg++) {
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < half; i++) {
        const a = arr[i]!;
        const b = arr[n - 1 - i]!;
        if (a === "__BYE__" || b === "__BYE__") continue;
        // Alternate home/away by leg for fairness.
        const [homeId, awayId] = leg === 0 ? [a, b] : [b, a];
        fixtures.push({
          homeId,
          awayId,
          round: leg * rounds + r,
          pitch: rng.pick(PITCHES),
        });
      }
      // Rotate (keep first fixed).
      arr = [arr[0]!, arr[n - 1]!, ...arr.slice(1, n - 1)];
    }
  }
  return fixtures;
}

function emptyStanding(t: GeneratedTeam): TeamStanding {
  return {
    teamId: t.id,
    name: t.name,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    points: 0,
    runsFor: 0,
    ballsFaced: 0,
    runsAgainst: 0,
    ballsBowled: 0,
    nrr: 0,
  };
}

export function playSeason(
  teams: GeneratedTeam[],
  seed: number,
): SeasonResult {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const standings = new Map(teams.map((t) => [t.id, emptyStanding(t)]));
  const fixtures = buildSchedule(teams, seed);
  const results: MatchResult[] = [];

  for (const fx of fixtures) {
    const home = teamMap.get(fx.homeId)!;
    const away = teamMap.get(fx.awayId)!;
    const matchSeed = combineSeeds(seed, fx.round, home.id.length, away.id.length, fx.homeId.charCodeAt(0));

    const pitch: Pitch = { type: fx.pitch };
    const cfg: MatchConfig = {
      oversPerInnings: 20,
      maxOversPerBowler: 4,
      pitch,
      seed: matchSeed,
    };

    const homeOrders = selectOrders(home.squad, {
      personality: derivePersonality(home.id),
      matchSeed: combineSeeds(matchSeed, 11),
    });
    const awayOrders = selectOrders(away.squad, {
      personality: derivePersonality(away.id),
      matchSeed: combineSeeds(matchSeed, 13),
    });

    const result = simulateMatch(
      { teamId: home.id, teamName: home.name, players: home.squad, orders: homeOrders },
      { teamId: away.id, teamName: away.name, players: away.squad, orders: awayOrders },
      cfg,
    );
    results.push(result);

    applyResult(standings, result, home.id, away.id);
  }

  // Final NRR + sort.
  const table = [...standings.values()];
  for (const s of table) {
    const forRate = s.ballsFaced > 0 ? (s.runsFor / s.ballsFaced) * 6 : 0;
    const againstRate = s.ballsBowled > 0 ? (s.runsAgainst / s.ballsBowled) * 6 : 0;
    s.nrr = +(forRate - againstRate).toFixed(3);
  }
  table.sort((a, b) => b.points - a.points || b.nrr - a.nrr);

  return { standings: table, fixtures, results, teams: teamMap };
}

function applyResult(
  standings: Map<string, TeamStanding>,
  result: MatchResult,
  homeId: string,
  awayId: string,
): void {
  const [inn1, inn2] = result.innings;
  const home = standings.get(homeId)!;
  const away = standings.get(awayId)!;
  home.played++;
  away.played++;

  // inn1 = home batting, inn2 = away batting (home bats first in this model).
  home.runsFor += inn1.runs;
  home.ballsFaced += inn1.balls;
  home.runsAgainst += inn2.runs;
  home.ballsBowled += inn2.balls;

  away.runsFor += inn2.runs;
  away.ballsFaced += inn2.balls;
  away.runsAgainst += inn1.runs;
  away.ballsBowled += inn1.balls;

  if (result.winnerTeamId === homeId) {
    home.won++;
    home.points += 2;
    away.lost++;
  } else if (result.winnerTeamId === awayId) {
    away.won++;
    away.points += 2;
    home.lost++;
  } else {
    home.tied++;
    away.tied++;
    home.points += 1;
    away.points += 1;
  }
}
