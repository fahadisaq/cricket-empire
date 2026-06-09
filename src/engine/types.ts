/**
 * Core domain types for the cricket engine.
 *
 * Skills are stored on a continuous 0..100 scale (more granular than the
 * original game's discrete "Hopeless..Superb" tiers, which we still expose for
 * display via skillTier()). Everything the match engine needs lives here with
 * zero dependencies on UI or persistence.
 */

export type BowlerType = "seam" | "spin";
export type BattingHand = "RHB" | "LHB";

/** Broad role used for lineup/AI heuristics and youth generation. */
export type PlayerRole =
  | "batsman"
  | "bowler"
  | "allrounder"
  | "wicketkeeper";

/**
 * Raw player skills, each 0..100.
 * Mirrors the original game's attribute set but continuous and explicit.
 */
export interface PlayerSkills {
  batVsSeam: number; // batting vs seam bowlers
  batVsSpin: number; // batting vs spin bowlers
  bowlMain: number; // primary bowling skill
  bowlVariation: number; // variations (weighted higher than main in ability)
  fielding: number;
  wicketkeeping: number;
}

/** Lifetime career stats, accumulated every match the player appears in. */
export interface CareerStats {
  matches: number;
  inningsBatted: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  highScore: number;
  notOuts: number;
  oversBowled: number; // stored as balls/6 (decimal allowed)
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number; // runs conceded in the best-wickets spell
  catches: number;
  manOfTheMatch: number;
  titlesWon: number;
}

export function emptyCareer(): CareerStats {
  return {
    matches: 0, inningsBatted: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0,
    fifties: 0, hundreds: 0, highScore: 0, notOuts: 0, oversBowled: 0,
    ballsBowled: 0, runsConceded: 0, wickets: 0, bestBowlingWickets: 0,
    bestBowlingRuns: 0, catches: 0, manOfTheMatch: 0, titlesWon: 0,
  };
}

export interface Player {
  id: string;
  name: string;
  age: number; // years
  role: PlayerRole;
  battingHand: BattingHand;
  bowlerType: BowlerType; // relevant when the player bowls
  skills: PlayerSkills;

  /** Dynamic, fluctuating attributes (0..100). */
  fitness: number;
  form: number; // mean-reverting weekly
  experience: number; // grows with matches; captain gains faster

  /** Hidden ceiling that caps growth from training (0..100). */
  potential: number;

  /** Weekly wage in currency units (derived from skills). */
  salary: number;

  /** Lifetime career record (optional for back-compat; created on first match). */
  career?: CareerStats;
  /** Debut week, for "years active" display. */
  debutWeek?: number;
}

export type PitchType = "sporting" | "crumbling" | "green" | "flat";

export interface Pitch {
  type: PitchType;
}

/** A team's selected XI plus tactical orders for a single match. */
export interface MatchOrders {
  /** 11 player ids, in batting order (index 0 opens). */
  battingOrder: string[];
  /**
   * Bowler ids allowed to bowl, with a soft preference order.
   * Engine enforces max 4 overs/bowler over 20 overs.
   */
  bowlingOrder: string[];
  /** Designated keeper id (must be in the XI). */
  keeperId: string;
  /** Captain id (gets experience bonus, improves fielding/field-sets). */
  captainId: string;
  /** Powerplay window: 5 consecutive overs of forced aggression (0-based start over). */
  powerplayStartOver: number;
  /**
   * Aim-For-Target: when batting first, pace the innings toward this score.
   * undefined = bat naturally.
   */
  aimForTarget?: number;
}

export interface TeamMatchInput {
  teamId: string;
  teamName: string;
  players: Player[]; // full squad; engine selects from orders
  orders: MatchOrders;
}

export interface MatchConfig {
  oversPerInnings: number; // 20 for T20
  maxOversPerBowler: number; // 4 for T20
  pitch: Pitch;
  seed: number;
}

/* ----------------------------- Match results ---------------------------- */

export type BallOutcome = 0 | 1 | 2 | 3 | 4 | 6 | "W";

export interface BallEvent {
  inning: 1 | 2;
  over: number; // 0-based
  ballInOver: number; // 1..6 (legal balls only; we ignore extras for now)
  strikerId: string;
  bowlerId: string;
  outcome: BallOutcome;
  runsThisBall: number;
  wicketType?: "bowled" | "caught" | "caughtBehind" | "runOut" | "lbw" | "stumped";
  commentary: string;
  // Running state snapshot after this ball:
  teamScore: number;
  teamWickets: number;
}

export interface BatterScorecard {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal?: string;
}

export interface BowlerScorecard {
  playerId: string;
  name: string;
  overs: number; // legal balls / 6
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
}

export interface InningsResult {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  balls: number;
  batting: BatterScorecard[];
  bowling: BowlerScorecard[];
}

export interface MatchResult {
  config: MatchConfig;
  innings: [InningsResult, InningsResult];
  winnerTeamId: string | null; // null = tie
  margin: string; // human readable, e.g. "by 18 runs" / "by 5 wickets"
  manOfTheMatch: { playerId: string; name: string; teamId: string };
  events: BallEvent[];
}
