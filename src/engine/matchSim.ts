/**
 * Full T20 match simulation built on the per-ball engine.
 *
 * Handles: innings construction, batting order & strike rotation, bowler
 * rotation with the 4-over cap, powerplay/death/chase tactics, scorecards,
 * ball-by-ball commentary, result margin, and man of the match.
 */
import { RNG, combineSeeds } from "./rng.js";
import { ENGINE_CONFIG as C } from "./config.js";
import {
  battingAbility,
  bowlingAbility,
  teamFieldingRating,
  keeperAbility,
} from "./ability.js";
import { resolveBall, type BallContext } from "./ballEngine.js";
import type {
  Player,
  TeamMatchInput,
  MatchConfig,
  MatchResult,
  InningsResult,
  BallEvent,
  BatterScorecard,
  BowlerScorecard,
  BallOutcome,
} from "./types.js";
import { commentate } from "./commentary.js";

interface BatState extends BatterScorecard {
  player: Player;
}
interface BowlState extends BowlerScorecard {
  player: Player;
  ballsThisSpell: number;
}

function byId(players: Player[]): Map<string, Player> {
  return new Map(players.map((p) => [p.id, p]));
}

function simulateInnings(
  inningNo: 1 | 2,
  batting: TeamMatchInput,
  bowling: TeamMatchInput,
  cfg: MatchConfig,
  rng: RNG,
  target: number | null,
  events: BallEvent[],
): InningsResult {
  const batMap = byId(batting.players);
  const bowlMap = byId(bowling.players);

  const bowlingXI = bowling.orders.bowlingOrder
    .map((id) => bowlMap.get(id))
    .filter((p): p is Player => !!p);
  const fieldingRating = teamFieldingRating(
    bowling.orders.battingOrder
      .map((id) => bowlMap.get(id))
      .filter((p): p is Player => !!p),
    bowling.orders.captainId,
  );
  const keeper = bowlMap.get(bowling.orders.keeperId);
  const keeperAbl = keeper ? keeperAbility(keeper) : 40;

  // Set up batters.
  const order = batting.orders.battingOrder
    .map((id) => batMap.get(id))
    .filter((p): p is Player => !!p);

  const bat: BatState[] = order.map((p) => ({
    player: p,
    playerId: p.id,
    name: p.name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
  }));

  const bowl = new Map<string, BowlState>();
  for (const p of bowlingXI) {
    bowl.set(p.id, {
      player: p,
      playerId: p.id,
      name: p.name,
      overs: 0,
      ballsBowled: 0,
      runsConceded: 0,
      wickets: 0,
      ballsThisSpell: 0,
    });
  }

  let score = 0;
  let wickets = 0;
  let legalBalls = 0;
  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatterIdx = 2;

  const totalBalls = cfg.oversPerInnings * 6;
  const ppStart = batting.orders.powerplayStartOver;
  let lastBowlerId: string | null = null;
  let strikeChangedLastBall = false;

  for (let over = 0; over < cfg.oversPerInnings; over++) {
    if (wickets >= 10) break;

    const bowler = pickBowler(bowlingXI, bowl, cfg, lastBowlerId, rng);
    if (!bowler) break;
    lastBowlerId = bowler.player.id;
    bowler.ballsThisSpell = 0;

    for (let ballInOver = 1; ballInOver <= 6; ballInOver++) {
      if (wickets >= 10 || legalBalls >= totalBalls) break;
      if (target !== null && score >= target) break;

      const striker = bat[strikerIdx];
      if (!striker) { wickets = 10; break; } // safety: ran out of batters
      const bowlerType = bowler.player.bowlerType;

      const batAbl = battingAbility(striker.player, bowlerType, cfg.pitch);
      const bowlAbl = bowlingAbility(bowler.player, over, cfg.pitch);

      const inPowerplay = over >= ppStart && over < ppStart + 5;
      const isDeathOvers = over >= C.aggression.deathOversStart;

      // Chase pressure.
      let rrrPressure: number | null = null;
      let cruising = false;
      if (target !== null) {
        const runsNeeded = target - score;
        const ballsLeft = totalBalls - legalBalls;
        if (ballsLeft > 0) {
          const rrr = runsNeeded / ballsLeft;
          rrrPressure = rrr - C.chase.rrrParPerBall;
          cruising = rrr < 1;
        }
      } else if (batting.orders.aimForTarget && batting.orders.aimForTarget > 0) {
        // Aim-For-Target (first innings): pace the innings toward a set score.
        // Treat the AFT like a "soft chase" — if behind the required pace, push
        // harder (more risk); if ahead, ease off.
        const ballsLeft = totalBalls - legalBalls;
        if (ballsLeft > 0) {
          const needed = batting.orders.aimForTarget - score;
          const rrr = needed / ballsLeft;
          rrrPressure = rrr - C.chase.rrrParPerBall;
          cruising = rrr < 0.8;
        }
      }

      const ctx: BallContext = {
        battingAbility: batAbl,
        bowlingAbility: bowlAbl,
        over,
        fieldingRating,
        keeperAbility: keeperAbl,
        inPowerplay,
        isDeathOvers,
        rrrPressure,
        cruising,
        bowlerLinePenalty: strikeChangedLastBall,
      };

      const res = resolveBall(ctx, rng);
      legalBalls++;
      striker.balls++;
      bowler.ballsBowled++;
      bowler.ballsThisSpell++;

      let outcome: BallOutcome = res.outcome;

      if (res.wicket) {
        wickets++;
        striker.out = true;
        striker.dismissal = describeDismissal(res.wicketType!, bowler.name);
        bowler.wickets++;
        outcome = "W";
      } else {
        score += res.runs;
        striker.runs += res.runs;
        bowler.runsConceded += res.runs;
        if (res.runs === 4) striker.fours++;
        if (res.runs === 6) striker.sixes++;
      }

      events.push({
        inning: inningNo,
        over,
        ballInOver,
        strikerId: striker.player.id,
        bowlerId: bowler.player.id,
        outcome,
        runsThisBall: res.wicket ? 0 : res.runs,
        wicketType: res.wicketType,
        commentary: commentate(res, striker.name, bowler.name, over, ballInOver),
        teamScore: score,
        teamWickets: wickets,
      });

      // Strike rotation.
      strikeChangedLastBall = false;
      if (res.wicket) {
        if (nextBatterIdx < bat.length) {
          strikerIdx = nextBatterIdx;
          nextBatterIdx++;
        } else {
          wickets = 10; // all out
          break;
        }
      } else if (res.runs % 2 === 1) {
        [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
        strikeChangedLastBall = true;
      }
    }

    // End of over: rotate strike.
    bowler.overs = Math.floor(bowler.ballsBowled / 6);
    [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
    strikeChangedLastBall = true;

    if (target !== null && score >= target) break;
  }

  return {
    battingTeamId: batting.teamId,
    bowlingTeamId: bowling.teamId,
    runs: score,
    wickets,
    balls: legalBalls,
    batting: bat.map(stripBat),
    bowling: bowlingXI
      .map((p) => bowl.get(p.id))
      .filter((b): b is BowlState => !!b && b.ballsBowled > 0)
      .map(stripBowl),
  };
}

function pickBowler(
  xi: Player[],
  bowl: Map<string, BowlState>,
  cfg: MatchConfig,
  lastBowlerId: string | null,
  rng: RNG,
): BowlState | null {
  // Eligible: under over-cap and not the immediately previous bowler.
  const eligible = xi
    .map((p) => bowl.get(p.id))
    .filter((b): b is BowlState => !!b)
    .filter(
      (b) =>
        b.ballsBowled < cfg.maxOversPerBowler * 6 &&
        b.player.id !== lastBowlerId,
    );
  if (eligible.length === 0) {
    // fall back: allow anyone under cap
    const any = xi
      .map((p) => bowl.get(p.id))
      .filter((b): b is BowlState => !!b)
      .filter((b) => b.ballsBowled < cfg.maxOversPerBowler * 6);
    if (any.length === 0) return null;
    return any[0]!;
  }
  // Prefer better bowlers but with variety: weight by core skill.
  const weights = eligible.map(
    (b) =>
      b.player.skills.bowlMain * 0.4 +
      b.player.skills.bowlVariation * 0.6 +
      1,
  );
  return eligible[rng.weighted(weights)]!;
}

function describeDismissal(type: string, bowler: string): string {
  switch (type) {
    case "bowled":
      return `b ${bowler}`;
    case "lbw":
      return `lbw b ${bowler}`;
    case "caught":
      return `c & field b ${bowler}`;
    case "caughtBehind":
      return `c keeper b ${bowler}`;
    case "stumped":
      return `st keeper b ${bowler}`;
    default:
      return "run out";
  }
}

function stripBat(b: BatState): BatterScorecard {
  const { player, ...rest } = b;
  void player;
  return rest;
}
function stripBowl(b: BowlState): BowlerScorecard {
  const { player, ballsThisSpell, ...rest } = b;
  void player;
  void ballsThisSpell;
  rest.overs = Math.floor(rest.ballsBowled / 6) + (rest.ballsBowled % 6) / 10;
  return rest;
}

/** Public entry point: simulate a complete match. */
export function simulateMatch(
  teamA: TeamMatchInput,
  teamB: TeamMatchInput,
  cfg: MatchConfig,
): MatchResult {
  const rng = new RNG(combineSeeds(cfg.seed, 1));
  const events: BallEvent[] = [];

  // Innings 1: teamA bats (caller decides toss/order before passing in).
  const inn1 = simulateInnings(1, teamA, teamB, cfg, rng, null, events);

  // Aim-for-target is informational for now; target for chase is inn1+1.
  const target = inn1.runs + 1;
  const inn2 = simulateInnings(2, teamB, teamA, cfg, rng, target, events);

  let winnerTeamId: string | null;
  let margin: string;
  if (inn1.runs > inn2.runs) {
    winnerTeamId = teamA.teamId;
    margin = `by ${inn1.runs - inn2.runs} runs`;
  } else if (inn2.runs > inn1.runs) {
    winnerTeamId = teamB.teamId;
    margin = `by ${10 - inn2.wickets} wickets`;
  } else {
    winnerTeamId = null;
    margin = "tied";
  }

  const manOfTheMatch = pickMOM(inn1, inn2, teamA, teamB);

  return {
    config: cfg,
    innings: [inn1, inn2],
    winnerTeamId,
    margin,
    manOfTheMatch,
    events,
  };
}

function pickMOM(
  inn1: InningsResult,
  inn2: InningsResult,
  teamA: TeamMatchInput,
  teamB: TeamMatchInput,
): { playerId: string; name: string; teamId: string } {
  type Cand = { playerId: string; name: string; teamId: string; score: number };
  const cands: Cand[] = [];
  const teamOf = (battingTeamId: string) =>
    battingTeamId === teamA.teamId ? teamA.teamId : teamB.teamId;

  for (const inn of [inn1, inn2]) {
    for (const b of inn.batting) {
      cands.push({
        playerId: b.playerId,
        name: b.name,
        teamId: teamOf(inn.battingTeamId),
        score: b.runs * 1 + b.fours * 1 + b.sixes * 2,
      });
    }
    for (const bw of inn.bowling) {
      cands.push({
        playerId: bw.playerId,
        name: bw.name,
        teamId: inn.bowlingTeamId,
        score: bw.wickets * 22 - bw.runsConceded * 0.4,
      });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const top = cands[0];
  if (!top) {
    return { playerId: "", name: "—", teamId: teamA.teamId };
  }
  return { playerId: top.playerId, name: top.name, teamId: top.teamId };
}
